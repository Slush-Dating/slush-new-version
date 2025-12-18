import { io, Socket } from 'socket.io-client';

class SocketService {
    private socket: Socket | null = null;
    private userId: string | null = null;

    connect(userId: string): Promise<Socket> {
        return new Promise((resolve, reject) => {
            if (this.socket?.connected) {
                // If already connected, check if authenticated
                if (this.userId === userId) {
                    resolve(this.socket);
                    return;
                } else {
                    // Re-authenticate if userId changed
                    this.socket.emit('authenticate', userId);
                    this.socket.once('authenticated', () => {
                        this.userId = userId;
                        resolve(this.socket);
                    });
                    return;
                }
            }

            try {
                this.userId = userId;
                this.socket = io('http://localhost:5001', {
                    transports: ['websocket', 'polling'],
                    reconnection: true,
                    reconnectionDelay: 1000,
                    reconnectionAttempts: 5
                });

                this.socket.on('connect', () => {
                    console.log('Connected to chat server');
                    // Authenticate with user ID
                    this.socket?.emit('authenticate', userId);
                });

                // Wait for authentication confirmation
                this.socket.once('authenticated', () => {
                    console.log('Socket authenticated successfully');
                    resolve(this.socket!);
                });

                this.socket.on('disconnect', () => {
                    console.log('Disconnected from chat server');
                });

                this.socket.on('connect_error', (error) => {
                    console.error('Socket connection error:', error);
                    reject(error);
                });

                this.socket.on('error', (error) => {
                    console.error('Socket error:', error);
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

    onError(callback: (error: string) => void): void {
        if (this.socket) {
            this.socket.on('error', callback);
        }
    }

    // Remove listeners
    off(event: string, callback?: Function): void {
        if (this.socket) {
            if (callback) {
                this.socket.off(event, callback);
            } else {
                this.socket.off(event);
            }
        }
    }

    // Check if connected
    get isConnected(): boolean {
        return this.socket?.connected || false;
    }
}

// Export singleton instance
export const socketService = new SocketService();
export default socketService;
