import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Search, Loader2, Heart } from 'lucide-react';
import { matchService, chatService, type Match } from '../services/api';
import socketService from '../services/socketService';
import { getAbsoluteMediaUrl } from '../services/apiConfig';
import type { ChatMessage } from '../types';
import './ChatList.css';

interface ChatListProps {
    onChat: (matchId: string) => void;
    refreshKey?: number; // Used to trigger a refresh when returning from chat
    onUnreadCountChange?: (change: number) => void; // Called when unread count changes
}

export const ChatList: React.FC<ChatListProps> = ({ onChat, refreshKey = 0, onUnreadCountChange }) => {
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [unreadByMatch, setUnreadByMatch] = useState<Record<string, number>>({});
    const [viewedMatches, setViewedMatches] = useState<Set<string>>(new Set());
    const socketCallbackRef = useRef<((message: ChatMessage) => void) | null>(null);

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

    // Debug: Log unread state changes
    useEffect(() => {
        console.log('📊 UnreadByMatch state:', unreadByMatch);
    }, [unreadByMatch]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                // Fetch matches first
                const matchesData = await matchService.getMatches();
                console.log('Matches Data:', matchesData);
                setMatches(matchesData);

                // Then try to fetch unread counts separately so we don't block the whole UI if it fails
                try {
                    const unreadData = await chatService.getUnreadCountByMatch();
                    console.log('📨 Unread counts fetched:', unreadData.unreadByMatch);
                    setUnreadByMatch(unreadData.unreadByMatch || {});
                } catch (unreadErr) {
                    console.error('Failed to fetch unread counts, continuing without highlighting:', unreadErr);
                    setUnreadByMatch({});
                }

                setError(null);
            } catch (err: any) {
                console.error('Failed to fetch matches:', err);
                setError(err.message || 'Failed to load chats');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [refreshKey]); // Re-fetch when refreshKey changes (e.g., when returning from chat)

    // Real-time socket subscription for instant message preview updates
    useEffect(() => {
        if (!currentUserId) return;

        const setupSocketListener = async () => {
            try {
                // Ensure socket is connected (App.tsx should have already connected, but ensure it here too)
                if (!socketService.isConnected) {
                    await socketService.connect(currentUserId);
                }

                // Track processed message IDs to prevent duplicate updates
                const processedMessageIds = new Set<string>();

                // Handler for new messages - updates preview in real-time
                const handleNewMessage = (message: ChatMessage) => {
                    // Deduplicate: we may receive the same message from both match room and user room
                    const messageId = message._id;
                    if (processedMessageIds.has(messageId)) {
                        console.log('🔄 ChatList: Skipping duplicate message:', messageId);
                        return;
                    }
                    processedMessageIds.add(messageId);

                    // Cleanup old IDs to prevent memory leak (keep last 100)
                    if (processedMessageIds.size > 100) {
                        const idsArray = Array.from(processedMessageIds);
                        idsArray.slice(0, 50).forEach(id => processedMessageIds.delete(id));
                    }

                    console.log('📨 ChatList received new message via socket:', message);
                    const matchId = message.matchId;

                    // Update the lastMessage preview for this match
                    setMatches(prevMatches =>
                        prevMatches.map(match => {
                            if (match.id === matchId) {
                                return {
                                    ...match,
                                    lastMessage: {
                                        content: message.content,
                                        createdAt: message.createdAt,
                                        senderId: typeof message.senderId === 'object'
                                            ? message.senderId._id
                                            : message.senderId
                                    }
                                };
                            }
                            return match;
                        })
                    );

                    // If message is from someone else, increment unread count
                    const senderId = typeof message.senderId === 'object'
                        ? message.senderId._id
                        : message.senderId;

                    if (senderId !== currentUserId) {
                        setUnreadByMatch(prev => ({
                            ...prev,
                            [matchId]: (prev[matchId] || 0) + 1
                        }));
                        // Remove from viewed to show unread indicator
                        setViewedMatches(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(matchId);
                            return newSet;
                        });

                        // Notify parent component about the unread count change (positive = increment)
                        if (onUnreadCountChange) {
                            console.log(`📨 New message received for match ${matchId}, incrementing unread count`);
                            onUnreadCountChange(1);
                        }
                    }
                };

                socketService.onNewMessage(handleNewMessage);
                socketCallbackRef.current = handleNewMessage;

            } catch (error) {
                console.error('Failed to setup socket for real-time previews:', error);
            }
        };

        setupSocketListener();

        // Fallback polling when socket might not be working
        const fallbackPolling = setInterval(async () => {
            try {
                // Only poll if we have matches and socket might not be connected
                if (matches.length > 0) {
                    const unreadData = await chatService.getUnreadCountByMatch();
                    setUnreadByMatch(unreadData.unreadByMatch || {});
                }
            } catch (error) {
                console.error('Fallback polling failed:', error);
            }
        }, 10000); // Poll every 10 seconds as fallback

        // Cleanup
        return () => {
            if (socketCallbackRef.current) {
                socketService.off('new_message', socketCallbackRef.current);
                socketCallbackRef.current = null;
            }
            clearInterval(fallbackPolling);
        };
    }, [currentUserId, matches.length]);

    const handleChatClick = async (matchId: string) => {
        // Get the current unread count for this match before marking as read
        const currentUnreadCount = unreadByMatch[matchId] || 0;

        // Mark this match as viewed locally
        setViewedMatches(prev => new Set(prev).add(matchId));

        // Remove from unread counts
        setUnreadByMatch(prev => {
            const updated = { ...prev };
            delete updated[matchId];
            return updated;
        });

        // Notify parent component about the unread count change (negative = decrement)
        if (onUnreadCountChange && currentUnreadCount > 0) {
            console.log(`📨 Marking ${currentUnreadCount} messages as read for match ${matchId}`);
            onUnreadCountChange(-currentUnreadCount);
        }

        // Call the mark as read API
        try {
            await chatService.markAsRead(matchId);
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }

        onChat(matchId);
    };

    const isUnread = (matchId: string): boolean => {
        // Check if there are unread messages and user hasn't viewed this match yet
        return (unreadByMatch[matchId] > 0) && !viewedMatches.has(matchId);
    };

    const filteredMatches = matches.filter(match =>
        match.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatLastActive = (matchedAt: string) => {
        const date = new Date(matchedAt);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };

    if (loading) {
        return (
            <div className="chat-list-container">
                <div className="chat-list-loading">
                    <Loader2 className="animate-spin" size={40} />
                    <p>Loading your conversations...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="chat-list-container">
                <div className="chat-list-error glass">
                    <p>{error}</p>
                    <button className="vibrant-btn" onClick={() => window.location.reload()}>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="chat-list-container chat-list-page-enter">
            {/* Animated background orbs */}
            <div className="chat-list-orbs">
                <div className="chat-list-orb chat-list-orb-1" />
                <div className="chat-list-orb chat-list-orb-2" />
                <div className="chat-list-orb chat-list-orb-3" />
            </div>

            {/* Content wrapper for z-index layering */}
            <div className="chat-list-content">
                <header className="chat-list-header">
                    <h1>Messages</h1>
                    <p>Chat with your matches and see your progress.</p>
                </header>

                <div className="chat-search glass-dark">
                    <Search size={20} />
                    <input
                        type="text"
                        placeholder="Search conversations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="conversations-list">
                    {filteredMatches.length === 0 ? (
                        <div className="no-chats glass">
                            <MessageSquare size={48} className="vibrant-text" />
                            <p>{searchQuery ? 'No chats found' : 'No active chats yet. Start matching!'}</p>
                        </div>
                    ) : (
                        filteredMatches.map(match => (
                            <div
                                key={match.id}
                                className={`chat-item glass ${isUnread(match.id) ? 'unread' : ''}`}
                                onClick={() => handleChatClick(match.id)}
                            >
                                <div className="chat-item-content">
                                    <div className="chat-avatar-wrapper">
                                        <div className="chat-avatar">
                                            {match.imageUrl ? (
                                                <img src={getAbsoluteMediaUrl(match.imageUrl)} alt={match.name} />
                                            ) : (
                                                <div className="avatar-placeholder">
                                                    {match.name[0].toUpperCase()}
                                                </div>
                                            )}
                                            {match.isNew && <div className="new-indicator"></div>}
                                        </div>
                                        {unreadByMatch[match.id] > 0 && (
                                            <div
                                                className="unread-badge"
                                                role="status"
                                                aria-label={`${unreadByMatch[match.id]} unread message${unreadByMatch[match.id] !== 1 ? 's' : ''}`}
                                            >
                                                {unreadByMatch[match.id] > 9 ? '9+' : unreadByMatch[match.id]}
                                            </div>
                                        )}
                                    </div>
                                    <div className="chat-info">
                                        <div className="chat-info-top">
                                            <h3>{match.name}</h3>
                                            <span className="last-time">
                                                {formatLastActive(match.lastMessage?.createdAt || match.matchedAt)}
                                            </span>
                                        </div>
                                        <div className="chat-info-bottom">
                                            <p className="last-message">
                                                {match.lastMessage ? (
                                                    <>
                                                        {match.lastMessage.senderId === currentUserId && 'You: '}
                                                        {match.lastMessage.content}
                                                    </>
                                                ) : match.isNew ? (
                                                    <span className="new-match-text">You just matched! Send a message.</span>
                                                ) : (
                                                    <span>Click to continue your conversation</span>
                                                )}
                                            </p>
                                            {match.isNew && !match.lastMessage && (
                                                <div className="match-tag">
                                                    <Heart size={10} fill="currentColor" />
                                                    <span>New Match</span>
                                                </div>
                                            )}
                                            {isUnread(match.id) && (
                                                <div
                                                    className="unread-tag"
                                                    role="status"
                                                    aria-label={`${unreadByMatch[match.id]} unread message${unreadByMatch[match.id] !== 1 ? 's' : ''}`}
                                                >
                                                    <span>{unreadByMatch[match.id]} new</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
