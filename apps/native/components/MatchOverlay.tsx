/**
 * Match Overlay Component
 * Shows celebratory animation when two users match
 */

import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Dimensions,
    Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MessageCircle, X, Heart, User, Snowflake } from 'lucide-react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withSequence,
    withDelay,
    withTiming,
    interpolate,
    runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { getAbsoluteMediaUrl } from '../services/apiConfig';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MatchData {
    matchId: string;
    user: {
        id: string;
        name: string;
        age: number | null;
        imageUrl: string | null;
        bio?: string;
    };
    matchedAt: string;
    context: string;
    isIceBreaker?: boolean;
}

interface MatchOverlayProps {
    isVisible: boolean;
    matchData: MatchData | null;
    currentUser: {
        name: string;
        photos?: string[];
        imageUrl?: string;
    } | null;
    onStartChat: (matchId: string) => void;
    onDismiss: () => void;
    onViewProfile?: (userId: string) => void;
}

export function MatchOverlay({
    isVisible,
    matchData,
    currentUser,
    onStartChat,
    onDismiss,
    onViewProfile,
}: MatchOverlayProps) {
    // Animation values
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);
    const heartScale = useSharedValue(0);
    const photosPosition = useSharedValue(100);
    const buttonsOpacity = useSharedValue(0);

    useEffect(() => {
        if (isVisible && matchData) {
            // Trigger haptic feedback
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Run animations
            opacity.value = withTiming(1, { duration: 300 });
            scale.value = withSpring(1, { damping: 12, stiffness: 100 });

            heartScale.value = withSequence(
                withDelay(200, withSpring(1.3, { damping: 8 })),
                withSpring(1, { damping: 10 })
            );

            photosPosition.value = withDelay(
                300,
                withSpring(0, { damping: 12 })
            );

            buttonsOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));
        } else {
            opacity.value = withTiming(0, { duration: 200 });
            scale.value = withTiming(0, { duration: 200 });
            heartScale.value = 0;
            photosPosition.value = 100;
            buttonsOpacity.value = 0;
        }
    }, [isVisible, matchData]);

    const containerStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const contentStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const heartStyle = useAnimatedStyle(() => ({
        transform: [{ scale: heartScale.value }],
    }));

    const photosStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: photosPosition.value }],
        opacity: interpolate(photosPosition.value, [100, 0], [0, 1]),
    }));

    const buttonsStyle = useAnimatedStyle(() => ({
        opacity: buttonsOpacity.value,
    }));

    const handleStartChat = () => {
        if (matchData) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onStartChat(matchData.matchId);
        }
    };

    const handleViewProfile = () => {
        if (matchData && onViewProfile) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onViewProfile(matchData.user.id);
        }
    };

    const handleDismiss = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onDismiss();
    };

    if (!matchData) return null;

    const currentUserImage = currentUser?.photos?.[0] || currentUser?.imageUrl;
    const matchedUserImage = matchData.user.imageUrl;

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="none"
            statusBarTranslucent
        >
            <Animated.View style={[styles.container, containerStyle]}>
                <LinearGradient
                    colors={['rgba(59, 130, 246, 0.95)', 'rgba(139, 92, 246, 0.85)', 'rgba(236, 72, 153, 0.75)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradient}
                >
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={handleDismiss}
                    >
                        <X size={24} color="#ffffff" />
                    </TouchableOpacity>

                    <Animated.View style={[styles.content, contentStyle]}>
                        {/* Title */}
                        <View style={styles.titleContainer}>
                            <Text style={styles.itsAMatch}>
                                {matchData.isIceBreaker ? 'Ice Broken!' : "It's a Match!"}
                            </Text>
                            <View style={styles.sparkleContainer}>
                                <Text style={styles.sparkle}>✨</Text>
                                <Text style={styles.sparkle}>💫</Text>
                                <Text style={styles.sparkle}>✨</Text>
                            </View>
                        </View>
                        <Text style={styles.subtitle}>
                            You and <Text style={styles.nameHighlight}>{matchData.user.name}</Text> liked each other
                        </Text>

                        {/* Photos with Heart */}
                        <Animated.View style={[styles.photosContainer, photosStyle]}>
                            {/* Current User Photo */}
                            <View style={styles.photoWrapper}>
                                {currentUserImage ? (
                                    <Image
                                        source={{ uri: getAbsoluteMediaUrl(currentUserImage) }}
                                        style={styles.photo}
                                    />
                                ) : (
                                    <View style={[styles.photo, styles.noPhoto]}>
                                        <User size={40} color="#64748b" />
                                    </View>
                                )}
                            </View>

                            {/* Heart/Snowflake in the middle */}
                            <Animated.View style={[
                                styles.heartContainer,
                                heartStyle,
                                matchData.isIceBreaker && { backgroundColor: '#0EA5E9' }
                            ]}>
                                {matchData.isIceBreaker ? (
                                    <View style={{ transform: [{ scale: 1.2 }] }}>
                                        <Snowflake size={36} color="#ffffff" strokeWidth={2.5} />
                                    </View>
                                ) : (
                                    <Heart size={36} color="#ffffff" fill="#ffffff" />
                                )}
                            </Animated.View>

                            {/* Matched User Photo */}
                            <TouchableOpacity
                                style={styles.photoWrapper}
                                onPress={handleViewProfile}
                            >
                                {matchedUserImage ? (
                                    <Image
                                        source={{ uri: getAbsoluteMediaUrl(matchedUserImage) }}
                                        style={styles.photo}
                                    />
                                ) : (
                                    <View style={[styles.photo, styles.noPhoto]}>
                                        <User size={40} color="#64748b" />
                                    </View>
                                )}
                            </TouchableOpacity>
                        </Animated.View>

                        {/* Buttons */}
                        <Animated.View style={[styles.buttons, buttonsStyle]}>
                            <TouchableOpacity
                                style={styles.chatButton}
                                onPress={handleStartChat}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={matchData.isIceBreaker ?
                                        ['#0EA5E9', '#7DD3FC'] :
                                        ['#3B82F6', '#8B5CF6']
                                    }
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.chatButtonGradient}
                                >
                                    <MessageCircle size={22} color="#ffffff" />
                                    <Text style={styles.chatButtonText}>Send Message</Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.continueButton}
                                onPress={handleDismiss}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.continueButtonText}>Keep Swiping</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </Animated.View>
                </LinearGradient>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButton: {
        position: 'absolute',
        top: 60,
        right: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    titleContainer: {
        alignItems: 'center',
        marginBottom: 12,
    },
    itsAMatch: {
        fontSize: 44,
        fontWeight: '800',
        color: '#ffffff',
        textAlign: 'center',
        textShadowColor: 'rgba(0, 0, 0, 0.4)',
        textShadowOffset: { width: 0, height: 3 },
        textShadowRadius: 6,
        marginBottom: 8,
    },
    sparkleContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    sparkle: {
        fontSize: 20,
        opacity: 0.9,
    },
    subtitle: {
        fontSize: 18,
        color: 'rgba(255, 255, 255, 0.95)',
        textAlign: 'center',
        marginBottom: 48,
        fontWeight: '500',
    },
    nameHighlight: {
        color: '#ffffff',
        fontWeight: '700',
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    photosContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 56,
        paddingHorizontal: 16,
    },
    photoWrapper: {
        width: 130,
        height: 130,
        borderRadius: 65,
        borderWidth: 4,
        borderColor: '#ffffff',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    photo: {
        width: '100%',
        height: '100%',
    },
    noPhoto: {
        backgroundColor: '#1e293b',
        justifyContent: 'center',
        alignItems: 'center',
    },
    heartContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: -24,
        zIndex: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 16,
        borderWidth: 3,
        borderColor: '#ffffff',
    },
    buttons: {
        width: '100%',
        gap: 20,
    },
    chatButton: {
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    chatButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
        paddingHorizontal: 24,
        gap: 10,
    },
    chatButtonText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#ffffff',
        textShadowColor: 'rgba(0, 0, 0, 0.2)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    continueButton: {
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    continueButtonText: {
        fontSize: 16,
        color: '#ffffff',
        fontWeight: '600',
        textShadowColor: 'rgba(0, 0, 0, 0.2)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
});

export default MatchOverlay;
