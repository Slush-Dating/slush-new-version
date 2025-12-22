import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Event from '../models/Event.js';
import EventBooking from '../models/EventBooking.js';
import Match from '../models/Match.js';
import Report from '../models/Report.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Force logout all users (clear authentication)
router.post('/force-logout-all', async (req, res) => {
    try {
        // This endpoint doesn't require authentication for emergency purposes
        // In production, you'd want to add admin authentication

        // Broadcast logout event to all connected sockets
        const io = req.app.get('io');
        if (io) {
            io.emit('force_logout', {
                message: 'You have been logged out by admin',
                reason: 'force_logout'
            });

            console.log('Broadcasted force logout to all users');
        }

        // Optionally clear all refresh tokens or invalidate all sessions
        // For now, we'll rely on the client-side logout triggered by the socket event

        res.json({
            success: true,
            message: 'All users have been logged out',
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        console.error('Error in force logout:', err);
        res.status(500).json({
            success: false,
            message: 'Server error during force logout',
            error: err.message
        });
    }
});

// Get system stats
router.get('/stats', async (req, res) => {
    try {
        const io = req.app.get('io');
        const connectedSockets = io ? io.engine.clientsCount : 0;

        const totalUsers = await User.countDocuments();
        const premiumUsers = await User.countDocuments({ isPremium: true });
        const completedOnboarding = await User.countDocuments({ onboardingCompleted: true });

        res.json({
            totalUsers,
            premiumUsers,
            completedOnboarding,
            connectedSockets,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Server error getting stats',
            error: err.message
        });
    }
});

// Get all users with pagination and filters
router.get('/users', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.isPremium) filter.isPremium = req.query.isPremium === 'true';
        if (req.query.onboardingCompleted) filter.onboardingCompleted = req.query.onboardingCompleted === 'true';
        if (req.query.search) {
            filter.$or = [
                { name: { $regex: req.query.search, $options: 'i' } },
                { email: { $regex: req.query.search, $options: 'i' } }
            ];
        }

        const users = await User.find(filter)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await User.countDocuments(filter);

        res.json({
            users,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Error getting users:', err);
        res.status(500).json({
            success: false,
            message: 'Server error getting users',
            error: err.message
        });
    }
});

// Get user details with related data
router.get('/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId).select('-password').lean();
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Ensure photos and videos arrays exist
        const userData = {
            ...user,
            photos: user.photos || [],
            videos: user.videos || []
        };

        console.log(`[Admin] Fetching details for user ${userId}`);
        console.log(`[Admin] Photos count: ${userData.photos.length}`);
        console.log(`[Admin] Videos count: ${userData.videos.length}`);
        console.log(`[Admin] Photos:`, userData.photos);
        console.log(`[Admin] Videos:`, userData.videos);

        // Get user's event bookings
        const bookings = await EventBooking.find({ userId }).populate('eventId', 'name date location status');
        const eventsCount = bookings.length;

        // Get user's matches
        const matches = await Match.find({
            $or: [{ user1: userId }, { user2: userId }],
            isMatch: true
        }).populate('user1 user2', 'name').limit(10);

        // Get reports against this user
        const reports = await Report.find({ reportedUserId: userId })
            .populate('reporterId', 'name')
            .sort({ createdAt: -1 })
            .limit(5);

        // Get reports made by this user
        const userReports = await Report.countDocuments({ reporterId: userId });

        res.json({
            user: userData,
            stats: {
                eventsAttended: eventsCount,
                matches: matches.length,
                reportsAgainst: reports.length,
                reportsMade: userReports
            },
            recentBookings: bookings.slice(0, 5),
            recentMatches: matches,
            recentReports: reports
        });
    } catch (err) {
        console.error('Error getting user details:', err);
        res.status(500).json({
            success: false,
            message: 'Server error getting user details',
            error: err.message
        });
    }
});

// Update user status (ban, suspend, etc.)
router.put('/users/:userId/status', async (req, res) => {
    try {
        const { userId } = req.params;
        const { action, reason, adminNotes } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // For now, we'll add a status field to track user state
        // In a real app, you might want to create a separate UserStatus model
        user.status = action; // 'active', 'suspended', 'banned'
        user.statusReason = reason;
        user.statusUpdatedAt = new Date();
        user.adminNotes = adminNotes;

        await user.save();

        res.json({
            success: true,
            message: `User ${action} successfully`,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                status: user.status,
                statusReason: user.statusReason,
                statusUpdatedAt: user.statusUpdatedAt
            }
        });
    } catch (err) {
        console.error('Error updating user status:', err);
        res.status(500).json({
            success: false,
            message: 'Server error updating user status',
            error: err.message
        });
    }
});

// Get events with detailed statistics
router.get('/events', async (req, res) => {
    try {
        const events = await Event.find({})
            .sort({ date: -1 })
            .populate('maleParticipants femaleParticipants otherParticipants', 'name gender');

        const eventsWithStats = await Promise.all(events.map(async (event) => {
            // Get bookings for this event
            const bookings = await EventBooking.find({ eventId: event._id })
                .populate('userId', 'name gender');

            // Get matches that occurred during this event
            const eventMatches = await Match.find({
                eventId: event._id,
                isMatch: true
            }).populate('user1 user2', 'name gender');

            return {
                ...event.toObject(),
                bookings: bookings.length,
                matches: eventMatches.length,
                recentBookings: bookings.slice(0, 10),
                recentMatches: eventMatches.slice(0, 5)
            };
        }));

        res.json({ events: eventsWithStats });
    } catch (err) {
        console.error('Error getting events:', err);
        res.status(500).json({
            success: false,
            message: 'Server error getting events',
            error: err.message
        });
    }
});

// Get detailed event statistics
router.get('/events/:eventId/stats', async (req, res) => {
    try {
        const { eventId } = req.params;

        const event = await Event.findById(eventId)
            .populate('maleParticipants femaleParticipants otherParticipants', 'name gender dob');

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Get all bookings
        const bookings = await EventBooking.find({ eventId })
            .populate('userId', 'name gender dob');

        // Get all matches from this event
        const matches = await Match.find({
            eventId,
            isMatch: true
        }).populate('user1 user2', 'name gender');

        // Calculate participation stats
        const maleBookings = bookings.filter(b => b.userGender === 'man').length;
        const femaleBookings = bookings.filter(b => b.userGender === 'woman').length;
        const otherBookings = bookings.filter(b => b.userGender !== 'man' && b.userGender !== 'woman').length;

        // Calculate age distribution
        const ageGroups = {
            '18-25': 0,
            '26-35': 0,
            '36-45': 0,
            '46+': 0
        };

        bookings.forEach(booking => {
            if (booking.userId && booking.userId.dob) {
                const age = new Date().getFullYear() - new Date(booking.userId.dob).getFullYear();
                if (age <= 25) ageGroups['18-25']++;
                else if (age <= 35) ageGroups['26-35']++;
                else if (age <= 45) ageGroups['36-45']++;
                else ageGroups['46+']++;
            }
        });

        res.json({
            event,
            stats: {
                totalBookings: bookings.length,
                maleBookings,
                femaleBookings,
                otherBookings,
                totalMatches: matches.length,
                matchRate: bookings.length > 0 ? (matches.length / bookings.length * 100).toFixed(1) : 0,
                ageGroups
            },
            bookings: bookings.slice(0, 50), // Limit for performance
            matches: matches.slice(0, 20)
        });
    } catch (err) {
        console.error('Error getting event stats:', err);
        res.status(500).json({
            success: false,
            message: 'Server error getting event stats',
            error: err.message
        });
    }
});

// Get all reports with pagination
router.get('/reports', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.status) filter.status = req.query.status;
        if (req.query.reason) filter.reason = req.query.reason;

        const reports = await Report.find(filter)
            .populate('reporterId', 'name email')
            .populate('reportedUserId', 'name email')
            .populate('adminReviewedBy', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Report.countDocuments(filter);

        res.json({
            reports,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Error getting reports:', err);
        res.status(500).json({
            success: false,
            message: 'Server error getting reports',
            error: err.message
        });
    }
});

// Update report status and take action
router.put('/reports/:reportId', async (req, res) => {
    try {
        const { reportId } = req.params;
        const { status, actionTaken, adminNotes, adminId } = req.body;

        const report = await Report.findById(reportId);
        if (!report) {
            return res.status(404).json({ message: 'Report not found' });
        }

        report.status = status;
        report.actionTaken = actionTaken;
        report.adminNotes = adminNotes;
        report.adminReviewedBy = adminId;

        await report.save();

        // If action is ban/suspension, update user status
        if (actionTaken === 'ban' || actionTaken === 'suspension') {
            const user = await User.findById(report.reportedUserId);
            if (user) {
                user.status = actionTaken;
                user.statusReason = `Admin action from report: ${report.reason}`;
                user.statusUpdatedAt = new Date();
                await user.save();
            }
        }

        res.json({
            success: true,
            message: 'Report updated successfully',
            report
        });
    } catch (err) {
        console.error('Error updating report:', err);
        res.status(500).json({
            success: false,
            message: 'Server error updating report',
            error: err.message
        });
    }
});

// Get comprehensive dashboard stats
router.get('/dashboard-stats', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const premiumUsers = await User.countDocuments({ isPremium: true });
        const activeUsers = await User.countDocuments({
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        });

        const totalEvents = await Event.countDocuments();
        const upcomingEvents = await Event.countDocuments({
            date: { $gte: new Date() },
            status: { $in: ['Scheduled', 'Active'] }
        });

        const totalMatches = await Match.countDocuments({ isMatch: true });
        const recentMatches = await Match.countDocuments({
            isMatch: true,
            matchedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        });

        const totalReports = await Report.countDocuments();
        const pendingReports = await Report.countDocuments({ status: 'pending' });

        // Get recent activity
        const recentSignups = await User.find({})
            .select('name createdAt')
            .sort({ createdAt: -1 })
            .limit(5);

        const recentEvents = await Event.find({
            date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        })
        .select('name date status')
        .sort({ date: -1 })
        .limit(5);

        res.json({
            overview: {
                totalUsers,
                premiumUsers,
                activeUsers,
                totalEvents,
                upcomingEvents,
                totalMatches,
                recentMatches,
                totalReports,
                pendingReports
            },
            recentActivity: {
                signups: recentSignups,
                events: recentEvents
            }
        });
    } catch (err) {
        console.error('Error getting dashboard stats:', err);
        res.status(500).json({
            success: false,
            message: 'Server error getting dashboard stats',
            error: err.message
        });
    }
});

export default router;



