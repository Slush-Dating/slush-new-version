import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import pkg from 'agora-access-token';
const { RtcTokenBuilder, RtcRole } = pkg;
import User from '../models/User.js';
import Event from '../models/Event.js';
import EventBooking from '../models/EventBooking.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Auth middleware
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

/**
 * @swagger
 * /api/agora/token:
 *   post:
 *     summary: Generate Agora RTC token
 *     tags: [Agora]
 *     security:
 *       - bearerAuth: []
 *     description: Generate an Agora RTC token for video/audio communication. Token expires in 24 hours.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - channelName
 *             properties:
 *               channelName:
 *                 type: string
 *                 description: Agora channel name
 *               uid:
 *                 type: integer
 *                 description: Optional user ID (auto-generated if not provided)
 *     responses:
 *       200:
 *         description: Agora token generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 appId:
 *                   type: string
 *                 channelName:
 *                   type: string
 *                 uid:
 *                   type: integer
 *       400:
 *         description: Channel name required
 *       500:
 *         description: Agora service not configured
 */
router.post('/token', authMiddleware, async (req, res) => {
    try {
        const { channelName, uid } = req.body;

        if (!channelName) {
            return res.status(400).json({ message: 'Channel name is required' });
        }

        const appId = process.env.AGORA_APP_ID;
        const appCertificate = process.env.AGORA_APP_CERTIFICATE;

        if (!appId || !appCertificate) {
            console.error('Agora credentials not configured');
            return res.status(500).json({ message: 'Agora service not configured' });
        }

        // Use provided UID or generate one from userId
        const rtcUid = uid || parseInt(req.userId.toString().slice(-8), 16) || 0;

        // Token expires in 24 hours
        const expirationTimeInSeconds = Math.floor(Date.now() / 1000) + (24 * 3600);

        // Build token with publisher role (can publish and subscribe)
        const token = RtcTokenBuilder.buildTokenWithUid(
            appId,
            appCertificate,
            channelName,
            rtcUid,
            RtcRole.PUBLISHER,
            expirationTimeInSeconds
        );

        res.json({
            token,
            appId,
            channelName,
            uid: rtcUid
        });
    } catch (error) {
        console.error('Error generating Agora token:', error);
        res.status(500).json({ message: 'Failed to generate token', error: error.message });
    }
});

/**
 * @swagger
 * /api/agora/event/{eventId}/next-partner:
 *   post:
 *     summary: Get next partner for event session
 *     tags: [Agora]
 *     security:
 *       - bearerAuth: []
 *     description: Get a random partner for video chat during an event session. User must be booked for the event.
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     responses:
 *       200:
 *         description: Partner found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 partner:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     userId:
 *                       type: string
 *                     name:
 *                       type: string
 *                     age:
 *                       type: number
 *                     bio:
 *                       type: string
 *                     imageUrl:
 *                       type: string
 *                 totalAvailable:
 *                   type: number
 *       403:
 *         description: User not booked for this event
 *       404:
 *         description: Event not found or no partners available
 */
router.post('/event/:eventId/next-partner', authMiddleware, async (req, res) => {
    try {
        const { eventId } = req.params;
        const userId = req.userId;

        // Get event
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Verify user is booked for this event
        const booking = await EventBooking.findOne({
            eventId,
            userId,
            status: 'booked'
        });

        if (!booking) {
            return res.status(403).json({ message: 'You are not booked for this event' });
        }

        // Get current user
        const currentUser = await User.findById(userId);
        if (!currentUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Import matchmaking service
        const matchmakingService = (await import('../services/EventMatchmakingService.js')).default;

        // Ensure user is registered in matchmaking service
        matchmakingService.joinSession(eventId, userId, null, {
            gender: currentUser.gender || 'other',
            interestedIn: currentUser.interestedIn || 'everyone',
            eventType: event.eventType || 'straight',
        });

        // Get session stats
        const stats = matchmakingService.getSessionStats(eventId);

        // Check if all pairings exhausted
        if (stats && stats.exhausted) {
            return res.status(200).json({
                allPartnersExhausted: true,
                message: 'You have met everyone available! Great job!',
                stats,
            });
        }

        // Get assigned partner from matchmaking service
        const assignedPartnerId = matchmakingService.getAssignedPartner(eventId, userId);

        if (!assignedPartnerId) {
            // No partner assigned yet - client should wait for socket event
            return res.status(200).json({
                partner: null,
                waitingForAssignment: true,
                message: 'Waiting for matchmaking. Listen for partner_assigned socket event.',
                stats,
            });
        }

        // Get partner details
        const partner = await User.findById(assignedPartnerId)
            .select('name dob gender bio photos')
            .lean();

        if (!partner) {
            return res.status(404).json({ message: 'Partner not found' });
        }

        // Calculate age
        let age = null;
        if (partner.dob) {
            const today = new Date();
            const birthDate = new Date(partner.dob);
            age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
        }

        const session = matchmakingService.getSession(eventId);

        res.json({
            partner: {
                id: partner._id.toString(),
                userId: partner._id.toString(),
                name: partner.name || 'Partner',
                age,
                bio: partner.bio || '',
                imageUrl: partner.photos && partner.photos.length > 0 ? partner.photos[0] : null,
            },
            timing: {
                currentRound: session.currentRound,
                currentPhase: session.currentPhase,
                phaseStartTime: session.phaseStartTime,
                phaseDuration: matchmakingService.PHASE_DURATIONS[session.currentPhase] || 60,
            },
            stats,
        });
    } catch (error) {
        console.error('Error getting next partner:', error);
        res.status(500).json({ message: 'Failed to get next partner', error: error.message });
    }
});

export default router;

