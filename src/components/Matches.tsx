import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Heart, Search, Loader2 } from 'lucide-react';
import { matchService, type Match } from '../services/api';
import './Matches.css';

export const Matches: React.FC<{
    user: any;
    onChat: (matchId: string) => void;
    onProfile: (userId: string) => void;
    onUpgrade: () => void;
}> = ({ user, onChat, onProfile, onUpgrade }) => {
    const [activeTab, setActiveTab] = useState<'matches' | 'likedYou'>('matches');
    const [matches, setMatches] = useState<Match[]>([]);
    const [likedYou, setLikedYou] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

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
                setLikedYou(likedYouData);
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

    const filteredMatches = matches.filter(match =>
        match.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const newMatches = filteredMatches.filter(m => m.isNew);

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
                <div className="matches-error glass">
                    <p>{error}</p>
                    <button className="vibrant-btn" onClick={() => window.location.reload()}>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <motion.div
            className="matches-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
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
                    <div className="discovery-search glass">
                        <Search size={20} />
                        <input
                            type="text"
                            placeholder="Search matches..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {newMatches.length > 0 && (
                        <section className="new-matches">
                            <h3>New Sparks <Heart size={14} fill="var(--primary)" color="var(--primary)" /></h3>
                            <div className="sparks-scroll">
                                {newMatches.map(match => (
                                    <motion.div
                                        key={match.id}
                                        className="spark-item"
                                        whileTap={{ scale: 0.9 }}
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
                                    </motion.div>
                                ))}
                            </div>
                        </section>
                    )}

                    <section className="matches-grid-section">
                        <h3>{newMatches.length > 0 ? 'All Matches' : 'Your Matches'}</h3>
                        {filteredMatches.length === 0 ? (
                            <div className="no-matches glass">
                                <Heart size={48} className="vibrant-text" />
                                <p>{searchQuery ? 'No matches found' : 'No matches yet. Start swiping!'}</p>
                            </div>
                        ) : (
                            <div className="matches-grid">
                                {filteredMatches.map(match => (
                                    <motion.div
                                        key={match.id}
                                        className="match-card glass"
                                        whileHover={{ scale: 1.02 }}
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
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </section>
                </>
            ) : (
                <section className="liked-you-section">
                    <div className="matches-grid">
                        {likedYou.map((like) => (
                            <div key={like.id} className={`match-card glass liked-you-card ${!user.isPremium ? 'premium-locked' : ''}`}>
                                <div className={`match-image-container ${!user.isPremium ? 'blurred' : ''}`}>
                                    {like.imageUrl ? (
                                        <img
                                            src={like.imageUrl.startsWith('http') ? like.imageUrl : `http://localhost:5001${like.imageUrl}`}
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
        </motion.div>
    );
};
