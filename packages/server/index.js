import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import eventRoutes from './routes/events.js';
import authRoutes from './routes/auth.js';
import matchRoutes, { setSocketIO } from './routes/matches.js';
import seedRoutes from './routes/seed.js';
import discoveryRoutes from './routes/discovery.js';
import chatRoutes from './routes/chat.js';
import agoraRoutes from './routes/agora.js';
import notificationRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';
import Message from './models/Message.js';
import Match from './models/Match.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';
import notificationService from './utils/notificationService.js';
import matchmakingService from './services/EventMatchmakingService.js';
import User from './models/User.js';
import Event from './models/Event.js';

const app = express();
const PORT = process.env.PORT || 5001;
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow ALL origins
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        credentials: false
    }
});

// In-memory store for tracking online users: userId -> Set(socket.id)
const onlineUsers = new Map();

// Helper function to get user's matches for status broadcasting
async function getUserMatches(userId) {
    try {
        const matches = await Match.find({
            $or: [{ user1: userId }, { user2: userId }],
            isMatch: true
        });
        return matches.map(match => {
            const user1Str = match.user1.toString();
            const user2Str = match.user2.toString();
            return user1Str === userId.toString() ? match.user2.toString() : match.user1.toString();
        });
    } catch (error) {
        console.error('Error fetching user matches:', error);
        return [];
    }
}

// Completely permissive CORS - allow everything for easy access
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Credentials', 'false');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }

    next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Slush Dating API Documentation',
    customfavIcon: '/favicon.ico'
}));

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Authenticate user on connection
    socket.on('authenticate', async (userId) => {
        if (!userId) {
            console.error('Authentication failed: No userId provided');
            socket.emit('error', 'Authentication failed: No userId provided');
            return;
        }
        socket.userId = userId.toString();
        socket.join(`user_${userId}`);

        // Mark user as online
        if (!onlineUsers.has(socket.userId)) {
            onlineUsers.set(socket.userId, new Set());

            // Broadcast online status to all matched users only if this is the first connection
            const matchedUsers = await getUserMatches(socket.userId);
            matchedUsers.forEach(matchedUserId => {
                io.to(`user_${matchedUserId}`).emit('user_status_change', {
                    userId: socket.userId,
                    isOnline: true
                });
            });
            console.log(`Broadcasted online status for user ${userId} to ${matchedUsers.length} matched users`);
        }

        onlineUsers.get(socket.userId).add(socket.id);
        console.log(`User ${userId} authenticated (socket: ${socket.id}, total connections: ${onlineUsers.get(socket.userId).size})`);

        // Emit confirmation
        socket.emit('authenticated', { userId: socket.userId });
    });

    // Handle request to get a specific user's online status
    socket.on('get_user_status', (targetUserId) => {
        const isOnline = onlineUsers.has(targetUserId.toString());
        socket.emit('user_status', {
            userId: targetUserId,
            isOnline
        });
    });

    // Handle joining chat room for a match
    socket.on('join_chat', async (matchId) => {
        try {
            // Verify user is part of this match
            const match = await Match.findById(matchId);
            if (!match || !match.isMatch) {
                socket.emit('error', 'Invalid match or not matched');
                return;
            }

            const isParticipant = [match.user1.toString(), match.user2.toString()].includes(socket.userId);
            if (!isParticipant) {
                socket.emit('error', 'Unauthorized access to chat');
                return;
            }

            socket.matchId = matchId;
            socket.join(`match_${matchId}`);
            console.log(`User ${socket.userId} joined chat for match ${matchId}`);

            // Send chat history
            const messages = await Message.find({ matchId })
                .populate('senderId', 'name profilePicture')
                .sort({ createdAt: 1 })
                .limit(50);

            socket.emit('chat_history', messages);

        } catch (error) {
            console.error('Error joining chat:', error);
            socket.emit('error', 'Failed to join chat');
        }
    });

    // Handle sending messages - with acknowledgment callback for real-time feel
    socket.on('send_message', async (data, callback) => {
        try {
            const { matchId, content, messageType = 'text' } = data;

            console.log('Received send_message event:', { matchId, content, messageType, socketUserId: socket.userId });

            if (!socket.userId || !matchId) {
                console.error('Missing authentication or matchId:', { socketUserId: socket.userId, matchId });
                if (typeof callback === 'function') {
                    callback({ success: false, error: 'Authentication required' });
                }
                socket.emit('error', 'Authentication required');
                return;
            }

            if (!content || typeof content !== 'string' || content.trim().length === 0) {
                console.error('Invalid message content:', content);
                if (typeof callback === 'function') {
                    callback({ success: false, error: 'Message content is required' });
                }
                socket.emit('error', 'Message content is required');
                return;
            }

            // Verify user is part of this match
            const match = await Match.findById(matchId);
            if (!match) {
                console.error('Match not found:', matchId);
                if (typeof callback === 'function') {
                    callback({ success: false, error: 'Match not found' });
                }
                socket.emit('error', 'Match not found');
                return;
            }

            if (!match.isMatch) {
                console.error('Match is not active:', matchId);
                if (typeof callback === 'function') {
                    callback({ success: false, error: 'Match is not active' });
                }
                socket.emit('error', 'Match is not active');
                return;
            }

            const user1Str = match.user1.toString();
            const user2Str = match.user2.toString();
            const socketUserIdStr = socket.userId.toString();

            console.log('Checking participants:', { user1: user1Str, user2: user2Str, socketUserId: socketUserIdStr });

            const isParticipant = user1Str === socketUserIdStr || user2Str === socketUserIdStr;
            if (!isParticipant) {
                console.error('User is not a participant:', { socketUserId: socketUserIdStr, user1: user1Str, user2: user2Str });
                if (typeof callback === 'function') {
                    callback({ success: false, error: 'Unauthorized - not a participant' });
                }
                socket.emit('error', 'Unauthorized - not a participant');
                return;
            }

            // Determine receiver
            const receiverId = user1Str === socketUserIdStr ? match.user2 : match.user1;

            console.log('Creating message:', { matchId, senderId: socket.userId, receiverId, content: content.trim() });

            // Save message to database
            const message = new Message({
                matchId,
                senderId: socket.userId,
                receiverId,
                content: content.trim(),
                messageType
            });

            await message.save();
            console.log('Message saved successfully:', message._id);

            // Send acknowledgment immediately to sender (fast confirmation)
            if (typeof callback === 'function') {
                callback({ success: true, messageId: message._id.toString() });
            }
            // Also emit as event for backwards compatibility
            socket.emit('message_sent', { messageId: message._id.toString() });

            // Populate sender info for broadcast
            await message.populate({ path: 'senderId', select: 'name profilePicture' });

            // Convert to plain object for socket emission
            const messageObj = message.toObject();

            // Send to both users in the match room (for Chat component)
            io.to(`match_${matchId}`).emit('new_message', messageObj);
            console.log('Message emitted to match room:', `match_${matchId}`);

            // Also send new_message to both user rooms for components not in chat room (ChatList, App.tsx)
            // This ensures real-time updates work for message previews and notification badges
            io.to(`user_${socket.userId}`).emit('new_message', messageObj);
            io.to(`user_${receiverId}`).emit('new_message', messageObj);
            console.log('Message emitted to user rooms for real-time previews');

            // Also send notification to receiver's user room (in case they're not in chat)
            io.to(`user_${receiverId}`).emit('notification', {
                type: 'new_message',
                matchId,
                message: messageObj
            });

        } catch (error) {
            console.error('Error sending message - Full error:', error);
            console.error('Error stack:', error.stack);
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                data: data
            });
            if (typeof callback === 'function') {
                callback({ success: false, error: `Failed to send message: ${error.message}` });
            }
            socket.emit('error', `Failed to send message: ${error.message}`);
        }
    });

    // Handle typing indicators
    socket.on('typing_start', (matchId) => {
        socket.to(`match_${matchId}`).emit('typing_start', socket.userId);
    });

    socket.on('typing_stop', (matchId) => {
        socket.to(`match_${matchId}`).emit('typing_stop', socket.userId);
    });

    // Event session socket handlers - integrated with matchmaking service
    socket.on('join_event_session', async (data) => {
        // Support both old format (just eventId string) and new format (object with eventId)
        const eventId = typeof data === 'string' ? data : data.eventId;

        if (!socket.userId) {
            socket.emit('error', 'Authentication required');
            return;
        }

        socket.join(`event_session_${eventId}`);
        socket.eventId = eventId;

        try {
            // Get user info for matchmaking
            const user = await User.findById(socket.userId).select('gender interestedIn').lean();
            const event = await Event.findById(eventId).select('eventType').lean();

            if (user && event) {
                // Register with matchmaking service
                matchmakingService.joinSession(eventId, socket.userId, socket.id, {
                    gender: user.gender || 'other',
                    interestedIn: user.interestedIn || 'everyone',
                    eventType: event.eventType || 'straight',
                });
            }
        } catch (err) {
            console.error('[Socket] Error joining matchmaking session:', err);
        }

        console.log(`User ${socket.userId} joined event session ${eventId}`);

        // Get stats from matchmaking service
        const stats = matchmakingService.getSessionStats(eventId);
        const participantCount = stats ? stats.onlineCount : 0;

        // Get list of participants for waiting room display
        const participants = matchmakingService.getParticipants(eventId);

        // Notify all users in the session about the new participant count
        io.to(`event_session_${eventId}`).emit('participant_count_update', {
            count: participantCount,
            eventId: eventId,
            participants: participants,
        });

        // Notify others in the session that a user joined
        socket.to(`event_session_${eventId}`).emit('user_joined_session', {
            userId: socket.userId
        });
    });

    socket.on('leave_event_session', (eventId) => {
        socket.leave(`event_session_${eventId}`);

        // Update matchmaking service
        matchmakingService.leaveSession(eventId, socket.userId);

        // Get updated stats from matchmaking service
        const stats = matchmakingService.getSessionStats(eventId);
        const participantCount = stats ? stats.onlineCount : 0;
        const participants = matchmakingService.getParticipants(eventId);

        // Notify remaining users about the updated count
        io.to(`event_session_${eventId}`).emit('participant_count_update', {
            count: participantCount,
            eventId: eventId,
            participants: participants,
        });

        socket.to(`event_session_${eventId}`).emit('user_left_session', {
            userId: socket.userId
        });
        console.log(`User ${socket.userId} left event session ${eventId}`);
    });

    // Get authoritative event state (for reconnection sync)
    socket.on('get_event_state', async (eventId, callback) => {
        if (!socket.userId) {
            if (typeof callback === 'function') {
                callback({ error: 'Authentication required' });
            }
            return;
        }

        try {
            // Rejoin session and get state
            const state = matchmakingService.rejoinSession(eventId, socket.userId, socket.id);

            if (!state) {
                if (typeof callback === 'function') {
                    callback({ error: 'Event session not found' });
                }
                return;
            }

            // Rejoin socket room
            socket.join(`event_session_${eventId}`);
            socket.eventId = eventId;

            // Get partner details if user has a partner
            let partnerData = null;
            if (state.partnerId) {
                const partner = await User.findById(state.partnerId)
                    .select('name dob gender bio photos')
                    .lean();

                if (partner) {
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

                    partnerData = {
                        id: partner._id.toString(),
                        userId: partner._id.toString(),
                        name: partner.name || 'Partner',
                        age,
                        bio: partner.bio || '',
                        imageUrl: partner.photos && partner.photos.length > 0 ? partner.photos[0] : null,
                    };
                }
            }

            const response = {
                ...state,
                partner: partnerData,
                channelName: state.partnerId
                    ? `event_${eventId}_round_${state.currentRound}_${socket.userId}_${state.partnerId}`
                    : null,
            };

            console.log(`[EventState] User ${socket.userId} requesting state for event ${eventId}:`, response);

            if (typeof callback === 'function') {
                callback(response);
            }
        } catch (error) {
            console.error('[EventState] Error getting event state:', error);
            if (typeof callback === 'function') {
                callback({ error: 'Failed to get event state' });
            }
        }
    });

    // Ready for matchmaking - signals user is ready for the next round
    socket.on('ready_for_matchmaking', (eventId) => {
        if (!socket.userId) {
            socket.emit('error', 'Authentication required');
            return;
        }

        matchmakingService.markReady(eventId, socket.userId);

        const stats = matchmakingService.getSessionStats(eventId);
        console.log(`User ${socket.userId} ready for matchmaking. Stats:`, stats);

        // Emit updated stats
        io.to(`event_session_${eventId}`).emit('matchmaking_stats', stats);
    });

    // Request to start the next round (usually triggered by one client when event starts)
    socket.on('start_event_round', async (eventId) => {
        if (!socket.userId) {
            socket.emit('error', 'Authentication required');
            return;
        }

        // Check if all pairings are exhausted
        if (matchmakingService.areAllPairingsExhausted(eventId)) {
            io.to(`event_session_${eventId}`).emit('event_complete', {
                eventId,
                message: 'All possible pairings have been completed!',
            });
            return;
        }

        // Start new round
        const roundInfo = matchmakingService.startRound(eventId);

        if (!roundInfo || roundInfo.pairings.length === 0) {
            io.to(`event_session_${eventId}`).emit('waiting_for_participants', {
                eventId,
                message: 'Waiting for more participants to join...',
            });
            return;
        }

        // Notify each user of their assigned partner
        for (const pairing of roundInfo.pairings) {
            try {
                // Get partner details for user1
                const partner2 = await User.findById(pairing.user2)
                    .select('name dob gender bio photos')
                    .lean();

                if (partner2) {
                    // Calculate age
                    let age = null;
                    if (partner2.dob) {
                        const today = new Date();
                        const birthDate = new Date(partner2.dob);
                        age = today.getFullYear() - birthDate.getFullYear();
                        const monthDiff = today.getMonth() - birthDate.getMonth();
                        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                            age--;
                        }
                    }

                    io.to(`user_${pairing.user1}`).emit('partner_assigned', {
                        eventId,
                        round: roundInfo.round,
                        phase: roundInfo.phase,
                        phaseDuration: roundInfo.phaseDuration,
                        phaseStartTime: roundInfo.phaseStartTime,
                        partner: {
                            id: partner2._id.toString(),
                            userId: partner2._id.toString(),
                            name: partner2.name || 'Partner',
                            age,
                            bio: partner2.bio || '',
                            imageUrl: partner2.photos && partner2.photos.length > 0 ? partner2.photos[0] : null,
                        },
                        channelName: `event_${eventId}_round_${roundInfo.round}_${pairing.user1}_${pairing.user2}`,
                    });
                }

                // Get partner details for user2
                const partner1 = await User.findById(pairing.user1)
                    .select('name dob gender bio photos')
                    .lean();

                if (partner1) {
                    let age = null;
                    if (partner1.dob) {
                        const today = new Date();
                        const birthDate = new Date(partner1.dob);
                        age = today.getFullYear() - birthDate.getFullYear();
                        const monthDiff = today.getMonth() - birthDate.getMonth();
                        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                            age--;
                        }
                    }

                    io.to(`user_${pairing.user2}`).emit('partner_assigned', {
                        eventId,
                        round: roundInfo.round,
                        phase: roundInfo.phase,
                        phaseDuration: roundInfo.phaseDuration,
                        phaseStartTime: roundInfo.phaseStartTime,
                        partner: {
                            id: partner1._id.toString(),
                            userId: partner1._id.toString(),
                            name: partner1.name || 'Partner',
                            age,
                            bio: partner1.bio || '',
                            imageUrl: partner1.photos && partner1.photos.length > 0 ? partner1.photos[0] : null,
                        },
                        channelName: `event_${eventId}_round_${roundInfo.round}_${pairing.user1}_${pairing.user2}`,
                    });
                }
            } catch (err) {
                console.error('[Socket] Error sending partner assignment:', err);
            }
        }

        // Notify users without partners (odd count) that they're waiting
        const participants = matchmakingService.getParticipants(eventId);
        for (const p of participants) {
            if (p.isOnline && !p.hasPartner) {
                io.to(`user_${p.userId}`).emit('waiting_for_partner', {
                    eventId,
                    round: roundInfo.round,
                    message: 'Waiting for next available partner...',
                });
            }
        }

        console.log(`[Matchmaking] Round ${roundInfo.round} started for event ${eventId} with ${roundInfo.pairings.length} pairs`);
    });

    // Advance to next phase in current round
    socket.on('advance_phase', (eventId) => {
        if (!socket.userId) {
            socket.emit('error', 'Authentication required');
            return;
        }

        const phaseInfo = matchmakingService.nextPhase(eventId);

        if (phaseInfo) {
            io.to(`event_session_${eventId}`).emit('phase_changed', {
                eventId,
                ...phaseInfo,
            });
            console.log(`[Matchmaking] Event ${eventId} advanced to phase ${phaseInfo.phase}`);
        } else {
            // End of round
            matchmakingService.endRound(eventId);
            io.to(`event_session_${eventId}`).emit('round_ended', {
                eventId,
            });
            console.log(`[Matchmaking] Event ${eventId} round ended`);
        }
    });

    socket.on('partner_matched', async (data) => {
        const { eventId, partnerId, channelName } = data;
        if (!socket.userId) {
            socket.emit('error', 'Authentication required');
            return;
        }
        // Notify both users about the match
        io.to(`user_${socket.userId}`).emit('partner_found', {
            partnerId,
            channelName,
            eventId
        });
        io.to(`user_${partnerId}`).emit('partner_found', {
            partnerId: socket.userId,
            channelName,
            eventId
        });
    });

    // Handle user leaving event (marking as absent)
    socket.on('user_left_event', async (eventId) => {
        if (!socket.userId) {
            socket.emit('error', 'Authentication required');
            return;
        }

        // Update matchmaking service
        matchmakingService.leaveSession(eventId, socket.userId);

        // Notify all users in the event session that this user is now absent
        io.to(`event_session_${eventId}`).emit('user_absent', {
            userId: socket.userId,
            eventId: eventId
        });

        console.log(`User ${socket.userId} marked as absent for event ${eventId}`);
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
        // Handle event session disconnect first (mid-date handling)
        if (socket.eventId && socket.userId) {
            const disconnectInfo = matchmakingService.handleDisconnect(socket.eventId, socket.userId);

            if (disconnectInfo && disconnectInfo.partnerId) {
                // Notify partner that their date has ended
                io.to(`user_${disconnectInfo.partnerId}`).emit('partner_disconnected', {
                    eventId: socket.eventId,
                    message: 'Your date has ended - your partner disconnected',
                    wasInDate: disconnectInfo.wasInDate,
                    currentPhase: disconnectInfo.currentPhase,
                    currentRound: disconnectInfo.currentRound,
                });
                console.log(`[Disconnect] Notified partner ${disconnectInfo.partnerId} about disconnect`);

                // Try to re-match the partner with a waiting user
                if (disconnectInfo.wasInDate) {
                    const session = matchmakingService.getSession(socket.eventId);
                    const newPartnerId = matchmakingService.findWaitingPartner(
                        socket.eventId,
                        disconnectInfo.partnerId,
                        session?.eventType || 'straight'
                    );

                    if (newPartnerId) {
                        // Get new partner details
                        const newPartner = await User.findById(newPartnerId)
                            .select('name dob gender bio photos')
                            .lean();

                        if (newPartner) {
                            let age = null;
                            if (newPartner.dob) {
                                const today = new Date();
                                const birthDate = new Date(newPartner.dob);
                                age = today.getFullYear() - birthDate.getFullYear();
                                const monthDiff = today.getMonth() - birthDate.getMonth();
                                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                                    age--;
                                }
                            }

                            // Notify partner about re-match
                            io.to(`user_${disconnectInfo.partnerId}`).emit('partner_assigned', {
                                eventId: socket.eventId,
                                round: disconnectInfo.currentRound,
                                phase: disconnectInfo.currentPhase,
                                phaseDuration: matchmakingService.PHASE_DURATIONS[disconnectInfo.currentPhase],
                                phaseStartTime: new Date(),
                                partner: {
                                    id: newPartner._id.toString(),
                                    userId: newPartner._id.toString(),
                                    name: newPartner.name || 'Partner',
                                    age,
                                    bio: newPartner.bio || '',
                                    imageUrl: newPartner.photos && newPartner.photos.length > 0 ? newPartner.photos[0] : null,
                                },
                                channelName: `event_${socket.eventId}_round_${disconnectInfo.currentRound}_${disconnectInfo.partnerId}_${newPartnerId}`,
                                isRematch: true,
                            });
                            console.log(`[Disconnect] Re-matched ${disconnectInfo.partnerId} with waiting user ${newPartnerId}`);

                            // Also notify the new partner
                            const originalPartner = await User.findById(disconnectInfo.partnerId)
                                .select('name dob gender bio photos')
                                .lean();

                            if (originalPartner) {
                                let partnerAge = null;
                                if (originalPartner.dob) {
                                    const today = new Date();
                                    const birthDate = new Date(originalPartner.dob);
                                    partnerAge = today.getFullYear() - birthDate.getFullYear();
                                    const monthDiff = today.getMonth() - birthDate.getMonth();
                                    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                                        partnerAge--;
                                    }
                                }

                                io.to(`user_${newPartnerId}`).emit('partner_assigned', {
                                    eventId: socket.eventId,
                                    round: disconnectInfo.currentRound,
                                    phase: disconnectInfo.currentPhase,
                                    phaseDuration: matchmakingService.PHASE_DURATIONS[disconnectInfo.currentPhase],
                                    phaseStartTime: new Date(),
                                    partner: {
                                        id: originalPartner._id.toString(),
                                        userId: originalPartner._id.toString(),
                                        name: originalPartner.name || 'Partner',
                                        age: partnerAge,
                                        bio: originalPartner.bio || '',
                                        imageUrl: originalPartner.photos && originalPartner.photos.length > 0 ? originalPartner.photos[0] : null,
                                    },
                                    channelName: `event_${socket.eventId}_round_${disconnectInfo.currentRound}_${disconnectInfo.partnerId}_${newPartnerId}`,
                                    isRematch: true,
                                });
                            }
                        }
                    } else {
                        // No waiting user available - partner goes to waiting state
                        const state = matchmakingService.getEventState(socket.eventId, disconnectInfo.partnerId);
                        io.to(`user_${disconnectInfo.partnerId}`).emit('waiting_for_partner', {
                            eventId: socket.eventId,
                            round: disconnectInfo.currentRound,
                            message: 'Waiting for next available partner...',
                            timeUntilNextRound: state?.timeUntilNextRound,
                        });
                        console.log(`[Disconnect] Partner ${disconnectInfo.partnerId} moved to waiting state`);
                    }
                }
            }

            // Notify others in event session
            socket.to(`event_session_${socket.eventId}`).emit('user_left_session', {
                userId: socket.userId
            });
        }

        // Handle regular online status
        if (socket.userId && onlineUsers.has(socket.userId)) {
            const userSockets = onlineUsers.get(socket.userId);
            userSockets.delete(socket.id);

            console.log(`Socket ${socket.id} disconnected for user ${socket.userId} (remaining: ${userSockets.size})`);

            // Only mark as offline and broadcast if no more active connections
            if (userSockets.size === 0) {
                onlineUsers.delete(socket.userId);
                console.log(`User ${socket.userId} is now fully offline`);

                // Broadcast offline status to all matched users
                const matchedUsers = await getUserMatches(socket.userId);
                matchedUsers.forEach(matchedUserId => {
                    io.to(`user_${matchedUserId}`).emit('user_status_change', {
                        userId: socket.userId,
                        isOnline: false
                    });
                });
                console.log(`Broadcasted offline status for user ${socket.userId} to ${matchedUsers.length} matched users`);
            }
        }

        console.log('User disconnected:', socket.id);
    });
});

// Pass io instance to routes that need it
setSocketIO(io);
notificationService.setSocketIO(io);
app.set('io', io);

// Start event reminder scheduler (runs every 60 seconds)
setInterval(async () => {
    try {
        await notificationService.checkAndSendEventReminders();
    } catch (error) {
        console.error('[Server] Error in event reminder scheduler:', error);
    }
}, 60000);

console.log('📅 Event reminder scheduler started (checking every 60 seconds)');

// ============================================
// EVENT AUTO-START SCHEDULER
// Monitors events and automatically starts them at scheduled time
// ============================================

const activeEventTimers = new Map();

/**
 * Auto-start an event when its scheduled time arrives
 */
async function autoStartEvent(eventId) {
    console.log(`[EventScheduler] Auto-starting event ${eventId}`);

    try {
        // Check if all pairings are exhausted
        if (matchmakingService.areAllPairingsExhausted(eventId)) {
            io.to(`event_session_${eventId}`).emit('event_complete', {
                eventId,
                message: 'All possible pairings have been completed!',
            });
            return;
        }

        // Get max possible rounds before starting
        const totalRounds = matchmakingService.getMaxPossibleRounds(eventId);

        // Start round using matchmaking service
        const roundInfo = matchmakingService.startRound(eventId);

        if (!roundInfo || roundInfo.pairings.length === 0) {
            io.to(`event_session_${eventId}`).emit('waiting_for_participants', {
                eventId,
                message: 'Waiting for more participants to join...',
            });
            return;
        }

        // Emit event_started to all participants in waiting room
        io.to(`event_session_${eventId}`).emit('event_started', {
            eventId,
            round: roundInfo.round,
            totalRounds: totalRounds,
        });

        console.log(`[EventScheduler] Event ${eventId} started! Round ${roundInfo.round} with ${roundInfo.pairings.length} pairs, ${totalRounds} total possible rounds`);

        // Send partner assignments to each paired user
        for (const pairing of roundInfo.pairings) {
            try {
                // Get partner details for user1
                const partner2 = await User.findById(pairing.user2)
                    .select('name dob gender bio photos')
                    .lean();

                if (partner2) {
                    // Calculate age
                    let age = null;
                    if (partner2.dob) {
                        const today = new Date();
                        const birthDate = new Date(partner2.dob);
                        age = today.getFullYear() - birthDate.getFullYear();
                        const monthDiff = today.getMonth() - birthDate.getMonth();
                        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                            age--;
                        }
                    }

                    io.to(`user_${pairing.user1}`).emit('partner_assigned', {
                        eventId,
                        round: roundInfo.round,
                        totalRounds: totalRounds,
                        phase: roundInfo.phase,
                        phaseDuration: roundInfo.phaseDuration,
                        phaseStartTime: roundInfo.phaseStartTime,
                        partner: {
                            id: partner2._id.toString(),
                            userId: partner2._id.toString(),
                            name: partner2.name || 'Partner',
                            age,
                            bio: partner2.bio || '',
                            imageUrl: partner2.photos && partner2.photos.length > 0 ? partner2.photos[0] : null,
                        },
                        channelName: `event_${eventId}_round_${roundInfo.round}_${pairing.user1}_${pairing.user2}`,
                    });
                }

                // Get partner details for user2
                const partner1 = await User.findById(pairing.user1)
                    .select('name dob gender bio photos')
                    .lean();

                if (partner1) {
                    let age = null;
                    if (partner1.dob) {
                        const today = new Date();
                        const birthDate = new Date(partner1.dob);
                        age = today.getFullYear() - birthDate.getFullYear();
                        const monthDiff = today.getMonth() - birthDate.getMonth();
                        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                            age--;
                        }
                    }

                    io.to(`user_${pairing.user2}`).emit('partner_assigned', {
                        eventId,
                        round: roundInfo.round,
                        totalRounds: totalRounds,
                        phase: roundInfo.phase,
                        phaseDuration: roundInfo.phaseDuration,
                        phaseStartTime: roundInfo.phaseStartTime,
                        partner: {
                            id: partner1._id.toString(),
                            userId: partner1._id.toString(),
                            name: partner1.name || 'Partner',
                            age,
                            bio: partner1.bio || '',
                            imageUrl: partner1.photos && partner1.photos.length > 0 ? partner1.photos[0] : null,
                        },
                        channelName: `event_${eventId}_round_${roundInfo.round}_${pairing.user1}_${pairing.user2}`,
                    });
                }
            } catch (err) {
                console.error('[EventScheduler] Error sending partner assignment:', err);
            }
        }

        // Notify users without partners (odd count) that they're waiting
        const participants = matchmakingService.getParticipants(eventId);
        for (const p of participants) {
            if (p.isOnline && !p.hasPartner) {
                // Calculate time until next round
                const totalPhaseDuration = matchmakingService.PHASE_DURATIONS.lobby +
                    matchmakingService.PHASE_DURATIONS.date +
                    matchmakingService.PHASE_DURATIONS.feedback;

                io.to(`user_${p.userId}`).emit('waiting_for_partner', {
                    eventId,
                    round: roundInfo.round,
                    message: 'Waiting for next available partner...',
                    timeUntilNextRound: totalPhaseDuration,
                });
            }
        }

        // ============================================
        // SERVER-CONTROLLED PHASE TIMER
        // Server automatically advances phases to keep all clients in sync
        // ============================================
        schedulePhaseAdvancement(eventId, roundInfo.round);

    } catch (error) {
        console.error(`[EventScheduler] Error auto-starting event ${eventId}:`, error);
    }
}

// Map to track active phase timers per event
const activePhaseTimers = new Map();

/**
 * Schedule automatic phase advancement for server-controlled timing
 */
function schedulePhaseAdvancement(eventId, round) {
    // Clear any existing timers for this event
    if (activePhaseTimers.has(eventId)) {
        const timers = activePhaseTimers.get(eventId);
        timers.forEach(timer => clearTimeout(timer));
    }

    const timers = [];
    const phaseDurations = matchmakingService.PHASE_DURATIONS;

    // Schedule: lobby (60s) -> date (180s) -> feedback (60s) -> next round
    let cumulativeDelay = 0;

    // After lobby phase ends -> Start date phase
    cumulativeDelay += phaseDurations.lobby * 1000;
    timers.push(setTimeout(async () => {
        await advanceToPhase(eventId, round, 'date');
    }, cumulativeDelay));

    // After date phase ends -> Start feedback phase
    cumulativeDelay += phaseDurations.date * 1000;
    timers.push(setTimeout(async () => {
        await advanceToPhase(eventId, round, 'feedback');
    }, cumulativeDelay));

    // After feedback phase ends -> Start next round
    cumulativeDelay += phaseDurations.feedback * 1000;
    timers.push(setTimeout(async () => {
        await startNextRound(eventId, round);
    }, cumulativeDelay));

    activePhaseTimers.set(eventId, timers);
    console.log(`[PhaseTimer] Scheduled phase advancements for event ${eventId} round ${round}`);
}

/**
 * Advance to a specific phase and notify all participants
 */
async function advanceToPhase(eventId, round, newPhase) {
    console.log(`[PhaseTimer] Advancing event ${eventId} round ${round} to phase: ${newPhase}`);

    const phaseInfo = matchmakingService.nextPhase(eventId);
    if (!phaseInfo) {
        console.log(`[PhaseTimer] Could not advance phase for event ${eventId}`);
        return;
    }

    // If entering date phase, set date start time for all paired users
    if (newPhase === 'date') {
        const participants = matchmakingService.getParticipants(eventId);
        for (const p of participants) {
            if (p.hasPartner) {
                matchmakingService.setDateStartTime(eventId, p.userId);
            }
        }
    }

    // Broadcast phase change to all participants
    io.to(`event_session_${eventId}`).emit('phase_change', {
        eventId,
        round: phaseInfo.round,
        phase: phaseInfo.phase,
        phaseStartTime: phaseInfo.phaseStartTime,
        phaseDuration: phaseInfo.phaseDuration,
        remainingTime: phaseInfo.phaseDuration,
    });

    console.log(`[PhaseTimer] Broadcasted phase_change to event ${eventId}: ${phaseInfo.phase}`);
}

/**
 * Start the next round after feedback phase ends
 */
async function startNextRound(eventId, previousRound) {
    console.log(`[PhaseTimer] Starting next round for event ${eventId} (previous round: ${previousRound})`);

    // End current round
    matchmakingService.endRound(eventId);

    // Check if all pairings are exhausted
    if (matchmakingService.areAllPairingsExhausted(eventId)) {
        io.to(`event_session_${eventId}`).emit('event_complete', {
            eventId,
            message: 'All possible pairings have been completed!',
        });

        // Clean up timers
        if (activePhaseTimers.has(eventId)) {
            activePhaseTimers.delete(eventId);
        }
        console.log(`[PhaseTimer] Event ${eventId} complete - all pairings exhausted`);
        return;
    }

    // Start new round
    const totalRounds = matchmakingService.getMaxPossibleRounds(eventId);
    const roundInfo = matchmakingService.startRound(eventId);

    if (!roundInfo || roundInfo.pairings.length === 0) {
        io.to(`event_session_${eventId}`).emit('waiting_for_participants', {
            eventId,
            message: 'Waiting for more participants...',
        });
        return;
    }

    // Broadcast round start
    io.to(`event_session_${eventId}`).emit('round_started', {
        eventId,
        round: roundInfo.round,
        totalRounds,
        phase: roundInfo.phase,
        phaseDuration: roundInfo.phaseDuration,
    });

    // Send partner assignments
    for (const pairing of roundInfo.pairings) {
        try {
            const partner2 = await User.findById(pairing.user2)
                .select('name dob gender bio photos')
                .lean();

            if (partner2) {
                let age = null;
                if (partner2.dob) {
                    const today = new Date();
                    const birthDate = new Date(partner2.dob);
                    age = today.getFullYear() - birthDate.getFullYear();
                    const monthDiff = today.getMonth() - birthDate.getMonth();
                    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                        age--;
                    }
                }

                io.to(`user_${pairing.user1}`).emit('partner_assigned', {
                    eventId,
                    round: roundInfo.round,
                    totalRounds,
                    phase: roundInfo.phase,
                    phaseDuration: roundInfo.phaseDuration,
                    phaseStartTime: roundInfo.phaseStartTime,
                    partner: {
                        id: partner2._id.toString(),
                        userId: partner2._id.toString(),
                        name: partner2.name || 'Partner',
                        age,
                        bio: partner2.bio || '',
                        imageUrl: partner2.photos && partner2.photos.length > 0 ? partner2.photos[0] : null,
                    },
                    channelName: `event_${eventId}_round_${roundInfo.round}_${pairing.user1}_${pairing.user2}`,
                });
            }

            const partner1 = await User.findById(pairing.user1)
                .select('name dob gender bio photos')
                .lean();

            if (partner1) {
                let age = null;
                if (partner1.dob) {
                    const today = new Date();
                    const birthDate = new Date(partner1.dob);
                    age = today.getFullYear() - birthDate.getFullYear();
                    const monthDiff = today.getMonth() - birthDate.getMonth();
                    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                        age--;
                    }
                }

                io.to(`user_${pairing.user2}`).emit('partner_assigned', {
                    eventId,
                    round: roundInfo.round,
                    totalRounds,
                    phase: roundInfo.phase,
                    phaseDuration: roundInfo.phaseDuration,
                    phaseStartTime: roundInfo.phaseStartTime,
                    partner: {
                        id: partner1._id.toString(),
                        userId: partner1._id.toString(),
                        name: partner1.name || 'Partner',
                        age,
                        bio: partner1.bio || '',
                        imageUrl: partner1.photos && partner1.photos.length > 0 ? partner1.photos[0] : null,
                    },
                    channelName: `event_${eventId}_round_${roundInfo.round}_${pairing.user1}_${pairing.user2}`,
                });
            }
        } catch (err) {
            console.error('[PhaseTimer] Error sending partner assignment:', err);
        }
    }

    // Notify waiting users
    const participants = matchmakingService.getParticipants(eventId);
    for (const p of participants) {
        if (p.isOnline && !p.hasPartner) {
            const totalPhaseDuration = matchmakingService.PHASE_DURATIONS.lobby +
                matchmakingService.PHASE_DURATIONS.date +
                matchmakingService.PHASE_DURATIONS.feedback;

            io.to(`user_${p.userId}`).emit('waiting_for_partner', {
                eventId,
                round: roundInfo.round,
                message: 'Waiting for next available partner...',
                timeUntilNextRound: totalPhaseDuration,
            });
        }
    }

    // Schedule phase advancement for this round
    schedulePhaseAdvancement(eventId, roundInfo.round);
}

// Check for upcoming events every 10 seconds
setInterval(async () => {
    try {
        const now = new Date();
        const oneMinuteFromNow = new Date(now.getTime() + 60000);

        // Find events starting within the next minute that haven't been scheduled
        const upcomingEvents = await Event.find({
            date: { $gt: now, $lte: oneMinuteFromNow },
            status: { $nin: ['Completed', 'Cancelled'] }
        });

        for (const event of upcomingEvents) {
            const eventIdStr = event._id.toString();

            if (!activeEventTimers.has(eventIdStr)) {
                const startTime = new Date(event.date).getTime();
                const delay = Math.max(0, startTime - now.getTime());

                // Set timer to auto-start this event
                const timer = setTimeout(async () => {
                    await autoStartEvent(eventIdStr);
                    activeEventTimers.delete(eventIdStr);
                }, delay);

                activeEventTimers.set(eventIdStr, timer);
                console.log(`[EventScheduler] Scheduled auto-start for event ${eventIdStr} (${event.name}) in ${Math.round(delay / 1000)}s`);
            }
        }
    } catch (error) {
        console.error('[EventScheduler] Error checking upcoming events:', error);
    }
}, 10000); // Check every 10 seconds

console.log('🚀 Event auto-start scheduler started (checking every 10 seconds)');


// Routes
app.use('/api/events', eventRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/seed', seedRoutes);
app.use('/api/discovery', discoveryRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/agora', agoraRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// Database Connection - Wait for connection before starting server
const HOST = process.env.HOST || '0.0.0.0';

// Determine which MongoDB URI to use based on environment
const getMongoDBUri = () => {
    // Check if we're in staging environment
    const isStaging = process.env.NODE_ENV === 'staging' || process.env.VITE_ENV === 'staging';

    if (isStaging && process.env.MONGODB_URI_STAGING) {
        console.log('🌍 Using STAGING database');
        return process.env.MONGODB_URI_STAGING;
    } else if (process.env.MONGODB_URI) {
        console.log('🏭 Using PRODUCTION database');
        return process.env.MONGODB_URI;
    } else {
        throw new Error('MONGODB_URI is not set in environment variables');
    }
};

async function startServer() {
    try {
        const mongoUri = getMongoDBUri();

        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB successfully');

        // Start server only after MongoDB connection is established
        server.listen(PORT, HOST, () => {
            console.log(`✅ Server is running on ${HOST}:${PORT}`);
            console.log(`📡 API endpoints available at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/api`);
            console.log(`🌐 Network access: http://0.0.0.0:${PORT}/api`);
            console.log(`🔓 CORS: Completely permissive (origin: *)`);
        });
    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
        console.error('Please check your MONGODB_URI in the .env file');
        process.exit(1);
    }
}

// Handle MongoDB connection events
mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
});

// Start the server
startServer();

// Export io instance for use in routes
export { io };
