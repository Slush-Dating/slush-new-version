import express from 'express';
import jwt from 'jsonwebtoken';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

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

// Helper to format relative time
const getRelativeTime = (date) => {
    const now = new Date();
    const diffMs = now - new Date(date);
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(date).toLocaleDateString();
};

// GET /api/notifications - Get all notifications for user
router.get('/', authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const { type, unreadOnly } = req.query;

        // Get current user to check premium status
        const currentUser = await User.findById(userId);
        if (!currentUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isPremium = currentUser.isPremium;

        // Build query
        const query = { userId };
        if (type && type !== 'all') {
            if (type === 'general') {
                query.type = { $in: ['general', 'security'] };
            } else {
                query.type = type;
            }
        }
        if (unreadOnly === 'true') {
            query.isRead = false;
        }

        const notifications = await Notification.find(query)
            .populate('fromUserId', 'name photos')
            .sort({ createdAt: -1 })
            .limit(50);

        // Format notifications with premium gating
        const formattedNotifications = notifications.map(notification => {
            const fromUser = notification.fromUserId;
            let title = notification.title;
            let userImage = null;

            // Premium gating for 'like' notifications
            if (notification.type === 'like' && fromUser) {
                if (isPremium) {
                    // Premium users see actual name
                    title = `${fromUser.name} has liked you`;
                    userImage = fromUser.photos && fromUser.photos.length > 0
                        ? fromUser.photos[0]
                        : null;
                } else {
                    // Non-premium users see anonymous message
                    title = 'Someone liked you!';
                    userImage = null; // Hide image for non-premium
                }
            } else if (notification.type === 'match' && fromUser) {
                // Matches show actual user for everyone
                title = `You matched with ${fromUser.name}`;
                userImage = fromUser.photos && fromUser.photos.length > 0
                    ? fromUser.photos[0]
                    : null;
            }

            return {
                id: notification._id.toString(),
                type: notification.type,
                title,
                description: notification.description,
                actionButton: notification.actionButton,
                actionLink: notification.actionLink,
                userImage,
                matchId: notification.matchId?.toString(),
                fromUserId: isPremium && notification.fromUserId
                    ? notification.fromUserId._id?.toString()
                    : null,
                isRead: notification.isRead,
                timestamp: getRelativeTime(notification.createdAt),
                createdAt: notification.createdAt
            };
        });

        res.json({
            notifications: formattedNotifications,
            isPremium,
            unreadCount: await Notification.countDocuments({ userId, isRead: false })
        });
    } catch (err) {
        console.error('Get notifications error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET /api/notifications/unread-count - Get unread notification count
router.get('/unread-count', authenticate, async (req, res) => {
    try {
        const count = await Notification.countDocuments({
            userId: req.userId,
            isRead: false
        });
        res.json({ unreadCount: count });
    } catch (err) {
        console.error('Get unread count error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// POST /api/notifications/:id/read - Mark notification as read
router.post('/:id/read', authenticate, async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId },
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        res.json({ success: true, notification });
    } catch (err) {
        console.error('Mark as read error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// POST /api/notifications/read-all - Mark all notifications as read
router.post('/read-all', authenticate, async (req, res) => {
    try {
        const result = await Notification.updateMany(
            { userId: req.userId, isRead: false },
            { isRead: true }
        );

        res.json({ success: true, updated: result.modifiedCount });
    } catch (err) {
        console.error('Mark all as read error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// DELETE /api/notifications/:id - Delete a notification
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const notification = await Notification.findOneAndDelete({
            _id: req.params.id,
            userId: req.userId
        });

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Delete notification error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

export default router;
