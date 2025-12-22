import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Heart, Star, X, MapPin, Loader2 } from 'lucide-react';
import { matchService, discoveryService } from '../services/api';
import { getMediaBaseUrl } from '../services/apiConfig';
import './VideoFeed.css';

// Use centralized API configuration for production support
const API_BASE = getMediaBaseUrl();

// Helper to construct full video URL
const getFullUrl = (url: string | null | undefined): string => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${API_BASE}${url}`;
};

interface Profile {
    id: string;
    userId: string;
    name: string;
    age: number | null;
    bio: string;
    videoUrl: string | null;
    distance: string;
    thumbnail?: string | null;
    duration?: number;
}

interface VideoFeedProps {
    onOpenProfile: (userId: string) => void;
    user?: any;
    onMatch?: (matchData: any) => void;
}

// Video preload cache - stores actual video elements
const videoPreloadCache = new Map<string, HTMLVideoElement>();

// Preload a video fully in the background
const preloadVideo = (url: string | null | undefined): Promise<HTMLVideoElement | null> => {
    if (!url) return Promise.resolve(null);
    if (videoPreloadCache.has(url)) return Promise.resolve(videoPreloadCache.get(url)!);

    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'auto'; // Load full video content
        video.src = getFullUrl(url);
        video.muted = true; // Required for autoplay
        video.playsInline = true; // Better mobile support
        video.loop = true;

        video.oncanplaythrough = () => {
            // Video is fully loaded and ready to play
            videoPreloadCache.set(url, video);
            resolve(video);
        };

        video.onloadeddata = () => {
            // Fallback - at least metadata loaded
            if (!videoPreloadCache.has(url)) {
                videoPreloadCache.set(url, video);
                resolve(video);
            }
        };

        video.onerror = () => {
            resolve(null); // Don't block on errors
        };

        // Set a timeout to prevent hanging
        setTimeout(() => {
            if (!videoPreloadCache.has(url)) {
                videoPreloadCache.set(url, video);
                resolve(video);
            }
        }, 10000); // 10 second timeout
    });
};

export const VideoFeed: React.FC<VideoFeedProps> = ({ onOpenProfile, onMatch }) => {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [displayIndex, setDisplayIndex] = useState(0); // What the user sees
    const [processingAction, setProcessingAction] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [slideDirection, setSlideDirection] = useState<'up' | 'down' | 'none'>('none');
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Aggressively preload upcoming videos when current index changes
    useEffect(() => {
        const preloadUpcoming = async () => {
            // Preload next 5 videos for smooth experience
            for (let i = 1; i <= 5; i++) {
                const nextIndex = (currentIndex + i) % profiles.length;
                if (profiles[nextIndex]?.videoUrl) {
                    preloadVideo(profiles[nextIndex].videoUrl!);
                }
            }

            // Also preload previous 2 videos for backward navigation
            for (let i = 1; i <= 2; i++) {
                const prevIndex = currentIndex - i < 0 ? profiles.length + (currentIndex - i) : currentIndex - i;
                if (profiles[prevIndex]?.videoUrl) {
                    preloadVideo(profiles[prevIndex].videoUrl!);
                }
            }
        };

        if (profiles.length > 0) {
            preloadUpcoming();
        }
    }, [currentIndex, profiles]);

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

                // Preload first 3 videos immediately for instant playback
                const preloadPromises = [];
                for (let i = 0; i < Math.min(3, formattedProfiles.length); i++) {
                    if (formattedProfiles[i].videoUrl) {
                        preloadPromises.push(preloadVideo(formattedProfiles[i].videoUrl));
                    }
                }
                // Don't wait for preloading to complete - let it happen in background

                // Clean up old cached videos to prevent memory leaks
                const cleanupCache = () => {
                    const maxCacheSize = 10; // Keep max 10 videos in cache
                    if (videoPreloadCache.size > maxCacheSize) {
                        const cacheKeys = Array.from(videoPreloadCache.keys());
                        // Remove videos that are far from current position
                        const videosToRemove = cacheKeys.slice(0, cacheKeys.length - maxCacheSize);
                        videosToRemove.forEach(key => {
                            const video = videoPreloadCache.get(key);
                            if (video) {
                                video.removeAttribute('src');
                                video.load(); // Reset video element
                            }
                            videoPreloadCache.delete(key);
                        });
                    }
                };

                // Clean up after preloading
                Promise.all(preloadPromises).then(cleanupCache);
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
        if (isTransitioning) return;

        const targetIndex = currentIndex + 1 >= profiles.length ? 0 : currentIndex + 1;
        if (targetIndex === currentIndex) return; // Prevent infinite loops

        setIsTransitioning(true);
        setSlideDirection('up');

        // Start animation - current video will animate out
        setTimeout(() => {
            // After animation completes, switch to new video
            setDisplayIndex(targetIndex);
            setCurrentIndex(targetIndex);
            setSlideDirection('none');
            setIsTransitioning(false);
        }, 400);
    }, [profiles.length, isTransitioning, currentIndex]);

    const handlePrev = useCallback(() => {
        if (isTransitioning) return;

        const targetIndex = currentIndex - 1 < 0 ? (profiles.length > 0 ? profiles.length - 1 : 0) : currentIndex - 1;
        if (targetIndex === currentIndex) return; // Prevent infinite loops

        setIsTransitioning(true);
        setSlideDirection('down');

        // Start animation - current video will animate out
        setTimeout(() => {
            // After animation completes, switch to new video
            setDisplayIndex(targetIndex);
            setCurrentIndex(targetIndex);
            setSlideDirection('none');
            setIsTransitioning(false);
        }, 400);
    }, [profiles.length, isTransitioning, currentIndex]);


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

    const displayProfile = profiles[displayIndex];

    if (!displayProfile) {
        return null;
    }

    return (
        <div className="video-feed-tiktok">
            {/* Only one video visible at a time */}
            <VideoCardTikTok
                key={`video-${displayProfile.id}`}
                profile={displayProfile}
                onSwipeUp={handleNext}
                onSwipeDown={handlePrev}
                onOpenProfile={() => onOpenProfile(displayProfile.userId)}
                onLike={(profile) => handleAction(profile, 'like')}
                onPass={(profile) => handleAction(profile, 'pass')}
                onSuperLike={(profile) => handleAction(profile, 'super_like')}
                processingAction={processingAction}
                slideDirection={slideDirection}
                isTransitioning={isTransitioning}
                isVisible={true}
            />
        </div>
    );
};

interface VideoCardProps {
    profile: Profile;
    onSwipeUp: () => void;
    onSwipeDown: () => void;
    onOpenProfile: (userId: string) => void;
    onLike: (profile: Profile) => void;
    onPass: (profile: Profile) => void;
    onSuperLike: (profile: Profile) => void;
    processingAction: boolean;
    slideDirection: 'up' | 'down' | 'none';
    isTransitioning: boolean;
    isVisible: boolean;
}

const VideoCardTikTok: React.FC<VideoCardProps> = ({
    profile,
    onSwipeUp,
    onSwipeDown,
    onOpenProfile,
    onLike,
    onPass,
    onSuperLike,
    processingAction,
    slideDirection,
    isTransitioning,
    isVisible
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const [translateY, setTranslateY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    // Determine animation class based on slide direction
    const getAnimationClass = () => {
        if (!isTransitioning) return '';
        if (slideDirection === 'up') return 'slide-out-up';
        if (slideDirection === 'down') return 'slide-out-down';
        return '';
    };

    // Minimum swipe distance (in pixels)
    const minSwipeDistance = 50;

    // Memoize URLs for performance
    const videoSrc = useMemo(() => getFullUrl(profile.videoUrl), [profile.videoUrl]);

    // Ref callback to check video readiness immediately when element mounts
    const videoRefCallback = useCallback((node: HTMLVideoElement | null) => {
        if (node) {
            videoRef.current = node;
            // Immediately check if video is ready (might be cached or preloaded)
            // Check synchronously first
            if (node.readyState >= 2) {
                setIsLoading(false);
            }
            // Also check in next frame to catch any immediate loads
            requestAnimationFrame(() => {
                if (node.readyState >= 2) {
                    setIsLoading(false);
                }
            });
        }
    }, []);

    useEffect(() => {
        setIsLoading(true);
        setHasError(false);
        setTranslateY(0);

        // Check if video is already preloaded
        const preloadedVideo = videoPreloadCache.get(profile.videoUrl || '');
        if (preloadedVideo && videoRef.current && preloadedVideo.readyState >= 3) {
            // Use preloaded video - video is ready
            videoRef.current.src = preloadedVideo.src;
            setIsLoading(false);
            setHasError(false);
        } else {
            // Video needs to load
            if (videoRef.current) {
                videoRef.current.load();
                // Check immediately if video already has data (might be cached by browser)
                const checkReady = () => {
                    if (videoRef.current && videoRef.current.readyState >= 2) {
                        setIsLoading(false);
                    }
                };
                // Check synchronously first
                checkReady();
                // Then check in next frame
                requestAnimationFrame(checkReady);
            }
        }
    }, [profile.id, profile.videoUrl]);

    // Control video playback based on transition state
    useEffect(() => {
        if (videoRef.current) {
            if (!isTransitioning) {
                videoRef.current.play().catch(e => {
                    // Autoplay blocked is fine
                    if (e.name !== 'NotAllowedError' && e.name !== 'NotSupportedError') {
                        console.log("Play error", e);
                    }
                });
            } else {
                videoRef.current.pause();
            }
        }
    }, [isTransitioning]);

    const handleVideoCanPlay = () => {
        setIsLoading(false);
        setHasError(false);

        // Only play if this video is currently visible and not during transition
        if (videoRef.current && isVisible && !isTransitioning) {
            videoRef.current.play().catch(e => {
                if (e.name !== 'NotAllowedError' && e.name !== 'NotSupportedError') {
                    console.log("Play error", e);
                }
            });
        }
    };

    const handleVideoLoadStart = () => {
        // Check if video is preloaded
        const preloadedVideo = videoPreloadCache.get(profile.videoUrl || '');
        if (preloadedVideo && preloadedVideo.readyState >= 3) { // HAVE_FUTURE_DATA or higher
            setIsLoading(false);
            setHasError(false);
        }
        // Also check current video element
        if (videoRef.current && videoRef.current.readyState >= 2) {
            setIsLoading(false);
        }
    };

    const handleVideoError = () => {
        setIsLoading(false);
        // Only show error if video element actually has an error
        if (videoRef.current && videoRef.current.error) {
            setHasError(true);
        }
    };

    const handleVideoLoadedMetadata = () => {
        // Check if video has enough data to play
        if (videoRef.current && videoRef.current.readyState >= 2) {
            setIsLoading(false);
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

        // Add resistance effect when dragging beyond threshold
        const resistance = Math.abs(diff) > 100 ? 0.5 : 1;
        setTranslateY(-diff * resistance);

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

        // Smooth spring-back animation
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

        // Add resistance effect when dragging beyond threshold
        const resistance = Math.abs(diff) > 100 ? 0.5 : 1;
        setTranslateY(-diff * resistance);

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

        // Smooth spring-back animation
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
            className={`video-card-tiktok ${isDragging ? 'dragging' : ''} ${getAnimationClass()}`}
            style={{ transform: isDragging ? `translateY(${translateY}px)` : undefined }}
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
                ref={videoRefCallback}
                src={videoSrc || undefined}
                loop
                muted
                playsInline
                preload="auto"
                className="tiktok-video-element"
                onCanPlay={handleVideoCanPlay}
                onLoadStart={handleVideoLoadStart}
                onLoadedMetadata={handleVideoLoadedMetadata}
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
            <div className="tiktok-info-overlay" onClick={() => onOpenProfile(profile.userId)}>
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
