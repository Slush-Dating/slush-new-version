import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Match from '../models/Match.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to verify authentication
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

// GET /api/discovery/feed - Get discovery feed (potential matches)
router.get('/feed', authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const limit = parseInt(req.query.limit) || 20;

        // Get current user
        const currentUser = await User.findById(userId);
        if (!currentUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get all users the current user has matched with
        // Exclude matched users (they should appear in matches, not discovery)
        const userMatches = await Match.find({
            $or: [{ user1: userId }, { user2: userId }],
            isMatch: true
        }).select('user1 user2').lean();

        const excludedUserIds = [userId.toString()];

        // Exclude matched users from discovery feed
        userMatches.forEach(match => {
            const otherUserId = match.user1.toString() === userId.toString()
                ? match.user2.toString()
                : match.user1.toString();
            excludedUserIds.push(otherUserId);
        });

        // Build query - exclude current user and matched users
        const query = {
            _id: { $nin: excludedUserIds.map(id => new mongoose.Types.ObjectId(id)) },
            onboardingCompleted: true
        };

        // Always exclude admin users from discovery feed (admin users are for authentication only)
        query.isAdmin = { $ne: true };

        // Debug: Log query details
        const totalUsers = await User.countDocuments({});
        const excludedCount = excludedUserIds.length;
        console.log(`[Discovery Feed] User ${userId} - Total users: ${totalUsers}, Excluded: ${excludedCount}`);

        // Find potential matches - sorted consistently so all users see same feed
        const potentialMatches = await User.find(query)
            .limit(limit)
            .sort({ createdAt: 1 }) // Sort by creation date for consistency
            .select('name dob gender bio photos videos interests location')
            .lean();

        console.log(`[Discovery Feed] User ${userId} - Returning ${potentialMatches.length} profiles`);

        // Calculate age and format response
        const formattedMatches = potentialMatches.map(user => {
            let age = null;
            if (user.dob) {
                const today = new Date();
                const birthDate = new Date(user.dob);
                age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
            }

            // All users are in Sheffield for testing
            const distance = 'Nearby';
            const locationString = 'Sheffield, UK';

            // Get video URL - prefer compressed version if available
            let videoUrl = null;
            let videoThumbnail = null;
            if (user.videos && user.videos.length > 0) {
                const originalVideo = user.videos[0];
                // Check if compressed version exists
                if (originalVideo.includes('/uploads/')) {
                    videoUrl = originalVideo.replace('/uploads/', '/uploads/videos/compressed/').replace(/\.[^.]+$/, '_compressed.mp4');
                    videoThumbnail = originalVideo.replace('/uploads/', '/uploads/videos/thumbnails/').replace(/\.[^.]+$/, '_thumb.jpg');
                } else {
                    videoUrl = originalVideo;
                }
            }

            // Fallback thumbnail to first photo if no video thumbnail
            const thumbnail = videoThumbnail || (user.photos && user.photos.length > 0 ? user.photos[0] : null);

            return {
                id: user._id.toString(),
                userId: user._id.toString(),
                name: user.name || 'Unknown',
                age,
                bio: user.bio || '',
                videoUrl: videoUrl,
                videoUrlOriginal: user.videos && user.videos.length > 0 ? user.videos[0] : null,
                thumbnail: thumbnail,
                distance,
                locationString,
                photos: user.photos || [],
                interests: user.interests || []
            };
        });

        res.json(formattedMatches);
    } catch (err) {
        console.error('Discovery feed error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET /api/discovery/event-partners - Get potential partners for an event
router.get('/event-partners', authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const eventId = req.query.eventId;
        const limit = parseInt(req.query.limit) || 10;

        // Get current user
        const currentUser = await User.findById(userId);
        if (!currentUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const currentUserGender = currentUser.gender || 'other';
        const currentUserInterest = currentUser.interestedIn || 'everyone';

        // Get event if eventId provided to check type
        let event = null;
        let eventType = 'bisexual'; // Default to bisexual (everyone matches)

        if (eventId) {
            const Event = (await import('../models/Event.js')).default;
            event = await Event.findById(eventId);
            if (event) {
                eventType = event.eventType || 'straight';
            }
        }

        // Get all users the current user has matched with
        const userMatches = await Match.find({
            $or: [{ user1: userId }, { user2: userId }],
            isMatch: true
        }).select('user1 user2').lean();

        const excludedUserIds = [userId.toString()];

        // Exclude matched users from discovery feed
        userMatches.forEach(match => {
            const otherUserId = match.user1.toString() === userId.toString()
                ? match.user2.toString()
                : match.user1.toString();
            excludedUserIds.push(otherUserId);
        });

        // Build base query
        const query = {
            _id: { $nin: excludedUserIds.map(id => new mongoose.Types.ObjectId(id)) },
            onboardingCompleted: true
        };

        // Always exclude admin users from discovery feed (admin users are for authentication only)
        query.isAdmin = { $ne: true };

        // Apply gender filtering based on event type
        if (eventType === 'straight') {
            // Straight events: match opposite gender
            if (currentUserGender === 'man') {
                query.gender = 'woman';
            } else if (currentUserGender === 'woman') {
                query.gender = 'man';
            } else {
                // Non-binary: can match with either men or women
                query.gender = { $in: ['man', 'woman'] };
            }
        } else if (eventType === 'gay') {
            // Gay events: match same gender
            if (currentUserGender === 'man') {
                query.gender = 'man';
            } else if (currentUserGender === 'woman') {
                query.gender = 'woman';
            } else {
                // Non-binary: match with other non-binary
                query.gender = { $in: ['non-binary', 'other'] };
            }
        }
        // For bisexual events, no gender filter - match with everyone

        // Additionally filter by user's interestedIn preference
        if (currentUserInterest === 'men') {
            // Only interested in men
            if (query.gender) {
                // If eventType already set a gender filter, intersect it
                const existingGender = query.gender;
                if (typeof existingGender === 'string') {
                    if (existingGender !== 'man') {
                        // Conflict: event wants opposite but user wants men
                        query.gender = 'man';
                    }
                } else if (existingGender.$in) {
                    query.gender = { $in: existingGender.$in.filter(g => g === 'man') };
                }
            } else {
                query.gender = 'man';
            }
        } else if (currentUserInterest === 'women') {
            // Only interested in women
            if (query.gender) {
                const existingGender = query.gender;
                if (typeof existingGender === 'string') {
                    if (existingGender !== 'woman') {
                        query.gender = 'woman';
                    }
                } else if (existingGender.$in) {
                    query.gender = { $in: existingGender.$in.filter(g => g === 'woman') };
                }
            } else {
                query.gender = 'woman';
            }
        }
        // If interestedIn is 'everyone', no additional filter

        console.log(`[Event Partners] User ${userId}, Gender: ${currentUserGender}, EventType: ${eventType}, Query:`, query);

        // Find potential partners - sorted consistently
        const potentialPartners = await User.find(query)
            .limit(limit)
            .sort({ createdAt: 1 })
            .select('name dob gender bio photos videos interests')
            .lean();

        console.log(`[Event Partners] Found ${potentialPartners.length} partners`);

        // Format response
        const formattedPartners = potentialPartners.map(user => {
            let age = null;
            if (user.dob) {
                const today = new Date();
                const birthDate = new Date(user.dob);
                age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
            }

            return {
                id: user._id.toString(),
                userId: user._id.toString(),
                name: user.name || 'Unknown',
                age,
                bio: user.bio || '',
                imageUrl: user.photos && user.photos.length > 0 ? user.photos[0] : null,
                videoUrl: user.videos && user.videos.length > 0 ? user.videos[0] : null,
                thumbnail: user.photos && user.photos.length > 0 ? user.photos[0] : null,
                locationString: 'Sheffield, UK',
                photos: user.photos || [],
                interests: user.interests || []
            };
        });

        res.json(formattedPartners);
    } catch (err) {
        console.error('Event partners error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});


export default router;

