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

// In-memory store for tracking online users
const onlineUsers = new Map(); // userId -> socket.id

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
        onlineUsers.set(socket.userId, socket.id);
        console.log(`User ${userId} authenticated and joined room user_${userId} (online users: ${onlineUsers.size})`);

        // Emit confirmation
        socket.emit('authenticated', { userId: socket.userId });

        // Broadcast online status to all matched users
        const matchedUsers = await getUserMatches(socket.userId);
        matchedUsers.forEach(matchedUserId => {
            io.to(`user_${matchedUserId}`).emit('user_status_change', {
                userId: socket.userId,
                isOnline: true
            });
        });
        console.log(`Broadcasted online status to ${matchedUsers.length} matched users`);
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

    // Event session socket handlers
    socket.on('join_event_session', (eventId) => {
        if (!socket.userId) {
            socket.emit('error', 'Authentication required');
            return;
        }
        socket.join(`event_session_${eventId}`);
        socket.eventId = eventId;
        console.log(`User ${socket.userId} joined event session ${eventId}`);

        // Get current participant count in this session
        const room = io.sockets.adapter.rooms.get(`event_session_${eventId}`);
        const participantCount = room ? room.size : 0;

        // Notify all users in the session about the new participant count
        io.to(`event_session_${eventId}`).emit('participant_count_update', {
            count: participantCount,
            eventId: eventId
        });

        // Notify others in the session that a user joined
        socket.to(`event_session_${eventId}`).emit('user_joined_session', {
            userId: socket.userId
        });
    });

    socket.on('leave_event_session', (eventId) => {
        socket.leave(`event_session_${eventId}`);

        // Get updated participant count after leaving
        const room = io.sockets.adapter.rooms.get(`event_session_${eventId}`);
        const participantCount = room ? room.size : 0;

        // Notify remaining users about the updated count
        io.to(`event_session_${eventId}`).emit('participant_count_update', {
            count: participantCount,
            eventId: eventId
        });

        socket.to(`event_session_${eventId}`).emit('user_left_session', {
            userId: socket.userId
        });
        console.log(`User ${socket.userId} left event session ${eventId}`);
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

    // Handle disconnect
    socket.on('disconnect', async () => {
        if (socket.userId) {
            // Mark user as offline
            onlineUsers.delete(socket.userId);
            console.log(`User ${socket.userId} disconnected (online users: ${onlineUsers.size})`);

            // Broadcast offline status to all matched users
            const matchedUsers = await getUserMatches(socket.userId);
            matchedUsers.forEach(matchedUserId => {
                io.to(`user_${matchedUserId}`).emit('user_status_change', {
                    userId: socket.userId,
                    isOnline: false
                });
            });
            console.log(`Broadcasted offline status to ${matchedUsers.length} matched users`);
        }

        if (socket.eventId) {
            socket.to(`event_session_${socket.eventId}`).emit('user_left_session', {
                userId: socket.userId
            });
        }
        console.log('User disconnected:', socket.id);
    });
});

// Pass io instance to routes that need it
setSocketIO(io);
app.set('io', io);

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
