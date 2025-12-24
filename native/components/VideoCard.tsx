/**
 * Enhanced Video Card Component
 * TikTok-style video playback with progress bar, visibility control, and error handling
 */

import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Image,
    Text,
    Dimensions,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Volume2, VolumeX } from 'lucide-react-native';
import { getAbsoluteMediaUrl } from '../services/apiConfig';
import { DiscoveryProfile } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface VideoCardProps {
    profile: DiscoveryProfile;
    isVisible?: boolean;
    onVideoLoad?: () => void;
    onVideoError?: (error: string) => void;
}

export default function VideoCard({
    profile,
    isVisible = true,
    onVideoLoad,
    onVideoError
}: VideoCardProps) {
    const [isVideoLoading, setIsVideoLoading] = useState(true);
    const [videoError, setVideoError] = useState<string | null>(null);
    const [isMuted, setIsMuted] = useState(true);
    const [showControls, setShowControls] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [retryCount, setRetryCount] = useState(0);
    const [usePhotoFallback, setUsePhotoFallback] = useState(false);

    const videoUrl = profile.videoUrl ? getAbsoluteMediaUrl(profile.videoUrl) : null;
    const thumbnailUrl = profile.thumbnail ? getAbsoluteMediaUrl(profile.thumbnail) : null;
    const fallbackImageUrl = profile.photos?.[0] ? getAbsoluteMediaUrl(profile.photos[0]) : null;

    // Debug logging for video URLs
    console.log('🎬 VideoCard Debug for profile:', profile.name);
    console.log('  - Original videoUrl:', profile.videoUrl);
    console.log('  - Processed videoUrl:', videoUrl);
    console.log('  - Thumbnail URL:', thumbnailUrl);

    // Validate video URL format
    const isValidVideoUrl = videoUrl && (
        videoUrl.includes('.mp4') ||
        videoUrl.includes('.mov') ||
        videoUrl.includes('.m4v') ||
        videoUrl.includes('.avi') ||
        videoUrl.includes('.mkv')
    );

    if (videoUrl && !isValidVideoUrl) {
        console.warn('⚠️  Video URL may not be in a supported format:', videoUrl);
    }

    // Create video player instance
    const player = useVideoPlayer(videoUrl || '', (player) => {
        player.loop = true;
        player.muted = isMuted;

        // Use status reactive property or listener depending on version
        player.addListener('statusChange', (status) => {
            // Some versions of expo-video pass a status string, others an object
            const statusValue = typeof status === 'string' ? status : (status as any)?.status;
            console.log('Video status changed:', statusValue, 'for profile:', profile.name);

            if (statusValue === 'readyToPlay') {
                console.log('✅ Video loaded successfully for:', profile.name);
                setIsVideoLoading(false);
                setVideoError(null);
                onVideoLoad?.();
                if (isVisible) {
                    player.play();
                    setIsPlaying(true);
                }
            } else if (statusValue === 'error') {
                const errorObj = typeof status === 'object' ? (status as any).error : null;
                const errorMsg = errorObj?.message || 'Unknown error';
                console.error('❌ Video error for profile:', profile.name, '- Error:', errorMsg, '- URL:', videoUrl);

                let userFriendlyError = 'Video unavailable';
                if (errorMsg.includes('Cannot Open')) {
                    userFriendlyError = 'Video file not accessible';
                }

                setIsVideoLoading(false);
                setVideoError(userFriendlyError);
                onVideoError?.(`${userFriendlyError}: ${errorMsg}`);
            }
        });
    });

    // Loading timeout to prevent infinite loading state
    useEffect(() => {
        let timeout: NodeJS.Timeout;
        if (isVisible && isVideoLoading && !videoError && !usePhotoFallback) {
            timeout = setTimeout(() => {
                console.warn(`🕒 Video loading timeout for ${profile.name} - triggering retry/fallback`);
                if (retryCount < 2) {
                    retryVideoLoad();
                } else {
                    setUsePhotoFallback(true);
                    setIsVideoLoading(false);
                }
            }, 10000); // 10 second timeout
        }
        return () => clearTimeout(timeout);
    }, [isVisible, isVideoLoading, videoError, usePhotoFallback, retryCount]);

    // Control playback based on visibility
    useEffect(() => {
        if (player && videoUrl) {
            if (isVisible) {
                player.play();
                setIsPlaying(true);
            } else {
                player.pause();
                setIsPlaying(false);
            }
        }
    }, [isVisible, videoUrl, player]);

    // Reset retry count when video URL changes
    useEffect(() => {
        setRetryCount(0);
        setVideoError(null);
        setIsVideoLoading(true);
        setUsePhotoFallback(false);
    }, [videoUrl]);

    // Update mute state
    useEffect(() => {
        if (player) {
            player.muted = isMuted;
        }
    }, [isMuted, player]);

    const handleVideoError = (error: string) => {
        console.error('Video error:', error, 'for profile:', profile.name);
        setIsVideoLoading(false);
        setVideoError(error);
        onVideoError?.(error);
    };

    const retryVideoLoad = () => {
        if (retryCount < 2) { // Allow up to 2 retries
            console.log(`Retrying video load for ${profile.name}, attempt ${retryCount + 1}`);
            setRetryCount(prev => prev + 1);
            setVideoError(null);
            setIsVideoLoading(true);
            setUsePhotoFallback(false);

            // Force re-render by updating a dependency - expo-video handles reloading automatically
            // when the source changes
        } else {
            // After max retries, switch to photo fallback
            console.log(`Max retries reached for ${profile.name}, switching to photo fallback`);
            setUsePhotoFallback(true);
            setVideoError(null);
            setIsVideoLoading(false);
        }
    };

    // Progress tracking is handled differently in expo-video
    // For now, we'll keep a simple progress bar based on playback state

    const toggleMute = () => {
        setIsMuted(!isMuted);
    };

    const togglePlayback = () => {
        if (player) {
            if (isPlaying) {
                player.pause();
                setIsPlaying(false);
            } else {
                player.play();
                setIsPlaying(true);
            }
        }
    };

    const handleVideoPress = () => {
        togglePlayback();
        setShowControls(!showControls);
        // Hide controls after 3 seconds
        if (!showControls) {
            setTimeout(() => setShowControls(false), 3000);
        }
    };

    // Show thumbnail or fallback image while loading
    const showThumbnail = isVideoLoading || videoError || !videoUrl || usePhotoFallback;

    return (
        <View style={styles.container}>
            <TouchableOpacity
                activeOpacity={1}
                onPress={handleVideoPress}
                style={styles.videoContainer}
            >
                {/* Video Component */}
                {videoUrl && videoUrl.length > 0 && !videoError && !usePhotoFallback ? (
                    <VideoView
                        player={player}
                        style={styles.video}
                        contentFit="cover"
                        allowsPictureInPicture={false}
                    />
                ) : null}

                {/* Thumbnail/Fallback Image */}
                {showThumbnail && (thumbnailUrl || fallbackImageUrl) && (
                    <Image
                        source={{ uri: thumbnailUrl || fallbackImageUrl || undefined }}
                        style={styles.thumbnail}
                        resizeMode="cover"
                    />
                )}

                {/* Loading Indicator */}
                {isVideoLoading && videoUrl && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color="#ffffff" />
                        <Text style={styles.loadingText}>Loading video...</Text>
                    </View>
                )}

                {/* Error State */}
                {videoError && !usePhotoFallback && (
                    <TouchableOpacity
                        style={styles.errorOverlay}
                        onPress={retryCount < 2 ? retryVideoLoad : undefined}
                        activeOpacity={retryCount < 2 ? 0.7 : 1}
                    >
                        <Text style={styles.errorText}>Video unavailable</Text>
                        <Text style={styles.errorSubtext}>
                            {retryCount < 2 ? 'Tap to retry' : 'Unable to load video'}
                        </Text>
                        {retryCount > 0 && (
                            <Text style={styles.retryCountText}>
                                Attempt {retryCount + 1}/3
                            </Text>
                        )}
                    </TouchableOpacity>
                )}

                {/* Photo Fallback Indicator */}
                {usePhotoFallback && (
                    <View style={styles.photoFallbackOverlay}>
                        <Text style={styles.photoFallbackText}>📸 Photo view</Text>
                        <Text style={styles.photoFallbackSubtext}>Video temporarily unavailable</Text>
                    </View>
                )}

                {/* Pause Icon Overlay */}
                {showControls && !isPlaying && videoUrl && !videoError && (
                    <View style={styles.pauseOverlay}>
                        <View style={styles.pauseIcon}>
                            <View style={styles.playTriangle} />
                        </View>
                    </View>
                )}

                {/* Mute Indicator (top right) */}
                <TouchableOpacity
                    style={styles.muteButton}
                    onPress={toggleMute}
                    activeOpacity={0.7}
                >
                    {isMuted ? (
                        <VolumeX size={20} color="#ffffff" />
                    ) : (
                        <Volume2 size={20} color="#ffffff" />
                    )}
                </TouchableOpacity>
            </TouchableOpacity>

            {/* Video Progress Bar */}
            <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: `${progress}%` }]} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    videoContainer: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },
    video: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    thumbnail: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    loadingText: {
        color: '#ffffff',
        marginTop: 12,
        fontSize: 14,
    },
    errorOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    errorText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    errorSubtext: {
        color: '#94a3b8',
        fontSize: 14,
    },
    retryCountText: {
        color: '#64748b',
        fontSize: 12,
        marginTop: 4,
    },
    photoFallbackOverlay: {
        position: 'absolute',
        top: 20,
        right: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        alignItems: 'center',
    },
    photoFallbackText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '600',
    },
    photoFallbackSubtext: {
        color: '#94a3b8',
        fontSize: 10,
        marginTop: 2,
    },
    pauseOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
    },
    pauseIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    playTriangle: {
        width: 0,
        height: 0,
        borderLeftWidth: 24,
        borderLeftColor: '#ffffff',
        borderTopWidth: 14,
        borderTopColor: 'transparent',
        borderBottomWidth: 14,
        borderBottomColor: 'transparent',
        marginLeft: 8,
    },
    muteButton: {
        position: 'absolute',
        top: 60,
        right: 16,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#ffffff',
    },
});
