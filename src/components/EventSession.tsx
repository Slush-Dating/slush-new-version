import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, X, Video, VideoOff, Mic, MicOff, Sparkles, PhoneOff } from 'lucide-react';
import './EventSession.css';

type Phase = 'prep' | 'date' | 'feedback' | 'ended';

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
                    handlePhaseTransition();
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
                setPhase('ended');
            }
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
            <div className="event-ended glass">
                <Sparkles size={48} className="vibrant-text" />
                <h2>Event Complete!</h2>
                <p>You met some amazing people. Check your matches soon!</p>
                <button className="vibrant-btn" onClick={onComplete}>Back to Discovery</button>
            </div>
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
                            <div className="partner-info-box glass">
                                <h3>{partner.name}, {partner.age}</h3>
                                <p>{partner.bio}</p>
                            </div>
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
                        <div className="feedback-content glass">
                            <div className="feedback-avatar">
                                <img src={partner.imageUrl} alt={partner.name} />
                            </div>
                            <h2>Did you vibe with {partner.name}?</h2>
                            <p>Be honest, we'll only match you if it's mutual!</p>

                            <div className="feedback-actions">
                                <button className="feedback-btn pass" onClick={handlePhaseTransition}>
                                    <X size={32} />
                                    <span>Pass</span>
                                </button>
                                <button className="feedback-btn like" onClick={handlePhaseTransition}>
                                    <Heart size={32} fill="currentColor" />
                                    <span>Like</span>
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
