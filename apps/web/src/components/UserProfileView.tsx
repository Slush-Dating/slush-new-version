import { useState, useEffect, useRef } from 'react';
import { MapPin, ChevronLeft, Pause, Play, Volume2, VolumeX, MessageCircle, MoreVertical, Flag, ChevronRight } from 'lucide-react';
import { authService } from '../services/authService';
import { matchService } from '../services/api';
import { getMediaBaseUrl } from '../services/apiConfig';
import './Profile.css';

interface UserProfileViewProps {
    userId: string;
    onBack: () => void;
    onChat?: (matchId: string) => void;
}

const MediaCard = ({ url, type }: { url: string; type: 'photo' | 'video' }) => {
    const [isPlaying, setIsPlaying] = useState(true);
    const [isMuted, setIsMuted] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);
    const fullUrl = url.startsWith('http') ? url : `${getMediaBaseUrl()}${url}`;

    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            if (isPlaying) videoRef.current.pause();
            else videoRef.current.play();
            setIsPlaying(!isPlaying);
        }
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsMuted(!isMuted);
    };

    if (type === 'video') {
        return (
            <div className="profile-media-card video">
                <video
                    ref={videoRef}
                    src={fullUrl}
                    loop
                    muted={isMuted}
                    autoPlay
                    playsInline
                    onClick={togglePlay}
                />
                <div className="video-controls">
                    <button onClick={togglePlay} className="video-control-btn">
                        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button onClick={toggleMute} className="video-control-btn">
                        {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="profile-media-card photo">
            <img src={fullUrl} alt="Profile media" />
        </div>
    );
};

export const UserProfileView: React.FC<UserProfileViewProps> = ({ userId, onBack, onChat }) => {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isBioExpanded, setIsBioExpanded] = useState(false);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [matchStatus, setMatchStatus] = useState<{ isMatched: boolean; matchId?: string } | null>(null);
    const [showMenu, setShowMenu] = useState(false);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('Authentication required');
                setLoading(false);
                return;
            }

            if (!userId || userId.trim() === '') {
                setError('Invalid user ID');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const data = await authService.getUserProfile(token, userId);
                setUser(data);
                setError(null);
            } catch (err: any) {
                console.error('Failed to fetch user profile:', err);
                setError(err.message || 'Failed to load profile');
            } finally {
                setLoading(false);
            }
        };

        if (userId) {
            fetchProfile();
        }
    }, [userId]);

    // Check match status when user data is loaded
    useEffect(() => {
        const checkMatch = async () => {
            if (!userId || !user) return;

            try {
                const status = await matchService.checkMatchStatus(userId);
                setMatchStatus(status);
            } catch (err: any) {
                console.error('Failed to check match status:', err);
                // Don't set error state for match check failures, just assume not matched
                setMatchStatus({ isMatched: false });
            }
        };

        checkMatch();
    }, [userId, user]);

    if (loading) {
        return (
            <div className="profile-wrapper">
                <div className="spinner"></div>
            </div>
        );
    }

    if (error || !user) {
        return (
            <div className="profile-wrapper dark-theme">
                <div className="profile-container-new">
                    <header className="profile-hero">
                        <div className="hero-overlay-gradient" />
                        <div className="hero-overlay-top">
                            <button className="hero-btn back-btn" onClick={onBack}>
                                <ChevronLeft size={24} />
                            </button>
                        </div>
                    </header>
                    <main className="profile-content-body">
                        <div className="error-message" style={{ padding: '2rem', textAlign: 'center' }}>
                            <p>{error || 'User not found'}</p>
                            <button className="vibrant-btn" onClick={onBack} style={{ marginTop: '1rem' }}>
                                Go Back
                            </button>
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    const calculateAge = (dob: string) => {
        if (!dob) return '';
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    const photos = user.photos || [];
    const videos = user.videos || [];
    const interests = user.interests || [];

    // Combine media with videos first, then photos
    const allMedia = [...videos, ...photos];
    const mediaTypes = [...videos.map(() => 'video' as const), ...photos.map(() => 'photo' as const)];

    const fallbackImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect width='800' height='600' fill='%23f0f0f0'/%3E%3Ctext x='400' y='300' text-anchor='middle' dy='.3em' fill='%23666' font-family='Arial' font-size='24'%3ENo Image%3C/text%3E%3C/svg%3E";

    // If no media, ensure we have a valid fallback
    const getImageUrl = (url: string) => {
        if (!url) return fallbackImage;
        return url.startsWith('http') ? url : `${getMediaBaseUrl()}${url}`;
    };

    const currentMediaItem = allMedia[activeImageIndex];
    const currentMediaType = mediaTypes[activeImageIndex];

    const heroMediaSrc = currentMediaItem
        ? (currentMediaType === 'video' ? getImageUrl(currentMediaItem) : getImageUrl(currentMediaItem))
        : fallbackImage;

    const handleUnmatch = async () => {
        if (!matchStatus?.isMatched || !window.confirm('Are you sure you want to unmatch with this person?')) {
            return;
        }

        try {
            await matchService.unmatch(userId);
            setMatchStatus({ isMatched: false });
            alert('Successfully unmatched');
        } catch (err: any) {
            console.error('Failed to unmatch:', err);
            alert('Failed to unmatch. Please try again.');
        }
    };

    const handleReport = async () => {
        const reason = prompt('Please provide a reason for reporting this user:');
        if (!reason || reason.trim() === '') return;

        try {
            await matchService.report(userId, reason.trim());
            alert('Report submitted successfully');
        } catch (err: any) {
            console.error('Failed to report:', err);
            alert('Failed to submit report. Please try again.');
        }
    };

    const handleChat = () => {
        if (onChat && matchStatus?.matchId) {
            onChat(matchStatus.matchId);
        }
    };

    // Touch handlers for swipe gestures
    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
        if (!touchStart || !touchEnd) return;

        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > 50;
        const isRightSwipe = distance < -50;

        if (isLeftSwipe && activeImageIndex < allMedia.length - 1) {
            setActiveImageIndex(activeImageIndex + 1);
        }

        if (isRightSwipe && activeImageIndex > 0) {
            setActiveImageIndex(activeImageIndex - 1);
        }
    };

    // Navigate to next/previous media
    const navigateNext = () => {
        if (activeImageIndex < allMedia.length - 1) {
            setActiveImageIndex(activeImageIndex + 1);
        }
    };

    const navigatePrevious = () => {
        if (activeImageIndex > 0) {
            setActiveImageIndex(activeImageIndex - 1);
        }
    };

    return (
        <div className="profile-wrapper dark-theme">
            <div className="profile-container-new">
                {/* Large Photo/Video Header */}
                <header
                    className="profile-hero"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className="hero-overlay-gradient" />
                    <div className="hero-overlay-top">
                        <button className="hero-btn back-btn" onClick={onBack}>
                            <ChevronLeft size={24} />
                        </button>
                        {matchStatus?.isMatched && (
                            <div className="hero-menu-container">
                                <button
                                    className="hero-btn menu-btn"
                                    onClick={() => setShowMenu(!showMenu)}
                                >
                                    <MoreVertical size={24} />
                                </button>
                                {showMenu && (
                                    <div className="hero-menu-dropdown">
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
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Navigation arrows */}
                    {allMedia.length > 1 && (
                        <>
                            {activeImageIndex > 0 && (
                                <button
                                    className="hero-nav-btn hero-nav-left"
                                    onClick={navigatePrevious}
                                    aria-label="Previous media"
                                >
                                    <ChevronLeft size={24} />
                                </button>
                            )}
                            {activeImageIndex < allMedia.length - 1 && (
                                <button
                                    className="hero-nav-btn hero-nav-right"
                                    onClick={navigateNext}
                                    aria-label="Next media"
                                >
                                    <ChevronRight size={24} />
                                </button>
                            )}
                        </>
                    )}

                    {currentMediaType === 'video' ? (
                        <video
                            src={heroMediaSrc}
                            className="hero-image"
                            autoPlay
                            muted
                            loop
                            playsInline
                            onError={(e) => {
                                const target = e.target as HTMLVideoElement;
                                target.style.display = 'none';
                                // Fallback to image
                                const img = document.createElement('img');
                                img.src = fallbackImage;
                                img.className = 'hero-image';
                                img.alt = '';
                                target.parentElement?.appendChild(img);
                            }}
                        />
                    ) : (
                        <img
                            src={heroMediaSrc}
                            alt=""
                            className="hero-image"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = fallbackImage;
                            }}
                        />
                    )}


                    {allMedia.length > 1 && (
                        <div className="hero-pagination">
                            {Array.from({ length: allMedia.length }).map((_, i) => (
                                <span
                                    key={i}
                                    className={`dot ${i === activeImageIndex ? 'active' : ''}`}
                                    onClick={() => setActiveImageIndex(i)}
                                />
                            ))}
                        </div>
                    )}
                </header>

                {/* Content Body */}
                <main className="profile-content-body">
                    {/* Identity Section */}
                    <section className="section-identity">
                        <div className="identity-header">
                            <h1 className="name-age">{user.name}, {calculateAge(user.dob)}</h1>
                            <p className="profession">{user.profession || 'Not specified'}</p>
                        </div>

                        <div className="location-row">
                            <div className="location-text">
                                <h4 className="section-label">Location</h4>
                                <p className="location-val">{user.locationString || 'Sheffield, UK'}</p>
                            </div>
                            <div className="distance-pill">
                                <MapPin size={14} /> Nearby
                            </div>
                        </div>
                    </section>

                    {/* About Section */}
                    <section className="section-about">
                        <h4 className="section-label">About</h4>
                        <div className={`bio-container ${isBioExpanded ? 'expanded' : ''}`}>
                            <p className="bio-text">
                                {user.bio || "No bio available."}
                            </p>
                            {user.bio && user.bio.length > 150 && !isBioExpanded && <div className="bio-fade-overlay" />}
                        </div>
                        {user.bio && user.bio.length > 150 && (
                            <button className="read-more-btn" onClick={() => setIsBioExpanded(!isBioExpanded)}>
                                {isBioExpanded ? 'Read less' : 'Read more'}
                            </button>
                        )}
                    </section>

                    {/* Interests Section */}
                    <section className="section-interests">
                        <h4 className="section-label">Interests</h4>
                        <div className="interests-grid-pills">
                            {interests.length > 0 ? interests.map((item: string) => (
                                <span key={item} className="interest-pill">{item}</span>
                            )) : (
                                <p style={{ color: 'var(--text-secondary)' }}>No interests listed</p>
                            )}
                        </div>
                    </section>

                    {/* Prompts Section (Life Goals & Simple Pleasures) */}
                    {user.prompts && user.prompts.length > 0 && user.prompts.some((p: any) => p.answer && p.answer.trim()) && (
                        <section className="section-prompts">
                            <h4 className="section-label">About Me</h4>
                            {user.prompts.map((prompt: any, index: number) => (
                                prompt.answer && prompt.answer.trim() && (
                                    <div key={index} className="prompt-card">
                                        <h5 className="prompt-question">{prompt.question}</h5>
                                        <p className="prompt-answer">{prompt.answer}</p>
                                    </div>
                                )
                            ))}
                        </section>
                    )}

                    {/* Unified Media Gallery */}
                    <section className="section-media-gallery">
                        <h4 className="section-label">Gallery</h4>
                        <div className="media-gallery-grid">
                            {/* All photos and videos in one responsive grid */}
                            {[...photos, ...videos].map((media, index) => {
                                const isVideo = videos.includes(media);
                                return (
                                    <div key={index} className="media-gallery-item">
                                        <MediaCard url={media} type={isVideo ? "video" : "photo"} />
                                    </div>
                                );
                            })}

                            {/* Media count is now handled by the backend defaults if empty */}
                            {photos.length === 0 && videos.length === 0 && (
                                <div className="no-media-message">
                                    <p>No photos uploaded yet</p>
                                </div>
                            )}
                        </div>
                    </section>
                </main>

                {/* Floating Chat Icon for Matched Users */}
                {matchStatus?.isMatched && onChat && (
                    <button
                        className="floating-chat-btn"
                        onClick={handleChat}
                    >
                        <MessageCircle size={24} />
                    </button>
                )}
            </div>
        </div>
    );
};

