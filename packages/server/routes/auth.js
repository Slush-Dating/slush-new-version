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

/**
 * @swagger
 * /api/auth/health/ffmpeg:
 *   get:
 *     summary: Check FFmpeg availability
 *     tags: [Auth]
 *     description: Health check endpoint to verify if FFmpeg is available for video processing
 *     responses:
 *       200:
 *         description: FFmpeg status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ffmpeg:
 *                   type: object
 *                   properties:
 *                     available:
 *                       type: boolean
 *                     version:
 *                       type: string
 */
router.get('/health/ffmpeg', async (req, res) => {
    try {
        const isAvailable = await videoProcessor.checkFfmpegAvailable();
        res.json({
            ffmpeg: {
                available: isAvailable,
                version: isAvailable ? 'installed' : 'not installed'
            }
        });
    } catch (error) {
        res.status(500).json({
            ffmpeg: {
                available: false,
                error: error.message
            }
        });
    }
});
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
    limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB limit (server handles auto-cropping to 30s)
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

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     description: Create a new user account. Returns JWT token and user data.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: password123
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: User already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     description: Authenticate user and receive JWT token. Token expires in 7 days.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/login', async (req, res) => {
    try {
        console.log('🔐 Login attempt for email:', req.body.email);

        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            console.log('❌ Missing email or password');
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            console.log('❌ User not found:', email);
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log('❌ Password mismatch for user:', email);
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        console.log('✅ Password verified for user:', email, '- generating token');

        // Ensure JWT_SECRET is available
        if (!JWT_SECRET) {
            console.error('❌ JWT_SECRET not configured');
            return res.status(500).json({ message: 'Server configuration error' });
        }

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

        console.log('✅ Token generated successfully for user:', email);

        res.json({
            token,
            user: {
                id: user._id,
                email: user.email,
                onboardingCompleted: user.onboardingCompleted,
                isPremium: user.isPremium
            }
        });
    } catch (err) {
        console.error('❌ Login server error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

/**
 * @swagger
 * /api/auth/onboarding:
 *   put:
 *     summary: Update user onboarding data
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     description: Update user profile during onboarding. Set finalStep=true to mark onboarding as completed.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               dob:
 *                 type: string
 *                 format: date
 *               gender:
 *                 type: string
 *                 enum: [man, woman, non-binary, other]
 *               interestedIn:
 *                 type: string
 *                 enum: [men, women, everyone]
 *               bio:
 *                 type: string
 *               interests:
 *                 type: array
 *                 items:
 *                   type: string
 *               photos:
 *                 type: array
 *                 items:
 *                   type: string
 *               videos:
 *                 type: array
 *                 items:
 *                   type: string
 *               finalStep:
 *                 type: boolean
 *                 description: Set to true to mark onboarding as completed
 *     responses:
 *       200:
 *         description: Onboarding updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - No token provided
 */
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

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Get current user's profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     description: Retrieve the authenticated user's profile information
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - No token provided
 *       404:
 *         description: User not found
 */
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

/**
 * @swagger
 * /api/auth/profile/{userId}:
 *   get:
 *     summary: Get another user's profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     description: View another user's public profile. Cannot view your own profile (use /profile instead).
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID to view
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Cannot view your own profile through this endpoint
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
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

/**
 * @swagger
 * /api/auth/upload:
 *   post:
 *     summary: Upload image or video file
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     description: Upload and process image or video files. Images are compressed and resized. Videos are compressed and thumbnails are generated (if FFmpeg is available).
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Image (JPEG, PNG, WebP) or Video (MP4, MOV). Max 2GB (videos auto-cropped to 30s).
 *     responses:
 *       200:
 *         description: File uploaded and processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   description: URL to the processed file
 *                 thumbnailUrl:
 *                   type: string
 *                   description: URL to thumbnail (for videos)
 *                 mediumUrl:
 *                   type: string
 *                   description: Medium size URL (for images)
 *                 originalUrl:
 *                   type: string
 *                 type:
 *                   type: string
 *                   enum: [image, video]
 *                 duration:
 *                   type: number
 *                   description: Video duration in seconds
 *                 width:
 *                   type: number
 *                 height:
 *                   type: number
 *                 compressionRatio:
 *                   type: number
 *                   description: Compression percentage
 *       400:
 *         description: Invalid file or file too large
 *       401:
 *         description: Unauthorized
 */
router.post('/upload', (req, res) => {
    console.log('[Upload] Received upload request');

    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn('[Upload] Auth header missing or malformed');
        return res.status(401).json({ message: 'Authorization header missing or malformed' });
    }

    const token = authHeader.split(' ')[1];
    try {
        jwt.verify(token, JWT_SECRET);
    } catch (err) {
        console.warn('[Upload] Invalid token');
        return res.status(401).json({ message: 'Invalid or expired token' });
    }

    // Handle file upload with proper error handling
    upload.single('file')(req, res, async (err) => {
        if (err) {
            console.error('[Upload] Multer error:', err.message);
            // Handle multer errors
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ message: 'File size exceeds 2GB limit. Please choose a smaller file.' });
                }
                return res.status(400).json({ message: err.message });
            }
            // Handle other errors (like fileFilter errors)
            return res.status(400).json({ message: err.message || 'File upload failed' });
        }

        if (!req.file) {
            console.error('[Upload] No file in request. Content-Type:', req.headers['content-type']);
            return res.status(400).json({
                message: 'No file uploaded',
                hint: 'Ensure Content-Type is multipart/form-data with correct boundary. Do not manually set the Content-Type header when using FormData.'
            });
        }

        console.log('[Upload] File received:', {
            filename: req.file.filename,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: `${Math.round(req.file.size / 1024 / 1024)}MB`
        });

        const filePath = req.file.path;
        const mimeType = req.file.mimetype;
        const isVideo = mimeType.startsWith('video/');
        const isImage = mimeType.startsWith('image/');

        try {
            let result;

            if (isVideo) {
                // Check if FFmpeg is available before processing
                const ffmpegAvailable = await videoProcessor.checkFfmpegAvailable();
                console.log(`[Upload] FFmpeg available: ${ffmpegAvailable}`);

                let processed = null;
                let processingError = null;

                if (ffmpegAvailable) {
                    try {
                        // Process video: compress, generate thumbnail, extract metadata
                        console.log(`[Upload] Processing video: ${req.file.filename}`);
                        processed = await videoProcessor.processVideo(filePath, {
                            generateQualities: false, // Skip quality variants for faster upload
                            maxDuration: 30 // Crop videos to 30 seconds maximum
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
                    } catch (videoError) {
                        console.error('[Upload] Video processing failed:', videoError);
                        processingError = videoError.message;
                        // Continue to fallback handling below
                    }
                } else {
                    console.warn('[Upload] FFmpeg not available, skipping video processing');
                }

                // If processing failed or FFmpeg not available, use fallback
                if (!processed) {
                    console.log('[Upload] Using fallback: returning original video file');
                    result = {
                        url: `/uploads/${req.file.filename}`,
                        type: 'video',
                        fallback: true,
                        processingError: processingError || 'FFmpeg not available - using original file',
                        note: 'Video uploaded successfully but not processed. May be larger than optimized videos.'
                    };
                }

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
            console.error('[Upload] Unexpected processing error:', processingError);
            console.error('[Upload] Error details:', {
                message: processingError.message,
                stack: processingError.stack,
                file: req.file.filename,
                mimeType: mimeType,
                fileSize: req.file.size
            });

            // For unexpected errors, still try to return the original file
            res.json({
                url: `/uploads/${req.file.filename}`,
                type: isVideo ? 'video' : isImage ? 'image' : 'unknown',
                processingError: 'Unexpected processing error - using original file',
                errorType: 'processing_error',
                fallback: true
            });
        }
    });
});

/**
 * @swagger
 * /api/auth/admin/login:
 *   post:
 *     summary: Admin login
 *     tags: [Auth]
 *     description: Login for admin users. Requires admin privileges.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Admin login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     isAdmin:
 *                       type: boolean
 *       400:
 *         description: Invalid credentials
 *       403:
 *         description: Access denied - Admin privileges required
 */
router.post('/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Check if user is an admin
        if (!user.isAdmin) {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Create admin token with admin flag
        const token = jwt.sign({ userId: user._id, isAdmin: true }, JWT_SECRET, { expiresIn: '24h' });
        res.json({
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                isAdmin: true
            }
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

/**
 * @swagger
 * /api/auth/upgrade-mock:
 *   post:
 *     summary: Mock premium upgrade (for testing)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     description: Upgrade user to premium status. This is a mock endpoint for testing purposes.
 *     responses:
 *       200:
 *         description: Upgraded to premium successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
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
