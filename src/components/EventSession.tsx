import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, X, Video, VideoOff, Mic, MicOff, Sparkles, PhoneOff, Trophy, Users, Clock } from 'lucide-react';
import './EventSession.css';

type Phase = 'prep' | 'date' | 'feedback' | 'summary' | 'ended';

interface Profile {
    id: string;
    name: string;
    age: number;
    bio: string;
    imageUrl: string;
    videoUrl: string;
}

const DUMMY_PARTNERS: Profile[] = [
    {
        id: 'p1',
        name: 'Emily',
        age: 24,
        bio: 'Traveler & Foodie. Always down for a new adventure!',
        imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-light-dancing-alone-31508-large.mp4'
    },
    {
        id: 'p2',
        name: 'Jessica',
        age: 26,
        bio: 'Art lover and weekend hiker. Let\'s explore!',
        imageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-woman-running-on-top-of-a-mountain-at-sunset-34635-large.mp4'
    }
];

export const EventSession: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
    const [round, setRound] = useState(1);
    const [phase, setPhase] = useState<Phase>('prep');
    const [timeLeft, setTimeLeft] = useState(60); // Start with 60s prep
    const [partner, setPartner] = useState<Profile>(DUMMY_PARTNERS[0]);

    const [isCamOn, setIsCamOn] = useState(true);
    const [isMicOn, setIsMicOn] = useState(true);
    const [showPrepCam, setShowPrepCam] = useState(false);
    const myVideoRef = useRef<HTMLVideoElement>(null);

    // Timer & Phase Logic
    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    // Don't auto-transition for summary phase - let users review and click continue
                    if (phase !== 'summary') {
                        handlePhaseTransition();
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [phase, round]);

    const handlePhaseTransition = () => {
        if (phase === 'prep') {
            setPhase('date');
            setTimeLeft(180); // 3 minutes
        } else if (phase === 'date') {
            setPhase('feedback');
            setTimeLeft(60); // 1 minute
        } else if (phase === 'feedback') {
            if (round < 2) { // Just demo 2 rounds
                setRound(prev => prev + 1);
                setPartner(DUMMY_PARTNERS[1]);
                setPhase('prep');
                setTimeLeft(60);
            } else {
                setPhase('summary');
                setTimeLeft(0); // No timer for summary
            }
        } else if (phase === 'summary') {
            setPhase('ended');
        }
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Camera Preview Logic
    useEffect(() => {
        if (isCamOn) {
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(stream => {
                    if (myVideoRef.current) myVideoRef.current.srcObject = stream;
                })
                .catch(err => console.error(err));
        }
    }, [isCamOn, phase]);

    if (phase === 'ended') {
        return (
            <motion.div
                className="event-ended"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8 }}
            >
                <div className="event-ended-background"></div>
                <div className="event-ended-content glass">
                    <motion.div
                        className="event-ended-icon"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", delay: 0.2 }}
                    >
                        <Trophy size={64} className="vibrant-text" />
                    </motion.div>

                    <motion.div
                        className="event-ended-text"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <h2>Event Complete!</h2>
                        <p>You met some amazing people. Check your matches soon!</p>
                    </motion.div>

                    <motion.button
                        className="vibrant-btn event-ended-btn"
                        onClick={onComplete}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                    >
                        Back to Discovery
                    </motion.button>
                </div>
            </motion.div>
        );
    }

    return (
        <div className="session-container">
            {/* Top Bar - Consistent across phases */}
            <header className="session-header">
                <div className="round-indicator">Round {round}</div>
                <div className={`phase-badge ${phase}`}>
                    {phase === 'prep' && 'Preparation'}
                    {phase === 'date' && 'Live Date'}
                    {phase === 'feedback' && 'Final Choice'}
                    {phase === 'summary' && 'Event Summary'}
                </div>
                <div className="phase-timer">{formatTime(timeLeft)}</div>
            </header>

            <AnimatePresence mode="wait">
                {phase === 'prep' && (
                    <motion.div
                        key="prep"
                        className="prep-screen-v2"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                    >
                        <div className="prep-main-content">
                            <div className="partner-focus-card glass">
                                <div className="partner-avatar-ring">
                                    <img src={partner.imageUrl} alt={partner.name} />
                                    <div className="pulse-ring"></div>
                                </div>
                                <div className="prep-text-content">
                                    <span className="upcoming-label">NEXT DATE</span>
                                    <h2>Meet {partner.name}</h2>
                                    <p>Starting in <strong>{timeLeft}s</strong></p>
                                </div>
                            </div>

                            <div className="user-readiness-card glass">
                                <div className="readiness-preview">
                                    {showPrepCam ? (
                                        <div className="cam-preview-container">
                                            <video ref={myVideoRef} autoPlay playsInline muted />
                                            <div className="live-tag">LIVE</div>
                                        </div>
                                    ) : (
                                        <div className="member-photo-mask">
                                            <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80" alt="Me" />
                                        </div>
                                    )}
                                </div>

                                <div className="readiness-actions">
                                    <p>Ready to spark a connection?</p>
                                    <button
                                        className={`prep-cam-toggle ${showPrepCam ? 'active' : ''}`}
                                        onClick={() => setShowPrepCam(!showPrepCam)}
                                    >
                                        {showPrepCam ? <VideoOff size={18} /> : <Video size={18} />}
                                        <span>{showPrepCam ? 'Hide Camera' : 'Check Appearance'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="prep-footer-tips">
                            <Sparkles size={16} className="vibrant-text" />
                            <span>Pro Tip: Smile and make eye contact with your camera!</span>
                        </div>
                    </motion.div>
                )}
                {phase === 'date' && (
                    <motion.div
                        key="date"
                        className="date-screen"
                        initial={{ opacity: 0, x: 100 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, y: -100 }}
                    >
                        {/* Main Partner Video */}
                        <div className="partner-video-container">
                            <video src={partner.videoUrl} autoPlay loop playsInline />
                        </div>

                        {/* My PIP Video */}
                        <div className="my-pip-container glass">
                            {isCamOn ? (
                                <video ref={myVideoRef} autoPlay playsInline muted />
                            ) : (
                                <div className="cam-off-pip"><VideoOff size={24} /></div>
                            )}
                        </div>

                        {/* In-Date Controls */}
                        <div className="date-controls">
                            <button className={`control-btn ${!isMicOn ? 'off' : ''}`} onClick={() => setIsMicOn(!isMicOn)}>
                                {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                            </button>
                            <button className={`control-btn ${!isCamOn ? 'off' : ''}`} onClick={() => setIsCamOn(!isCamOn)}>
                                {isCamOn ? <Video size={20} /> : <VideoOff size={20} />}
                            </button>
                            <button className="control-btn hang-up" onClick={() => { setPhase('feedback'); setTimeLeft(60); }}>
                                <PhoneOff size={20} />
                            </button>
                        </div>
                    </motion.div>
                )}

                {phase === 'feedback' && (
                    <motion.div
                        key="feedback"
                        className="feedback-screen"
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 1.1 }}
                    >
                        <div className="feedback-background"></div>
                        <div className="feedback-content glass">
                            <motion.div 
                                className="feedback-avatar-wrapper"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", delay: 0.2 }}
                            >
                                <div className="feedback-avatar-glow"></div>
                                <div className="feedback-avatar">
                                    <img src={partner.imageUrl} alt={partner.name} />
                                </div>
                            </motion.div>
                            
                            <motion.div 
                                className="feedback-text-content"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                            >
                                <h2 className="feedback-title">Did you vibe with {partner.name}?</h2>
                                <p className="feedback-subtitle">Be honest, we'll only match you if it's mutual!</p>
                            </motion.div>

                            <motion.div 
                                className="feedback-actions"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                            >
                                <button className="feedback-btn feedback-btn-pass" onClick={handlePhaseTransition}>
                                    <div className="feedback-btn-icon">
                                        <X size={28} />
                                    </div>
                                    <span>Pass</span>
                                </button>
                                <button className="feedback-btn feedback-btn-like" onClick={handlePhaseTransition}>
                                    <div className="feedback-btn-icon">
                                        <Heart size={28} fill="currentColor" />
                                    </div>
                                    <span>Like</span>
                                </button>
                            </motion.div>
                        </div>
                    </motion.div>
                )}

                {phase === 'summary' && (
                    <motion.div
                        key="summary"
                        className="summary-screen"
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 1.1 }}
                    >
                        <div className="summary-background"></div>
                        <div className="summary-content glass">
                            <motion.div
                                className="summary-header"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                            >
                                <Sparkles size={32} className="vibrant-text" />
                                <h2>Event Summary</h2>
                            </motion.div>

                            <motion.div
                                className="summary-stats"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                            >
                                <div className="summary-stat-card">
                                    <Users size={24} className="stat-icon" />
                                    <div className="stat-info">
                                        <span className="stat-number">2</span>
                                        <span className="stat-label">People Met</span>
                                    </div>
                                </div>

                                <div className="summary-stat-card">
                                    <Clock size={24} className="stat-icon" />
                                    <div className="stat-info">
                                        <span className="stat-number">6:00</span>
                                        <span className="stat-label">Total Time</span>
                                    </div>
                                </div>

                                <div className="summary-stat-card">
                                    <Heart size={24} className="stat-icon vibrant-text" />
                                    <div className="stat-info">
                                        <span className="stat-number">1</span>
                                        <span className="stat-label">Matches</span>
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div
                                className="summary-partners"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6 }}
                            >
                                <h3>People You Met</h3>
                                <div className="partners-grid">
                                    {DUMMY_PARTNERS.map((partner, index) => (
                                        <motion.div
                                            key={partner.id}
                                            className="partner-summary-card"
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: 0.7 + (index * 0.1) }}
                                        >
                                            <div className="partner-summary-avatar">
                                                <img src={partner.imageUrl} alt={partner.name} />
                                            </div>
                                            <div className="partner-summary-info">
                                                <h4>{partner.name}</h4>
                                                <p>{partner.age} years old</p>
                                            </div>
                                            <div className="partner-summary-status">
                                                {index === 0 ? (
                                                    <Heart size={16} fill="currentColor" className="vibrant-text" />
                                                ) : (
                                                    <X size={16} className="text-dim" />
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </motion.div>

                            <motion.button
                                className="vibrant-btn summary-continue-btn"
                                onClick={handlePhaseTransition}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.8 }}
                            >
                                Continue
                            </motion.button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
