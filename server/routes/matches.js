import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import Match from '../models/Match.js';
import User from '../models/User.js';
import Message from '../models/Message.js';

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

// Helper function to get or create match document
const getOrCreateMatch = async (user1Id, user2Id) => {
    // Ensure user1 < user2 for consistency
    const [user1, user2] = user1Id.toString() < user2Id.toString()
        ? [user1Id, user2Id]
        : [user2Id, user1Id];

    let match = await Match.findOne({ user1, user2 });

    if (!match) {
        match = new Match({ user1, user2 });
        await match.save();
    }

    return match;
};

// POST /api/matches/action - Like, pass, or super like a user
router.post('/action', authenticate, async (req, res) => {
    try {
        const { toUserId, action, context, eventId } = req.body;
        const fromUserId = req.userId;

        if (!toUserId || !action || !context) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        if (!['like', 'pass', 'super_like'].includes(action)) {
            return res.status(400).json({ message: 'Invalid action' });
        }

        if (!['video_feed', 'live_event'].includes(context)) {
            return res.status(400).json({ message: 'Invalid context' });
        }

        if (fromUserId === toUserId) {
            return res.status(400).json({ message: 'Cannot perform action on yourself' });
        }

        // Verify both users exist
        const [fromUser, toUser] = await Promise.all([
            User.findById(fromUserId),
            User.findById(toUserId)
        ]);

        if (!fromUser || !toUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get or create match document
        const match = await getOrCreateMatch(fromUserId, toUserId);

        // Check if action already exists (prevent duplicates)
        const existingAction = match.actions.find(
            a => a.fromUser.toString() === fromUserId.toString() &&
                a.toUser.toString() === toUserId.toString()
        );

        if (existingAction) {
            // Update existing action
            existingAction.action = action;
            existingAction.context = context;
            existingAction.eventId = eventId || null;
            existingAction.createdAt = new Date();
        } else {
            // Add new action
            match.actions.push({
                fromUser: fromUserId,
                toUser: toUserId,
                action,
                context,
                eventId: eventId || null
            });
        }

        match.updatedAt = new Date();

        // Check if this creates a match
        const wasMatch = match.isMatch;
        const isNewMatch = match.checkAndCreateMatch();
        await match.save();

        // If it's a new match, populate user details for response
        let matchData = null;
        if (isNewMatch && !wasMatch) {
            await match.populate([
                { path: 'user1', select: 'name photos bio dob' },
                { path: 'user2', select: 'name photos bio dob' }
            ]);
            matchData = {
                matchId: match._id,
                user: match.user1._id.toString() === fromUserId.toString()
                    ? match.user2
                    : match.user1,
                matchedAt: match.matchedAt,
                context: match.matchContext
            };
        }

        res.json({
            success: true,
            action,
            isMatch: isNewMatch,
            match: matchData
        });
    } catch (err) {
        console.error('Match action error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET /api/matches - Get all matches for the authenticated user
router.get('/', authenticate, async (req, res) => {
    try {
        const userId = req.userId;

        const matches = await Match.find({
            $or: [{ user1: userId }, { user2: userId }],
            isMatch: true
        })
            .populate('user1', 'name photos bio dob gender')
            .populate('user2', 'name photos bio dob gender')
            .populate('eventId', 'name date location')
            .sort({ matchedAt: -1 });

        const formattedMatches = await Promise.all(matches.map(async match => {
            const user1Id = match.user1?._id || match.user1;
            const otherUser = user1Id && user1Id.toString() === userId.toString()
                ? match.user2
                : match.user1;

            if (!otherUser) return null;

            // Fetch last message for this match
            const lastMessage = await Message.findOne({ matchId: match._id })
                .sort({ createdAt: -1 })
                .select('content createdAt senderId')
                .lean();

            // Calculate age from dob
            let age = null;
            if (otherUser.dob) {
                const today = new Date();
                const birthDate = new Date(otherUser.dob);
                age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
            }

            return {
                id: match._id.toString(),
                userId: otherUser._id?.toString() || otherUser.toString(),
                name: otherUser.name || 'Unknown',
                age,
                imageUrl: otherUser.photos && otherUser.photos.length > 0
                    ? otherUser.photos[0]
                    : null,
                bio: otherUser.bio || '',
                matchedAt: match.matchedAt,
                context: match.matchContext,
                event: match.eventId ? {
                    name: match.eventId.name,
                    date: match.eventId.date,
                    location: match.eventId.location
                } : null,
                isNew: match.matchedAt &&
                    (Date.now() - new Date(match.matchedAt).getTime()) < 24 * 60 * 60 * 1000, // New if matched in last 24 hours
                lastMessage: lastMessage ? {
                    content: lastMessage.content,
                    createdAt: lastMessage.createdAt,
                    senderId: lastMessage.senderId.toString()
                } : null
            };
        }));

        const filteredMatches = formattedMatches.filter(m => m !== null);

        res.json(filteredMatches);
    } catch (err) {
        console.error('Get matches error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET /api/matches/liked-you - Get users who liked the current user but haven't matched yet
router.get('/liked-you', authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const userObjectId = new mongoose.Types.ObjectId(userId);

        // Find matches where current user is toUser and action is like/super_like, and it's not a match yet
        const likes = await Match.find({
            $or: [
                { user1: userObjectId, actions: { $elemMatch: { toUser: userObjectId, action: { $in: ['like', 'super_like'] } } } },
                { user2: userObjectId, actions: { $elemMatch: { toUser: userObjectId, action: { $in: ['like', 'super_like'] } } } }
            ],
            isMatch: false
        })
            .populate('user1', 'name photos bio dob gender')
            .populate('user2', 'name photos bio dob gender')
            .sort({ updatedAt: -1 });

        const likedByUsers = likes.filter(match => {
            if (!match.actions) return false;
            const currentUserAction = match.actions.find(a => a.fromUser && a.fromUser.toString() === userId.toString());
            return !currentUserAction || (currentUserAction.action !== 'pass');
        }).map(match => {
            const user1Id = match.user1?._id || match.user1;
            const otherUser = user1Id && user1Id.toString() === userId.toString()
                ? match.user2
                : match.user1;

            if (!otherUser) return null;

            // Calculate age from dob
            let age = null;
            if (otherUser.dob) {
                const today = new Date();
                const birthDate = new Date(otherUser.dob);
                age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
            }

            return {
                id: match._id.toString(),
                userId: otherUser._id?.toString() || otherUser.toString(),
                name: otherUser.name || 'Unknown',
                age,
                imageUrl: otherUser.photos && otherUser.photos.length > 0
                    ? otherUser.photos[0]
                    : null,
                bio: otherUser.bio || '',
                likedAt: match.updatedAt
            };
        }).filter(user => user !== null);

        res.json(likedByUsers);
    } catch (err) {
        console.error('Get liked-you error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET /api/matches/stats - Get match statistics
router.get('/stats', authenticate, async (req, res) => {
    try {
        const userId = req.userId;

        const [totalMatches, likesGiven, likesReceived] = await Promise.all([
            Match.countDocuments({
                $or: [{ user1: userId }, { user2: userId }],
                isMatch: true
            }),
            Match.countDocuments({
                $or: [{ user1: userId }, { user2: userId }]
            }).then(async (count) => {
                const matches = await Match.find({
                    $or: [{ user1: userId }, { user2: userId }]
                });
                return matches.reduce((acc, match) => {
                    return acc + match.actions.filter(
                        a => a.fromUser.toString() === userId.toString() &&
                            (a.action === 'like' || a.action === 'super_like')
                    ).length;
                }, 0);
            }),
            Match.countDocuments({
                $or: [{ user1: userId }, { user2: userId }]
            }).then(async (count) => {
                const matches = await Match.find({
                    $or: [{ user1: userId }, { user2: userId }]
                });
                return matches.reduce((acc, match) => {
                    return acc + match.actions.filter(
                        a => a.toUser.toString() === userId.toString() &&
                            (a.action === 'like' || a.action === 'super_like')
                    ).length;
                }, 0);
            })
        ]);

        res.json({
            totalMatches,
            likesGiven,
            likesReceived
        });
    } catch (err) {
        console.error('Get match stats error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// DELETE /api/matches/clear - Clear all match data (for testing)
router.delete('/clear', authenticate, async (req, res) => {
    try {
        const deletedCount = await Match.deleteMany({});
        res.json({
            success: true,
            message: `Cleared ${deletedCount.deletedCount} match documents`,
            deletedCount: deletedCount.deletedCount
        });
    } catch (err) {
        console.error('Clear matches error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET /api/matches/:matchId - Get a specific match
router.get('/:matchId', authenticate, async (req, res) => {
    try {
        const { matchId } = req.params;
        const userId = req.userId;

        const match = await Match.findOne({
            _id: matchId,
            $or: [{ user1: userId }, { user2: userId }]
        })
            .populate('user1', 'name photos bio dob gender')
            .populate('user2', 'name photos bio dob gender')
            .populate('eventId', 'name date location');

        if (!match) {
            return res.status(404).json({ message: 'Match not found' });
        }

        const otherUser = match.user1._id.toString() === userId.toString()
            ? match.user2
            : match.user1;

        let age = null;
        if (otherUser.dob) {
            const today = new Date();
            const birthDate = new Date(otherUser.dob);
            age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
        }

        res.json({
            id: match._id.toString(),
            userId: otherUser._id.toString(),
            name: otherUser.name || 'Unknown',
            age,
            imageUrl: otherUser.photos && otherUser.photos.length > 0
                ? otherUser.photos[0]
                : null,
            bio: otherUser.bio || '',
            matchedAt: match.matchedAt,
            context: match.matchContext,
            event: match.eventId ? {
                name: match.eventId.name,
                date: match.eventId.date,
                location: match.eventId.location
            } : null
        });
    } catch (err) {
        console.error('Get match error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// POST /api/matches/unmatch/:userId - Unmatch with a user
router.post('/unmatch/:userId', authenticate, async (req, res) => {
    try {
        const { userId: targetUserId } = req.params;
        const currentUserId = req.userId;

        if (currentUserId === targetUserId) {
            return res.status(400).json({ message: 'Cannot unmatch yourself' });
        }

        // Find the match document
        const match = await Match.findOne({
            $or: [
                { user1: currentUserId, user2: targetUserId },
                { user1: targetUserId, user2: currentUserId }
            ],
            isMatch: true
        });

        if (!match) {
            return res.status(404).json({ message: 'No match found with this user' });
        }

        // Remove the match by setting isMatch to false and clearing matchedAt
        match.isMatch = false;
        match.matchedAt = null;
        match.matchContext = null;
        match.eventId = null;
        await match.save();

        res.json({ success: true, message: 'Successfully unmatched' });
    } catch (err) {
        console.error('Unmatch error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// POST /api/matches/report/:userId - Report a user
router.post('/report/:userId', authenticate, async (req, res) => {
    try {
        const { userId: targetUserId } = req.params;
        const { reason } = req.body;
        const currentUserId = req.userId;

        if (currentUserId === targetUserId) {
            return res.status(400).json({ message: 'Cannot report yourself' });
        }

        // Verify the target user exists
        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Here you could save the report to a reports collection
        // For now, we'll just log it and return success
        console.log(`User ${currentUserId} reported user ${targetUserId} for reason: ${reason}`);

        res.json({ success: true, message: 'Report submitted successfully' });
    } catch (err) {
        console.error('Report error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET /api/matches/check/:userId - Check if users are matched
router.get('/check/:userId', authenticate, async (req, res) => {
    try {
        const { userId: targetUserId } = req.params;
        const currentUserId = req.userId;

        if (currentUserId === targetUserId) {
            return res.json({ isMatched: false });
        }

        // Find the match document
        const match = await Match.findOne({
            $or: [
                { user1: currentUserId, user2: targetUserId },
                { user1: targetUserId, user2: currentUserId }
            ],
            isMatch: true
        });

        res.json({
            isMatched: !!match,
            matchId: match?._id.toString()
        });
    } catch (err) {
        console.error('Check match status error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

export default router;


