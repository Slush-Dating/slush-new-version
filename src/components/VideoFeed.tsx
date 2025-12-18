import { useRef, useState, useEffect, useCallback } from 'react';
import { Heart, Star, X, MapPin, Loader2 } from 'lucide-react';
import { matchService, discoveryService, type DiscoveryProfile } from '../services/api';
import './VideoFeed.css';

interface Profile {
    id: string;
    userId: string;
    name: string;
    age: number | null;
    bio: string;
    videoUrl: string | null;
    distance: string;
    thumbnail?: string | null;
}

interface VideoFeedProps {
    onOpenProfile: () => void;
    user?: any;
    onMatch?: (matchData: any) => void;
}

export const VideoFeed: React.FC<VideoFeedProps> = ({ onOpenProfile, user, onMatch }) => {
    console.log('VideoFeed rendered with user:', user);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loadedVideos, setLoadedVideos] = useState<Set<number>>(new Set());
    const [processingAction, setProcessingAction] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const handleAction = useCallback(async (profile: Profile, action: 'like' | 'pass' | 'super_like') => {
        if (processingAction || !profile.userId) {
            handleNext();
            return;
        }

        setProcessingAction(true);
        try {
            const result = await matchService.performAction(
                profile.userId,
                action,
                'video_feed'
            );

            if (result.isMatch && result.match && onMatch) {
                onMatch(result.match);
            }

            // Remove profile from list after action
            setProfiles(prev => prev.filter(p => p.id !== profile.id));
            
            // Adjust index if needed
            if (currentIndex >= profiles.length - 1) {
                setCurrentIndex(0);
            }
        } catch (error) {
            console.error('Failed to perform match action:', error);
            handleNext();
        } finally {
            setProcessingAction(false);
        }
    }, [processingAction, onMatch, currentIndex, profiles.length]);

    // Fetch discovery feed on mount
    useEffect(() => {
        const fetchProfiles = async () => {
            try {
                setLoading(true);
                setError(null);
                const feed = await discoveryService.getFeed(20);

                // Convert DiscoveryProfile to Profile format
                const formattedProfiles: Profile[] = feed.map(p => ({
                    id: p.id,
                    userId: p.userId,
                    name: p.name,
                    age: p.age || 0,
                    bio: p.bio,
                    videoUrl: p.videoUrl || '',
                    distance: p.distance,
                    thumbnail: p.thumbnail
                }));

                setProfiles(formattedProfiles);
            } catch (err: any) {
                console.error('Failed to fetch discovery feed:', err);
                setError(err.message || 'Failed to load profiles');
            } finally {
                setLoading(false);
            }
        };

        fetchProfiles();
    }, []);

    const handleNext = useCallback(() => {
        setCurrentIndex(prev => {
            const next = prev + 1;
            return next >= profiles.length ? 0 : next;
        });
    }, [profiles.length]);

    const handlePrev = useCallback(() => {
        setCurrentIndex(prev => {
            const prevIndex = prev - 1;
            return prevIndex < 0 ? (profiles.length > 0 ? profiles.length - 1 : 0) : prevIndex;
        });
    }, [profiles.length]);

    const handleVideoLoaded = useCallback((index: number) => {
        setLoadedVideos(prev => new Set(prev).add(index));
    }, []);

    if (loading) {
        return (
            <div className="video-feed-tiktok">
                <div className="video-loading">
                    <Loader2 className="spinner" size={48} />
                    <p>Loading profiles...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="video-feed-tiktok">
                <div className="video-error">
                    <p>{error}</p>
                    <button onClick={() => window.location.reload()}>Retry</button>
                </div>
            </div>
        );
    }

    if (profiles.length === 0) {
        return (
            <div className="video-feed-tiktok">
                <div className="video-error">
                    <p>No profiles available. Check back later!</p>
                    <p>Make sure you're logged in and have completed onboarding.</p>
                </div>
            </div>
        );
    }

    const currentProfile = profiles[currentIndex];
    if (!currentProfile) {
        return null;
    }

    return (
        <div className="video-feed-tiktok">
            <VideoCardTikTok
                key={currentProfile.id}
                profile={currentProfile}
                index={currentIndex}
                onSwipeUp={handleNext}
                onSwipeDown={handlePrev}
                onOpenProfile={onOpenProfile}
                onVideoLoaded={handleVideoLoaded}
                isLoaded={loadedVideos.has(currentIndex)}
                onLike={(profile) => handleAction(profile, 'like')}
                onPass={(profile) => handleAction(profile, 'pass')}
                onSuperLike={(profile) => handleAction(profile, 'super_like')}
                processingAction={processingAction}
            />
        </div>
    );
};

interface VideoCardProps {
    profile: Profile;
    index: number;
    onSwipeUp: () => void;
    onSwipeDown: () => void;
    onOpenProfile: () => void;
    onVideoLoaded: (index: number) => void;
    isLoaded: boolean;
    onLike: (profile: Profile) => void;
    onPass: (profile: Profile) => void;
    onSuperLike: (profile: Profile) => void;
    processingAction: boolean;
}

const VideoCardTikTok: React.FC<VideoCardProps> = ({ 
    profile, 
    index,
    onSwipeUp, 
    onSwipeDown, 
    onOpenProfile,
    onVideoLoaded,
    isLoaded,
    onLike,
    onPass,
    onSuperLike,
    processingAction
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const [translateY, setTranslateY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    // Minimum swipe distance (in pixels)
    const minSwipeDistance = 50;

    useEffect(() => {
        setIsLoading(true);
        setHasError(false);
        setTranslateY(0);
        
        if (videoRef.current) {
            videoRef.current.load();
            // Try to play, but don't treat autoplay blocking as an error
            videoRef.current.play().catch(e => {
                // Autoplay blocked is fine, video will play on user interaction
                // Don't set error for autoplay blocking
                if (e.name !== 'NotAllowedError' && e.name !== 'NotSupportedError') {
                    console.log("Play failed", e);
                    // Only set error if video hasn't loaded
                    if (videoRef.current && videoRef.current.readyState < 2) {
                        // Video hasn't loaded yet, wait for onError or onCanPlay
                    }
                }
                // Don't set loading to false here - let onCanPlay or onError handle it
            });
        }
    }, [profile.id]);

    const handleVideoCanPlay = () => {
        setIsLoading(false);
        setHasError(false);
        onVideoLoaded(index);
        // Try to play, but don't worry if autoplay is blocked
        if (videoRef.current) {
            videoRef.current.play().catch(e => {
                // Autoplay blocked is fine, don't show error
                // Video will play on user interaction
                if (e.name !== 'NotAllowedError' && e.name !== 'NotSupportedError') {
                    console.log("Play error", e);
                }
            });
        }
    };

    const handleVideoError = () => {
        setIsLoading(false);
        // Only show error if video element actually has an error
        if (videoRef.current && videoRef.current.error) {
            setHasError(true);
        }
    };

    const handleVideoLoadedData = () => {
        setIsLoading(false);
        setHasError(false);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientY);
        setIsDragging(true);
        setTouchEnd(e.targetTouches[0].clientY);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchStart === null) return;
        
        const currentTouch = e.targetTouches[0].clientY;
        setTouchEnd(currentTouch);
        const diff = touchStart - currentTouch;
        setTranslateY(-diff);
        
        // Pause video while dragging for better performance
        if (videoRef.current && Math.abs(diff) > 10) {
            videoRef.current.pause();
        }
    };

    const handleTouchEnd = () => {
        if (!touchStart || !touchEnd) {
            setIsDragging(false);
            // Resume video if not swiping
            if (videoRef.current && Math.abs(translateY) < minSwipeDistance) {
                videoRef.current.play().catch(e => console.log("Play error", e));
            }
            return;
        }

        const distance = touchStart - touchEnd;
        const isUpSwipe = distance > minSwipeDistance;
        const isDownSwipe = distance < -minSwipeDistance;

        if (isUpSwipe) {
            onSwipeUp();
        } else if (isDownSwipe) {
            onSwipeDown();
        } else {
            // Resume video if swipe wasn't strong enough
            if (videoRef.current) {
                videoRef.current.play().catch(e => console.log("Play error", e));
            }
        }

        setTranslateY(0);
        setIsDragging(false);
        setTouchStart(null);
        setTouchEnd(null);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setTouchStart(e.clientY);
        setIsDragging(true);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (touchStart === null || !isDragging) return;
        const diff = touchStart - e.clientY;
        setTouchEnd(e.clientY);
        setTranslateY(-diff);
        
        // Pause video while dragging for better performance
        if (videoRef.current && Math.abs(diff) > 10) {
            videoRef.current.pause();
        }
    };

    const handleMouseUp = () => {
        if (touchStart === null) {
            setIsDragging(false);
            // Resume video if not swiping
            if (videoRef.current && Math.abs(translateY) < minSwipeDistance) {
                videoRef.current.play().catch(e => console.log("Play error", e));
            }
            return;
        }

        const distance = touchStart - (touchEnd || touchStart);
        const isUpSwipe = distance > minSwipeDistance;
        const isDownSwipe = distance < -minSwipeDistance;

        if (isUpSwipe) {
            onSwipeUp();
        } else if (isDownSwipe) {
            onSwipeDown();
        } else {
            // Resume video if swipe wasn't strong enough
            if (videoRef.current) {
                videoRef.current.play().catch(e => console.log("Play error", e));
            }
        }

        setTranslateY(0);
        setIsDragging(false);
        setTouchStart(null);
        setTouchEnd(null);
    };

    const handleLike = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!processingAction) {
            onLike(profile);
        }
    };

    const handlePass = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!processingAction) {
            onPass(profile);
        }
    };

    const handleSuperLike = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!processingAction) {
            onSuperLike(profile);
        }
    };

    return (
        <div 
            ref={containerRef}
            className={`video-card-tiktok ${isDragging ? 'dragging' : ''}`}
            style={{ transform: `translateY(${translateY}px)` }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {isLoading && !hasError && (
                <div className="video-loading">
                    <Loader2 size={48} className="spinner" />
                    <p>Loading video...</p>
                </div>
            )}
            
            {hasError && videoRef.current?.error && (
                <div className="video-error">
                    <p>Unable to load video</p>
                    <button onClick={() => {
                        setHasError(false);
                        setIsLoading(true);
                        if (videoRef.current) {
                            videoRef.current.load();
                        }
                    }}>Retry</button>
                </div>
            )}

            <video
                ref={videoRef}
                src={profile.videoUrl || undefined}
                loop
                muted
                playsInline
                className="tiktok-video-element"
                onCanPlay={handleVideoCanPlay}
                onError={handleVideoError}
                onLoadedData={handleVideoLoadedData}
            />

            {/* Side Actions Overlay - TikTok Style */}
            <div className="tiktok-actions">
                <div className="action-group">
                    <div 
                        className={`action-icon-wrapper ${processingAction ? 'disabled' : ''}`} 
                        onClick={handleLike}
                    >
                        <div className="icon-circle like-circle">
                            <Heart size={32} fill="white" stroke="white" />
                        </div>
                        <span>Like</span>
                    </div>

                    <div 
                        className={`action-icon-wrapper ${processingAction ? 'disabled' : ''}`} 
                        onClick={handleSuperLike}
                    >
                        <div className="icon-circle star-circle">
                            <Star size={28} fill="#FFD700" stroke="#FFD700" />
                        </div>
                        <span>Super</span>
                    </div>

                    <div 
                        className={`action-icon-wrapper ${processingAction ? 'disabled' : ''}`} 
                        onClick={handlePass}
                    >
                        <div className="icon-circle pass-circle">
                            <X size={28} stroke="white" />
                        </div>
                        <span>Pass</span>
                    </div>
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
        </div>
    );
};
