/**
 * Waiting Room Screen
 * Pre-event lobby with camera preview and countdown
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, CameraType, CameraView } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ArrowLeft,
    Video,
    VideoOff,
    Mic,
    MicOff,
    Users,
    Clock,
    ShieldCheck,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { eventService, type EventData } from '../../../../services/api';
import socketService from '../../../../services/socketService';
import { getCurrentUserId } from '../../../../services/authService';

export default function WaitingRoomScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [event, setEvent] = useState<EventData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [isMicOn, setIsMicOn] = useState(true);
    const [participantCount, setParticipantCount] = useState(0);
    const [timeToStart, setTimeToStart] = useState<number | null>(null);
    const [isEventStarting, setIsEventStarting] = useState(false);

    const cameraRef = useRef<CameraView>(null);

    useEffect(() => {
        requestPermissions();
        if (id) {
            fetchEvent();
            joinWaitingRoom();
        }

        return () => {
            if (id) {
                leaveWaitingRoom();
            }
        };
    }, [id]);

    // Countdown timer
    useEffect(() => {
        if (!event) return;

        const updateCountdown = () => {
            const now = new Date().getTime();
            const eventTime = new Date(event.date).getTime();
            const diff = eventTime - now;

            if (diff <= 0) {
                setTimeToStart(0);
                setIsEventStarting(true);
            } else {
                setTimeToStart(Math.floor(diff / 1000));
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);

        return () => clearInterval(interval);
    }, [event]);

    const requestPermissions = async () => {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
    };

    const fetchEvent = async () => {
        try {
            if (!id) return;
            const eventData = await eventService.getEventById(id);
            setEvent(eventData);
        } catch (error) {
            console.error('Failed to fetch event:', error);
            Alert.alert('Error', 'Failed to load event details');
        } finally {
            setIsLoading(false);
        }
    };

    const joinWaitingRoom = async () => {
        try {
            const userId = await getCurrentUserId();
            if (!userId || !id) return;

            await socketService.connect(userId);
            socketService.joinRoom(`event_waiting_${id}`);

            // NOTE: For custom event listeners in events, you would typically
            // use socketService.emit() to send events and the backend would push updates
            // For now, we simulate participant count updates locally
            setParticipantCount(1); // Start with self
        } catch (error) {
            console.error('Failed to join waiting room:', error);
        }
    };

    const leaveWaitingRoom = () => {
        if (id) {
            socketService.leaveRoom(`event_waiting_${id}`);
        }
    };

    const handleBack = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Alert.alert(
            'Leave Waiting Room',
            'Are you sure you want to leave?',
            [
                { text: 'Stay', style: 'cancel' },
                {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: () => router.back(),
                },
            ]
        );
    };

    const handleToggleCamera = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsCameraOn(!isCameraOn);
    };

    const handleToggleMic = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsMicOn(!isMicOn);
    };

    const handleJoinSession = () => {
        if (id) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            router.replace(`/(main)/events/session/${id}`);
        }
    };

    const formatTime = (seconds: number): string => {
        if (seconds <= 0) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>Preparing waiting room...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Camera Preview */}
            <View style={styles.cameraContainer}>
                {hasPermission && isCameraOn ? (
                    <CameraView
                        ref={cameraRef}
                        style={styles.camera}
                        facing="front"
                    />
                ) : (
                    <View style={[styles.camera, styles.cameraOff]}>
                        <VideoOff size={48} color="#64748b" />
                        <Text style={styles.cameraOffText}>Camera Off</Text>
                    </View>
                )}

                {/* Gradient Overlay */}
                <LinearGradient
                    colors={['rgba(10, 10, 10, 0.6)', 'transparent', 'rgba(10, 10, 10, 0.8)']}
                    style={styles.cameraGradient}
                />

                {/* Top Header */}
                <SafeAreaView style={styles.header} edges={['top']}>
                    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                        <ArrowLeft size={24} color="#ffffff" />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={styles.eventName}>{event?.name}</Text>
                        <View style={styles.participantBadge}>
                            <Users size={14} color="#22c55e" />
                            <Text style={styles.participantText}>
                                {participantCount} waiting
                            </Text>
                        </View>
                    </View>
                    <View style={styles.placeholder} />
                </SafeAreaView>

                {/* Camera Controls */}
                <View style={styles.cameraControls}>
                    <TouchableOpacity
                        style={[styles.controlButton, !isCameraOn && styles.controlButtonOff]}
                        onPress={handleToggleCamera}
                    >
                        {isCameraOn ? (
                            <Video size={24} color="#ffffff" />
                        ) : (
                            <VideoOff size={24} color="#ef4444" />
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.controlButton, !isMicOn && styles.controlButtonOff]}
                        onPress={handleToggleMic}
                    >
                        {isMicOn ? (
                            <Mic size={24} color="#ffffff" />
                        ) : (
                            <MicOff size={24} color="#ef4444" />
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Bottom Info */}
            <SafeAreaView style={styles.bottomSection} edges={['bottom']}>
                {/* Countdown */}
                <View style={styles.countdownContainer}>
                    {isEventStarting ? (
                        <>
                            <Text style={styles.startingText}>Event is starting!</Text>
                            <Text style={styles.startingSubtext}>Get ready to meet people</Text>
                        </>
                    ) : timeToStart !== null ? (
                        <>
                            <View style={styles.countdownRow}>
                                <Clock size={20} color="#3B82F6" />
                                <Text style={styles.countdownLabel}>Starting in</Text>
                            </View>
                            <Text style={styles.countdownTime}>
                                {timeToStart > 3600
                                    ? `${Math.floor(timeToStart / 3600)}h ${Math.floor((timeToStart % 3600) / 60)}m`
                                    : formatTime(timeToStart)}
                            </Text>
                        </>
                    ) : null}
                </View>

                {/* Tips */}
                <View style={styles.tips}>
                    <View style={styles.tip}>
                        <ShieldCheck size={18} color="#22c55e" />
                        <Text style={styles.tipText}>
                            Be respectful and have fun meeting new people
                        </Text>
                    </View>
                </View>

                {/* Join Button */}
                {isEventStarting && (
                    <TouchableOpacity
                        style={styles.joinButton}
                        onPress={handleJoinSession}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={['#3B82F6', '#60A5FA']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.joinGradient}
                        >
                            <Text style={styles.joinButtonText}>Join Speed Dating</Text>
                        </LinearGradient>
                    </TouchableOpacity>
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
        color: '#94a3b8',
        fontSize: 16,
    },
    cameraContainer: {
        flex: 1,
        position: 'relative',
    },
    camera: {
        flex: 1,
    },
    cameraOff: {
        backgroundColor: '#1e293b',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraOffText: {
        marginTop: 12,
        color: '#64748b',
        fontSize: 16,
    },
    cameraGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerCenter: {
        alignItems: 'center',
    },
    eventName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#ffffff',
        marginBottom: 4,
    },
    participantBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    participantText: {
        fontSize: 12,
        color: '#22c55e',
        fontWeight: '500',
    },
    placeholder: {
        width: 44,
    },
    cameraControls: {
        position: 'absolute',
        bottom: 24,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
    },
    controlButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    controlButtonOff: {
        backgroundColor: 'rgba(239, 68, 68, 0.3)',
    },
    bottomSection: {
        padding: 20,
        backgroundColor: '#0a0a0a',
    },
    countdownContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    countdownRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    countdownLabel: {
        fontSize: 14,
        color: '#94a3b8',
    },
    countdownTime: {
        fontSize: 48,
        fontWeight: '700',
        color: '#ffffff',
    },
    startingText: {
        fontSize: 24,
        fontWeight: '700',
        color: '#22c55e',
        marginBottom: 4,
    },
    startingSubtext: {
        fontSize: 14,
        color: '#94a3b8',
    },
    tips: {
        marginBottom: 20,
    },
    tip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        padding: 14,
        borderRadius: 12,
    },
    tipText: {
        flex: 1,
        fontSize: 14,
        color: '#94a3b8',
    },
    joinButton: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    joinGradient: {
        paddingVertical: 18,
        alignItems: 'center',
    },
    joinButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#ffffff',
    },
});
