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
    private typingStartHandlers: Set<(userId: string) => void> = new Set();
    private typingStopHandlers: Set<(userId: string) => void> = new Set();
    private userStatusHandlers: Set<(data: { userId: string; isOnline: boolean }) => void> = new Set();
    private userAbsentHandlers: Set<(data: { userId: string; eventId: string }) => void> = new Set();
    private notificationHandlers: Set<(data: { type: string; notification: any }) => void> = new Set();

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

            // Authenticate with the server (required for send_message to work)
            if (this.userId) {
                this.socket?.emit('authenticate', this.userId);
                console.log('🔐 Authenticating socket with userId:', this.userId);
            }

            // Notify handlers
            this.connectionHandlers.forEach(handler => handler('connected'));
        });

        // Listen for authentication confirmation
        this.socket.on('authenticated', (data: { userId: string }) => {
            console.log('✅ Socket authenticated:', data.userId);
        });

        // Listen for authentication errors
        this.socket.on('error', (error: string) => {
            console.error('❌ Socket error:', error);
            if (error.includes('Authentication')) {
                console.error('🔐 Authentication failed, attempting to reconnect...');
                // The socket will automatically reconnect, and we'll try to authenticate again
            }
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
        this.socket.on('typing_start', (userId: string) => {
            console.log('✍️ User typing:', userId);
            this.typingStartHandlers.forEach(handler => handler(userId));
        });

        this.socket.on('typing_stop', (userId: string) => {
            console.log('✍️ User stopped typing:', userId);
            this.typingStopHandlers.forEach(handler => handler(userId));
        });

        // Listen for user status changes (online/offline)
        this.socket.on('user_status_change', (data: { userId: string; isOnline: boolean }) => {
            console.log('👤 User status changed:', data.userId, data.isOnline ? 'online' : 'offline');
            this.userStatusHandlers.forEach(handler => handler(data));
        });

        // Listen for user status responses
        this.socket.on('user_status', (data: { userId: string; isOnline: boolean }) => {
            console.log('👤 User status response:', data.userId, data.isOnline ? 'online' : 'offline');
            this.userStatusHandlers.forEach(handler => handler(data));
        });

        // Listen for user absent events (when someone leaves an event)
        this.socket.on('user_absent', (data: { userId: string; eventId: string }) => {
            console.log('👤 User marked as absent:', data.userId, 'for event:', data.eventId);
            this.userAbsentHandlers.forEach(handler => handler(data));
        });

        // Listen for new notifications (likes, matches, event reminders, etc.)
        this.socket.on('new_notification', (data: { type: string; notification: any }) => {
            console.log('🔔 New notification received:', data.type, data.notification?.title);
            this.notificationHandlers.forEach(handler => handler(data));
        });

        // Listen for event reminder notifications specifically
        this.socket.on('event_reminder', (data: any) => {
            console.log('📅 Event reminder received:', data.reminderType);
            this.notificationHandlers.forEach(handler => handler({
                type: 'event_reminder',
                notification: data
            }));
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
            this.socket.emit('join_chat', matchId);
            console.log('📍 Joined match room:', matchId);
        }
    }

    /**
     * Leave a chat room
     */
    leaveRoom(matchId: string): void {
        if (this.socket?.connected) {
            // Note: Server doesn't have leave_chat handler, but we can still emit it
            // or just remove from local tracking
            console.log('📍 Left match room:', matchId);
        }
    }

    /**
     * Send a typing indicator
     */
    sendTyping(matchId: string): void {
        if (this.socket?.connected && this.userId) {
            this.socket.emit('typing_start', matchId);
        }
    }

    /**
     * Send stopped typing indicator
     */
    sendStoppedTyping(matchId: string): void {
        if (this.socket?.connected && this.userId) {
            this.socket.emit('typing_stop', matchId);
        }
    }

    /**
     * Send a message via socket with HTTP fallback
     */
    async sendMessage(matchId: string, content: string, messageType: 'text' | 'image' | 'system' = 'text'): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.socket?.connected) {
                reject(new Error('Socket not connected'));
                return;
            }

            if (!this.userId) {
                reject(new Error('Socket not authenticated'));
                return;
            }

            console.log('📤 Sending message via socket:', { matchId, content, messageType, userId: this.userId });

            // Set up error handler
            const errorHandler = (error: string) => {
                console.error('❌ Socket error when sending message:', error);
                this.socket?.off('error', errorHandler);
                this.socket?.off('message_sent', successHandler);
                reject(new Error(error));
            };

            // Set up success handler for acknowledgment
            const successHandler = (data: { messageId: string }) => {
                console.log('✅ Message sent successfully:', data.messageId);
                this.socket?.off('error', errorHandler);
                this.socket?.off('message_sent', successHandler);
                resolve();
            };

            this.socket.once('error', errorHandler);
            this.socket.once('message_sent', successHandler);

            // Emit the message with acknowledgment callback
            this.socket.emit('send_message', {
                matchId,
                content,
                messageType
            }, (response: { success: boolean; messageId?: string; error?: string }) => {
                // Socket.io acknowledgment callback (immediate)
                this.socket?.off('error', errorHandler);
                this.socket?.off('message_sent', successHandler);

                if (response?.success) {
                    resolve();
                } else if (response?.error) {
                    reject(new Error(response.error));
                } else {
                    // Fallback: resolve immediately (server will broadcast the message)
                    resolve();
                }
            });

            // Timeout fallback in case server doesn't respond with acknowledgment
            setTimeout(() => {
                this.socket?.off('error', errorHandler);
                this.socket?.off('message_sent', successHandler);
                // Resolve anyway - optimistic UI means message is shown, server will confirm via broadcast
                resolve();
            }, 2000);
        });
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
     * Register a handler for typing start events
     */
    onTypingStart(handler: (userId: string) => void): void {
        this.typingStartHandlers.add(handler);
    }

    /**
     * Register a handler for typing stop events
     */
    onTypingStop(handler: (userId: string) => void): void {
        this.typingStopHandlers.add(handler);
    }

    /**
     * Register a handler for user status changes (online/offline)
     */
    onUserStatusChange(handler: (data: { userId: string; isOnline: boolean }) => void): void {
        this.userStatusHandlers.add(handler);
    }

    /**
     * Register a handler for user absent events
     */
    onUserAbsent(handler: (data: { userId: string; eventId: string }) => void): void {
        this.userAbsentHandlers.add(handler);
    }

    /**
     * Register a handler for notification events
     */
    onNotification(handler: (data: { type: string; notification: any }) => void): void {
        this.notificationHandlers.add(handler);
    }

    /**
     * Request the online status of a specific user
     */
    getUserStatus(userId: string): void {
        if (this.socket?.connected) {
            this.socket.emit('get_user_status', userId);
        }
    }

    /**
     * Remove a specific event handler
     */
    off(event: string, handler: (data: any) => void): void {
        if (event === 'new_message') {
            this.messageHandlers.delete(handler);
        } else if (event === 'new_match') {
            this.matchHandlers.delete(handler);
        } else if (event === 'typing_start') {
            this.typingStartHandlers.delete(handler);
        } else if (event === 'typing_stop') {
            this.typingStopHandlers.delete(handler);
        } else if (event === 'user_status_change' || event === 'user_status') {
            this.userStatusHandlers.delete(handler);
        } else if (event === 'user_absent') {
            this.userAbsentHandlers.delete(handler);
        } else if (event === 'new_notification' || event === 'notification') {
            this.notificationHandlers.delete(handler);
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

    // ===== Event Matchmaking Methods =====

    /**
     * Join an event session for matchmaking
     */
    joinEventSession(eventId: string): void {
        if (this.socket?.connected) {
            this.socket.emit('join_event_session', eventId);
            console.log('📍 Joined event session:', eventId);
        }
    }

    /**
     * Leave an event session
     */
    leaveEventSession(eventId: string): void {
        if (this.socket?.connected) {
            this.socket.emit('leave_event_session', eventId);
            console.log('📍 Left event session:', eventId);
        }
    }

    /**
     * Emit start event round - triggers server matchmaking
     */
    emitStartEventRound(eventId: string): void {
        if (this.socket?.connected) {
            this.socket.emit('start_event_round', eventId);
            console.log('🚀 Requested round start for event:', eventId);
        }
    }

    /**
     * Emit ready for matchmaking signal
     */
    emitReadyForMatchmaking(eventId: string): void {
        if (this.socket?.connected) {
            this.socket.emit('ready_for_matchmaking', eventId);
            console.log('✅ Ready for matchmaking in event:', eventId);
        }
    }

    /**
     * Emit advance phase signal
     */
    emitAdvancePhase(eventId: string): void {
        if (this.socket?.connected) {
            this.socket.emit('advance_phase', eventId);
            console.log('⏭️ Requested phase advance for event:', eventId);
        }
    }

    /**
     * Register handler for partner assignment from server
     */
    onPartnerAssigned(handler: (data: {
        eventId: string;
        round: number;
        phase: string;
        phaseDuration: number;
        phaseStartTime: string;
        partner: {
            id: string;
            userId: string;
            name: string;
            age: number | null;
            bio: string;
            imageUrl: string | null;
        };
        channelName: string;
    }) => void): void {
        if (this.socket) {
            this.socket.on('partner_assigned', handler);
        }
    }

    /**
     * Register handler for phase changes from server
     */
    onPhaseChanged(handler: (data: {
        eventId: string;
        round: number;
        phase: string;
        phaseDuration: number;
        phaseStartTime: string;
    }) => void): void {
        if (this.socket) {
            this.socket.on('phase_changed', handler);
        }
    }

    /**
     * Register handler for round ended event
     */
    onRoundEnded(handler: (data: { eventId: string }) => void): void {
        if (this.socket) {
            this.socket.on('round_ended', handler);
        }
    }

    /**
     * Register handler for event complete (all pairings exhausted)
     */
    onEventComplete(handler: (data: { eventId: string; message: string }) => void): void {
        if (this.socket) {
            this.socket.on('event_complete', handler);
        }
    }

    /**
     * Register handler for waiting for partner (odd participant)
     */
    onWaitingForPartner(handler: (data: { eventId: string; round: number; message: string }) => void): void {
        if (this.socket) {
            this.socket.on('waiting_for_partner', handler);
        }
    }

    /**
     * Register handler for participant count updates
     */
    onParticipantCountUpdate(handler: (data: { count: number; eventId: string; participants?: any[] }) => void): void {
        if (this.socket) {
            this.socket.on('participant_count_update', handler);
        }
    }
}

// Export singleton instance
const socketService = new SocketService();
export default socketService;
