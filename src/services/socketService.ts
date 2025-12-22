import { io, Socket } from 'socket.io-client';
import { getSocketUrl } from './apiConfig';

class SocketService {
    private socket: Socket | null = null;
    private userId: string | null = null;

    connect(userId: string): Promise<Socket> {
        return new Promise((resolve, reject) => {
            // If we have a socket and it's connected and authenticated for the same user, reuse it
            if (this.socket?.connected && this.userId === userId) {
                console.log('✅ Socket already connected and authenticated, reusing connection');
                resolve(this.socket!);
                return;
            }

            // If socket exists but not connected, or different user, disconnect first
            if (this.socket) {
                console.log('🔄 Disconnecting existing socket before reconnecting');
                this.socket.disconnect();
                this.socket = null;
                this.userId = null;
            }

            try {
                this.userId = userId;
                // Get socket URL using shared configuration
                const socketUrl = getSocketUrl();
                console.log('🔌 Connecting to socket:', socketUrl);
                console.log('📍 Socket connection details:', {
                    hostname: window.location.hostname,
                    protocol: window.location.protocol,
                    isMobile: !!(window as any).Capacitor,
                    isDev: import.meta.env.DEV
                });
                this.socket = io(socketUrl, {
                    transports: ['websocket', 'polling'],
                    reconnection: true,
                    reconnectionDelay: 1000,
                    reconnectionAttempts: 5,
                    timeout: 20000
                });

                this.socket.on('connect', () => {
                    console.log('✅ Connected to chat server');
                    // Authenticate with user ID
                    this.socket?.emit('authenticate', userId);
                });

                // Wait for authentication confirmation
                this.socket.once('authenticated', () => {
                    console.log('✅ Socket authenticated successfully');
                    resolve(this.socket!);
                });

                this.socket.on('disconnect', () => {
                    console.log('⚠️ Disconnected from chat server');
                });

                this.socket.on('reconnect', () => {
                    console.log('🔄 Socket reconnected, re-authenticating...');
                    // Re-authenticate on reconnect
                    if (this.userId) {
                        this.socket?.emit('authenticate', this.userId);
                    }
                });

                this.socket.on('connect_error', (error) => {
                    console.error('❌ Socket connection error:', error);
                    // Don't reject on connect_error - let reconnection handle it
                    // reject(error);
                });

                this.socket.on('error', (error) => {
                    console.error('❌ Socket error:', error);
                });
            } catch (error) {
                console.error('Failed to initialize socket:', error);
                reject(error);
            }
        });
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    joinChat(matchId: string): void {
        if (this.socket) {
            this.socket.emit('join_chat', matchId);
        }
    }

    leaveChat(matchId: string): void {
        if (this.socket) {
            this.socket.emit('leave_chat', matchId);
        }
    }

    sendMessage(matchId: string, content: string, messageType: 'text' | 'image' | 'system' = 'text'): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.socket?.connected) {
                reject(new Error('Socket not connected'));
                return;
            }

            if (!this.userId) {
                reject(new Error('Socket not authenticated'));
                return;
            }

            console.log('Sending message via socket:', { matchId, content, messageType, userId: this.userId });

            // Set up a one-time error listener for this specific message
            const errorHandler = (error: string) => {
                console.error('Socket error when sending message:', error);
                this.socket?.off('error', errorHandler);
                this.socket?.off('message_sent', successHandler);
                reject(new Error(error));
            };

            // Set up success handler for acknowledgment
            const successHandler = (data: { messageId: string }) => {
                console.log('Message sent successfully:', data.messageId);
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

    startTyping(matchId: string): void {
        if (this.socket) {
            this.socket.emit('typing_start', matchId);
        }
    }

    stopTyping(matchId: string): void {
        if (this.socket) {
            this.socket.emit('typing_stop', matchId);
        }
    }

    // Event listeners
    onChatHistory(callback: (messages: any[]) => void): void {
        if (this.socket) {
            this.socket.on('chat_history', callback);
        }
    }

    onNewMessage(callback: (message: any) => void): void {
        if (this.socket) {
            this.socket.on('new_message', callback);
        }
    }

    onTypingStart(callback: (userId: string) => void): void {
        if (this.socket) {
            this.socket.on('typing_start', callback);
        }
    }

    onTypingStop(callback: (userId: string) => void): void {
        if (this.socket) {
            this.socket.on('typing_stop', callback);
        }
    }

    onNotification(callback: (notification: any) => void): void {
        if (this.socket) {
            this.socket.on('notification', callback);
        }
    }

    onForceLogout(callback: (data: any) => void): void {
        if (this.socket) {
            this.socket.on('force_logout', callback);
        }
    }

    offForceLogout(callback?: (data: any) => void): void {
        if (this.socket) {
            this.socket.off('force_logout', callback);
        }
    }

    onError(callback: (error: string) => void): void {
        if (this.socket) {
            this.socket.on('error', callback);
        }
    }

    onNewMatch(callback: (matchData: any) => void): void {
        if (this.socket) {
            this.socket.on('new_match', callback);
        }
    }

    // User status methods
    getUserStatus(userId: string): void {
        if (this.socket) {
            this.socket.emit('get_user_status', userId);
        }
    }

    onUserStatus(callback: (data: { userId: string; isOnline: boolean }) => void): void {
        if (this.socket) {
            this.socket.on('user_status', callback);
        }
    }

    onUserStatusChange(callback: (data: { userId: string; isOnline: boolean }) => void): void {
        if (this.socket) {
            this.socket.on('user_status_change', callback);
        }
    }

    // Waiting room / Event session methods
    joinEventSession(eventId: string): void {
        if (this.socket) {
            this.socket.emit('join_event_session', eventId);
        }
    }

    leaveEventSession(eventId: string): void {
        if (this.socket) {
            this.socket.emit('leave_event_session', eventId);
        }
    }

    onUserJoinedSession(callback: (data: { userId: string }) => void): void {
        if (this.socket) {
            this.socket.on('user_joined_session', callback);
        }
    }

    onUserLeftSession(callback: (data: { userId: string }) => void): void {
        if (this.socket) {
            this.socket.on('user_left_session', callback);
        }
    }

    onParticipantCountUpdate(callback: (data: { count: number; eventId: string }) => void): void {
        if (this.socket) {
            this.socket.on('participant_count_update', callback);
        }
    }

    onPartnerFound(callback: (data: { partnerId: string; channelName: string; eventId: string }) => void): void {
        if (this.socket) {
            this.socket.on('partner_found', callback);
        }
    }

    // Remove listeners
    off(event: string, callback?: (...args: any[]) => void): void {
        if (this.socket) {
            if (callback) {
                this.socket.off(event, callback);
            } else {
                this.socket.off(event);
            }
        }
    }

    // Check if connected and authenticated
    get isConnected(): boolean {
        return this.socket?.connected && this.userId !== null || false;
    }

    // Get connection status details
    getConnectionStatus(): { connected: boolean; authenticated: boolean; userId: string | null } {
        return {
            connected: this.socket?.connected || false,
            authenticated: this.userId !== null,
            userId: this.userId
        };
    }
}

// Export singleton instance
export const socketService = new SocketService();
export default socketService;
