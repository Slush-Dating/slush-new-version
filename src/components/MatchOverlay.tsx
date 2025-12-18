import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, X, User } from 'lucide-react';
import './MatchOverlay.css';

interface MatchData {
    matchId: string;
    user: {
        id: string;
        name: string;
        age: number | null;
        imageUrl: string | null;
        bio?: string;
    };
    matchedAt: string;
    context: string;
}

interface MatchOverlayProps {
    isVisible: boolean;
    matchData: MatchData | null;
    currentUser: any;
    onStartChat: (matchId: string) => void;
    onDismiss: () => void;
    onViewProfile?: (userId: string) => void;
}

export const MatchOverlay: React.FC<MatchOverlayProps> = ({
    isVisible,
    matchData,
    currentUser,
    onStartChat,
    onDismiss,
    onViewProfile
}) => {
    // Ensure we have the minimum required data to render
    if (!isVisible || !matchData || !currentUser) {
        if (isVisible) {
            console.warn('MatchOverlay: Missing required data', { isVisible, hasMatchData: !!matchData, hasCurrentUser: !!currentUser });
        }
        return null;
    }

    console.log('MatchOverlay rendering', { isVisible, matchData, currentUser });

    return (
        <AnimatePresence>
            {isVisible && matchData && currentUser && (
                <motion.div
                    className="match-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <motion.div
                        className="match-overlay-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />

                    <motion.div
                        className="match-overlay-content"
                        initial={{ scale: 0.8, opacity: 0, y: 50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.8, opacity: 0, y: 50 }}
                        transition={{
                            type: "spring",
                            damping: 25,
                            stiffness: 300,
                            delay: 0.1
                        }}
                    >
                        {/* Profile Images Container */}
                        <div className="match-profiles">
                            <motion.div
                                className="profile-image-wrapper"
                                initial={{ x: -100, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.3, type: "spring", damping: 20 }}
                            >
                                <div className="profile-image-container">
                                    {(currentUser.imageUrl || (currentUser.photos && currentUser.photos.length > 0)) ? (
                                        <img
                                            src={currentUser.imageUrl || (currentUser.photos && currentUser.photos[0] ? `http://localhost:5001${currentUser.photos[0]}` : '')}
                                            alt={currentUser.name || 'You'}
                                            className="profile-image"
                                        />
                                    ) : (
                                        <div className="profile-image-placeholder">
                                            {(currentUser.name && currentUser.name[0]) ? currentUser.name[0].toUpperCase() : 'U'}
                                        </div>
                                    )}
                                    <div className="profile-name">{currentUser.name || 'You'}</div>
                                </div>
                            </motion.div>

                            <motion.div
                                className="match-heart-container"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{
                                    delay: 0.5,
                                    type: "spring",
                                    damping: 15,
                                    stiffness: 200
                                }}
                            >
                                <Heart size={40} fill="var(--primary)" color="var(--primary)" />
                            </motion.div>

                            <motion.div
                                className="profile-image-wrapper"
                                initial={{ x: 100, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.3, type: "spring", damping: 20 }}
                            >
                                <div className="profile-image-container">
                                    {matchData.user.imageUrl ? (
                                        <img
                                            src={matchData.user.imageUrl.startsWith('http') 
                                                ? matchData.user.imageUrl 
                                                : `http://localhost:5001${matchData.user.imageUrl}`}
                                            alt={matchData.user.name || 'Match'}
                                            className="profile-image"
                                            onError={(e) => {
                                                // Fallback to placeholder if image fails to load
                                                const target = e.target as HTMLImageElement;
                                                target.style.display = 'none';
                                                const placeholder = target.nextElementSibling as HTMLElement;
                                                if (placeholder) placeholder.style.display = 'flex';
                                            }}
                                        />
                                    ) : null}
                                    {!matchData.user.imageUrl && (
                                        <div className="profile-image-placeholder">
                                            {(matchData.user.name && matchData.user.name[0]) ? matchData.user.name[0].toUpperCase() : '?'}
                                        </div>
                                    )}
                                    <div className="profile-name">{matchData.user.name || 'Unknown'}</div>
                                </div>
                            </motion.div>
                        </div>

                        {/* Match Text Animation */}
                        <motion.div
                            className="match-text-container"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.8, duration: 0.5 }}
                        >
                            <motion.h1
                                className="match-title gradient-text"
                                initial={{ scale: 0.5 }}
                                animate={{ scale: 1 }}
                                transition={{
                                    delay: 1,
                                    type: "spring",
                                    damping: 10,
                                    stiffness: 200
                                }}
                            >
                                It's a match!
                            </motion.h1>
                            <motion.p
                                className="match-subtitle"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 1.2 }}
                            >
                                You and {matchData.user.name} liked each other
                            </motion.p>
                        </motion.div>

                        {/* Action Buttons */}
                        <motion.div
                            className="match-actions"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.4, duration: 0.4 }}
                        >
                            <motion.button
                                className="vibrant-btn match-chat-btn"
                                onClick={() => onStartChat(matchData.matchId)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <MessageCircle size={20} />
                                Start Chatting
                            </motion.button>

                            {onViewProfile && matchData.user.id && (
                                <motion.button
                                    className="match-profile-btn"
                                    onClick={() => onViewProfile(matchData.user.id)}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <User size={20} />
                                    View Profile
                                </motion.button>
                            )}

                            <motion.button
                                className="match-dismiss-btn"
                                onClick={onDismiss}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <X size={20} />
                                Keep Swiping
                            </motion.button>
                        </motion.div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
