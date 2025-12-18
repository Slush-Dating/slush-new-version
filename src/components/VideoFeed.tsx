import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Heart, Star, X, MapPin } from 'lucide-react';
import './VideoFeed.css';

interface Profile {
    id: string;
    name: string;
    age: number;
    bio: string;
    videoUrl: string;
    distance: string;
}

const DUMMY_PROFILES: Profile[] = [
    {
        id: '1',
        name: 'Sarah',
        age: 24,
        bio: 'Finding the magic in everyday moments. ✨ Adventurer | Coffee Addict',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-light-dancing-alone-31508-large.mp4',
        distance: '2 miles away',
    },
    {
        id: '2',
        name: 'Alex',
        age: 27,
        bio: 'Life is better when you are laughing. Let\'s grab a drink! 🥃',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-man-dancing-under-a-street-light-at-night-34444-large.mp4',
        distance: '5 miles away',
    },
    {
        id: '3',
        name: 'Chloe',
        age: 22,
        bio: 'Sunsets and good vibes only. 🌅 Hiking enthusiast.',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-woman-running-on-top-of-a-mountain-at-sunset-34635-large.mp4',
        distance: '1 mile away',
    }
];

export const VideoFeed: React.FC<{ onOpenProfile: () => void }> = ({ onOpenProfile }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    const handleNext = () => {
        if (currentIndex < DUMMY_PROFILES.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            setCurrentIndex(0); // Loop for demo
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    return (
        <div className="video-feed-tiktok">
            <AnimatePresence mode="popLayout">
                <VideoCardTikTok
                    key={DUMMY_PROFILES[currentIndex].id}
                    profile={DUMMY_PROFILES[currentIndex]}
                    onSwipeUp={handleNext}
                    onSwipeDown={handlePrev}
                    onOpenProfile={onOpenProfile}
                />
            </AnimatePresence>
        </div>
    );
};

interface VideoCardProps {
    profile: Profile;
    onSwipeUp: () => void;
    onSwipeDown: () => void;
    onOpenProfile: () => void;
}

const VideoCardTikTok: React.FC<VideoCardProps> = ({ profile, onSwipeUp, onSwipeDown, onOpenProfile }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const y = useMotionValue(0);
    const opacity = useTransform(y, [-300, 0, 300], [0, 1, 0]);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.play().catch(e => console.log("Autoplay blocked", e));
        }
    }, [profile]);

    const handleDragEnd = (_: any, info: any) => {
        if (info.offset.y < -150) {
            onSwipeUp();
        } else if (info.offset.y > 150) {
            onSwipeDown();
        }
    };

    return (
        <motion.div
            className="video-card-tiktok"
            style={{ y, opacity }}
            initial={{ y: 800 }}
            animate={{ y: 0 }}
            exit={{ y: -800 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            onDragEnd={handleDragEnd}
            transition={{ type: "spring", damping: 25, stiffness: 150 }}
        >
            <video
                ref={videoRef}
                src={profile.videoUrl}
                loop
                muted
                playsInline
                className="tiktok-video-element"
            />

            {/* Side Actions Overlay - TikTok Style */}
            <div className="tiktok-actions">
                <div className="action-group">
                    <motion.div className="action-icon-wrapper" whileTap={{ scale: 0.8 }} onClick={onSwipeUp}>
                        <div className="icon-circle like-circle">
                            <Heart size={32} fill="white" stroke="white" />
                        </div>
                        <span>Like</span>
                    </motion.div>

                    <motion.div className="action-icon-wrapper" whileTap={{ scale: 0.8 }} onClick={onSwipeUp}>
                        <div className="icon-circle star-circle">
                            <Star size={28} fill="#FFD700" stroke="#FFD700" />
                        </div>
                        <span>Super</span>
                    </motion.div>

                    <motion.div className="action-icon-wrapper" whileTap={{ scale: 0.8 }} onClick={onSwipeUp}>
                        <div className="icon-circle pass-circle">
                            <X size={28} stroke="white" />
                        </div>
                        <span>Pass</span>
                    </motion.div>
                </div>
            </div>

            {/* Bottom Info Overlay */}
            <div className="tiktok-info-overlay" onClick={onOpenProfile}>
                <div className="tiktok-user-info">
                    <h3>@{profile.name.toLowerCase()} <span className="user-age">{profile.age}</span></h3>
                    <div className="tiktok-distance">
                        <MapPin size={14} />
                        <span>{profile.distance}</span>
                    </div>
                    <p className="tiktok-bio">{profile.bio}</p>
                </div>
            </div>

            <div className="tiktok-vignette-bottom"></div>
        </motion.div>
    );
};
