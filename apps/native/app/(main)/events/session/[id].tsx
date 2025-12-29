/**
 * Event Session Screen
 * Live speed dating session with video calls
 * 
 * Full Agora video chat integration with react-native-agora
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
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withSequence,
    withDelay,
    interpolate,
    FadeIn,
    FadeOut,
} from 'react-native-reanimated';
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
    Zap,
    ThumbsDown,
    ArrowLeft,
    RotateCw,
    Phone,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { IRtcEngine, VideoCanvas as AgoraVideoCanvas } from 'react-native-agora';

let createAgoraRtcEngine: any;
let ChannelProfileType: any;
let ClientRoleType: any;
let RtcSurfaceView: any;
let VideoCanvas: any;
let VideoSourceType: any;

try {
    const agoraModule = require('react-native-agora');
    createAgoraRtcEngine = agoraModule.createAgoraRtcEngine;
    ChannelProfileType = agoraModule.ChannelProfileType;
    ClientRoleType = agoraModule.ClientRoleType;
    RtcSurfaceView = agoraModule.RtcSurfaceView;
    VideoCanvas = agoraModule.VideoCanvas;
    VideoSourceType = agoraModule.VideoSourceType;
} catch (error) {
    console.warn('react-native-agora not available - requires development build:', error);
}

import { eventService, matchService, agoraService } from '../../../../services/api';
import { getAbsoluteMediaUrl } from '../../../../services/apiConfig';
import socketService from '../../../../services/socketService';
import MatchOverlay from '../../../../components/MatchOverlay';
import { getCurrentUserId } from '../../../../services/authService';
import { useAuth } from '../../../../hooks/useAuth';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Session timing (in seconds)
const TIMING = {
    LOBBY: 60,     // 60 seconds lobby before each date
    DATE: 180,     // 3 minutes date
    FEEDBACK: 60,  // 60 seconds feedback
};

type SessionPhase = 'loading' | 'lobby' | 'date' | 'feedback' | 'waiting' | 'summary' | 'complete';

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
    const { id, testPhase } = useLocalSearchParams<{ id: string; testPhase?: string }>();
    const { user } = useAuth();

    const [phase, setPhase] = useState<SessionPhase>(
        (testPhase as SessionPhase) || 'loading'
    );
    const [partner, setPartner] = useState<Partner | null>(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [roundNumber, setRoundNumber] = useState(1);
    const [totalRounds, setTotalRounds] = useState(0); // Set dynamically based on participants
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [isMicOn, setIsMicOn] = useState(true);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [likedPartners, setLikedPartners] = useState<string[]>([]);
    const [matches, setMatches] = useState<Partner[]>([]);
    const [hasMatches, setHasMatches] = useState(false);
    const [agoraError, setAgoraError] = useState<string | null>(null);
    const [remoteUid, setRemoteUid] = useState<number | null>(null);
    const [isAgoraInitialized, setIsAgoraInitialized] = useState(false);
    const [timeNotifications, setTimeNotifications] = useState<{ [key: string]: boolean }>({
        '1min': false,
        '30sec': false,
    });
    const [showTimeNotification, setShowTimeNotification] = useState<string | null>(null);
    const [absentUsers, setAbsentUsers] = useState<Set<string>>(new Set());
    const [pairedPartnerIds, setPairedPartnerIds] = useState<string[]>([]);
    const [isUserAbsent, setIsUserAbsent] = useState(false);
    const [serverChannelName, setServerChannelName] = useState<string | null>(null);

    // Match overlay state
    const [showMatchOverlay, setShowMatchOverlay] = useState(false);
    const [matchData, setMatchData] = useState<any>(null);

    const currentUser = user ? {
        name: user.name || 'You',
        photos: user.photos,
        imageUrl: user.photos?.[0]
    } : null;

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const agoraEngineRef = useRef<IRtcEngine | null>(null);
    const currentChannelRef = useRef<string | null>(null);
    const currentUidRef = useRef<number | null>(null);
    const appIdRef = useRef<string | null>(null);
    const localCanvasRef = useRef<AgoraVideoCanvas | null>(null);
    const remoteCanvasRef = useRef<AgoraVideoCanvas | null>(null);

    // Animation values for feedback screen
    const profileScale = useSharedValue(0);
    const profileOpacity = useSharedValue(0);
    const buttonsOpacity = useSharedValue(0);
    const buttonsTranslateY = useSharedValue(30);
    const timerPulse = useSharedValue(1);

    // Initialize Agora engine
    useEffect(() => {
        const initAgora = async () => {
            // Check if Agora module is available
            if (!createAgoraRtcEngine || !ChannelProfileType || !VideoSourceType) {
                setAgoraError('Agora SDK not available - requires Expo development build. See README.md for setup instructions.');
                console.warn('Agora SDK not available - native modules require development build');
                return;
            }

            try {
                // Get appId from backend first (we'll use a dummy channel name to get the appId)
                // In production, you might want to store appId in config or get it separately
                let appId = appIdRef.current;

                if (!appId) {
                    try {
                        // Get token to retrieve appId (using a temporary channel name)
                        const tempTokenData = await agoraService.getToken('temp_init');
                        appId = tempTokenData.appId;
                        appIdRef.current = appId;
                    } catch (error) {
                        console.warn('Could not get appId from token, will try during join:', error);
                        // Continue without appId - will handle during join
                    }
                }

                // Create Agora engine instance using v4.x API
                const engine = createAgoraRtcEngine();
                await engine.initialize({
                    appId: appId || '',
                });

                // Enable video and audio
                await engine.enableVideo();
                await engine.enableAudio();

                // Set channel profile to communication
                await engine.setChannelProfile(ChannelProfileType.ChannelProfileCommunication);

                // Register event handlers
                engine.registerEventHandler({
                    onJoinChannelSuccess: (channel: string, uid: number, elapsed: number) => {
                        console.log('Joined channel successfully:', channel, uid);
                        currentUidRef.current = uid;
                    },
                    onUserJoined: (uid: number, elapsed: number) => {
                        console.log('Remote user joined:', uid);
                        setRemoteUid(uid);
                        // Setup remote canvas
                        remoteCanvasRef.current = {
                            uid: uid,
                            sourceType: VideoSourceType.VideoSourceRemote,
                        };
                    },
                    onUserOffline: (uid: number, reason: number) => {
                        console.log('Remote user left:', uid);
                        setRemoteUid(null);
                        remoteCanvasRef.current = null;
                    },
                    onRemoteVideoStateChanged: (uid: number, state: number, reason: number, elapsed: number) => {
                        console.log('Remote video state changed:', uid, state);
                    },
                    onRemoteAudioStateChanged: (uid: number, state: number, reason: number, elapsed: number) => {
                        console.log('Remote audio state changed:', uid, state);
                    },
                    onError: (err: number, msg: string) => {
                        console.error('Agora error:', err, msg);
                        setAgoraError(`Agora error: ${msg}`);
                    },
                });

                // Setup local canvas
                localCanvasRef.current = {
                    uid: 0,
                    sourceType: VideoSourceType.VideoSourceCamera,
                };

                agoraEngineRef.current = engine;
                setIsAgoraInitialized(true);
            } catch (error) {
                console.error('Failed to initialize Agora:', error);
                setAgoraError(`Failed to initialize Agora: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        };

        initAgora();

        return () => {
            cleanupAgora();
        };
    }, []);

    // Socket event handling for absent users
    useEffect(() => {
        if (!id || !user?.id) return;

        const handleUserAbsent = (data: { userId: string; eventId: string }) => {
            if (data.eventId === id) {
                setAbsentUsers(prev => new Set([...prev, data.userId]));
                console.log('User marked as absent:', data.userId);
            }
        };

        socketService.onUserAbsent(handleUserAbsent);

        return () => {
            socketService.off('user_absent', handleUserAbsent);
        };
    }, [id, user?.id]);

    // Socket event handling for partner assignments (includes totalRounds from server)
    useEffect(() => {
        if (!id) return;

        const handlePartnerAssigned = (data: {
            eventId: string;
            round: number;
            totalRounds?: number;
            phase: string;
            phaseDuration: number;
            phaseStartTime: string;
            partner: {
                id: string;
                userId: string;
                name: string;
                age: number | null;
                bio: string;
                imageUrl: string | null;
            };
            channelName: string;
        }) => {
            if (data.eventId === id) {
                console.log('[Session] Received partner_assigned from server:', data);

                // Update partner
                setPartner({
                    id: data.partner.id,
                    userId: data.partner.userId,
                    name: data.partner.name,
                    age: data.partner.age,
                    bio: data.partner.bio || '',
                    imageUrl: data.partner.imageUrl,
                });

                // Update round info from server
                setRoundNumber(data.round);
                if (data.totalRounds && data.totalRounds > 0) {
                    setTotalRounds(data.totalRounds);
                }

                // Set phase based on server
                setPhase(data.phase as SessionPhase);
                setTimeLeft(data.phaseDuration);
                setServerChannelName(data.channelName);

                // Trigger haptic feedback
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        };

        socketService.onPartnerAssigned(handlePartnerAssigned);

        return () => {
            socketService.off('partner_assigned', handlePartnerAssigned);
        };
    }, [id]);

    // Handle partner disconnection during event
    useEffect(() => {
        if (!id) return;

        const handlePartnerDisconnected = (data: {
            eventId: string;
            message: string;
            wasInDate: boolean;
            currentPhase: string;
            currentRound: number;
        }) => {
            if (data.eventId === id) {
                console.log('[Session] Partner disconnected:', data.message);

                // Show alert to user
                Alert.alert('Date Ended', data.message || 'Your partner has disconnected.');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

                // Leave Agora channel if in a date
                if (data.wasInDate) {
                    leaveAgoraChannel();
                }

                // Clear partner and move to waiting
                setPartner(null);
                setPhase('waiting');
            }
        };

        socketService.onPartnerDisconnected(handlePartnerDisconnected);

        return () => {
            socketService.off('partner_disconnected', handlePartnerDisconnected);
        };
    }, [id]);

    // Handle server-controlled phase changes
    useEffect(() => {
        if (!id) return;

        const handlePhaseChange = (data: {
            eventId: string;
            round: number;
            phase: string;
            phaseStartTime: string;
            phaseDuration: number;
            remainingTime: number;
        }) => {
            if (data.eventId === id) {
                console.log('[Session] Server phase change:', data.phase, 'remaining:', data.remainingTime);

                // Update phase and time from server
                setPhase(data.phase as SessionPhase);
                setTimeLeft(data.remainingTime);
                setRoundNumber(data.round);

                // Reset time notifications for new phase
                setTimeNotifications({ '1min': false, '30sec': false });

                // Join Agora channel when entering date phase
                if (data.phase === 'date' && partner && id) {
                    const channelToJoin = serverChannelName;
                    if (channelToJoin) {
                        joinAgoraChannel(channelToJoin);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    } else {
                        console.warn('[Session] No channel name available to join Agora');
                        // Fallback but warn
                        const fallback_channelName = `event_${id}_round_${data.round}_${partner.userId}`;
                        joinAgoraChannel(fallback_channelName);
                    }
                }

                // Leave Agora channel when date ends
                if (data.phase === 'feedback') {
                    leaveAgoraChannel();
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
            }
        };

        socketService.onPhaseChange(handlePhaseChange);

        return () => {
            socketService.off('phase_change', handlePhaseChange);
        };
    }, [id, partner]);

    // Handle new round started
    useEffect(() => {
        if (!id) return;

        const handleRoundStarted = (data: {
            eventId: string;
            round: number;
            totalRounds: number;
            phase: string;
            phaseDuration: number;
        }) => {
            if (data.eventId === id) {
                console.log('[Session] New round started:', data.round, 'of', data.totalRounds);

                setRoundNumber(data.round);
                setTotalRounds(data.totalRounds);
                setPhase(data.phase as SessionPhase);
                setTimeLeft(data.phaseDuration);

                // Reset time notifications
                setTimeNotifications({ '1min': false, '30sec': false });

                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        };

        socketService.onRoundStarted(handleRoundStarted);

        return () => {
            socketService.off('round_started', handleRoundStarted);
        };
    }, [id]);

    // Handle socket reconnection - sync state from server
    useEffect(() => {
        if (!id) return;

        const handleConnectionChange = (status: 'connected' | 'disconnected') => {
            if (status === 'connected') {
                console.log('[Session] Socket reconnected - requesting state sync');

                // Request authoritative state from server
                socketService.requestEventState(id, (state: any) => {
                    if (state.error) {
                        console.error('[Session] Failed to get event state:', state.error);
                        return;
                    }

                    console.log('[Session] Received event state:', state);

                    // Sync local state with server
                    setRoundNumber(state.currentRound);
                    setPhase(state.currentPhase as SessionPhase);
                    setTimeLeft(state.remainingTime);

                    if (state.totalRounds) {
                        setTotalRounds(state.totalRounds);
                    }

                    if (state.partner) {
                        setPartner(state.partner);
                    } else if (state.isWaiting) {
                        setPartner(null);
                        setPhase('waiting');
                    }

                    // Rejoin Agora if in date phase with partner
                    if (state.currentPhase === 'date' && state.channelName) {
                        setServerChannelName(state.channelName);
                        joinAgoraChannel(state.channelName);
                    }
                });
            }
        };

        socketService.onConnectionChange(handleConnectionChange);

        return () => {
            socketService.off('connection_change', handleConnectionChange);
        };
    }, [id]);

    // Cleanup Agora on unmount
    const cleanupAgora = async () => {
        try {
            if (agoraEngineRef.current) {
                await leaveAgoraChannel();
                agoraEngineRef.current.release();
                agoraEngineRef.current = null;
                setIsAgoraInitialized(false);
                localCanvasRef.current = null;
                remoteCanvasRef.current = null;
            }
        } catch (error) {
            console.error('Error cleaning up Agora:', error);
        }
    };

    useEffect(() => {
        // If test phase is provided, set it up directly
        if (testPhase) {
            const testPhaseTyped = testPhase as SessionPhase;

            // Set appropriate time and state for test phase
            switch (testPhaseTyped) {
                case 'lobby':
                    setPhase('lobby');
                    setTimeLeft(TIMING.LOBBY);
                    setPartner({
                        id: 'test_partner',
                        userId: 'test_user',
                        name: 'Test Partner',
                        age: 25,
                        imageUrl: null,
                        bio: 'This is a test partner for stage testing',
                    });
                    break;
                case 'date':
                    setPhase('date');
                    setTimeLeft(TIMING.DATE);
                    // Set mock partner for testing
                    setPartner({
                        id: 'test_partner',
                        userId: 'test_user',
                        name: 'Test Partner',
                        age: 25,
                        imageUrl: null,
                        bio: 'This is a test partner for stage testing',
                    });
                    break;
                case 'feedback':
                    setPhase('feedback');
                    setTimeLeft(TIMING.FEEDBACK);
                    setPartner({
                        id: 'test_partner',
                        userId: 'test_user',
                        name: 'Test Partner',
                        age: 25,
                        imageUrl: null,
                        bio: 'This is a test partner for stage testing',
                    });
                    break;
                case 'waiting':
                    setPhase('waiting');
                    setTimeLeft(0);
                    setRoundNumber(3); // Set a test round number
                    break;
                case 'summary':
                    setPhase('summary');
                    setTimeLeft(0);
                    break;
                case 'loading':
                    setPhase('loading');
                    setTimeLeft(0);
                    break;
                default:
                    startSession();
            }
        } else {
            startSession();
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [testPhase]);

    // Check for matches to prevent leaving
    useEffect(() => {
        const checkMatches = async () => {
            try {
                const userMatches = await matchService.getMatches();
                setHasMatches(userMatches.length > 0);
            } catch (error) {
                console.error('Failed to check matches:', error);
            }
        };
        // Check matches periodically and when matches state changes
        checkMatches();
        const interval = setInterval(checkMatches, 5000); // Check every 5 seconds
        return () => clearInterval(interval);
    }, [matches]);

    // Timer effect with notifications
    useEffect(() => {
        if (phase === 'lobby' || phase === 'date' || phase === 'feedback') {
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        handlePhaseEnd();
                        return 0;
                    }

                    const newTime = prev - 1;

                    // Trigger notifications for date phase
                    if (phase === 'date') {
                        if (newTime === 60 && !timeNotifications['1min']) {
                            // 1 minute left notification
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setTimeNotifications(prev => ({ ...prev, '1min': true }));
                            setShowTimeNotification('1 minute remaining');
                            setTimeout(() => setShowTimeNotification(null), 2500);
                        } else if (newTime === 30 && !timeNotifications['30sec']) {
                            // 30 seconds left notification
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            setTimeNotifications(prev => ({ ...prev, '30sec': true }));
                            setShowTimeNotification('30 seconds remaining');
                            setTimeout(() => setShowTimeNotification(null), 2500);
                        }
                    }

                    return newTime;
                });
            }, 1000);
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [phase, partner, timeNotifications]);

    const startSession = async () => {
        // Fetch first partner
        await fetchNextPartner();
    };

    const fetchNextPartner = async () => {
        setPhase('loading');
        setAgoraError(null);

        try {
            if (!id) {
                throw new Error('Event ID is required');
            }

            // Fetch next partner from API, excluding already-paired partners
            const result = await agoraService.getNextPartner(id, pairedPartnerIds);

            // Check if all partners have been met
            if (result.allPartnersExhausted) {
                console.log('All partners dated! Moving to summary.');
                setPhase('summary');
                return;
            }

            setPartner(result.partner);

            // Set totalRounds based on available partners (first fetch only)
            // totalPossible includes current partner, so rounds = all partners you can date
            if (totalRounds === 0 && result.totalAvailable !== undefined) {
                // Total rounds = currently available + already paired
                const total = result.totalAvailable + pairedPartnerIds.length;
                console.log(`[Session] Setting totalRounds to ${total} (${result.totalAvailable} available + ${pairedPartnerIds.length} already dated)`);
                setTotalRounds(total);
            }

            // TIMING SYNCHRONIZATION: Use server timing if available
            if (result.timing) {
                const { currentPhase, timeRemaining, currentRound: serverRound } = result.timing;

                console.log(`[Timing Sync] Server phase: ${currentPhase}, Time remaining: ${timeRemaining}s, Round: ${serverRound}`);

                // Sync phase and time with server
                setPhase(currentPhase as SessionPhase);
                setTimeLeft(timeRemaining);
                setRoundNumber(serverRound);
                if (result.channelName) {
                    setServerChannelName(result.channelName);
                }

                // Reset time notifications for new phase
                setTimeNotifications({ '1min': false, '30sec': false });
            } else {
                // Fallback to local timing if server doesn't provide timing data
                console.warn('[Timing Sync] No server timing data, using local timing (may cause desync)');
                setPhase('lobby');
                setTimeLeft(TIMING.LOBBY);
            }
        } catch (error: any) {
            console.error('Failed to fetch next partner:', error);

            // Check if all partners exhausted (404 with specific message)
            if (error?.message?.includes('met everyone') || error?.message?.includes('exhausted')) {
                setPhase('summary');
                return;
            }

            setAgoraError(`Failed to fetch partner: ${error instanceof Error ? error.message : 'Unknown error'}`);

            // Fallback to mock partner for testing
            const mockPartner: Partner = {
                id: `partner_${roundNumber}`,
                userId: `user_${roundNumber}`,
                name: ['Sarah', 'Emma', 'Olivia', 'Ava', 'Isabella', 'Sophia', 'Charlotte', 'Amelia', 'Harper', 'Evelyn'][roundNumber - 1] || 'Partner',
                age: 24 + roundNumber,
                imageUrl: null,
                bio: 'Looking forward to connecting!',
            };
            setPartner(mockPartner);
            setPhase('lobby');
            setTimeLeft(TIMING.LOBBY);
        }
    };

    // Join Agora channel
    const joinAgoraChannel = async (channelName: string) => {
        if (!agoraEngineRef.current || !isAgoraInitialized) {
            console.error('Agora engine not initialized');
            return;
        }

        try {
            setAgoraError(null);

            // Get token from backend
            const tokenData = await agoraService.getToken(channelName);
            currentUidRef.current = tokenData.uid;

            // Enable local video/audio based on state
            if (isCameraOn) {
                await agoraEngineRef.current.enableLocalVideo(true);
                await agoraEngineRef.current.startPreview();
            } else {
                await agoraEngineRef.current.enableLocalVideo(false);
            }

            if (isMicOn) {
                await agoraEngineRef.current.enableLocalAudio(true);
            } else {
                await agoraEngineRef.current.enableLocalAudio(false);
            }

            // Join channel using v4.x API
            await agoraEngineRef.current.joinChannel(
                tokenData.token,
                channelName,
                tokenData.uid,
                {
                    clientRoleType: ClientRoleType.ClientRoleBroadcaster,
                }
            );

            currentChannelRef.current = channelName;
        } catch (error) {
            console.error('Failed to join Agora channel:', error);
            setAgoraError(`Failed to join channel: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    // Leave Agora channel
    const leaveAgoraChannel = async () => {
        if (!agoraEngineRef.current) {
            return;
        }

        try {
            await agoraEngineRef.current.leaveChannel();
            currentChannelRef.current = null;
            setRemoteUid(null);
        } catch (error) {
            console.error('Failed to leave Agora channel:', error);
        }
    };

    const handlePhaseEnd = async () => {
        // Request authoritative phase transition from server
        if (id) {
            socketService.emit('advance_phase', id);
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
                'live_event',
                id
            );

            if (result.isMatch) {
                setMatches((prev) => [...prev, partner]);
                setMatchData(result.match);
                setShowMatchOverlay(true);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            setLikedPartners((prev) => [...prev, partner.userId]);

            if (!result.isMatch) {
                moveToNextRound(true);
            }
        } catch (error) {
            console.error('Like failed:', error);
        }
    };

    const handlePass = async () => {
        if (!partner) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            // Call match API with pass action
            await matchService.performAction(
                partner.userId,
                'pass',
                'live_event',
                id
            );
        } catch (error) {
            console.error('Pass failed:', error);
        }

        moveToNextRound(false);
    };

    const handleSuperLike = async () => {
        if (!partner) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        try {
            // Call match API with super_like action
            const result = await matchService.performAction(
                partner.userId,
                'super_like',
                'live_event',
                id
            );

            if (result.isMatch) {
                setMatches((prev) => [...prev, partner]);
                setMatchData(result.match);
                setShowMatchOverlay(true);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            setLikedPartners((prev) => [...prev, partner.userId]);

            if (!result.isMatch) {
                moveToNextRound(true);
            }
        } catch (error) {
            console.error('Super like failed:', error);
            // Fallback to regular like if super like fails
            await handleLike();
            return;
        }
    };

    const moveToNextRound = async (liked: boolean) => {
        // Don't allow absent users to move to next rounds
        if (isUserAbsent || (user?.id && absentUsers.has(user.id))) {
            console.log('User is absent, staying in waiting phase');
            setPhase('waiting');
            return;
        }

        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        // Track this partner as someone we've dated
        if (partner?.userId) {
            setPairedPartnerIds(prev => [...prev, partner.userId]);
        }

        // Leave current channel
        await leaveAgoraChannel();

        // Check if we've dated everyone or reached max rounds
        const datedCount = pairedPartnerIds.length + 1; // +1 for current partner being added
        console.log(`[Session] Completed round ${roundNumber}. Dated ${datedCount}/${totalRounds} partners.`);

        if (datedCount >= totalRounds && totalRounds > 0) {
            console.log('[Session] All partners dated! Moving to summary.');
            setPhase('summary');
        } else {
            setRoundNumber((prev) => prev + 1);
            // Go to lobby for next round
            await fetchNextPartner();
        }
    };

    const handleComplete = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (hasMatches || matches.length > 0) {
            // If user has matches, prevent leaving to chat
            Alert.alert(
                'Event Complete',
                'You have matches! You\'ll be able to chat after the event ends.',
                [{ text: 'OK', onPress: () => router.replace('/(main)/events') }]
            );
        } else {
            router.replace('/(main)/matches');
        }
    };

    const handleLeaveEvent = async () => {
        if (hasMatches || matches.length > 0) {
            Alert.alert(
                'Cannot Leave',
                'You have matches from this event. You cannot leave until the event is complete.',
                [{ text: 'OK' }]
            );
            return;
        }

        Alert.alert(
            'Leave Event',
            'Are you sure you want to leave? You can rejoin later if you change your mind.',
            [
                { text: 'Stay', style: 'cancel' },
                {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // Call the leave event API
                            await eventService.leaveEvent(id);

                            // Leave Agora channel
                            await leaveAgoraChannel();

                            // Emit socket event to notify others
                            socketService.emit('user_left_event', id);

                            // Mark user as absent locally
                            setIsUserAbsent(true);
                            if (user?.id) {
                                const userId = user.id;
                                setAbsentUsers(prev => new Set([...prev, userId]));
                            }

                            // Move to waiting phase with rejoin option
                            setPhase('waiting');
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        } catch (error) {
                            console.error('Failed to leave event:', error);
                            Alert.alert('Error', 'Failed to leave event. Please try again.');
                        }
                    },
                },
            ]
        );
    };

    const handleRejoinEvent = async () => {
        try {
            // Call the rejoin event API
            await eventService.rejoinEvent(id);

            // Mark user as no longer absent
            setIsUserAbsent(false);
            if (user?.id) {
                const userId = user.id;
                setAbsentUsers(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(userId);
                    return newSet;
                });
            }

            // Emit socket event to notify others
            socketService.emit('user_rejoined_event', id);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
                'Rejoined!',
                'You have rejoined the event. Finding your next partner...',
                [{ text: 'OK', onPress: () => fetchNextPartner() }]
            );
        } catch (error: any) {
            console.error('Failed to rejoin event:', error);
            Alert.alert('Error', error?.message || 'Failed to rejoin event. Please try again.');
        }
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

    // Animation effect for feedback screen
    useEffect(() => {
        if (phase === 'feedback') {
            // Animate profile card entrance
            profileScale.value = withSpring(1, { damping: 12, stiffness: 100 });
            profileOpacity.value = withTiming(1, { duration: 400 });

            // Animate buttons entrance
            buttonsOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
            buttonsTranslateY.value = withDelay(200, withSpring(0, { damping: 12 }));

            // Pulse timer when time is running low
            if (timeLeft <= 10) {
                timerPulse.value = withSequence(
                    withTiming(1.1, { duration: 500 }),
                    withTiming(1, { duration: 500 })
                );
            } else {
                timerPulse.value = 1;
            }
        } else {
            // Reset animations
            profileScale.value = 0;
            profileOpacity.value = 0;
            buttonsOpacity.value = 0;
            buttonsTranslateY.value = 30;
            timerPulse.value = 1;
        }
    }, [phase, timeLeft]);

    // Animated styles for feedback screen
    const profileAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: profileScale.value }],
        opacity: profileOpacity.value,
    }));

    const buttonsAnimatedStyle = useAnimatedStyle(() => ({
        opacity: buttonsOpacity.value,
        transform: [{ translateY: buttonsTranslateY.value }],
    }));

    const timerAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: timerPulse.value }],
    }));

    // Loading state
    if (phase === 'loading') {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>Finding your next match...</Text>
                {agoraError && (
                    <Text style={styles.errorText}>{agoraError}</Text>
                )}
                {!isAgoraInitialized && (
                    <Text style={styles.loadingSubtext}>Initialising video...</Text>
                )}
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
                        You met {totalRounds > 0 ? totalRounds : roundNumber} amazing people
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

    // Lobby phase - shows before each date
    if (phase === 'lobby') {
        const currentUserPhoto = user?.photos?.[0] ? getAbsoluteMediaUrl(user.photos[0]) : null;
        const partnerPhoto = partner?.imageUrl ? getAbsoluteMediaUrl(partner.imageUrl) : null;
        const currentUserName = user?.name || 'You';
        const currentUserAge = user?.dob ? (() => {
            const today = new Date();
            const birthDate = new Date(user.dob);
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            return age;
        })() : null;

        return (
            <SafeAreaView style={styles.lobbyContainer} edges={['top', 'bottom']}>
                <View style={styles.lobbyContent}>
                    {/* Title */}
                    <Text style={styles.lobbyTitle}>Speed Dating Event</Text>
                    <Text style={styles.lobbySubtitle}>Get ready to date and find your match.</Text>

                    {/* Timer */}
                    <View style={styles.lobbyTimerContainer}>
                        <View style={styles.lobbyTimerBadge}>
                            <Clock size={16} color="#3B82F6" />
                            <Text style={styles.lobbyTimerText}>
                                Starts in {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')} min
                            </Text>
                        </View>
                    </View>

                    {/* Participants */}
                    <View style={styles.participantsContainer}>
                        {/* Current User */}
                        <View style={styles.participantCard}>
                            {currentUserPhoto ? (
                                <Image
                                    source={{ uri: currentUserPhoto }}
                                    style={styles.participantImage}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View style={[styles.participantImage, styles.participantPlaceholder]}>
                                    <Text style={styles.participantEmoji}>👤</Text>
                                </View>
                            )}
                            <Text style={styles.participantName}>
                                {currentUserName}
                                {currentUserAge && `, ${currentUserAge}`}
                            </Text>
                        </View>

                        {/* Video Icon - Positioned to avoid overlap */}
                        <View style={styles.videoIconContainer}>
                            <View style={styles.videoIconCircle}>
                                <Video size={24} color="#ffffff" />
                            </View>
                        </View>

                        {/* Partner */}
                        <View style={styles.participantCard}>
                            {partnerPhoto ? (
                                <Image
                                    source={{ uri: partnerPhoto }}
                                    style={styles.participantImage}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View style={[styles.participantImage, styles.participantPlaceholder]}>
                                    <Text style={styles.participantEmoji}>👤</Text>
                                </View>
                            )}
                            {partner?.id && absentUsers.has(partner.id) && (
                                <View style={styles.absentOverlay}>
                                    <Text style={styles.absentText}>ABSENT</Text>
                                </View>
                            )}
                            <Text style={styles.participantName}>
                                {partner?.name}
                                {partner?.age && `, ${partner.age}`}
                            </Text>
                        </View>
                    </View>

                    {/* Date Progress */}
                    <Text style={styles.dateProgress}>
                        Date number {roundNumber}{totalRounds > 0 ? ` of ${totalRounds}` : ''}
                    </Text>

                    {/* Quote */}
                    <Text style={styles.quote}>"Could it be love at first sight?"</Text>

                    {/* Action Buttons */}
                    <View style={styles.lobbyButtons}>
                        <TouchableOpacity
                            style={styles.leaveEventButton}
                            onPress={handleLeaveEvent}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.leaveEventButtonText}>Leave Event</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Bottom Gradient */}
                <LinearGradient
                    colors={['transparent', 'rgba(59, 130, 246, 0.1)', 'rgba(59, 130, 246, 0.2)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={styles.lobbyBottomGradient}
                />
            </SafeAreaView>
        );
    }

    // Waiting between rounds
    if (phase === 'waiting') {
        return (
            <SafeAreaView style={styles.waitingContainer} edges={['top', 'bottom']}>
                {/* Gradient Background */}
                <LinearGradient
                    colors={['#0a0a0a', '#1e293b', '#334155']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />

                <View style={styles.waitingContent}>
                    {/* Round Info */}
                    <View style={styles.waitingHeader}>
                        <Text style={styles.waitingRoundText}>
                            {user?.id && absentUsers.has(user.id) ? 'Absent' : `Round ${roundNumber}${totalRounds > 0 ? ` of ${totalRounds}` : ''}`}
                        </Text>
                        <Text style={styles.waitingSubtitle}>
                            {user?.id && absentUsers.has(user.id) ? 'You left the event but remain in the lobby' : 'Next date starting soon'}
                        </Text>
                    </View>

                    {/* Countdown Timer */}
                    <View style={styles.waitingTimerContainer}>
                        <View style={styles.waitingTimerCircle}>
                            <Text style={styles.waitingTimerText}>
                                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                            </Text>
                            <Text style={styles.waitingTimerLabel}>minutes</Text>
                        </View>
                    </View>

                    {/* Progress Indicator */}
                    <View style={styles.waitingProgressContainer}>
                        <View style={styles.waitingProgressBar}>
                            <View
                                style={[
                                    styles.waitingProgressFill,
                                    { width: `${((TIMING.LOBBY - timeLeft) / TIMING.LOBBY) * 100}%` }
                                ]}
                            />
                        </View>
                        <Text style={styles.waitingProgressText}>
                            {isUserAbsent ? 'You left the event. Tap below to rejoin!' : 'Preparing your next date...'}
                        </Text>
                    </View>

                    {/* Rejoin Button for absent users */}
                    {isUserAbsent && (
                        <TouchableOpacity
                            style={styles.rejoinButton}
                            onPress={handleRejoinEvent}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={['#10b981', '#059669']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.rejoinButtonGradient}
                            >
                                <Text style={styles.rejoinButtonText}>Rejoin Event</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}
                </View>
            </SafeAreaView>
        );
    }

    // Feedback/Decision Screen - Redesigned with animations
    if (phase === 'feedback') {
        const partnerPhoto = partner?.imageUrl ? getAbsoluteMediaUrl(partner.imageUrl) : null;

        return (
            <View style={styles.feedbackContainer}>
                {/* Gradient Background */}
                <LinearGradient
                    colors={['#f8fafc', '#f1f5f9', '#e2e8f0']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />

                <SafeAreaView style={styles.feedbackSafeArea} edges={['top', 'bottom']}>
                    {/* Close Button */}
                    <View style={styles.feedbackHeader}>
                        <TouchableOpacity
                            onPress={handleLeaveEvent}
                            style={styles.closeButton}
                            activeOpacity={0.7}
                        >
                            <View style={styles.closeButtonInner}>
                                <X size={18} color="#64748b" />
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Timer Banner */}
                    <Animated.View style={[styles.feedbackTimerBannerContainer, timerAnimatedStyle]}>
                        <View style={styles.feedbackTimerBanner}>
                            {/* Progress bar background */}
                            <View style={styles.feedbackTimerBannerProgressBg} />
                            {/* Progress bar fill */}
                            <View style={[
                                styles.feedbackTimerBannerProgressFill,
                                { width: `${(timeLeft / TIMING.FEEDBACK) * 100}%` }
                            ]} />
                            {/* Timer content */}
                            <View style={styles.feedbackTimerBannerContent}>
                                <Clock size={16} color="#ffffff" />
                                <Text style={styles.feedbackTimerBannerText}>
                                    {timeLeft}s remaining
                                </Text>
                            </View>
                        </View>
                    </Animated.View>

                    {/* Question */}
                    <Text style={styles.feedbackQuestion}>Did you like them?</Text>

                    {/* Profile Card with animation */}
                    <Animated.View style={[styles.feedbackProfileCard, profileAnimatedStyle]}>
                        <View style={styles.feedbackProfileImageContainer}>
                            {partnerPhoto ? (
                                <Image
                                    source={{ uri: partnerPhoto }}
                                    style={styles.feedbackProfileImage}
                                    resizeMode="cover"
                                />
                            ) : (
                                <LinearGradient
                                    colors={['#a78bfa', '#8b5cf6', '#7c3aed']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.feedbackProfileImagePlaceholder}
                                >
                                    <Text style={styles.feedbackProfileEmoji}>👤</Text>
                                </LinearGradient>
                            )}
                            <View style={styles.feedbackProfileImageShadow} />
                        </View>

                        <View style={styles.feedbackProfileInfo}>
                            <Text style={styles.feedbackProfileName}>
                                {partner?.name}
                                {partner?.age && <Text style={styles.feedbackProfileAge}>, {partner.age}</Text>}
                            </Text>

                            {partner?.bio && (
                                <Text style={styles.feedbackProfileBio}>{partner.bio}</Text>
                            )}
                        </View>
                    </Animated.View>

                    {/* Action Buttons with animation */}
                    <Animated.View style={[styles.feedbackActionButtons, buttonsAnimatedStyle]}>
                        <TouchableOpacity
                            style={styles.feedbackDislikeButton}
                            onPress={handlePass}
                            activeOpacity={0.7}
                        >
                            <LinearGradient
                                colors={['#ffffff', '#fff7ed']}
                                style={styles.feedbackButtonGradient}
                            >
                                <View style={styles.feedbackDislikeIconContainer}>
                                    <ThumbsDown size={22} color="#f97316" strokeWidth={2.5} />
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.feedbackLikeButton}
                            onPress={handleLike}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={['#3B82F6', '#2563eb', '#1d4ed8']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.feedbackButtonGradient}
                            >
                                <Heart size={30} color="#ffffff" fill="#ffffff" strokeWidth={2} />
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.feedbackSuperLikeButton}
                            onPress={handleSuperLike}
                            activeOpacity={0.7}
                        >
                            <LinearGradient
                                colors={['#ffffff', '#faf5ff']}
                                style={styles.feedbackButtonGradient}
                            >
                                <View style={styles.feedbackSuperLikeIconContainer}>
                                    <Zap size={22} color="#8b5cf6" strokeWidth={2.5} fill="#8b5cf6" />
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Instructions */}
                    <View style={styles.feedbackInstructions}>
                        <View style={styles.feedbackInstructionCard}>
                            <Text style={styles.feedbackInstructionText}>
                                Tap <Text style={styles.feedbackInstructionHighlight}>'Like'</Text> to show interest.
                            </Text>
                            <Text style={styles.feedbackInstructionText}>
                                If it's mutual, you'll <Text style={styles.feedbackInstructionHighlight}>'Match'</Text> and can chat.
                            </Text>
                            <Text style={styles.feedbackInstructionText}>
                                If not, tap <Text style={styles.feedbackInstructionHighlight}>'Dislike'</Text> to see new matches.
                            </Text>
                        </View>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    // Main session UI (Date phase)
    return (
        <View style={styles.container}>
            {/* Video Area */}
            <View style={styles.videoArea}>
                {/* Partner Video - Agora Remote Video */}
                <View style={styles.partnerVideo}>
                    {remoteUid !== null && agoraEngineRef.current && remoteCanvasRef.current && RtcSurfaceView ? (
                        <RtcSurfaceView
                            canvas={remoteCanvasRef.current}
                            style={StyleSheet.absoluteFill}
                            zOrderMediaOverlay={true}
                        />
                    ) : (
                        <View style={styles.videoPlaceholder}>
                            <Text style={styles.placeholderEmoji}>👤</Text>
                            {phase === 'date' ? (
                                <Text style={styles.placeholderText}>
                                    {agoraError || 'Waiting for partner to join...'}
                                </Text>
                            ) : (
                                <Text style={styles.placeholderText}>
                                    {partner?.name}'s Video
                                </Text>
                            )}
                        </View>
                    )}
                </View>

                {/* Self Video - Agora Local Video */}
                <View style={styles.selfVideo}>
                    {isCameraOn && agoraEngineRef.current && localCanvasRef.current && RtcSurfaceView ? (
                        <RtcSurfaceView
                            canvas={localCanvasRef.current}
                            style={styles.camera}
                            zOrderMediaOverlay={true}
                        />
                    ) : (
                        <View style={[styles.camera, styles.cameraOff]}>
                            <VideoOff size={20} color="#64748b" />
                        </View>
                    )}
                </View>
            </View>

            {/* Status Bar */}
            <StatusBar style="light" />

            {/* Header */}
            <SafeAreaView style={styles.header} edges={['top']}>
                {/* Back Button */}
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backButton}
                    activeOpacity={0.7}
                >
                    <ArrowLeft size={24} color="#ffffff" />
                </TouchableOpacity>

                {/* Timer Container - Centered */}
                <View style={styles.timerContainer}>
                    <View style={styles.timerBadge}>
                        <Text style={styles.timerText}>
                            {formatTime(timeLeft)}
                        </Text>
                    </View>
                </View>

                {/* Camera Switch Button */}
                <TouchableOpacity
                    onPress={async () => {
                        if (agoraEngineRef.current) {
                            await agoraEngineRef.current.switchCamera();
                        }
                    }}
                    style={styles.cameraSwitchButton}
                    activeOpacity={0.7}
                >
                    <RotateCw size={20} color="#ffffff" />
                </TouchableOpacity>
            </SafeAreaView>

            {/* Time notification overlay */}
            {showTimeNotification && (
                <Animated.View
                    style={styles.timeNotification}
                    entering={FadeIn.duration(300)}
                    exiting={FadeOut.duration(300)}
                >
                    <View style={styles.timeNotificationContent}>
                        <Clock size={16} color="#ffffff" />
                        <Text style={styles.timeNotificationText}>
                            {showTimeNotification}
                        </Text>
                    </View>
                </Animated.View>
            )}

            {/* Controls */}
            <SafeAreaView style={styles.controls} edges={['bottom']}>
                <View style={styles.controlsRow}>
                    {/* Microphone Button - Left */}
                    <TouchableOpacity
                        style={styles.controlButton}
                        onPress={async () => {
                            const newState = !isMicOn;
                            setIsMicOn(newState);
                            if (agoraEngineRef.current) {
                                await agoraEngineRef.current.enableLocalAudio(newState);
                            }
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        activeOpacity={0.7}
                    >
                        {isMicOn ? (
                            <Mic size={24} color="#374151" />
                        ) : (
                            <MicOff size={24} color="#374151" />
                        )}
                    </TouchableOpacity>

                    {/* End Call Button - Center (Red) */}
                    <TouchableOpacity
                        style={styles.endCallButton}
                        onPress={handlePass}
                        activeOpacity={0.8}
                    >
                        <Phone size={24} color="#ffffff" />
                    </TouchableOpacity>

                    {/* Video Button - Right */}
                    <TouchableOpacity
                        style={styles.controlButton}
                        onPress={async () => {
                            const newState = !isCameraOn;
                            setIsCameraOn(newState);
                            if (agoraEngineRef.current) {
                                await agoraEngineRef.current.enableLocalVideo(newState);
                                if (newState && localCanvasRef.current) {
                                    await agoraEngineRef.current.startPreview();
                                } else {
                                    await agoraEngineRef.current.stopPreview();
                                }
                            }
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        activeOpacity={0.7}
                    >
                        {isCameraOn ? (
                            <Video size={24} color="#374151" />
                        ) : (
                            <VideoOff size={24} color="#374151" />
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            {/* Match Overlay */}
            <MatchOverlay
                isVisible={showMatchOverlay}
                matchData={matchData}
                currentUser={currentUser}
                onStartChat={(matchId) => {
                    setShowMatchOverlay(false);
                    // Stay in event for now, but mark it?
                    // router.push(`/(main)/chat/${matchId}`);
                }}
                onDismiss={() => {
                    setShowMatchOverlay(false);
                    moveToNextRound(likedPartners.includes(partner?.userId || ''));
                }}
                onViewProfile={(userId) => {
                    setShowMatchOverlay(false);
                    router.push(`/(main)/user/${userId}`);
                }}
            />
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
    errorText: {
        marginTop: 16,
        color: '#ef4444',
        fontSize: 14,
        textAlign: 'center',
        paddingHorizontal: 20,
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
        width: 120,
        height: 120,
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
        paddingTop: 8,
        paddingBottom: 12,
        zIndex: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    timerBadge: {
        backgroundColor: 'rgba(55, 65, 81, 0.9)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        minWidth: 80,
        alignItems: 'center',
        justifyContent: 'center',
    },
    timerText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    cameraSwitchButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timeNotification: {
        position: 'absolute',
        top: 80,
        left: 16,
        right: 16,
        alignItems: 'center',
        zIndex: 1000,
    },
    timeNotificationContent: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 25,
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    timeNotificationText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 0.5,
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
        paddingBottom: 20,
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    controlsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    controlButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    endCallButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#ef4444',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
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
    lobbyContainer: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    lobbyContent: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 40,
        paddingBottom: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    lobbyTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 8,
        textAlign: 'center',
    },
    lobbySubtitle: {
        fontSize: 14,
        color: '#94a3b8',
        marginBottom: 48,
        textAlign: 'center',
    },
    participantsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
        gap: 20,
        position: 'relative',
    },
    participantCard: {
        alignItems: 'center',
        width: 140,
    },
    participantImage: {
        width: 120,
        height: 160,
        borderRadius: 16,
        backgroundColor: '#e2e8f0',
        marginBottom: 12,
    },
    participantPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#e2e8f0',
    },
    participantEmoji: {
        fontSize: 48,
    },
    participantName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
        textAlign: 'center',
    },
    videoIconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    videoIconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
    },
    lobbyBottomGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 200,
        pointerEvents: 'none',
    },
    lobbyTimerContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    lobbyTimerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 24,
        gap: 8,
        borderWidth: 1.5,
        borderColor: 'rgba(59, 130, 246, 0.2)',
    },
    lobbyTimerText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#3B82F6',
        letterSpacing: 0.3,
    },
    dateProgress: {
        fontSize: 16,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 16,
        textAlign: 'center',
    },
    quote: {
        fontSize: 18,
        fontStyle: 'italic',
        color: '#64748b',
        marginBottom: 48,
        textAlign: 'center',
    },
    lobbyButtons: {
        width: '100%',
        gap: 16,
    },
    startDateButton: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
    },
    startDateGradient: {
        paddingVertical: 18,
        alignItems: 'center',
    },
    startDateButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#ffffff',
    },
    leaveEventButton: {
        paddingVertical: 18,
        borderRadius: 16,
        backgroundColor: '#ffffff',
        borderWidth: 2,
        borderColor: '#3B82F6',
        alignItems: 'center',
    },
    leaveEventButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#3B82F6',
    },
    // Feedback/Decision Screen Styles - Enhanced
    feedbackContainer: {
        flex: 1,
    },
    feedbackSafeArea: {
        flex: 1,
    },
    feedbackHeader: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 20,
        paddingTop: 12,
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButtonInner: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    feedbackTimerBannerContainer: {
        paddingHorizontal: 20,
        marginTop: 8,
        marginBottom: 12,
    },
    feedbackTimerBanner: {
        position: 'relative',
        backgroundColor: '#3B82F6',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
        minHeight: 48,
    },
    feedbackTimerBannerProgressBg: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
    },
    feedbackTimerBannerProgressFill: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        height: 4,
        backgroundColor: '#ffffff',
        borderBottomLeftRadius: 12,
    },
    feedbackTimerBannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    feedbackTimerBannerText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffffff',
        letterSpacing: 0.5,
    },
    feedbackQuestion: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0f172a',
        textAlign: 'center',
        marginBottom: 24,
        paddingHorizontal: 24,
        letterSpacing: -0.5,
    },
    feedbackProfileCard: {
        alignItems: 'center',
        paddingHorizontal: 24,
        marginBottom: 24,
    },
    feedbackProfileImageContainer: {
        position: 'relative',
        marginBottom: 20,
    },
    feedbackProfileImage: {
        width: 180,
        height: 180,
        borderRadius: 20,
        backgroundColor: '#f3f4f6',
    },
    feedbackProfileImagePlaceholder: {
        width: 180,
        height: 180,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    feedbackProfileImageShadow: {
        position: 'absolute',
        width: 180,
        height: 180,
        borderRadius: 20,
        backgroundColor: 'transparent',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
        top: 0,
        left: 0,
    },
    feedbackProfileEmoji: {
        fontSize: 60,
    },
    feedbackProfileInfo: {
        alignItems: 'center',
        maxWidth: '90%',
    },
    feedbackProfileName: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 8,
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    feedbackProfileAge: {
        fontWeight: '400',
        color: '#64748b',
    },
    feedbackProfileBio: {
        fontSize: 16,
        color: '#475569',
        textAlign: 'center',
        lineHeight: 24,
        marginTop: 8,
    },
    feedbackActionButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        marginBottom: 20,
        paddingHorizontal: 24,
    },
    feedbackDislikeButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        overflow: 'hidden',
        shadowColor: '#f97316',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 5,
    },
    feedbackLikeButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        overflow: 'hidden',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 8,
    },
    feedbackSuperLikeButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        overflow: 'hidden',
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 5,
    },
    feedbackButtonGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    feedbackDislikeIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    feedbackSuperLikeIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    feedbackInstructions: {
        paddingHorizontal: 24,
        alignItems: 'center',
    },
    feedbackInstructionCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderRadius: 16,
        width: '100%',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.05)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    feedbackInstructionText: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 4,
    },
    feedbackInstructionHighlight: {
        color: '#3B82F6',
        fontWeight: '700',
    },
    // Waiting screen styles
    waitingContainer: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },
    waitingContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    waitingHeader: {
        alignItems: 'center',
        marginBottom: 40,
    },
    waitingRoundText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#ffffff',
        marginBottom: 8,
    },
    waitingSubtitle: {
        fontSize: 16,
        color: '#94a3b8',
        textAlign: 'center',
    },
    waitingTimerContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    waitingTimerCircle: {
        width: 150,
        height: 150,
        borderRadius: 75,
        borderWidth: 4,
        borderColor: '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        marginBottom: 20,
    },
    waitingTimerText: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    waitingTimerLabel: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 4,
    },
    waitingProgressContainer: {
        alignItems: 'center',
        width: '100%',
    },
    waitingProgressBar: {
        width: '80%',
        height: 4,
        backgroundColor: '#374151',
        borderRadius: 2,
        marginBottom: 16,
        overflow: 'hidden',
    },
    waitingProgressFill: {
        height: '100%',
        backgroundColor: '#3B82F6',
        borderRadius: 2,
    },
    waitingProgressText: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
    },
    // Absent overlay styles
    absentOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 16,
    },
    absentText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    // Rejoin button styles
    rejoinButton: {
        marginTop: 24,
        width: '80%',
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    rejoinButtonGradient: {
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rejoinButtonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
