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

/**
 * @swagger
 * /api/chat/unread/by-match:
 *   get:
 *     summary: Get unread message counts by match
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     description: Get unread message counts grouped by match ID.
 *     responses:
 *       200:
 *         description: Unread counts by match
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 unreadByMatch:
 *                   type: object
 *                   additionalProperties:
 *                     type: number
 */
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

// Get total unread message count for user (simplified endpoint)
router.get('/unread', authenticateToken, async (req, res) => {
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

/**
 * @swagger
 * /api/chat:
 *   get:
 *     summary: Get chat list
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     description: Get all conversations (matches) for the authenticated user with last message and unread counts.
 *     responses:
 *       200:
 *         description: List of conversations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   matchId:
 *                     type: string
 *                   user:
 *                     type: object
 *                   lastMessage:
 *                     type: object
 *                     nullable: true
 *                   unreadCount:
 *                     type: number
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        console.log('📋 GET /api/chat - Fetching chat list');
        const userId = req.userId;
        if (!userId) return res.status(401).json({ message: 'User ID not found in token' });

        // Get all matches for this user
        const matches = await Match.find({
            $or: [{ user1: userId }, { user2: userId }],
            isMatch: true
        })
            .populate('user1', 'name photos')
            .populate('user2', 'name photos')
            .sort({ matchedAt: -1 })
            .lean();

        const matchIds = matches.map(m => m._id.toString());

        // Initialize empty objects for unread counts and last messages
        const unreadByMatch = {};
        const lastMessageByMatch = {};

        // Only query if there are matches
        if (matchIds.length > 0) {
            const matchObjectIds = matchIds.map(id => new mongoose.Types.ObjectId(id));

            // Get unread counts per match
            const unreadCounts = await Message.aggregate([
                {
                    $match: {
                        matchId: { $in: matchObjectIds },
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

            unreadCounts.forEach(item => {
                if (item._id) {
                    unreadByMatch[item._id.toString()] = item.count;
                }
            });

            // Get last message for each match
            const lastMessages = await Message.aggregate([
                {
                    $match: {
                        matchId: { $in: matchObjectIds }
                    }
                },
                {
                    $sort: { createdAt: -1 }
                },
                {
                    $group: {
                        _id: '$matchId',
                        lastMessage: { $first: '$$ROOT' }
                    }
                }
            ]);

            lastMessages.forEach(item => {
                if (item._id && item.lastMessage) {
                    lastMessageByMatch[item._id.toString()] = {
                        content: item.lastMessage.content,
                        createdAt: item.lastMessage.createdAt,
                        senderId: item.lastMessage.senderId.toString()
                    };
                }
            });
        }

        // Format response
        const chatList = matches.map(match => {
            const user1Id = match.user1?._id || match.user1;
            const otherUser = user1Id && user1Id.toString() === userId.toString()
                ? match.user2
                : match.user1;

            if (!otherUser) return null;

            const matchId = match._id.toString();
            const otherUserId = otherUser._id || otherUser;
            const photos = otherUser.photos || [];
            const imageUrl = photos.length > 0 ? photos[0] : null;

            return {
                matchId,
                user: {
                    _id: otherUserId.toString(),
                    name: otherUser.name || 'Unknown',
                    photos: photos,
                    imageUrl: imageUrl
                },
                lastMessage: lastMessageByMatch[matchId] || null,
                unreadCount: unreadByMatch[matchId] || 0
            };
        }).filter(chat => chat !== null);

        res.json(chatList);

    } catch (error) {
        console.error('Error fetching chat list:', error);
        res.status(500).json({ message: 'Failed to fetch chat list', error: error.message });
    }
});

/**
 * @swagger
 * /api/chat/{matchId}:
 *   get:
 *     summary: Get chat history
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *         description: Match ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of messages per page
 *     responses:
 *       200:
 *         description: Chat history with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *                 hasMore:
 *                   type: boolean
 *                 page:
 *                   type: number
 *       403:
 *         description: Unauthorized access to chat
 *       404:
 *         description: Match not found
 */
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
