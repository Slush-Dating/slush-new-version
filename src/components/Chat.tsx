import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Image, Smile, MoreVertical, Loader2, User, Flag } from 'lucide-react';
import { chatService, matchService } from '../services/api';
import socketService from '../services/socketService';
import type { ChatMessage } from '../types';
import './Chat.css';

interface MatchUser {
    id: string;
    userId: string;
    name: string;
    age: number | null;
    imageUrl: string | null;
    bio: string;
}

export const Chat: React.FC<{ matchId: string, onBack: () => void; onViewProfile?: (userId: string) => void }> = ({ matchId, onBack, onViewProfile }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [matchUser, setMatchUser] = useState<MatchUser | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isTyping, setIsTyping] = useState(false);
    const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
    const [isSocketConnected, setIsSocketConnected] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const socketConnected = useRef(false);
    const socketCallbacksRef = useRef<{
        onNewMessage?: (message: ChatMessage) => void;
        onTypingStart?: (userId: string) => void;
        onTypingStop?: (userId: string) => void;
        onError?: (error: string) => void;
    }>({});

    const [showMenu, setShowMenu] = useState(false);

    const handleUnmatch = async () => {
        if (!matchUser || !window.confirm('Are you sure you want to unmatch? This action cannot be undone.')) return;

        try {
            await matchService.unmatch(matchUser.userId);
            onBack();
        } catch (err: any) {
            alert('Failed to unmatch. Please try again.');
        }
    };

    const handleReport = async () => {
        if (!matchUser) return;
        const reason = prompt('Please provide a reason for reporting this user:');
        if (!reason) return;

        try {
            await matchService.report(matchUser.userId, reason);
            alert('Report submitted.');
            setShowMenu(false);
        } catch (err: any) {
            alert('Failed to report. Please try again.');
        }
    };

    // Debug: Track input value changes
    useEffect(() => {
        console.log('Input value changed:', inputValue);
    }, [inputValue]);

    // Ensure input is focusable when component mounts
    useEffect(() => {
        if (!loading && inputRef.current && !sending) {
            // Small delay to ensure DOM is ready
            const timer = setTimeout(() => {
                if (inputRef.current) {
                    console.log('Attempting to focus input');
                    inputRef.current.focus();
                    console.log('Input focused, disabled state:', inputRef.current.disabled);
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [loading, sending]);

    // Get current user ID from token
    const getCurrentUserId = (): string | null => {
        const token = localStorage.getItem('token');
        if (!token) return null;
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.userId;
        } catch {
            return null;
        }
    };

    const currentUserId = getCurrentUserId();

    // Input change handler - simplified and direct
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        console.log('Input change event fired, value:', value, 'Event type:', e.type);
        setInputValue(value);
        console.log('State updated, new inputValue will be:', value);
    };

    const handleSend = useCallback(async () => {
        if (!inputValue.trim() || sending || !currentUserId) return;

        const content = inputValue.trim();
        setInputValue('');

        // Generate a temporary client-side ID for optimistic UI
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Create optimistic message that appears immediately
        const optimisticMessage: ChatMessage = {
            _id: tempId,
            matchId,
            senderId: {
                _id: currentUserId,
                name: 'You',
                profilePicture: undefined
            },
            receiverId: matchUser?.userId || '',
            content,
            messageType: 'text',
            isRead: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Add message immediately (optimistic update)
        setMessages(prev => [...prev, optimisticMessage]);

        try {
            setSending(true);

            // Try socket first, fallback to HTTP if socket not connected
            if (socketService.isConnected) {
                try {
                    await socketService.sendMessage(matchId, content, 'text');
                    // Socket will broadcast the message back, we'll deduplicate by content+time
                } catch (socketErr: any) {
                    // If socket fails, fallback to HTTP
                    if (socketErr.message === 'Socket not connected') {
                        const message = await chatService.sendMessage(matchId, content, 'text');
                        // Replace optimistic message with real one
                        setMessages(prev => prev.map(m =>
                            m._id === tempId ? message : m
                        ));
                    } else {
                        throw socketErr;
                    }
                }
            } else {
                // Use HTTP API as fallback
                const message = await chatService.sendMessage(matchId, content, 'text');
                // Replace optimistic message with real one
                setMessages(prev => prev.map(m =>
                    m._id === tempId ? message : m
                ));
            }
        } catch (err: any) {
            console.error('Failed to send message:', err);
            // Remove optimistic message on failure
            setMessages(prev => prev.filter(m => m._id !== tempId));
            // Revert the input value
            setInputValue(content);
            setError(err.message || 'Failed to send message. Please try again.');
        } finally {
            setSending(false);
        }
    }, [inputValue, sending, currentUserId, matchId, matchUser]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !sending && inputValue.trim()) {
            e.preventDefault();
            handleSend();
        }
    }, [sending, inputValue, handleSend]);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Load match details and chat history
    useEffect(() => {
        const loadChat = async () => {
            if (!currentUserId) {
                setError('Not authenticated');
                setLoading(false);
                return;
            }

            if (!matchId) {
                setError('Invalid match ID');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);

                // Get match details
                const match = await matchService.getMatchById(matchId);

                // Backend already returns the other user's data
                // match.userId is the other user's ID, not the current user's
                const otherUser = {
                    id: match.id,
                    userId: match.userId,
                    name: match.name,
                    age: match.age,
                    imageUrl: match.imageUrl,
                    bio: match.bio
                };

                setMatchUser(otherUser);

                // Load chat history
                const chatHistory = await chatService.getChatHistory(matchId);
                setMessages(chatHistory.messages || []);

                // Connect to socket if not connected
                if (!socketConnected.current) {
                    try {
                        await socketService.connect(currentUserId);
                        socketService.joinChat(matchId);
                        socketConnected.current = true;
                        setIsSocketConnected(socketService.isConnected);

                        // Set up event listeners with stored references for cleanup
                        // Deduplicates messages to handle optimistic updates
                        const onNewMessageCallback = (message: ChatMessage) => {
                            setMessages(prev => {
                                // Check for duplicates - match by content and approximate time for optimistic messages
                                const isDuplicate = prev.some(m => {
                                    // If real message already exists
                                    if (m._id === message._id) return true;
                                    // If optimistic message matches this server message
                                    if (m._id.startsWith('temp_')) {
                                        const timeDiff = Math.abs(new Date(m.createdAt).getTime() - new Date(message.createdAt).getTime());
                                        return m.content === message.content && timeDiff < 5000; // Within 5 seconds
                                    }
                                    return false;
                                });

                                if (isDuplicate) {
                                    // Replace optimistic message with real one
                                    return prev.map(m => {
                                        if (m._id.startsWith('temp_') && m.content === message.content) {
                                            return message;
                                        }
                                        return m._id === message._id ? message : m;
                                    });
                                }

                                return [...prev, message];
                            });
                        };
                        socketService.onNewMessage(onNewMessageCallback);
                        socketCallbacksRef.current.onNewMessage = onNewMessageCallback;

                        const onTypingStartCallback = (userId: string) => {
                            if (userId !== currentUserId) {
                                setIsOtherUserTyping(true);
                            }
                        };
                        socketService.onTypingStart(onTypingStartCallback);
                        socketCallbacksRef.current.onTypingStart = onTypingStartCallback;

                        const onTypingStopCallback = (userId: string) => {
                            if (userId !== currentUserId) {
                                setIsOtherUserTyping(false);
                            }
                        };
                        socketService.onTypingStop(onTypingStopCallback);
                        socketCallbacksRef.current.onTypingStop = onTypingStopCallback;

                        const onErrorCallback = (error: string) => {
                            console.error('Socket error:', error);
                            setIsSocketConnected(false);
                        };
                        socketService.onError(onErrorCallback);
                        socketCallbacksRef.current.onError = onErrorCallback;

                        // Monitor connection status
                        const checkConnection = setInterval(() => {
                            setIsSocketConnected(socketService.isConnected);
                        }, 1000);

                        // Cleanup interval on component unmount
                        return () => {
                            clearInterval(checkConnection);
                        };
                    } catch (socketError) {
                        console.error('Failed to connect socket:', socketError);
                        setIsSocketConnected(false);
                        // Continue without socket - messages will still work via HTTP
                    }
                }

                setError(null);
            } catch (err: any) {
                console.error('Failed to load chat:', err);
                setError(err.message || 'Failed to load chat');
            } finally {
                setLoading(false);
            }
        };

        loadChat();

        // Cleanup function
        return () => {
            if (socketConnected.current) {
                // Remove event listeners using stored callback references
                if (socketCallbacksRef.current.onNewMessage) {
                    socketService.off('new_message', socketCallbacksRef.current.onNewMessage);
                }
                if (socketCallbacksRef.current.onTypingStart) {
                    socketService.off('typing_start', socketCallbacksRef.current.onTypingStart);
                }
                if (socketCallbacksRef.current.onTypingStop) {
                    socketService.off('typing_stop', socketCallbacksRef.current.onTypingStop);
                }
                if (socketCallbacksRef.current.onError) {
                    socketService.off('error', socketCallbacksRef.current.onError);
                }
                socketService.leaveChat(matchId);
                socketConnected.current = false;
                socketCallbacksRef.current = {};
            }
        };
    }, [matchId, currentUserId]);

    // Handle typing indicators
    useEffect(() => {
        let typingTimer: ReturnType<typeof setTimeout>;

        if (inputValue && !isTyping && socketService.isConnected) {
            setIsTyping(true);
            socketService.startTyping(matchId);
        } else if (!inputValue && isTyping) {
            typingTimer = setTimeout(() => {
                setIsTyping(false);
                if (socketService.isConnected) {
                    socketService.stopTyping(matchId);
                }
            }, 1000);
        }

        return () => {
            if (typingTimer) clearTimeout(typingTimer);
        };
    }, [inputValue, isTyping, matchId]);

    const formatMessageTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'now';
        if (diffMins < 60) return `${diffMins}m ago`;

        const hours = Math.floor(diffMins / 60);
        if (hours < 24) return `${hours}h ago`;

        return date.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const isMessageFromMe = (message: ChatMessage) => {
        if (!message || !currentUserId) return false;
        // Handle both populated object and string ID formats
        if (typeof message.senderId === 'object' && message.senderId._id) {
            return message.senderId._id === currentUserId || message.senderId._id.toString() === currentUserId;
        }
        // Handle string senderId
        const senderIdStr = typeof message.senderId === 'string' ? message.senderId : String(message.senderId);
        return senderIdStr === currentUserId;
    };

    if (loading) {
        return (
            <motion.div
                className="chat-container"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
            >
                <div className="chat-loading">
                    <Loader2 className="animate-spin" size={40} />
                    <p>Loading chat...</p>
                </div>
            </motion.div>
        );
    }

    if (error || !matchUser) {
        return (
            <motion.div
                className="chat-container"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
            >
                <div className="chat-error glass">
                    <p>{error || 'Unable to load chat'}</p>
                    <button className="vibrant-btn" onClick={onBack}>
                        Go Back
                    </button>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            className="chat-container"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            <header className="chat-header glass">
                <div className="header-left">
                    <button className="back-btn" onClick={onBack}>
                        <ArrowLeft size={24} />
                    </button>
                    <div className="chat-user">
                        <div className="user-avatar">
                            {matchUser.imageUrl ? (
                                <img
                                    src={matchUser.imageUrl.startsWith('http')
                                        ? matchUser.imageUrl
                                        : `http://localhost:5001${matchUser.imageUrl}`}
                                    alt={matchUser.name}
                                />
                            ) : (
                                <div className="avatar-placeholder">
                                    {matchUser.name?.[0]?.toUpperCase() || '?'}
                                </div>
                            )}
                            <div className={`online-status ${isSocketConnected ? '' : 'disconnected'}`}></div>
                        </div>
                        <div className="user-text">
                            <h4>{matchUser.name}</h4>
                            <span className={isSocketConnected ? 'online' : 'offline'}>
                                {isSocketConnected ? 'Connected' : 'Offline'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="header-right">
                    {onViewProfile && matchUser.userId && (
                        <button
                            className="icon-btn"
                            onClick={() => onViewProfile(matchUser.userId)}
                            title="View Profile"
                        >
                            <User size={20} />
                        </button>
                    )}
                    <div className="chat-menu-container">
                        <button
                            className="icon-btn"
                            onClick={() => setShowMenu(!showMenu)}
                        >
                            <MoreVertical size={20} />
                        </button>
                        <AnimatePresence>
                            {showMenu && (
                                <motion.div
                                    className="chat-menu-dropdown"
                                    initial={{ opacity: 0, scale: 0.9, y: -10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                >
                                    <button
                                        className="menu-item unmatch"
                                        onClick={() => {
                                            handleUnmatch();
                                            setShowMenu(false);
                                        }}
                                    >
                                        <Flag size={16} />
                                        Unmatch
                                    </button>
                                    <button
                                        className="menu-item report"
                                        onClick={() => {
                                            handleReport();
                                            setShowMenu(false);
                                        }}
                                    >
                                        <Flag size={16} />
                                        Report
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </header>

            <div className="messages-area">
                <AnimatePresence initial={false}>
                    {messages.map((msg) => (
                        <motion.div
                            key={msg._id}
                            className={`message-bubble ${isMessageFromMe(msg) ? 'me' : 'them'}`}
                            initial={{ scale: 0.8, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                        >
                            <div className="bubble-content">{msg.content}</div>
                            <span className="bubble-time">{formatMessageTime(msg.createdAt)}</span>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* Typing indicator */}
                {isOtherUserTyping && (
                    <motion.div
                        className="message-bubble them typing-indicator"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                    >
                        <div className="typing-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </motion.div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <footer className="chat-input-area glass">
                <div className="input-tools">
                    <button className="tool-btn" disabled><Image size={20} /></button>
                    <button className="tool-btn" disabled><Smile size={20} /></button>
                </div>
                <div className="input-wrapper">
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Type a message..."
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onFocus={(e) => {
                            console.log('Input focused, value:', e.target.value);
                        }}
                        onBlur={(e) => {
                            console.log('Input blurred, value:', e.target.value);
                        }}
                        onClick={(e) => {
                            console.log('Input clicked');
                            e.stopPropagation();
                        }}
                        onMouseDown={(e) => {
                            console.log('Input mouse down');
                            e.stopPropagation();
                        }}
                        disabled={sending}
                        autoFocus
                        autoComplete="off"
                        spellCheck={false}
                        style={{ pointerEvents: 'auto' }}
                        readOnly={false}
                    />
                    <button
                        className="send-btn vibrant-btn"
                        onClick={handleSend}
                        disabled={!inputValue.trim() || sending}
                    >
                        {sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                    </button>
                </div>
            </footer>
        </motion.div>
    );
};
