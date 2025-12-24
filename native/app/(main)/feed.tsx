/**
 * TikTok-Style Video Feed Screen
 * Full-screen vertical swipeable video profiles
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    ActivityIndicator,
    TouchableOpacity,
    FlatList,
    ViewToken,
    Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
    Heart,
    X,
    MapPin,
    RefreshCw,
    Snowflake,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

import { discoveryService, matchService, type DiscoveryProfile } from '../../services/api';
import VideoCard from '../../components/VideoCard';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Viewability configuration for determining which video is "current"
const VIEWABILITY_CONFIG = {
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 100,
};

export default function FeedScreen() {
    const [profiles, setProfiles] = useState<DiscoveryProfile[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isActionLoading, setIsActionLoading] = useState(false);

    // Animation values for action buttons
    const likeScale = useRef(new Animated.Value(1)).current;
    const icebreakerScale = useRef(new Animated.Value(1)).current;
    const passScale = useRef(new Animated.Value(1)).current;

    const flatListRef = useRef<FlatList>(null);

    // Fetch discovery feed
    const fetchFeed = useCallback(async () => {
        setIsLoading(true);
        setError('');

        try {
            const feed = await discoveryService.getFeed();
            setProfiles(feed);
            setCurrentIndex(0);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load feed');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFeed();
    }, [fetchFeed]);

    // Track which video is currently visible
    const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems.length > 0 && viewableItems[0].index !== null) {
            setCurrentIndex(viewableItems[0].index);
        }
    }, []);

    const viewabilityConfigCallbackPairs = useRef([
        { viewabilityConfig: VIEWABILITY_CONFIG, onViewableItemsChanged },
    ]);

    const currentProfile = profiles[currentIndex];

    // Navigate to profile
    const navigateToProfile = useCallback(() => {
        if (currentProfile) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(`/(main)/user/${currentProfile.userId}`);
        }
    }, [currentProfile]);

    // Animate button press
    const animateButton = (scaleValue: Animated.Value) => {
        Animated.sequence([
            Animated.timing(scaleValue, {
                toValue: 0.8,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.spring(scaleValue, {
                toValue: 1,
                friction: 3,
                tension: 100,
                useNativeDriver: true,
            }),
        ]).start();
    };

    // Handle action (like, pass, icebreaker)
    const handleAction = async (action: 'like' | 'pass' | 'super_like' | 'icebreaker') => {
        if (!currentProfile || isActionLoading) return;

        // Animate the appropriate button
        if (action === 'like') animateButton(likeScale);
        else if (action === 'icebreaker' || action === 'super_like') animateButton(icebreakerScale);
        else if (action === 'pass') animateButton(passScale);

        setIsActionLoading(true);
        Haptics.impactAsync(
            action === 'super_like' || action === 'icebreaker'
                ? Haptics.ImpactFeedbackStyle.Heavy
                : Haptics.ImpactFeedbackStyle.Medium
        );

        try {
            const result = await matchService.performAction(
                currentProfile.userId,
                action,
                'video_feed'
            );

            if (result.isMatch) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                // TODO: Show match overlay
                console.log('🎉 Match!', result.match);
            }

            // Remove the current profile and auto-scroll
            setProfiles(prev => {
                const newProfiles = prev.filter(p => p.userId !== currentProfile.userId);
                // If we're at end of list, stay at last valid index
                if (currentIndex >= newProfiles.length && newProfiles.length > 0) {
                    setTimeout(() => {
                        flatListRef.current?.scrollToIndex({
                            index: newProfiles.length - 1,
                            animated: true,
                        });
                    }, 100);
                }
                return newProfiles;
            });
        } catch (err) {
            console.error('Action failed:', err);
        } finally {
            setIsActionLoading(false);
        }
    };

    // Render each video item
    const renderVideoItem = useCallback(({ item, index }: { item: DiscoveryProfile; index: number }) => {
        const isVisible = index === currentIndex;

        return (
            <View style={styles.videoItemContainer}>
                {/* Video Component */}
                <VideoCard
                    profile={item}
                    isVisible={isVisible}
                    onVideoLoad={() => console.log('Video loaded for profile:', item.name)}
                    onVideoError={(error) => console.log('Video error for profile:', item.name, error)}
                />

                {/* Profile Info Overlay (Bottom) */}
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={navigateToProfile}
                    style={styles.profileOverlayTouchable}
                >
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.8)']}
                        style={styles.profileOverlay}
                    >
                        <View style={styles.profileInfo}>
                            <Text style={styles.name}>
                                {item.name}
                                {item.age && (
                                    <Text style={styles.age}>, {item.age}</Text>
                                )}
                            </Text>

                            {(item.distance || item.locationString) && (
                                <View style={styles.locationRow}>
                                    <MapPin size={14} color="#ffffff" />
                                    <Text style={styles.distance}>
                                        {item.locationString || item.distance}
                                    </Text>
                                </View>
                            )}

                            {item.bio && (
                                <Text style={styles.bio} numberOfLines={2}>
                                    {item.bio}
                                </Text>
                            )}
                        </View>
                    </LinearGradient>
                </TouchableOpacity>

                {/* Action Buttons (Right Side - TikTok Style) */}
                <View style={styles.rightActions}>
                    <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                        <TouchableOpacity
                            style={[styles.sideActionButton, styles.likeButton]}
                            onPress={() => handleAction('like')}
                            disabled={isActionLoading || !isVisible}
                            activeOpacity={0.8}
                        >
                            <Heart size={32} color="#ffffff" fill="#ffffff" />
                            <Text style={styles.actionText}>Like</Text>
                        </TouchableOpacity>
                    </Animated.View>

                    <Animated.View style={{ transform: [{ scale: icebreakerScale }] }}>
                        <TouchableOpacity
                            style={[styles.sideActionButton, styles.icebreakerButton]}
                            onPress={() => handleAction('icebreaker')}
                            disabled={isActionLoading || !isVisible}
                            activeOpacity={0.8}
                        >
                            <Snowflake size={28} color="#ffffff" />
                            <Text style={styles.actionText}>Arctic</Text>
                        </TouchableOpacity>
                    </Animated.View>

                    <Animated.View style={{ transform: [{ scale: passScale }] }}>
                        <TouchableOpacity
                            style={[styles.sideActionButton, styles.passButton]}
                            onPress={() => handleAction('pass')}
                            disabled={isActionLoading || !isVisible}
                            activeOpacity={0.8}
                        >
                            <X size={32} color="#ffffff" strokeWidth={3} />
                            <Text style={styles.actionText}>Pass</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>

                {/* Swipe Hint (first video only) */}
                {index === 0 && profiles.length > 1 && (
                    <View style={styles.swipeHint}>
                        <Text style={styles.swipeHintText}>Swipe up for next</Text>
                    </View>
                )}
            </View>
        );
    }, [currentIndex, isActionLoading, likeScale, icebreakerScale, passScale, profiles.length, navigateToProfile]);

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>Finding people near you...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={fetchFeed}>
                    <RefreshCw size={20} color="#ffffff" />
                    <Text style={styles.retryText}>Try Again</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (profiles.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Heart size={64} color="#64748b" />
                <Text style={styles.emptyTitle}>No more profiles</Text>
                <Text style={styles.emptyText}>
                    Check back later for more matches in your area
                </Text>
                <TouchableOpacity style={styles.refreshButton} onPress={fetchFeed}>
                    <RefreshCw size={20} color="#3B82F6" />
                    <Text style={styles.refreshText}>Refresh</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                ref={flatListRef}
                data={profiles}
                keyExtractor={(item) => item.userId}
                renderItem={renderVideoItem}
                pagingEnabled
                snapToInterval={SCREEN_HEIGHT}
                snapToAlignment="start"
                decelerationRate="fast"
                showsVerticalScrollIndicator={false}
                viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
                getItemLayout={(_, index) => ({
                    length: SCREEN_HEIGHT,
                    offset: SCREEN_HEIGHT * index,
                    index,
                })}
                initialNumToRender={2}
                maxToRenderPerBatch={3}
                windowSize={5}
                removeClippedSubviews={true}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    videoItemContainer: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        backgroundColor: '#000000',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000000',
    },
    loadingText: {
        marginTop: 16,
        color: '#94a3b8',
        fontSize: 16,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000000',
        padding: 24,
    },
    errorText: {
        color: '#ef4444',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 16,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3B82F6',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
    },
    retryText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '500',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000000',
        padding: 24,
    },
    emptyTitle: {
        color: '#ffffff',
        fontSize: 24,
        fontWeight: '600',
        marginTop: 16,
    },
    emptyText: {
        color: '#94a3b8',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 8,
    },
    refreshButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 24,
        gap: 8,
    },
    refreshText: {
        color: '#3B82F6',
        fontSize: 16,
        fontWeight: '500',
    },
    profileOverlayTouchable: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 80, // Leave space for action buttons
        paddingHorizontal: 20,
        paddingBottom: 100,
        paddingTop: 80,
    },
    profileOverlay: {
        width: '100%',
        height: '100%',
    },
    profileInfo: {
        gap: 6,
    },
    name: {
        fontSize: 26,
        fontWeight: '700',
        color: '#ffffff',
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    age: {
        fontWeight: '400',
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    distance: {
        fontSize: 15,
        color: '#ffffff',
        opacity: 0.9,
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    bio: {
        fontSize: 15,
        color: '#ffffff',
        marginTop: 8,
        lineHeight: 22,
        opacity: 0.95,
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    rightActions: {
        position: 'absolute',
        right: 12,
        bottom: 180,
        alignItems: 'center',
        gap: 20,
    },
    sideActionButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    likeButton: {
        backgroundColor: '#ff1493',
    },
    icebreakerButton: {
        backgroundColor: '#00bfff',
    },
    passButton: {
        backgroundColor: '#ff4500',
    },
    actionText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
        textAlign: 'center',
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    swipeHint: {
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    swipeHintText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
        fontWeight: '500',
    },
});
