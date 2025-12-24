import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import Match from '../models/Match.js';
import User from '../models/User.js';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';
import Report from '../models/Report.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Import io instance - will be set by server/index.js
let io = null;
export const setSocketIO = (socketIO) => {
    io = socketIO;
};

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

/**
 * @swagger
 * /api/matches/action:
 *   post:
 *     summary: Like, pass, or super like a user
 *     tags: [Matches]
 *     security:
 *       - bearerAuth: []
 *     description: Perform an action (like, pass, or super_like) on a user. Creates a match if both users like each other.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - toUserId
 *               - action
 *               - context
 *             properties:
 *               toUserId:
 *                 type: string
 *               action:
 *                 type: string
 *                 enum: [like, pass, super_like]
 *               context:
 *                 type: string
 *                 enum: [video_feed, live_event]
 *               eventId:
 *                 type: string
 *                 description: Optional event ID if action is from live event
 *     responses:
 *       200:
 *         description: Action processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 action:
 *                   type: string
 *                 isMatch:
 *                   type: boolean
 *                 match:
 *                   $ref: '#/components/schemas/Match'
 *                   nullable: true
 */
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

        // Create notification for likes (if action is like/super_like and not a match yet)
        if ((action === 'like' || action === 'super_like') && !isNewMatch) {
            try {
                const likeNotification = new Notification({
                    userId: toUserId,
                    type: 'like',
                    fromUserId: fromUserId,
                    title: `${fromUser.name} has liked you`,
                    description: action === 'super_like' ? 'Super Like!' : null
                });
                await likeNotification.save();

                // Emit socket event for real-time notification
                if (io) {
                    io.to(`user_${toUserId}`).emit('new_notification', {
                        type: 'like',
                        notification: {
                            id: likeNotification._id.toString(),
                            type: 'like',
                            title: 'Someone liked you!', // Always send generic for socket (premium check on fetch)
                            timestamp: 'Just now'
                        }
                    });
                }
            } catch (notifErr) {
                console.error('Failed to create like notification:', notifErr);
            }
        }

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

            // Emit socket event only to the other user (not the initiator, who already knows from API response)
            if (io) {
                const otherUserId = match.user1._id.toString() === fromUserId.toString()
                    ? match.user2._id.toString()
                    : match.user1._id.toString();

                // Emit only to the other user's room
                io.to(`user_${otherUserId}`).emit('new_match', {
                    matchId: match._id,
                    user: match.user1._id.toString() === otherUserId.toString()
                        ? match.user2
                        : match.user1,
                    matchedAt: match.matchedAt,
                    context: match.matchContext
                });
                console.log(`Emitted new_match event to user ${otherUserId} (not to initiator ${fromUserId})`);
            }

            // Create match notifications for both users
            try {
                const user1Id = match.user1._id.toString();
                const user2Id = match.user2._id.toString();

                // Notification for user1
                const notification1 = new Notification({
                    userId: user1Id,
                    type: 'match',
                    fromUserId: user2Id,
                    title: `You matched with ${match.user2.name}`,
                    description: "It's a match!",
                    matchId: match._id
                });
                await notification1.save();

                // Notification for user2
                const notification2 = new Notification({
                    userId: user2Id,
                    type: 'match',
                    fromUserId: user1Id,
                    title: `You matched with ${match.user1.name}`,
                    description: "It's a match!",
                    matchId: match._id
                });
                await notification2.save();

                // Emit socket events for match notifications
                if (io) {
                    io.to(`user_${user1Id}`).emit('new_notification', {
                        type: 'match',
                        notification: {
                            id: notification1._id.toString(),
                            type: 'match',
                            title: `You matched with ${match.user2.name}`,
                            description: "It's a match!",
                            matchId: match._id.toString(),
                            timestamp: 'Just now'
                        }
                    });
                    io.to(`user_${user2Id}`).emit('new_notification', {
                        type: 'match',
                        notification: {
                            id: notification2._id.toString(),
                            type: 'match',
                            title: `You matched with ${match.user1.name}`,
                            description: "It's a match!",
                            matchId: match._id.toString(),
                            timestamp: 'Just now'
                        }
                    });
                }
            } catch (notifErr) {
                console.error('Failed to create match notifications:', notifErr);
            }
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

/**
 * @swagger
 * /api/matches:
 *   get:
 *     summary: Get all matches for authenticated user
 *     tags: [Matches]
 *     security:
 *       - bearerAuth: []
 *     description: Retrieve all matches for the authenticated user. Includes last message and match metadata.
 *     responses:
 *       200:
 *         description: List of matches
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Match'
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const userId = req.userId;

        const matches = await Match.find({
            $or: [{ user1: userId }, { user2: userId }],
            isMatch: true
        })
            .populate('user1', 'name photos bio dob gender isAdmin')
            .populate('user2', 'name photos bio dob gender isAdmin')
            .populate('eventId', 'name date location')
            .sort({ matchedAt: -1 });

        const formattedMatches = await Promise.all(matches.map(async match => {
            const user1Id = match.user1?._id || match.user1;
            const otherUser = user1Id && user1Id.toString() === userId.toString()
                ? match.user2
                : match.user1;

            if (!otherUser) return null;

            // Exclude admin users (admin users are for backend panel only)
            // Check if otherUser has isAdmin field (populated user) or fetch it
            let isAdminUser = false;
            if (otherUser.isAdmin !== undefined) {
                isAdminUser = otherUser.isAdmin === true;
            } else {
                // If isAdmin wasn't populated, check the user document
                const userDoc = await User.findById(otherUser._id || otherUser).select('isAdmin email name').lean();
                if (userDoc) {
                    isAdminUser = userDoc.isAdmin === true || 
                                 (userDoc.email && /admin/i.test(userDoc.email)) ||
                                 (userDoc.name && /admin/i.test(userDoc.name));
                }
            }
            if (isAdminUser) return null;

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

            // Check if this match was created via a super-like
            const isSuperLike = match.actions.some(action =>
                (action.action === 'super_like') &&
                ((action.fromUser.toString() === userId.toString() && action.toUser.toString() === otherUser._id?.toString()) ||
                 (action.fromUser.toString() === otherUser._id?.toString() && action.toUser.toString() === userId.toString()))
            );

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
                isSuperLike,
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

/**
 * @swagger
 * /api/matches/liked-you:
 *   get:
 *     summary: Get users who liked you
 *     tags: [Matches]
 *     security:
 *       - bearerAuth: []
 *     description: Get users who have liked the current user but haven't matched yet. Useful for "Likes You" feature.
 *     responses:
 *       200:
 *         description: List of users who liked you
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
 *                   imageUrl:
 *                     type: string
 *                   bio:
 *                     type: string
 *                   likedAt:
 *                     type: string
 *                     format: date-time
 *                   isSuperLike:
 *                     type: boolean
 */
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
            .populate('user1', 'name photos bio dob gender isAdmin')
            .populate('user2', 'name photos bio dob gender isAdmin')
            .sort({ updatedAt: -1 });

        const likedByUsers = likes.filter(match => {
            if (!match.actions) return false;
            const currentUserAction = match.actions.find(a => a.fromUser && a.fromUser.toString() === userId.toString());
            return !currentUserAction || (currentUserAction.action !== 'pass');
        }).map(async match => {
            const user1Id = match.user1?._id || match.user1;
            const otherUser = user1Id && user1Id.toString() === userId.toString()
                ? match.user2
                : match.user1;

            if (!otherUser) return null;

            // Exclude admin users (admin users are for backend panel only)
            let isAdminUser = false;
            if (otherUser.isAdmin !== undefined) {
                isAdminUser = otherUser.isAdmin === true;
            } else {
                const userDoc = await User.findById(otherUser._id || otherUser).select('isAdmin email name').lean();
                if (userDoc) {
                    isAdminUser = userDoc.isAdmin === true || 
                                 (userDoc.email && /admin/i.test(userDoc.email)) ||
                                 (userDoc.name && /admin/i.test(userDoc.name));
                }
            }
            if (isAdminUser) return null;

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

            // Check if this like was a super-like
            const isSuperLike = match.actions.some(action =>
                action.action === 'super_like' &&
                action.fromUser.toString() === otherUser._id?.toString() &&
                action.toUser.toString() === userId.toString()
            );

            return {
                id: match._id.toString(),
                userId: otherUser._id?.toString() || otherUser.toString(),
                name: otherUser.name || 'Unknown',
                age,
                imageUrl: otherUser.photos && otherUser.photos.length > 0
                    ? otherUser.photos[0]
                    : null,
                bio: otherUser.bio || '',
                likedAt: match.updatedAt,
                isSuperLike
            };
        });

        // Filter out null values and await all async operations
        const filteredLikedByUsers = (await Promise.all(likedByUsers)).filter(user => user !== null);

        res.json(filteredLikedByUsers);
    } catch (err) {
        console.error('Get liked-you error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

/**
 * @swagger
 * /api/matches/stats:
 *   get:
 *     summary: Get match statistics
 *     tags: [Matches]
 *     security:
 *       - bearerAuth: []
 *     description: Get statistics about matches, likes given, and likes received.
 *     responses:
 *       200:
 *         description: Match statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalMatches:
 *                   type: number
 *                 likesGiven:
 *                   type: number
 *                 likesReceived:
 *                   type: number
 */
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

/**
 * @swagger
 * /api/matches/unmatch/{userId}:
 *   post:
 *     summary: Unmatch with a user
 *     tags: [Matches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to unmatch with
 *     responses:
 *       200:
 *         description: Successfully unmatched
 *       400:
 *         description: Cannot unmatch yourself
 *       404:
 *         description: No match found
 */
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

/**
 * @swagger
 * /api/matches/report/{userId}:
 *   post:
 *     summary: Report a user
 *     tags: [Matches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to report
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *               description:
 *                 type: string
 *               context:
 *                 type: string
 *                 default: profile
 *               referenceId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Report submitted successfully
 *       400:
 *         description: Cannot report yourself or already reported recently
 *       404:
 *         description: User not found
 */
router.post('/report/:userId', authenticate, async (req, res) => {
    try {
        const { userId: targetUserId } = req.params;
        const { reason, description, context = 'profile', referenceId } = req.body;
        const currentUserId = req.userId;

        if (currentUserId === targetUserId) {
            return res.status(400).json({ message: 'Cannot report yourself' });
        }

        // Verify the target user exists
        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if user has already reported this person recently (prevent spam)
        const existingReport = await Report.findOne({
            reporterId: currentUserId,
            reportedUserId: targetUserId,
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Within last 24 hours
        });

        if (existingReport) {
            return res.status(400).json({ message: 'You have already reported this user recently' });
        }

        // Create the report
        const report = new Report({
            reporterId: currentUserId,
            reportedUserId: targetUserId,
            reason,
            description: description || '',
            context,
            referenceId
        });

        await report.save();

        console.log(`User ${currentUserId} reported user ${targetUserId} for reason: ${reason}`);

        res.json({
            success: true,
            message: 'Report submitted successfully',
            reportId: report._id
        });
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


