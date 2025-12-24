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

// Generate Agora RTC token
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

// Get next partner for event session
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

        // Get all participants for this event
        const allParticipants = [
            ...event.maleParticipants.map(id => id.toString()),
            ...event.femaleParticipants.map(id => id.toString()),
            ...event.otherParticipants.map(id => id.toString())
        ].filter(id => id !== userId.toString());

        if (allParticipants.length === 0) {
            return res.status(404).json({ message: 'No other participants found' });
        }

        // Get users that match preferences
        const eventType = event.eventType || 'straight';
        const currentUserGender = currentUser.gender || 'other';
        const currentUserInterest = currentUser.interestedIn || 'everyone';

        // Build query based on event type and user preferences
        let genderFilter = {};
        if (eventType === 'straight') {
            if (currentUserGender === 'man') {
                genderFilter = { gender: 'woman' };
            } else if (currentUserGender === 'woman') {
                genderFilter = { gender: 'man' };
            }
        } else if (eventType === 'gay') {
            genderFilter = { gender: currentUserGender };
        }
        // For bisexual events, no gender filter

        // Apply interestedIn preference
        if (currentUserInterest === 'men') {
            genderFilter = { gender: 'man' };
        } else if (currentUserInterest === 'women') {
            genderFilter = { gender: 'woman' };
        }

        // Find potential partners
        // Always exclude admin users (admin users are for backend panel only)
        const query = {
            _id: {
                $in: allParticipants.map(id => new mongoose.Types.ObjectId(id)),
                $ne: new mongoose.Types.ObjectId(userId)
            },
            onboardingCompleted: true,
            isAdmin: { $ne: true },
            email: { $not: { $regex: /admin/i } },
            name: { $not: { $regex: /admin/i } },
            ...genderFilter
        };

        const potentialPartners = await User.find(query)
            .select('name dob gender bio photos')
            .limit(50)
            .lean();

        if (potentialPartners.length === 0) {
            return res.status(404).json({ message: 'No matching partners found' });
        }

        // Calculate age for each partner
        const partnersWithAge = potentialPartners.map(partner => {
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

            return {
                id: partner._id.toString(),
                userId: partner._id.toString(),
                name: partner.name || 'Unknown',
                age,
                bio: partner.bio || '',
                imageUrl: partner.photos && partner.photos.length > 0 ? partner.photos[0] : null
            };
        });

        // Return a random partner (in production, you'd implement round-robin or matching algorithm)
        const randomPartner = partnersWithAge[Math.floor(Math.random() * partnersWithAge.length)];

        res.json({
            partner: randomPartner,
            totalAvailable: partnersWithAge.length
        });
    } catch (error) {
        console.error('Error getting next partner:', error);
        res.status(500).json({ message: 'Failed to get next partner', error: error.message });
    }
});

export default router;

