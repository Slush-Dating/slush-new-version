import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Video, VideoOff, Mic, MicOff, Settings, ShieldCheck, Users } from 'lucide-react';
import { eventService, type EventData } from '../services/api';
import socketService from '../services/socketService';
import './WaitingRoom.css';

interface WaitingRoomProps {
    eventId: string;
    onLeave: () => void;
    onStart: () => void;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({ eventId, onLeave, onStart }) => {
    const [timeLeft, setTimeLeft] = useState(0);
    const [isCamOn, setIsCamOn] = useState(true);
    const [isMicOn, setIsMicOn] = useState(true);
    const [event, setEvent] = useState<EventData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [participantCount, setParticipantCount] = useState(0);
    const videoRef = useRef<HTMLVideoElement>(null);
    const socketConnectedRef = useRef(false);

    // Timer countdown effect
    useEffect(() => {
        if (timeLeft <= 0 || loading) return;

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
    }, [timeLeft, loading, onStart]);

    useEffect(() => {
        const startCamera = async () => {
            if (isCamOn) {
                try {
                    // Check if mediaDevices is available (not all mobile browsers support it)
                    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                        console.warn("Camera not supported on this device");
                        setError("Camera not available on this device. Please check your browser settings.");
                        return;
                    }

                    const constraints = {
                        video: {
                            facingMode: 'user', // Prefer front camera on mobile
                            width: { ideal: 640 },
                            height: { ideal: 480 }
                        }
                    };

                    let stream: MediaStream;
                    try {
                        stream = await navigator.mediaDevices.getUserMedia(constraints);
                    } catch (constraintError: any) {
                        // Retry with simpler constraints for older mobile devices
                        if (constraintError.name === 'OverconstrainedError') {
                            console.log('Retrying with simpler camera constraints...');
                            stream = await navigator.mediaDevices.getUserMedia({ video: true });
                        } else {
                            throw constraintError;
                        }
                    }

                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                    setError(null); // Clear any previous errors
                } catch (err: any) {
                    console.error("Error accessing camera:", err);

                    let errorMessage = "Unable to access camera. ";
                    if (err.name === 'NotAllowedError') {
                        // iOS Safari specific messaging
                        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                        if (isIOS) {
                            errorMessage += "Go to Settings > Safari > Camera and allow access.";
                        } else {
                            errorMessage += "Please allow camera access in your browser settings.";
                        }
                    } else if (err.name === 'NotFoundError') {
                        errorMessage += "No camera found on this device.";
                    } else if (err.name === 'NotReadableError') {
                        errorMessage += "Camera is already in use by another application.";
                    } else if (err.name === 'OverconstrainedError') {
                        errorMessage += "Camera constraints not supported.";
                    } else {
                        errorMessage += "Please check your device settings and try again.";
                    }

                    setError(errorMessage);
                    setIsCamOn(false); // Turn off camera toggle if access fails
                }
            } else {
                if (videoRef.current?.srcObject) {
                    const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
                    tracks.forEach(track => track.stop());
                    videoRef.current.srcObject = null;
                }
            }
        };

        startCamera();
    }, [isCamOn]);

    // Fetch event data
    useEffect(() => {
        const fetchEvent = async () => {
            try {
                // Add timeout to prevent infinite loading
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

                const eventData = await eventService.getEventById(eventId);
                clearTimeout(timeoutId);
                setEvent(eventData);
                setError(null);
            } catch (err: any) {
                console.error('Failed to fetch event:', err);
                if (err.name === 'AbortError') {
                    setError('Request timed out. Please check your connection.');
                } else {
                    setError('Could not load event details. Please try again.');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchEvent();
    }, [eventId]);

    // Socket connection for real-time participant count updates
    useEffect(() => {
        if (!eventId) return;

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
        if (!currentUserId) return;

        const setupSocket = async () => {
            try {
                // Ensure socket is connected
                if (!socketService.isConnected) {
                    await socketService.connect(currentUserId);
                }

                socketConnectedRef.current = true;

                // Join the event session room
                socketService.joinEventSession(eventId);
                console.log(`📍 Joined event session ${eventId} for real-time updates`);

                // Listen for participant count updates
                socketService.onParticipantCountUpdate((data) => {
                    if (data.eventId === eventId) {
                        console.log(`👥 Participant count update: ${data.count}`);
                        setParticipantCount(data.count);
                    }
                });

                // Listen for user joined events (for logging/visual feedback)
                socketService.onUserJoinedSession((data) => {
                    console.log(`➕ User ${data.userId} joined the session`);
                });

                // Listen for user left events
                socketService.onUserLeftSession((data) => {
                    console.log(`➖ User ${data.userId} left the session`);
                });

            } catch (error) {
                console.error('Failed to setup socket for waiting room:', error);
            }
        };

        setupSocket();

        // Cleanup on unmount
        return () => {
            if (socketConnectedRef.current) {
                socketService.leaveEventSession(eventId);
                socketService.off('participant_count_update');
                socketService.off('user_joined_session');
                socketService.off('user_left_session');
                socketConnectedRef.current = false;
                console.log(`📍 Left event session ${eventId}`);
            }
        };
    }, [eventId]);

    // Calculate time remaining until event starts
    useEffect(() => {
        if (!event) return;

        const eventStartTime = new Date(event.date);
        const now = new Date();
        const timeUntilStart = Math.max(0, Math.floor((eventStartTime.getTime() - now.getTime()) / 1000));

        setTimeLeft(timeUntilStart);

        // If event has already started or starts very soon, start the session immediately
        if (timeUntilStart <= 0) {
            onStart();
        }
    }, [event, onStart]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Show loading state
    if (loading) {
        return (
            <motion.div
                className="waiting-room-v3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                <div className="lobby-content-v3" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                    <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #3b82f6', borderRadius: '50%' }}></div>
                    <p style={{ marginTop: '20px', color: '#666' }}>Loading event details...</p>
                </div>
            </motion.div>
        );
    }

    // Show error state
    if (error || !event) {
        return (
            <motion.div
                className="waiting-room-v3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                <div className="lobby-content-v3" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                    <p style={{ color: '#ef4444', textAlign: 'center' }}>{error || 'Event not found'}</p>
                    <button className="vibrant-btn" onClick={onLeave} style={{ marginTop: '20px' }}>Go Back</button>
                </div>
            </motion.div>
        );
    }

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
                    <h3>{event.name}</h3>
                    <p>Event starts in</p>
                    <div className="timer-display-v3">
                        {formatTime(timeLeft)}
                    </div>
                    {timeLeft > 0 && (
                        <button className="skip-waiting-btn" onClick={onStart}>
                            Skip Waiting (Testing Only)
                        </button>
                    )}
                </div>

                <div className="lobby-info-cards">
                    <div className="info-mini-card glass">
                        <span className="label">Event Time</span>
                        <span className="value">{new Date(event.date).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                    </div>
                    <div className="info-mini-card glass">
                        <span className="label"><Users size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />In Waiting Room</span>
                        <span className="value live-count">
                            {participantCount > 0
                                ? `${participantCount} Online`
                                : `${(event.maleCount || 0) + (event.femaleCount || 0) + (event.otherCount || 0)} Registered`
                            }
                        </span>
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
