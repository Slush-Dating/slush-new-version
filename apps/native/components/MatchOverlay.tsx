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
                    colors={['rgba(59, 130, 246, 0.9)', 'rgba(14, 165, 233, 0.9)']}
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
                        <Text style={styles.itsAMatch}>
                            {matchData.isIceBreaker ? 'Ice Broken!' : "It's a Match!"}
                        </Text>
                        <Text style={styles.subtitle}>
                            You and {matchData.user.name} liked each other
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
                            >
                                <MessageCircle size={20} color={matchData.isIceBreaker ? "#0EA5E9" : "#3B82F6"} />
                                <Text style={[
                                    styles.chatButtonText,
                                    matchData.isIceBreaker && { color: '#0EA5E9' }
                                ]}>Send Message</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.continueButton}
                                onPress={handleDismiss}
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
    itsAMatch: {
        fontSize: 42,
        fontWeight: '800',
        color: '#ffffff',
        textAlign: 'center',
        marginBottom: 8,
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    subtitle: {
        fontSize: 18,
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
        marginBottom: 40,
    },
    photosContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 48,
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
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: -20,
        zIndex: 10,
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
        elevation: 12,
    },
    buttons: {
        width: '100%',
        gap: 16,
    },
    chatButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        paddingVertical: 18,
        borderRadius: 16,
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    chatButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#3B82F6',
    },
    continueButton: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    continueButtonText: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.8)',
        fontWeight: '500',
    },
});

export default MatchOverlay;
