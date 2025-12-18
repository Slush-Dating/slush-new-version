import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Video, VideoOff, Mic, MicOff, Settings, ShieldCheck } from 'lucide-react';
import './WaitingRoom.css';

interface WaitingRoomProps {
    eventId: string;
    onLeave: () => void;
    onStart: () => void;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({ onLeave, onStart }) => {
    const [timeLeft, setTimeLeft] = useState(240); // 4 minute cycle (240 seconds)
    const [isCamOn, setIsCamOn] = useState(true);
    const [isMicOn, setIsMicOn] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    onStart();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (isCamOn) {
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(stream => {
                    if (videoRef.current) videoRef.current.srcObject = stream;
                })
                .catch(err => console.error("Error accessing camera:", err));
        } else {
            if (videoRef.current?.srcObject) {
                const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
                tracks.forEach(track => track.stop());
                videoRef.current.srcObject = null;
            }
        }
    }, [isCamOn]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <motion.div
            className="waiting-room-v3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <header className="lobby-header-v3">
                <button className="back-btn" onClick={onLeave}>
                    <ArrowLeft size={24} />
                </button>
                <div className="lobby-status">
                    <div className="status-live">
                        <span className="pulse-dot"></span>
                        LIVE SESSION
                    </div>
                </div>
                <button className="settings-btn">
                    <Settings size={22} />
                </button>
            </header>

            <main className="lobby-content-v3">
                <div className="search-visualizer">
                    {/* Searching Beams */}
                    <div className="beams-container">
                        {[...Array(4)].map((_, i) => (
                            <motion.div
                                key={i}
                                className="search-beam"
                                animate={{
                                    rotate: 360,
                                    opacity: [0.1, 0.4, 0.1],
                                    scale: [1, 1.2, 1]
                                }}
                                transition={{
                                    rotate: { duration: 10 + i * 2, repeat: Infinity, ease: "linear" },
                                    opacity: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                                    scale: { duration: 4, repeat: Infinity, ease: "easeInOut" }
                                }}
                                style={{ transformOrigin: 'center' }}
                            />
                        ))}
                    </div>

                    <div className="profile-preview-container">
                        <div className={`video-preview-frame ${!isCamOn ? 'cam-off' : ''}`}>
                            {isCamOn ? (
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="preview-video-element"
                                />
                            ) : (
                                <div className="cam-placeholder">
                                    <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80" alt="Me" />
                                    <div className="overlay-blur"></div>
                                </div>
                            )}

                            <div className="verification-badge">
                                <ShieldCheck size={14} />
                                <span>Verified</span>
                            </div>
                        </div>

                        <div className="av-controls-floating">
                            <button
                                className={`control-btn ${!isCamOn ? 'off' : ''}`}
                                onClick={() => setIsCamOn(!isCamOn)}
                            >
                                {isCamOn ? <Video size={20} /> : <VideoOff size={20} />}
                            </button>
                            <button
                                className={`control-btn ${!isMicOn ? 'off' : ''}`}
                                onClick={() => setIsMicOn(!isMicOn)}
                            >
                                {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="pairing-timer-section">
                    <h3>Searching for your next spark...</h3>
                    <p>Pairing starts in</p>
                    <div className="timer-display-v3">
                        {formatTime(timeLeft)}
                    </div>
                    <button className="skip-waiting-btn" onClick={onStart}>
                        Skip Waiting (Testing Only)
                    </button>
                </div>

                <div className="lobby-info-cards">
                    <div className="info-mini-card glass">
                        <span className="label">Next Round</span>
                        <span className="value">4:00 min</span>
                    </div>
                    <div className="info-mini-card glass">
                        <span className="label">Participants</span>
                        <span className="value">48 Active</span>
                    </div>
                </div>
            </main>

            <footer className="lobby-footer-v3">
                <p>Nova pairing algorithm is active</p>
                <div className="algorithm-indicator">
                    <span></span><span></span><span></span>
                </div>
            </footer>
        </motion.div>
    );
};
