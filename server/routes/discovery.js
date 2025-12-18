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

            return {
                id: user._id.toString(),
                userId: user._id.toString(),
                name: user.name || 'Unknown',
                age,
                bio: user.bio || '',
                videoUrl: user.videos && user.videos.length > 0 ? user.videos[0] : null,
                thumbnail: user.photos && user.photos.length > 0 ? user.photos[0] : null,
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

        // Find potential partners - sorted consistently so all users see same feed
        const potentialPartners = await User.find(query)
            .limit(limit)
            .sort({ createdAt: 1 }) // Sort by creation date for consistency
            .select('name dob gender bio photos videos interests')
            .lean();

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

