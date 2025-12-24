/**
 * Event Session Screen
 * Live speed dating session with video calls
 * 
 * NOTE: This is a placeholder implementation.
 * Full Agora video chat integration would require:
 * - npm install react-native-agora
 * - iOS/Android native module setup
 * - Agora app credentials
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Alert,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, CameraView } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import {
    Heart,
    X,
    Video,
    VideoOff,
    Mic,
    MicOff,
    Clock,
    MessageCircle,
    SkipForward,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { eventService, matchService } from '../../../../services/api';
import { getAbsoluteMediaUrl } from '../../../../services/apiConfig';
import socketService from '../../../../services/socketService';
import { getCurrentUserId } from '../../../../services/authService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Session timing (in seconds)
const TIMING = {
    PREP: 15,      // 15 seconds prep
    DATE: 180,     // 3 minutes date
    FEEDBACK: 30,  // 30 seconds feedback
};

type SessionPhase = 'loading' | 'prep' | 'date' | 'feedback' | 'waiting' | 'summary' | 'complete';

interface Partner {
    id: string;
    userId: string;
    name: string;
    age: number | null;
    imageUrl: string | null;
    bio: string;
}

export default function EventSessionScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [phase, setPhase] = useState<SessionPhase>('loading');
    const [partner, setPartner] = useState<Partner | null>(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [roundNumber, setRoundNumber] = useState(1);
    const [totalRounds] = useState(5); // Could be dynamic
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [isMicOn, setIsMicOn] = useState(true);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [likedPartners, setLikedPartners] = useState<string[]>([]);
    const [matches, setMatches] = useState<Partner[]>([]);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const cameraRef = useRef<CameraView>(null);

    useEffect(() => {
        requestPermissions();
        startSession();

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, []);

    // Timer effect
    useEffect(() => {
        if (phase === 'prep' || phase === 'date' || phase === 'feedback') {
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        handlePhaseEnd();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [phase, partner]);

    const requestPermissions = async () => {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
    };

    const startSession = async () => {
        // Simulate fetching first partner
        await fetchNextPartner();
    };

    const fetchNextPartner = async () => {
        setPhase('loading');

        // Simulate API call to get next partner
        // In real implementation, this would come from your backend
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Mock partner data
        const mockPartner: Partner = {
            id: `partner_${roundNumber}`,
            userId: `user_${roundNumber}`,
            name: ['Sarah', 'Emma', 'Olivia', 'Ava', 'Isabella'][roundNumber - 1] || 'Partner',
            age: 24 + roundNumber,
            imageUrl: null, // Would be real URL in production
            bio: 'Looking forward to connecting!',
        };

        setPartner(mockPartner);
        setPhase('prep');
        setTimeLeft(TIMING.PREP);
    };

    const handlePhaseEnd = () => {
        switch (phase) {
            case 'prep':
                setPhase('date');
                setTimeLeft(TIMING.DATE);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                break;
            case 'date':
                setPhase('feedback');
                setTimeLeft(TIMING.FEEDBACK);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                break;
            case 'feedback':
                // Auto-pass if no decision made
                moveToNextRound(false);
                break;
        }
    };

    const handleLike = async () => {
        if (!partner) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        try {
            // Call match API
            const result = await matchService.performAction(
                partner.userId,
                'like',
                'live_event'
            );

            if (result.isMatch) {
                setMatches((prev) => [...prev, partner]);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            setLikedPartners((prev) => [...prev, partner.userId]);
        } catch (error) {
            console.error('Like failed:', error);
        }

        moveToNextRound(true);
    };

    const handlePass = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        moveToNextRound(false);
    };

    const moveToNextRound = async (liked: boolean) => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        if (roundNumber >= totalRounds) {
            setPhase('summary');
        } else {
            setRoundNumber((prev) => prev + 1);
            setPhase('waiting');
            await new Promise((resolve) => setTimeout(resolve, 2000));
            await fetchNextPartner();
        }
    };

    const handleComplete = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.replace('/(main)/matches');
    };

    const handleSkip = () => {
        // For testing - skip current phase
        handlePhaseEnd();
    };

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Loading state
    if (phase === 'loading') {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>Finding your next match...</Text>
            </View>
        );
    }

    // Summary screen
    if (phase === 'summary') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.summaryContent}>
                    <Text style={styles.summaryTitle}>Speed Dating Complete! 🎉</Text>
                    <Text style={styles.summarySubtitle}>
                        You met {totalRounds} amazing people
                    </Text>

                    {matches.length > 0 ? (
                        <View style={styles.matchesSection}>
                            <Text style={styles.matchesTitle}>
                                You got {matches.length} match{matches.length > 1 ? 'es' : ''}!
                            </Text>
                            <View style={styles.matchAvatars}>
                                {matches.map((match, index) => (
                                    <View key={index} style={styles.matchAvatar}>
                                        <View style={styles.matchPlaceholder}>
                                            <Heart size={24} color="#3B82F6" />
                                        </View>
                                        <Text style={styles.matchName}>{match.name}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    ) : (
                        <View style={styles.noMatchesSection}>
                            <Text style={styles.noMatchesText}>
                                No matches this time, but don't give up!
                            </Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={styles.completeButton}
                        onPress={handleComplete}
                    >
                        <LinearGradient
                            colors={['#3B82F6', '#60A5FA']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.completeGradient}
                        >
                            <Text style={styles.completeButtonText}>
                                {matches.length > 0 ? 'View Matches' : 'Back to App'}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // Waiting between rounds
    if (phase === 'waiting') {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>
                    Round {roundNumber} of {totalRounds}
                </Text>
                <Text style={styles.loadingSubtext}>Getting ready...</Text>
            </View>
        );
    }

    // Main session UI
    return (
        <View style={styles.container}>
            {/* Video Area */}
            <View style={styles.videoArea}>
                {/* Partner Video (Placeholder) */}
                <View style={styles.partnerVideo}>
                    <View style={styles.videoPlaceholder}>
                        <Text style={styles.placeholderEmoji}>👤</Text>
                        <Text style={styles.placeholderText}>
                            {partner?.name}'s Video
                        </Text>
                    </View>
                </View>

                {/* Self Video */}
                <View style={styles.selfVideo}>
                    {hasPermission && isCameraOn ? (
                        <CameraView
                            ref={cameraRef}
                            style={styles.camera}
                            facing="front"
                        />
                    ) : (
                        <View style={[styles.camera, styles.cameraOff]}>
                            <VideoOff size={20} color="#64748b" />
                        </View>
                    )}
                </View>
            </View>

            {/* Header */}
            <SafeAreaView style={styles.header} edges={['top']}>
                <View style={styles.roundBadge}>
                    <Text style={styles.roundText}>
                        {roundNumber}/{totalRounds}
                    </Text>
                </View>

                <View style={styles.timerContainer}>
                    <Clock size={16} color={phase === 'feedback' ? '#f59e0b' : '#3B82F6'} />
                    <Text
                        style={[
                            styles.timer,
                            phase === 'feedback' && styles.timerWarning,
                        ]}
                    >
                        {formatTime(timeLeft)}
                    </Text>
                </View>

                <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                    <SkipForward size={20} color="#64748b" />
                </TouchableOpacity>
            </SafeAreaView>

            {/* Phase Banner */}
            <View style={styles.phaseBanner}>
                <Text style={styles.phaseText}>
                    {phase === 'prep'
                        ? '🎬 Get Ready!'
                        : phase === 'date'
                            ? '💬 Chat with ' + partner?.name
                            : '🤔 Make Your Decision'}
                </Text>
            </View>

            {/* Partner Info */}
            <View style={styles.partnerInfo}>
                <Text style={styles.partnerName}>
                    {partner?.name}
                    {partner?.age && <Text style={styles.partnerAge}>, {partner.age}</Text>}
                </Text>
                {partner?.bio && (
                    <Text style={styles.partnerBio}>{partner.bio}</Text>
                )}
            </View>

            {/* Controls */}
            <SafeAreaView style={styles.controls} edges={['bottom']}>
                {/* Camera/Mic Controls */}
                <View style={styles.mediaControls}>
                    <TouchableOpacity
                        style={[styles.mediaButton, !isCameraOn && styles.mediaButtonOff]}
                        onPress={() => setIsCameraOn(!isCameraOn)}
                    >
                        {isCameraOn ? (
                            <Video size={20} color="#ffffff" />
                        ) : (
                            <VideoOff size={20} color="#ef4444" />
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.mediaButton, !isMicOn && styles.mediaButtonOff]}
                        onPress={() => setIsMicOn(!isMicOn)}
                    >
                        {isMicOn ? (
                            <Mic size={20} color="#ffffff" />
                        ) : (
                            <MicOff size={20} color="#ef4444" />
                        )}
                    </TouchableOpacity>
                </View>

                {/* Decision Buttons (only in feedback phase) */}
                {phase === 'feedback' && (
                    <View style={styles.decisionButtons}>
                        <TouchableOpacity style={styles.passButton} onPress={handlePass}>
                            <X size={32} color="#ef4444" />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.likeButton} onPress={handleLike}>
                            <Heart size={32} color="#22c55e" fill="#22c55e" />
                        </TouchableOpacity>
                    </View>
                )}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0a0a0a',
    },
    loadingText: {
        marginTop: 16,
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '600',
    },
    loadingSubtext: {
        marginTop: 8,
        color: '#94a3b8',
        fontSize: 14,
    },
    videoArea: {
        flex: 1,
        position: 'relative',
    },
    partnerVideo: {
        flex: 1,
    },
    videoPlaceholder: {
        flex: 1,
        backgroundColor: '#1e293b',
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderEmoji: {
        fontSize: 64,
    },
    placeholderText: {
        marginTop: 16,
        color: '#94a3b8',
        fontSize: 16,
    },
    selfVideo: {
        position: 'absolute',
        bottom: 100,
        right: 16,
        width: 100,
        height: 140,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#0a0a0a',
    },
    camera: {
        flex: 1,
    },
    cameraOff: {
        backgroundColor: '#374151',
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    roundBadge: {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    roundText: {
        color: '#3B82F6',
        fontSize: 14,
        fontWeight: '600',
    },
    timerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
    },
    timer: {
        color: '#3B82F6',
        fontSize: 24,
        fontWeight: '700',
    },
    timerWarning: {
        color: '#f59e0b',
    },
    skipButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    phaseBanner: {
        position: 'absolute',
        top: 120,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    phaseText: {
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    partnerInfo: {
        position: 'absolute',
        bottom: 200,
        left: 16,
        right: 120,
    },
    partnerName: {
        fontSize: 28,
        fontWeight: '700',
        color: '#ffffff',
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    partnerAge: {
        fontWeight: '400',
    },
    partnerBio: {
        marginTop: 8,
        fontSize: 16,
        color: '#e2e8f0',
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    controls: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
    },
    mediaControls: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 16,
    },
    mediaButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    mediaButtonOff: {
        backgroundColor: 'rgba(239, 68, 68, 0.3)',
    },
    decisionButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 40,
    },
    passButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderWidth: 2,
        borderColor: '#ef4444',
        justifyContent: 'center',
        alignItems: 'center',
    },
    likeButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        borderWidth: 2,
        borderColor: '#22c55e',
        justifyContent: 'center',
        alignItems: 'center',
    },
    summaryContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    summaryTitle: {
        fontSize: 32,
        fontWeight: '700',
        color: '#ffffff',
        textAlign: 'center',
        marginBottom: 8,
    },
    summarySubtitle: {
        fontSize: 16,
        color: '#94a3b8',
        marginBottom: 40,
    },
    matchesSection: {
        alignItems: 'center',
        marginBottom: 40,
    },
    matchesTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#22c55e',
        marginBottom: 20,
    },
    matchAvatars: {
        flexDirection: 'row',
        gap: 16,
    },
    matchAvatar: {
        alignItems: 'center',
    },
    matchPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    matchName: {
        fontSize: 14,
        color: '#ffffff',
    },
    noMatchesSection: {
        marginBottom: 40,
    },
    noMatchesText: {
        fontSize: 16,
        color: '#94a3b8',
        textAlign: 'center',
    },
    completeButton: {
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
    },
    completeGradient: {
        paddingVertical: 18,
        alignItems: 'center',
    },
    completeButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#ffffff',
    },
});
