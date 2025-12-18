import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import eventRoutes from './routes/events.js';
import authRoutes from './routes/auth.js';
import matchRoutes from './routes/matches.js';
import seedRoutes from './routes/seed.js';
import discoveryRoutes from './routes/discovery.js';
import chatRoutes from './routes/chat.js';
import Message from './models/Message.js';
import Match from './models/Match.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:5173", "http://localhost:5175", "http://localhost:5177"],
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Authenticate user on connection
    socket.on('authenticate', (userId) => {
        if (!userId) {
            console.error('Authentication failed: No userId provided');
            socket.emit('error', 'Authentication failed: No userId provided');
            return;
        }
        socket.userId = userId.toString();
        socket.join(`user_${userId}`);
        console.log(`User ${userId} authenticated and joined room user_${userId}`);
        // Emit confirmation
        socket.emit('authenticated', { userId: socket.userId });
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

            // Send to both users in the match room
            io.to(`match_${matchId}`).emit('new_message', messageObj);
            console.log('Message emitted to match room:', `match_${matchId}`);

            // Also send to receiver's user room (in case they're not in chat)
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

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Routes
app.use('/api/events', eventRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/seed', seedRoutes);
app.use('/api/discovery', discoveryRoutes);
app.use('/api/chat', chatRoutes);

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('MongoDB connection error:', err));

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
