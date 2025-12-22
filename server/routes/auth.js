import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Match from '../models/Match.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import videoProcessor from '../utils/videoProcessor.js';
import imageProcessor from '../utils/imageProcessor.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Default Placeholders
const DEFAULT_PLACEHOLDERS = [
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80",
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&q=80",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80",
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&q=80",
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80"
];

// Configure Multer for File Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const validVideoTypes = ['video/mp4', 'video/quicktime', 'video/mov'];
        const validMimeTypes = [...validImageTypes, ...validVideoTypes];

        const extname = path.extname(file.originalname).toLowerCase();
        const validExtensions = ['.jpeg', '.jpg', '.png', '.webp', '.mp4', '.mov'];

        // Check both mimetype and extension for better compatibility
        const isValidMimeType = validMimeTypes.includes(file.mimetype);
        const isValidExtension = validExtensions.includes(extname);

        if (isValidMimeType || isValidExtension) {
            return cb(null, true);
        } else {
            cb(new Error('Only images (JPEG, PNG, WebP) and videos (MP4, MOV) are allowed!'));
        }
    }
});

// Register
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const user = new User({
            email,
            password: hashedPassword
        });

        await user.save();

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ token, user: { id: user._id, email: user.email, onboardingCompleted: user.onboardingCompleted, isPremium: user.isPremium } });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user._id, email: user.email, onboardingCompleted: user.onboardingCompleted, isPremium: user.isPremium } });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Update Onboarding
router.put('/onboarding', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.userId;

        const updates = req.body;
        // Mark onboarding as completed if it's the final update
        if (updates.finalStep) {
            updates.onboardingCompleted = true;
            delete updates.finalStep;
        }

        const user = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true });

        // Add locationString
        const userObj = {
            id: user._id,
            email: user.email,
            onboardingCompleted: user.onboardingCompleted,
            name: user.name,
            dob: user.dob,
            gender: user.gender,
            interestedIn: user.interestedIn,
            bio: user.bio,
            interests: user.interests,
            photos: user.photos,
            videos: user.videos,
            interests: user.interests,
            photos: user.photos,
            videos: user.videos,
            locationString: 'Sheffield, UK',
            isPremium: user.isPremium
        };

        res.json({ user: userObj });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Get Profile
router.get('/profile', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Convert location coordinates to readable string
        const userObj = user.toObject();
        if (userObj.location && userObj.location.coordinates) {
            // Check if coordinates match Sheffield (for now, all users are in Sheffield)
            const [lon, lat] = userObj.location.coordinates;
            if (Math.abs(lon - (-1.4701)) < 0.01 && Math.abs(lat - 53.3811) < 0.01) {
                userObj.locationString = 'Sheffield, UK';
            } else {
                userObj.locationString = 'Sheffield, UK'; // Default for testing
            }
        } else {
            userObj.locationString = 'Sheffield, UK';
        }

        // If no media, provide defaults
        if ((!userObj.photos || userObj.photos.length === 0) && (!userObj.videos || userObj.videos.length === 0)) {
            userObj.photos = DEFAULT_PLACEHOLDERS;
            userObj.videos = [];
        }

        res.json(userObj);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Get another user's profile (anyone can view profiles)
router.get('/profile/:userId', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const currentUserId = decoded.userId;
        const { userId } = req.params;

        // Validate userId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid user ID format' });
        }

        // Prevent users from viewing their own profile through this endpoint
        if (currentUserId === userId) {
            return res.status(400).json({ message: 'Use /profile endpoint to view your own profile' });
        }

        const user = await User.findById(userId).select('-password -email');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Convert location coordinates to readable string
        const userObj = user.toObject();
        if (userObj.location && userObj.location.coordinates) {
            const [lon, lat] = userObj.location.coordinates;
            if (Math.abs(lon - (-1.4701)) < 0.01 && Math.abs(lat - 53.3811) < 0.01) {
                userObj.locationString = 'Sheffield, UK';
            } else {
                userObj.locationString = 'Sheffield, UK';
            }
        } else {
            userObj.locationString = 'Sheffield, UK';
        }

        // If no media, provide defaults
        if ((!userObj.photos || userObj.photos.length === 0) && (!userObj.videos || userObj.videos.length === 0)) {
            userObj.photos = DEFAULT_PLACEHOLDERS;
            userObj.videos = [];
        }

        res.json(userObj);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Upload File with Processing
router.post('/upload', (req, res) => {
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }

    // Handle file upload with proper error handling
    upload.single('file')(req, res, async (err) => {
        if (err) {
            // Handle multer errors
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ message: 'File size exceeds 50MB limit' });
                }
                return res.status(400).json({ message: err.message });
            }
            // Handle other errors (like fileFilter errors)
            return res.status(400).json({ message: err.message || 'File upload failed' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const filePath = req.file.path;
        const mimeType = req.file.mimetype;
        const isVideo = mimeType.startsWith('video/');
        const isImage = mimeType.startsWith('image/');

        try {
            let result;

            if (isVideo) {
                // Process video: compress, generate thumbnail, extract metadata
                console.log(`[Upload] Processing video: ${req.file.filename}`);
                const processed = await videoProcessor.processVideo(filePath, {
                    generateQualities: false // Skip quality variants for faster upload
                });

                result = {
                    url: processed.compressed.url,
                    thumbnailUrl: processed.thumbnail.url,
                    originalUrl: processed.original.url,
                    duration: processed.metadata.duration,
                    width: processed.metadata.width,
                    height: processed.metadata.height,
                    compressionRatio: processed.metadata.compressionRatio,
                    type: 'video'
                };

                console.log(`[Upload] Video processed: ${processed.metadata.compressionRatio}% compression`);

            } else if (isImage) {
                // Process image: compress, create variants
                console.log(`[Upload] Processing image: ${req.file.filename}`);
                const processed = await imageProcessor.processImage(filePath, {
                    sizes: ['thumbnail', 'medium', 'full']
                });

                result = {
                    url: processed.fullUrl || processed.original.url,
                    thumbnailUrl: processed.thumbnailUrl,
                    mediumUrl: processed.mediumUrl,
                    originalUrl: processed.original.url,
                    width: processed.metadata.width,
                    height: processed.metadata.height,
                    type: 'image',
                    variants: processed.variants
                };

                console.log(`[Upload] Image processed with ${Object.keys(processed.variants).length} variants`);

            } else {
                // Unknown type, return original
                result = {
                    url: `/uploads/${req.file.filename}`,
                    type: 'unknown'
                };
            }

            res.json(result);

        } catch (processingError) {
            console.error('[Upload] Processing error:', processingError);

            // Fall back to returning original file if processing fails
            res.json({
                url: `/uploads/${req.file.filename}`,
                type: isVideo ? 'video' : isImage ? 'image' : 'unknown',
                processingError: 'Media optimization failed, using original file'
            });
        }
    });
});

// Mock Upgrade to Premium
router.post('/upgrade-mock', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.userId;

        const user = await User.findByIdAndUpdate(userId, { isPremium: true }, { new: true }).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: 'Upgraded to Premium successfully', user });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

export default router;
