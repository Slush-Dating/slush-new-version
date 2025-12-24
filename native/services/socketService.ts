/**
 * Socket Service for React Native
 * Handles real-time WebSocket connections using Socket.IO
 */

import { io, Socket } from 'socket.io-client';
import { getSocketUrl } from './apiConfig';
import { getToken } from './authService';

class SocketService {
    private socket: Socket | null = null;
    private userId: string | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private messageHandlers: Set<(message: any) => void> = new Set();
    private matchHandlers: Set<(match: any) => void> = new Set();
    private connectionHandlers: Set<(status: 'connected' | 'disconnected') => void> = new Set();

    /**
     * Connect to the socket server
     */
    async connect(userId: string): Promise<void> {
        if (this.socket?.connected && this.userId === userId) {
            console.log('🔌 Socket already connected for user:', userId);
            return;
        }

        // Disconnect existing socket if any
        if (this.socket) {
            this.disconnect();
        }

        this.userId = userId;
        const socketUrl = getSocketUrl();
        const token = await getToken();

        console.log('🔌 Connecting to socket server:', socketUrl);

        this.socket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            auth: {
                token,
            },
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });

        this.setupEventListeners();
    }

    /**
     * Set up socket event listeners
     */
    private setupEventListeners(): void {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('✅ Socket connected');
            this.reconnectAttempts = 0;

            // Join user's room for personal notifications
            if (this.userId) {
                this.socket?.emit('join_user_room', this.userId);
                console.log('📍 Joined user room:', this.userId);
            }

            // Notify handlers
            this.connectionHandlers.forEach(handler => handler('connected'));
        });

        this.socket.on('disconnect', (reason) => {
            console.log('❌ Socket disconnected:', reason);
            this.connectionHandlers.forEach(handler => handler('disconnected'));
        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ Socket connection error:', error.message);
            this.reconnectAttempts++;
        });

        // Listen for new messages
        this.socket.on('new_message', (message: any) => {
            console.log('📨 New message received:', message._id);
            this.messageHandlers.forEach(handler => handler(message));
        });

        // Listen for new matches
        this.socket.on('new_match', (match: any) => {
            console.log('🎉 New match received:', match.matchId);
            this.matchHandlers.forEach(handler => handler(match));
        });

        // Listen for typing indicators
        this.socket.on('user_typing', (data: any) => {
            console.log('✍️ User typing:', data);
        });

        this.socket.on('user_stopped_typing', (data: any) => {
            console.log('✍️ User stopped typing:', data);
        });
    }

    /**
     * Disconnect from socket server
     */
    disconnect(): void {
        if (this.socket) {
            console.log('🔌 Disconnecting socket');
            this.socket.disconnect();
            this.socket = null;
            this.userId = null;
        }
    }

    /**
     * Check if socket is connected
     */
    isConnected(): boolean {
        return this.socket?.connected ?? false;
    }

    /**
     * Join a chat room (match room)
     */
    joinRoom(matchId: string): void {
        if (this.socket?.connected) {
            this.socket.emit('join_room', matchId);
            console.log('📍 Joined match room:', matchId);
        }
    }

    /**
     * Leave a chat room
     */
    leaveRoom(matchId: string): void {
        if (this.socket?.connected) {
            this.socket.emit('leave_room', matchId);
            console.log('📍 Left match room:', matchId);
        }
    }

    /**
     * Send a typing indicator
     */
    sendTyping(matchId: string): void {
        if (this.socket?.connected && this.userId) {
            this.socket.emit('typing', { matchId, userId: this.userId });
        }
    }

    /**
     * Send stopped typing indicator
     */
    sendStoppedTyping(matchId: string): void {
        if (this.socket?.connected && this.userId) {
            this.socket.emit('stop_typing', { matchId, userId: this.userId });
        }
    }

    /**
     * Register a handler for new messages
     */
    onNewMessage(handler: (message: any) => void): void {
        this.messageHandlers.add(handler);
    }

    /**
     * Register a handler for new matches
     */
    onNewMatch(handler: (match: any) => void): void {
        this.matchHandlers.add(handler);
    }

    /**
     * Register a handler for connection status changes
     */
    onConnectionChange(handler: (status: 'connected' | 'disconnected') => void): void {
        this.connectionHandlers.add(handler);
    }

    /**
     * Remove a specific event handler
     */
    off(event: string, handler: (data: any) => void): void {
        if (event === 'new_message') {
            this.messageHandlers.delete(handler);
        } else if (event === 'new_match') {
            this.matchHandlers.delete(handler);
        } else if (this.socket) {
            this.socket.off(event, handler);
        }
    }

    /**
     * Emit a custom event
     */
    emit(event: string, data: any): void {
        if (this.socket?.connected) {
            this.socket.emit(event, data);
        }
    }
}

// Export singleton instance
const socketService = new SocketService();
export default socketService;
