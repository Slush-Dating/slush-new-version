import express from 'express';
import mongoose from 'mongoose';
import Message from '../models/Message.js';
import Match from '../models/Match.js';
import jwt from 'jsonwebtoken';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            // Provide more specific error messages
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Token expired. Please log in again.', code: 'TOKEN_EXPIRED' });
            } else if (err.name === 'JsonWebTokenError') {
                return res.status(403).json({ message: 'Invalid token', code: 'INVALID_TOKEN' });
            }
            return res.status(403).json({ message: 'Invalid or expired token', code: 'TOKEN_ERROR' });
        }
        req.userId = user.userId;
        req.user = user;
        next();
    });
};

// Get unread message counts grouped by match
router.get('/unread/by-match', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) return res.status(401).json({ message: 'User ID not found in token' });

        console.log(`Fetching unread counts by match for user: ${userId}`);

        // Get all matches for this user
        const matches = await Match.find({
            $or: [{ user1: userId }, { user2: userId }],
            isMatch: true
        }).select('_id');

        const matchIds = matches.map(m => m._id);

        // Aggregate unread counts by matchId
        const unreadCounts = await Message.aggregate([
            {
                $match: {
                    matchId: { $in: matchIds },
                    receiverId: new mongoose.Types.ObjectId(userId),
                    isRead: false
                }
            },
            {
                $group: {
                    _id: '$matchId',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Transform to object { matchId: count }
        const unreadByMatch = {};
        unreadCounts.forEach(item => {
            if (item._id) {
                unreadByMatch[item._id.toString()] = item.count;
            }
        });

        res.json({ unreadByMatch });

    } catch (error) {
        console.error('Error fetching unread counts by match:', error);
        res.status(500).json({ message: 'Failed to fetch unread counts', error: error.message });
    }
});

// Get unread message count for user
router.get('/unread/count', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) return res.status(401).json({ message: 'User ID not found in token' });

        // Get all matches for this user
        const matches = await Match.find({
            $or: [{ user1: userId }, { user2: userId }],
            isMatch: true
        }).select('_id');

        const matchIds = matches.map(m => m._id);

        // Count unread messages
        const unreadCount = await Message.countDocuments({
            matchId: { $in: matchIds },
            receiverId: userId,
            isRead: false
        });

        res.json({ unreadCount });

    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ message: 'Failed to fetch unread count', error: error.message });
    }
});

// Get chat history for a match
router.get('/:matchId', authenticateToken, async (req, res) => {
    try {
        const { matchId } = req.params;
        const userId = req.userId;
        if (!userId) return res.status(401).json({ message: 'User ID not found in token' });

        // Verify user is part of this match
        const match = await Match.findById(matchId);
        if (!match || !match.isMatch) {
            return res.status(404).json({ message: 'Match not found or not active' });
        }

        const isParticipant = [match.user1.toString(), match.user2.toString()].includes(userId);
        if (!isParticipant) {
            return res.status(403).json({ message: 'Unauthorized access to chat' });
        }

        // Get messages with pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const messages = await Message.find({ matchId })
            .populate('senderId', 'name profilePicture')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Reverse to get chronological order
        messages.reverse();

        // Mark messages as read if they're from the other user
        const otherUserId = match.user1.toString() === userId ? match.user2 : match.user1;
        await Message.updateMany(
            {
                matchId,
                senderId: otherUserId,
                receiverId: userId,
                isRead: false
            },
            {
                isRead: true,
                readAt: new Date()
            }
        );

        res.json({
            messages,
            hasMore: messages.length === limit,
            page
        });

    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ message: 'Failed to fetch chat history' });
    }
});

// Send a message (though this will mainly be handled via Socket.IO)
router.post('/:matchId', authenticateToken, async (req, res) => {
    try {
        const { matchId } = req.params;
        const { content, messageType = 'text' } = req.body;
        const userId = req.userId;
        if (!userId) return res.status(401).json({ message: 'User ID not found in token' });

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ message: 'Message content is required' });
        }

        // Verify user is part of this match
        const match = await Match.findById(matchId);
        if (!match || !match.isMatch) {
            return res.status(404).json({ message: 'Match not found or not active' });
        }

        const isParticipant = [match.user1.toString(), match.user2.toString()].includes(userId);
        if (!isParticipant) {
            return res.status(403).json({ message: 'Unauthorized access to chat' });
        }

        // Determine receiver
        const receiverId = match.user1.toString() === userId ? match.user2 : match.user1;

        // Save message to database
        const message = new Message({
            matchId,
            senderId: userId,
            receiverId,
            content: content.trim(),
            messageType
        });

        await message.save();
        await message.populate({ path: 'senderId', select: 'name profilePicture' });

        res.status(201).json(message);

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ message: 'Failed to send message' });
    }
});

// Mark messages as read
router.post('/:matchId/read', authenticateToken, async (req, res) => {
    try {
        const { matchId } = req.params;
        const userId = req.userId;
        if (!userId) return res.status(401).json({ message: 'User ID not found in token' });

        // Verify user is part of this match
        const match = await Match.findById(matchId);
        if (!match || !match.isMatch) {
            return res.status(404).json({ message: 'Match not found or not active' });
        }

        const isParticipant = [match.user1.toString(), match.user2.toString()].includes(userId);
        if (!isParticipant) {
            return res.status(403).json({ message: 'Unauthorized access to chat' });
        }

        // Mark messages as read
        const result = await Message.updateMany(
            {
                matchId,
                receiverId: userId,
                isRead: false
            },
            {
                isRead: true,
                readAt: new Date()
            }
        );

        res.json({ updated: result.modifiedCount });

    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).json({ message: 'Failed to mark messages as read' });
    }
});

export default router;
