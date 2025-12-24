/**
 * Waiting Room Screen
 * Pre-event lobby with animated countdown and participant preview
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    ScrollView,
    Image,
    Modal,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Camera, CameraView } from 'expo-camera';
import Animated, {
    useSharedValue,
    useAnimatedProps,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import {
    ArrowLeft,
    Users,
    Camera as CameraIcon,
    BookOpen,
    X,
    ChevronRight,
    ChevronLeft,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { eventService, type EventData } from '../../../../services/api';
import { getAbsoluteMediaUrl } from '../../../../services/apiConfig';
import { useBackNavigation } from '../../../../hooks/useBackNavigation';
import { colors, spacing, radius, typography, shadows } from '../../../../constants/theme';
const CIRCLE_SIZE = 200;
const CIRCLE_STROKE_WIDTH = 8;
const CIRCLE_RADIUS = (CIRCLE_SIZE - CIRCLE_STROKE_WIDTH) / 2;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Participant {
    _id: string;
    name: string;
    photos?: string[];
}

export default function WaitingRoomScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const handleBack = useBackNavigation('/(main)/events');

    const [event, setEvent] = useState<EventData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [totalParticipants, setTotalParticipants] = useState(0);
    const [maxParticipants, setMaxParticipants] = useState(16);
    const [timeToStart, setTimeToStart] = useState<number | null>(null);
    const [isEventStarting, setIsEventStarting] = useState(false);
    const [showCameraModal, setShowCameraModal] = useState(false);
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const [showGuideModal, setShowGuideModal] = useState(false);
    const [currentGuideStep, setCurrentGuideStep] = useState(1);

    const progress = useSharedValue(0);
    const countdownSeconds = useSharedValue(0);
    const entryTimeRef = useRef<number | null>(null);
    const cameraRef = useRef<CameraView>(null);

    useEffect(() => {
        if (id) {
            entryTimeRef.current = Date.now();
            fetchEvent();
            fetchParticipants();
        }
    }, [id]);

    // Countdown timer - 15 minutes (900 seconds) waiting room
    useEffect(() => {
        if (!event || !entryTimeRef.current) return;

        const WAITING_ROOM_DURATION = 15 * 60; // 15 minutes in seconds

        const updateCountdown = () => {
            const now = new Date().getTime();
            const eventTime = new Date(event.date).getTime();
            const timeUntilEvent = Math.floor((eventTime - now) / 1000);

            // Calculate time elapsed since entering waiting room
            const elapsed = Math.floor((now - entryTimeRef.current!) / 1000);
            const remaining = Math.max(0, WAITING_ROOM_DURATION - elapsed);

            if (remaining <= 0 || timeUntilEvent <= 0) {
                setTimeToStart(0);
                setIsEventStarting(true);
                progress.value = withTiming(1, { duration: 500 });
                countdownSeconds.value = 0;
            } else {
                // Show the minimum of waiting room time remaining or time until event
                const displayTime = Math.min(remaining, timeUntilEvent);
                setTimeToStart(displayTime);
                countdownSeconds.value = displayTime;

                // Calculate progress (0 to 1) for 15 minutes
                const progressValue = 1 - (remaining / WAITING_ROOM_DURATION);
                progress.value = withTiming(progressValue, {
                    duration: 1000,
                    easing: Easing.linear,
                });
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);

        return () => clearInterval(interval);
    }, [event]);

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

    const fetchParticipants = async () => {
        try {
            if (!id) return;
            const participantsData = await eventService.getParticipants(id);
            const allParticipants = [
                ...(participantsData.maleParticipants || []),
                ...(participantsData.femaleParticipants || []),
                ...(participantsData.otherParticipants || []),
            ];
            setParticipants(allParticipants);
            setTotalParticipants(participantsData.totalParticipants || allParticipants.length);
            setMaxParticipants(
                (participantsData.maxMaleParticipants || 0) +
                (participantsData.maxFemaleParticipants || 0)
            );
        } catch (error) {
            console.error('Failed to fetch participants:', error);
        }
    };

    const handleLeave = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Alert.alert(
            'Leave Waiting Room',
            'Are you sure you want to leave?',
            [
                { text: 'Stay', style: 'cancel' },
                {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: () => handleBack(),
                },
            ]
        );
    };

    const handleJoinSession = () => {
        if (id) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            // Navigate to session which will start with lobby phase
            router.replace(`/(main)/events/session/${id}`);
        }
    };

    const handleEventGuide = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setCurrentGuideStep(1);
        setShowGuideModal(true);
    };

    const handleCloseGuide = () => {
        setShowGuideModal(false);
        setCurrentGuideStep(1);
    };

    const handleNextStep = () => {
        if (currentGuideStep < 3) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setCurrentGuideStep(currentGuideStep + 1);
        }
    };

    const handlePreviousStep = () => {
        if (currentGuideStep > 1) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setCurrentGuideStep(currentGuideStep - 1);
        }
    };

    const guideSteps = [
        {
            step: 1,
            title: 'Video Dates',
            description: 'You will go on a series of video-dates that will last 3 minutes each.',
            image: require('../../../../assets/event-guide-1.png'),
        },
        {
            step: 2,
            title: 'Like or Dislike',
            description: 'After your video-date, you will need to decide whether you like or dislike your date.',
            image: require('../../../../assets/event-guide-2.png'),
        },
        {
            step: 3,
            title: 'Match & Chat',
            description: 'At the end of the event, match and chat.',
            image: require('../../../../assets/event-guide-3.png'),
        },
    ];

    const requestCameraPermission = async () => {
        try {
            const { status } = await Camera.requestCameraPermissionsAsync();
            setHasCameraPermission(status === 'granted');
            return status === 'granted';
        } catch (error) {
            console.error('Error requesting camera permission:', error);
            return false;
        }
    };

    const handleCheckAppearance = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        
        const hasPermission = await requestCameraPermission();
        
        if (hasPermission) {
            setShowCameraModal(true);
        } else {
            Alert.alert(
                'Camera Permission Required',
                'Please grant camera permission to check your appearance.',
                [{ text: 'OK' }]
            );
        }
    };

    const handleCloseCamera = () => {
        setShowCameraModal(false);
    };

    const formatTime = (seconds: number): string => {
        if (seconds <= 0) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const animatedCircleProps = useAnimatedProps(() => {
        const strokeDashoffset = CIRCLE_CIRCUMFERENCE * (1 - progress.value);
        return {
            strokeDashoffset,
        };
    });

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Preparing waiting room...</Text>
            </View>
        );
    }

    const displayTime = timeToStart !== null ? formatTime(timeToStart) : '00:00';
    const minutes = timeToStart !== null ? Math.floor(timeToStart / 60) : 0;

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleLeave} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.textPrimary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Event Title Section */}
                <View style={styles.titleSection}>
                    <Text style={styles.startingSoonText}>Starting Soon</Text>
                    <Text style={styles.eventTitle}>{event?.name || 'Event'}</Text>
                </View>

                {/* Countdown Section */}
                <View style={styles.countdownSection}>
                    <Text style={styles.almostThereText}>We are almost there.</Text>
                    
                    {/* Circular Progress Countdown */}
                    <View style={styles.circleContainer}>
                        <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE} style={styles.circleSvg}>
                            {/* Background circle */}
                            <Circle
                                cx={CIRCLE_SIZE / 2}
                                cy={CIRCLE_SIZE / 2}
                                r={CIRCLE_RADIUS}
                                stroke={colors.bgSecondary}
                                strokeWidth={CIRCLE_STROKE_WIDTH}
                                fill="transparent"
                            />
                            {/* Animated progress circle */}
                            <AnimatedCircle
                                cx={CIRCLE_SIZE / 2}
                                cy={CIRCLE_SIZE / 2}
                                r={CIRCLE_RADIUS}
                                stroke={colors.primary}
                                strokeWidth={CIRCLE_STROKE_WIDTH}
                                fill="transparent"
                                strokeDasharray={CIRCLE_CIRCUMFERENCE}
                                strokeLinecap="round"
                                transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
                                animatedProps={animatedCircleProps}
                            />
                        </Svg>
                        <View style={styles.timeContainer}>
                            <Text style={styles.timeText}>{displayTime}</Text>
                            <Text style={styles.timeLabel}>mins</Text>
                        </View>
                    </View>
                </View>

                {/* Participants Section */}
                <View style={styles.participantsSection}>
                    <View style={styles.participantsHeader}>
                        <Text style={styles.participantsTitle}>Event participants</Text>
                        <Text style={styles.participantsCount}>
                            {totalParticipants}/{maxParticipants}
                        </Text>
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.participantsScroll}
                        contentContainerStyle={styles.participantsScrollContent}
                    >
                        {participants.map((participant) => {
                            const photoUrl = participant.photos?.[0];
                            return (
                                <View key={participant._id} style={styles.participantAvatarContainer}>
                                    {photoUrl ? (
                                        <View style={styles.blurredImageWrapper}>
                                            <Image
                                                source={{ uri: getAbsoluteMediaUrl(photoUrl) }}
                                                style={styles.participantAvatarImage}
                                                resizeMode="cover"
                                            />
                                            <BlurView
                                                intensity={20}
                                                tint="light"
                                                style={styles.blurOverlay}
                                            />
                                        </View>
                                    ) : (
                                        <View style={[styles.participantAvatar, styles.participantAvatarPlaceholder]}>
                                            <Users size={24} color={colors.textTertiary} />
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* Guide Prompt */}
                <View style={styles.guidePrompt}>
                    <Text style={styles.guidePromptText}>
                        Waiting and not sure what to do? Check out the Event guide below.
                    </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionsSection}>
                    <TouchableOpacity
                        style={styles.eventGuideButton}
                        onPress={handleEventGuide}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={[colors.primary, colors.primaryLight]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.guideButtonGradient}
                        >
                            <BookOpen size={20} color="#ffffff" />
                            <Text style={styles.guideButtonText}>Event guide</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.appearanceButton}
                        onPress={handleCheckAppearance}
                        activeOpacity={0.8}
                    >
                        <CameraIcon size={20} color={colors.primary} />
                        <Text style={styles.appearanceButtonText}>Check your appearance</Text>
                    </TouchableOpacity>
                </View>

                {/* Join Button (when event starts) */}
                {isEventStarting && (
                    <TouchableOpacity
                        style={styles.joinButton}
                        onPress={handleJoinSession}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={[colors.primary, colors.primaryLight]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.joinButtonGradient}
                        >
                            <Text style={styles.joinButtonText}>Join Event</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                )}
            </ScrollView>

            {/* Camera Preview Modal */}
            <Modal
                visible={showCameraModal}
                animationType="slide"
                transparent={false}
                onRequestClose={handleCloseCamera}
            >
                <View style={styles.cameraModalContainer}>
                    <SafeAreaView style={styles.cameraModalSafeArea} edges={['top']}>
                        {/* Header */}
                        <View style={styles.cameraModalHeader}>
                            <Text style={styles.cameraModalTitle}>Check Your Appearance</Text>
                            <TouchableOpacity
                                onPress={handleCloseCamera}
                                style={styles.cameraCloseButton}
                                activeOpacity={0.8}
                            >
                                <X size={24} color={colors.textPrimary} />
                            </TouchableOpacity>
                        </View>

                        {/* Camera Preview */}
                        {hasCameraPermission ? (
                            <View style={styles.cameraPreviewContainer}>
                                <CameraView
                                    ref={cameraRef}
                                    style={styles.cameraPreview}
                                    facing="front"
                                />
                            </View>
                        ) : (
                            <View style={styles.cameraPermissionContainer}>
                                <ActivityIndicator size="large" color={colors.primary} />
                                <Text style={styles.cameraPermissionText}>
                                    Requesting camera permission...
                                </Text>
                            </View>
                        )}

                        {/* Instructions */}
                        <View style={styles.cameraInstructions}>
                            <Text style={styles.cameraInstructionsText}>
                                Make sure you're well-lit and your face is clearly visible
                            </Text>
                        </View>
                    </SafeAreaView>
                </View>
            </Modal>

            {/* Event Guide Modal */}
            <Modal
                visible={showGuideModal}
                animationType="fade"
                transparent={true}
                onRequestClose={handleCloseGuide}
            >
                <View style={styles.guideModalBackdrop}>
                    <TouchableOpacity
                        style={styles.guideModalBackdropTouchable}
                        activeOpacity={1}
                        onPress={handleCloseGuide}
                    />
                    <View style={styles.guideModalContainer}>
                        {/* Header */}
                        <View style={styles.guideModalHeader}>
                            <Text style={styles.guideModalTitle}>Event Guide</Text>
                            <TouchableOpacity
                                onPress={handleCloseGuide}
                                style={styles.guideCloseButton}
                                activeOpacity={0.8}
                            >
                                <X size={20} color={colors.textPrimary} />
                            </TouchableOpacity>
                        </View>

                        {/* Step Indicator */}
                        <View style={styles.stepIndicator}>
                            {guideSteps.map((step) => (
                                <View
                                    key={step.step}
                                    style={[
                                        styles.stepDot,
                                        currentGuideStep === step.step && styles.stepDotActive,
                                    ]}
                                />
                            ))}
                        </View>

                        {/* Step Content */}
                        <ScrollView
                            style={styles.guideContent}
                            contentContainerStyle={styles.guideContentContainer}
                            showsVerticalScrollIndicator={false}
                        >
                            {guideSteps.map((step) => {
                                if (step.step !== currentGuideStep) return null;
                                
                                return (
                                    <View key={step.step} style={styles.stepContent}>
                                        {/* Step Image */}
                                        <View style={styles.stepImageContainer}>
                                            <Image
                                                source={step.image}
                                                style={styles.stepImage}
                                                resizeMode="contain"
                                            />
                                        </View>

                                        {/* Step Description */}
                                        <Text style={styles.stepDescription}>{step.description}</Text>
                                    </View>
                                );
                            })}
                        </ScrollView>

                        {/* Navigation Buttons */}
                        <View style={styles.guideNavigation}>
                            {currentGuideStep < 3 ? (
                                <>
                                    <TouchableOpacity
                                        onPress={handlePreviousStep}
                                        disabled={currentGuideStep === 1}
                                        style={[
                                            styles.navButton,
                                            styles.navButtonLeft,
                                            currentGuideStep === 1 && styles.navButtonDisabled,
                                        ]}
                                        activeOpacity={0.8}
                                    >
                                        <ChevronLeft
                                            size={18}
                                            color={currentGuideStep === 1 ? colors.textTertiary : colors.primary}
                                        />
                                        <Text
                                            style={[
                                                styles.navButtonText,
                                                currentGuideStep === 1 && styles.navButtonTextDisabled,
                                            ]}
                                        >
                                            Previous
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={handleNextStep}
                                        style={[styles.navButton, styles.navButtonRight]}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.navButtonTextRight}>Next</Text>
                                        <ChevronRight size={18} color={colors.bgWhite} />
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <TouchableOpacity
                                    onPress={handleCloseGuide}
                                    style={styles.navButtonDone}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.navButtonTextDone}>Ok</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bgTertiary,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.bgTertiary,
    },
    loadingText: {
        marginTop: spacing.lg,
        color: colors.textSecondary,
        fontSize: typography.sizes.md,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: radius.full,
        backgroundColor: colors.bgWhite,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.sm,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.xxxl,
    },
    titleSection: {
        alignItems: 'center',
        marginTop: spacing.lg,
        marginBottom: spacing.xl,
    },
    startingSoonText: {
        fontSize: typography.sizes.md,
        color: colors.textSecondary,
        fontWeight: typography.weights.regular,
        marginBottom: spacing.xs,
    },
    eventTitle: {
        fontSize: typography.sizes.xxxl,
        fontWeight: typography.weights.bold,
        color: colors.textPrimary,
        textAlign: 'center',
    },
    countdownSection: {
        alignItems: 'center',
        marginBottom: spacing.xxl,
    },
    almostThereText: {
        fontSize: typography.sizes.md,
        color: colors.textSecondary,
        marginBottom: spacing.xl,
    },
    circleContainer: {
        width: CIRCLE_SIZE,
        height: CIRCLE_SIZE,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    circleSvg: {
        position: 'absolute',
    },
    timeContainer: {
        alignItems: 'center',
    },
    timeText: {
        fontSize: 48,
        fontWeight: typography.weights.bold,
        color: colors.textPrimary,
    },
    timeLabel: {
        fontSize: typography.sizes.sm,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    participantsSection: {
        marginBottom: spacing.xl,
    },
    participantsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    participantsTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.semibold,
        color: colors.textPrimary,
    },
    participantsCount: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.textSecondary,
    },
    participantsScroll: {
        marginHorizontal: -spacing.xl,
    },
    participantsScrollContent: {
        paddingHorizontal: spacing.xl,
        gap: spacing.md,
    },
    participantAvatarContainer: {
        width: 64,
        height: 64,
        borderRadius: radius.md,
        overflow: 'hidden',
        backgroundColor: colors.bgWhite,
    },
    blurredImageWrapper: {
        width: '100%',
        height: '100%',
        position: 'relative',
    },
    participantAvatarImage: {
        width: '100%',
        height: '100%',
    },
    blurOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    participantAvatar: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.bgSecondary,
    },
    participantAvatarPlaceholder: {
        backgroundColor: colors.bgAccent,
    },
    guidePrompt: {
        marginBottom: spacing.xl,
        paddingHorizontal: spacing.md,
    },
    guidePromptText: {
        fontSize: typography.sizes.md,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
    actionsSection: {
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    eventGuideButton: {
        borderRadius: radius.lg,
        overflow: 'hidden',
        ...shadows.md,
    },
    guideButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.xl,
        gap: spacing.sm,
    },
    guideButtonText: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.semibold,
        color: '#ffffff',
    },
    appearanceButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.xl,
        borderRadius: radius.lg,
        backgroundColor: colors.bgWhite,
        borderWidth: 2,
        borderColor: colors.primary,
        gap: spacing.sm,
    },
    appearanceButtonText: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.semibold,
        color: colors.primary,
    },
    joinButton: {
        borderRadius: radius.lg,
        overflow: 'hidden',
        marginTop: spacing.md,
        ...shadows.md,
    },
    joinButtonGradient: {
        paddingVertical: spacing.lg,
        alignItems: 'center',
    },
    joinButtonText: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: '#ffffff',
    },
    cameraModalContainer: {
        flex: 1,
        backgroundColor: colors.bgTertiary,
    },
    cameraModalSafeArea: {
        flex: 1,
    },
    cameraModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: colors.bgTertiary,
    },
    cameraModalTitle: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: colors.textPrimary,
    },
    cameraCloseButton: {
        width: 40,
        height: 40,
        borderRadius: radius.full,
        backgroundColor: colors.bgWhite,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.sm,
    },
    cameraPreviewContainer: {
        flex: 1,
        marginHorizontal: spacing.lg,
        marginVertical: spacing.md,
        borderRadius: radius.lg,
        overflow: 'hidden',
        backgroundColor: colors.bgSecondary,
        ...shadows.md,
    },
    cameraPreview: {
        flex: 1,
        width: '100%',
    },
    cameraPermissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: spacing.lg,
        marginVertical: spacing.md,
    },
    cameraPermissionText: {
        marginTop: spacing.md,
        fontSize: typography.sizes.md,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    cameraInstructions: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
    },
    cameraInstructionsText: {
        fontSize: typography.sizes.sm,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
    guideModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
    },
    guideModalBackdropTouchable: {
        ...StyleSheet.absoluteFillObject,
    },
    guideModalContainer: {
        width: '100%',
        maxWidth: SCREEN_WIDTH - spacing.md * 2,
        height: SCREEN_HEIGHT * 0.9,
        maxHeight: SCREEN_HEIGHT * 0.9,
        backgroundColor: colors.bgWhite,
        borderRadius: radius.xl,
        overflow: 'hidden',
        ...shadows.xl,
    },
    guideModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderLight,
    },
    guideModalTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textPrimary,
    },
    guideCloseButton: {
        width: 32,
        height: 32,
        borderRadius: radius.full,
        backgroundColor: colors.bgSecondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepIndicator: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
    },
    stepDot: {
        width: 8,
        height: 8,
        borderRadius: radius.full,
        backgroundColor: colors.bgSecondary,
    },
    stepDotActive: {
        backgroundColor: colors.primary,
        width: 24,
    },
    guideContent: {
        flex: 1,
    },
    guideContentContainer: {
        flexGrow: 1,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
    },
    stepContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    stepImageContainer: {
        width: '100%',
        flex: 1,
        minHeight: 300,
        maxHeight: SCREEN_HEIGHT * 0.5,
        borderRadius: radius.lg,
        overflow: 'hidden',
        backgroundColor: colors.bgSecondary,
        marginBottom: spacing.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepImage: {
        width: '100%',
        height: '100%',
    },
    stepDescription: {
        fontSize: typography.sizes.md,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.md,
    },
    guideNavigation: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.borderLight,
        backgroundColor: colors.bgWhite,
    },
    navButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
    },
    navButtonLeft: {
        backgroundColor: colors.bgSecondary,
    },
    navButtonRight: {
        backgroundColor: colors.primary,
        marginLeft: 'auto',
    },
    navButtonDone: {
        width: '100%',
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    navButtonDisabled: {
        opacity: 0.5,
    },
    navButtonText: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.primary,
    },
    navButtonTextRight: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.bgWhite,
    },
    navButtonTextDisabled: {
        color: colors.textTertiary,
    },
    navButtonTextDone: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.semibold,
        color: colors.bgWhite,
    },
});
