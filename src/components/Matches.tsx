import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Heart, Loader2, Sparkles, Users, Zap } from 'lucide-react';
import { matchService, type Match, type LikedYouUser } from '../services/api';
import socketService from '../services/socketService';
import { getAbsoluteMediaUrl } from '../services/apiConfig';
import './Matches.css';

export const Matches: React.FC<{
    user: any;
    onChat: (matchId: string) => void;
    onProfile: (userId: string) => void;
    onUpgrade: () => void;
}> = ({ user, onChat, onProfile, onUpgrade }) => {
    const [activeTab, setActiveTab] = useState<'matches' | 'likedYou'>('matches');
    const [matches, setMatches] = useState<Match[]>([]);
    const [likedYou, setLikedYou] = useState<LikedYouUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const socketCallbackRef = useRef<((matchData: any) => void) | null>(null);

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

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);

            try {
                // Fetch matches first as it's the primary content
                const matchesData = await matchService.getMatches();
                setMatches(matchesData);
            } catch (err: any) {
                console.error('Failed to fetch matches:', err);
                setError('Failed to load matches');
            }

            try {
                // Fetch liked you data secondary
                const likedYouData = await matchService.getLikedYou();
                // Sort to prioritize super-liked users at the top
                const sortedLikedYou = likedYouData.sort((a, b) => {
                    if (a.isSuperLike && !b.isSuperLike) return -1;
                    if (!a.isSuperLike && b.isSuperLike) return 1;
                    // If both are super-liked or neither, sort by likedAt (most recent first)
                    return new Date(b.likedAt).getTime() - new Date(a.likedAt).getTime();
                });
                setLikedYou(sortedLikedYou);
            } catch (err: any) {
                console.error('Failed to fetch liked you users:', err);
                // We don't set the main error here so matches still show
                // unless matches also failed
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Listen for new matches via socket
    useEffect(() => {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) return;

        const setupSocketListener = async () => {
            try {
                // Ensure socket is connected (App.tsx should have already connected, but ensure it here too)
                if (!socketService.isConnected) {
                    await socketService.connect(currentUserId);
                }

                // Handler for new matches - updates matches list in real-time
                const handleNewMatch = (matchData: any) => {
                    console.log('🎉 Matches component received new match via socket:', matchData);

                    // Check if match already exists (avoid duplicates)
                    setMatches(prevMatches => {
                        const exists = prevMatches.some(m => m.id === matchData.matchId);
                        if (exists) {
                            console.log('Match already exists, skipping');
                            return prevMatches;
                        }

                        // Transform match data to Match format
                        const newMatch: Match = {
                            id: matchData.matchId,
                            userId: matchData.user._id?.toString() || matchData.user.id || '',
                            name: matchData.user.name || 'Unknown',
                            age: matchData.user.age !== undefined
                                ? matchData.user.age
                                : (matchData.user.dob
                                    ? (() => {
                                        const today = new Date();
                                        const birthDate = new Date(matchData.user.dob);
                                        let age = today.getFullYear() - birthDate.getFullYear();
                                        const monthDiff = today.getMonth() - birthDate.getMonth();
                                        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                                            age--;
                                        }
                                        return age;
                                    })()
                                    : null),
                            imageUrl: matchData.user.imageUrl
                                || (matchData.user.photos && matchData.user.photos.length > 0
                                    ? getAbsoluteMediaUrl(matchData.user.photos[0])
                                    : null),
                            bio: matchData.user.bio || '',
                            matchedAt: matchData.matchedAt || new Date().toISOString(),
                            context: matchData.context || 'video_feed',
                            event: null,
                            isNew: true,
                            lastMessage: null
                        };

                        console.log('✨ Adding new match to list:', newMatch);
                        // Add new match at the beginning of the list
                        return [newMatch, ...prevMatches];
                    });
                };

                socketService.onNewMatch(handleNewMatch);
                socketCallbackRef.current = handleNewMatch;

            } catch (error) {
                console.error('Failed to setup socket for new matches:', error);
            }
        };

        setupSocketListener();

        // Cleanup
        return () => {
            if (socketCallbackRef.current) {
                socketService.off('new_match', socketCallbackRef.current);
                socketCallbackRef.current = null;
            }
        };
    }, []);

    const formatLastActive = (matchedAt: string) => {
        const matchDate = new Date(matchedAt);
        const now = new Date();
        const diffMs = now.getTime() - matchDate.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return matchDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };

    const newMatches = matches.filter(m => m.isNew);

    if (loading) {
        return (
            <div className="matches-container">
                <div className="matches-loading">
                    <Loader2 className="animate-spin" size={40} />
                    <p>Loading matches...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="matches-container">
                <div className="matches-error glass-dark">
                    <p>{error}</p>
                    <button className="vibrant-btn" onClick={() => window.location.reload()}>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="matches-container matches-page-enter">
            {/* Animated background orbs */}
            <div className="matches-orbs">
                <div className="matches-orb matches-orb-1" />
                <div className="matches-orb matches-orb-2" />
                <div className="matches-orb matches-orb-3" />
            </div>

            {/* Content wrapper for z-index layering */}
            <div className="matches-content">
                <header className="matches-header">
                    <h1>Matches</h1>
                    <p>This is a list of people who have liked you and your matches.</p>
                </header>

                <div className="tabs-container">
                    <button
                        className={`tab-btn ${activeTab === 'matches' ? 'active' : ''}`}
                        onClick={() => setActiveTab('matches')}
                    >
                        Matches
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'likedYou' ? 'active' : ''}`}
                        onClick={() => setActiveTab('likedYou')}
                    >
                        Liked You
                    </button>
                </div>

                {activeTab === 'matches' ? (
                    <>
                        {newMatches.length > 0 && (
                            <section className="new-matches">
                                <h3>New Sparks <Heart size={14} fill="var(--primary)" color="var(--primary)" /></h3>
                                <div className="sparks-scroll">
                                    {newMatches.map(match => (
                                        <div
                                            key={match.id}
                                            className="spark-item"
                                            onClick={() => onProfile(match.userId)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <div className="spark-avatar">
                                                {match.imageUrl ? (
                                                    <img src={match.imageUrl} alt={match.name} />
                                                ) : (
                                                    <div className="avatar-placeholder">
                                                        {match.name[0].toUpperCase()}
                                                    </div>
                                                )}
                                                <div className="new-indicator"></div>
                                            </div>
                                            <span>{match.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        <section className="matches-grid-section">
                            <h3>{newMatches.length > 0 ? 'All Matches' : 'Your Matches'}</h3>
                            {matches.length === 0 ? (
                                <div className="no-matches glass-dark">
                                    <div className="no-matches-icon">
                                        <Heart size={40} />
                                        <Sparkles size={20} className="sparkle-icon" />
                                        <Users size={16} className="users-icon" />
                                    </div>
                                    <h3 className="no-matches-title">No Matches Yet</h3>
                                    <p className="no-matches-message">
                                        Keep swiping and connecting! Your perfect match is out there waiting to meet you.
                                        Start exploring events and engaging with the community.
                                    </p>
                                    <div className="no-matches-tip">
                                        <Zap size={16} />
                                        <span>Tip: Try attending events to increase your chances!</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="matches-grid">
                                    {matches.map(match => (
                                        <div
                                            key={match.id}
                                            className={`match-card glass ${match.isSuperLike ? 'super-liked' : ''}`}
                                            onClick={() => onProfile(match.userId)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <div className="match-image-container">
                                                {match.imageUrl ? (
                                                    <img src={match.imageUrl} alt={match.name} className="match-img" />
                                                ) : (
                                                    <div className="match-img-placeholder">
                                                        {match.name[0].toUpperCase()}
                                                    </div>
                                                )}
                                                <button
                                                    className="match-chat-overlay"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onChat(match.id);
                                                    }}
                                                    title="Start Chat"
                                                >
                                                    <MessageCircle size={16} />
                                                </button>
                                            </div>
                                            <div className="match-info-overlay">
                                                <h4>
                                                    {match.name}
                                                    {match.age !== null && `, ${match.age}`}
                                                </h4>
                                                <div className="match-status">
                                                    <div className="online-dot"></div>
                                                    <span>{formatLastActive(match.matchedAt)}</span>
                                                </div>
                                                {match.isSuperLike && (
                                                    <div className="super-like-indicator">
                                                        <span>Super Match! ✨</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </>
                ) : (
                    <section className="liked-you-section">
                        <div className="matches-grid">
                            {likedYou.map((like) => (
                                <div key={like.id} className={`match-card glass liked-you-card ${like.isSuperLike ? 'super-liked' : ''} ${!user.isPremium ? 'premium-locked' : ''}`}>
                                    <div className={`match-image-container ${!user.isPremium ? 'blurred' : ''}`}>
                                        {like.imageUrl ? (
                                            <img
                                                src={getAbsoluteMediaUrl(like.imageUrl)}
                                                alt={user.isPremium ? like.name : "Blurred user"}
                                                className={`match-img ${!user.isPremium ? 'blur-effect' : ''}`}
                                            />
                                        ) : (
                                            <div className={`match-img-placeholder ${!user.isPremium ? 'blur-effect' : ''}`}>
                                                {user.isPremium ? like.name[0].toUpperCase() : '?'}
                                            </div>
                                        )}
                                    </div>
                                    {user.isPremium && (
                                        <div className="match-info-overlay">
                                            <h4>{like.name}{like.age && `, ${like.age}`}</h4>
                                            {like.isSuperLike && (
                                                <div className="super-like-indicator">
                                                    <span>Super Liked You!</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {!user.isPremium && (
                            <div className="premium-banner" onClick={onUpgrade} style={{ cursor: 'pointer' }}>
                                <div className="premium-content">
                                    <span>Update to Slush Silver (Premium) to see who has liked you!</span>
                                    <div className="crown-icon">👑</div>
                                </div>
                            </div>
                        )}
                    </section>
                )}
            </div>
        </div>
    );
};
