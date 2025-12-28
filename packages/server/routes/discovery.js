import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
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

/**
 * @swagger
 * /api/discovery/feed:
 *   get:
 *     summary: Get discovery feed
 *     tags: [Discovery]
 *     security:
 *       - bearerAuth: []
 *     description: Get potential matches for the discovery feed. Excludes already matched users and admin users.
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Maximum number of profiles to return
 *     responses:
 *       200:
 *         description: List of potential matches
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   userId:
 *                     type: string
 *                   name:
 *                     type: string
 *                   age:
 *                     type: number
 *                   bio:
 *                     type: string
 *                   videoUrl:
 *                     type: string
 *                   thumbnail:
 *                     type: string
 *                   distance:
 *                     type: string
 *                   locationString:
 *                     type: string
 *                   photos:
 *                     type: array
 *                   interests:
 *                     type: array
 */
router.get('/feed', authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const limit = parseInt(req.query.limit) || 20;

        // Get current user
        const currentUser = await User.findById(userId);
        if (!currentUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get users to exclude: matched users, recently passed users (14 days), and already liked users
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const excludedMatches = await Match.find({
            $or: [{ user1: userId }, { user2: userId }],
            $or: [
                { isMatch: true }, // Already matched
                {
                    actions: {
                        $elemMatch: {
                            fromUser: userId,
                            action: 'pass',
                            createdAt: { $gte: fourteenDaysAgo }
                        }
                    }
                },
                {
                    actions: {
                        $elemMatch: {
                            fromUser: userId,
                            action: { $in: ['like', 'super_like'] }
                        }
                    }
                }
            ]
        }).select('user1 user2').lean();

        const excludedUserIds = [userId.toString()];

        // Exclude these users from discovery feed
        excludedMatches.forEach(match => {
            const otherUserId = match.user1.toString() === userId.toString()
                ? match.user2.toString()
                : match.user1.toString();
            excludedUserIds.push(otherUserId);
        });

        // Build query - exclude current user and matched users
        // Always exclude admin users from discovery feed (admin users are for backend panel only)
        const query = {
            _id: { $nin: excludedUserIds.map(id => new mongoose.Types.ObjectId(id)) },
            onboardingCompleted: true,
            $and: [
                { isAdmin: { $ne: true } },
                { email: { $not: { $regex: /admin/i } } },
                { name: { $not: { $regex: /admin/i } } }
            ]
        };

        // Debug: Log query details
        const totalUsers = await User.countDocuments({});
        const excludedCount = excludedUserIds.length;
        console.log(`[Discovery Feed] User ${userId} - Total users: ${totalUsers}, Excluded: ${excludedCount}`);

        // Find potential matches - sorted consistently so all users see same feed
        const potentialMatches = await User.find(query)
            .limit(limit)
            .sort({ createdAt: 1 }) // Sort by creation date for consistency
            .select('name dob gender bio photos videos interests location isAdmin email')
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

            // Get location string from user data
            let locationString = 'Location not set';
            if (user.location) {
                if (user.location.locationString) {
                    locationString = user.location.locationString;
                } else if (user.location.city) {
                    const parts = [user.location.city];
                    if (user.location.state) parts.push(user.location.state);
                    if (user.location.country) parts.push(user.location.country);
                    locationString = parts.join(', ');
                }
            }
            const distance = 'Nearby'; // TODO: Calculate actual distance when both users have location

            // Get video URL - prefer compressed version if available
            let videoUrl = null;
            let videoThumbnail = null;

            if (user.videos && user.videos.length > 0) {
                const originalVideo = user.videos[0]; // e.g., "/uploads/file-123.mp4"
                const filename = path.basename(originalVideo);
                const baseName = path.parse(filename).name;

                // Construct potential paths
                const compressedRelPath = `/uploads/videos/compressed/${baseName}_compressed.mp4`;
                const thumbnailRelPath = `/uploads/videos/thumbnails/${baseName}_thumb.jpg`;

                // Absolute paths for disk check
                const uploadsDir = path.join(__dirname, '..');
                const compressedAbsPath = path.join(uploadsDir, 'uploads', 'videos', 'compressed', `${baseName}_compressed.mp4`);
                const thumbnailAbsPath = path.join(uploadsDir, 'uploads', 'videos', 'thumbnails', `${baseName}_thumb.jpg`);

                // Check if compressed version exists on disk
                if (fs.existsSync(compressedAbsPath)) {
                    videoUrl = compressedRelPath;
                } else {
                    // Fallback to original
                    videoUrl = originalVideo;
                }

                // Check if thumbnail exists
                if (fs.existsSync(thumbnailAbsPath)) {
                    videoThumbnail = thumbnailRelPath;
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
                interests: user.interests || [],
                isAdmin: user.isAdmin || false
            };
        });

        res.json(formattedMatches);
    } catch (err) {
        console.error('Discovery feed error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

/**
 * @swagger
 * /api/discovery/event-partners:
 *   get:
 *     summary: Get potential partners for an event
 *     tags: [Discovery]
 *     security:
 *       - bearerAuth: []
 *     description: Get potential partners for a specific event, filtered by event type and user preferences.
 *     parameters:
 *       - in: query
 *         name: eventId
 *         schema:
 *           type: string
 *         description: Event ID to find partners for
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of partners to return
 *     responses:
 *       200:
 *         description: List of potential event partners
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   userId:
 *                     type: string
 *                   name:
 *                     type: string
 *                   age:
 *                     type: number
 *                   bio:
 *                     type: string
 *                   imageUrl:
 *                     type: string
 *                   videoUrl:
 *                     type: string
 *                   thumbnail:
 *                     type: string
 *                   locationString:
 *                     type: string
 *                   photos:
 *                     type: array
 *                   interests:
 *                     type: array
 */
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

        // Get users to exclude: matched users, recently passed users (14 days), and already liked users
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const excludedMatches = await Match.find({
            $or: [{ user1: userId }, { user2: userId }],
            $or: [
                { isMatch: true }, // Already matched
                {
                    actions: {
                        $elemMatch: {
                            fromUser: userId,
                            action: 'pass',
                            createdAt: { $gte: fourteenDaysAgo }
                        }
                    }
                },
                {
                    actions: {
                        $elemMatch: {
                            fromUser: userId,
                            action: { $in: ['like', 'super_like'] }
                        }
                    }
                }
            ]
        }).select('user1 user2').lean();

        const excludedUserIds = [userId.toString()];

        // Exclude these users from discovery feed
        excludedMatches.forEach(match => {
            const otherUserId = match.user1.toString() === userId.toString()
                ? match.user2.toString()
                : match.user1.toString();
            excludedUserIds.push(otherUserId);
        });

        // Build base query
        // Always exclude admin users from discovery feed (admin users are for backend panel only)
        const query = {
            _id: { $nin: excludedUserIds.map(id => new mongoose.Types.ObjectId(id)) },
            onboardingCompleted: true,
            $and: [
                { isAdmin: { $ne: true } },
                { email: { $not: { $regex: /admin/i } } },
                { name: { $not: { $regex: /admin/i } } }
            ]
        };

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

            // Get location string from user data
            let locationString = 'Location not set';
            if (user.location) {
                if (user.location.locationString) {
                    locationString = user.location.locationString;
                } else if (user.location.city) {
                    const parts = [user.location.city];
                    if (user.location.state) parts.push(user.location.state);
                    if (user.location.country) parts.push(user.location.country);
                    locationString = parts.join(', ');
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
                locationString: locationString,
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

