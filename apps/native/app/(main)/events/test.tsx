/**
 * Event Testing Screen
 * Test buttons for each event stage
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ArrowLeft,
    Play,
    Clock,
    Users,
    MessageCircle,
    CheckCircle,
    Loader,
    Video,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { eventService, agoraService, type EventData } from '../../../services/api';
import { useAuth } from '../../../hooks/useAuth';

type SessionPhase = 'loading' | 'prep' | 'date' | 'feedback' | 'waiting' | 'summary' | 'complete';

interface TestStage {
    id: SessionPhase;
    label: string;
    description: string;
    icon: any;
    route: string;
    requiresEventId?: boolean;
}

const TEST_STAGES: TestStage[] = [
    {
        id: 'loading',
        label: 'Loading Stage',
        description: 'Test the initial loading state',
        icon: Loader,
        route: '/(main)/events/session/test',
    },
    {
        id: 'prep',
        label: 'Prep Stage (Waiting Room)',
        description: '15 minute waiting room with countdown',
        icon: Clock,
        route: '/(main)/events/waiting/[id]',
        requiresEventId: true,
    },
    {
        id: 'date',
        label: 'Date Stage',
        description: '3 minutes video chat',
        icon: Video,
        route: '/(main)/events/session/test',
    },
    {
        id: 'feedback',
        label: 'Feedback Stage',
        description: '30 seconds decision time',
        icon: MessageCircle,
        route: '/(main)/events/session/test',
    },
    {
        id: 'waiting',
        label: 'Waiting Stage',
        description: 'Between rounds',
        icon: Users,
        route: '/(main)/events/session/test',
    },
    {
        id: 'summary',
        label: 'Summary Stage',
        description: 'End of session summary',
        icon: CheckCircle,
        route: '/(main)/events/session/test',
    },
];

export default function EventTestScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [events, setEvents] = useState<EventData[]>([]);
    const [isLoadingEvents, setIsLoadingEvents] = useState(false);
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

    React.useEffect(() => {
        loadEvents();
    }, []);

    const loadEvents = async () => {
        try {
            setIsLoadingEvents(true);
            const allEvents = await eventService.getAllEvents();
            setEvents(allEvents);
            if (allEvents.length > 0) {
                setSelectedEventId(allEvents[0]._id || null);
            }
        } catch (error) {
            console.error('Failed to load events:', error);
            Alert.alert('Error', 'Failed to load events');
        } finally {
            setIsLoadingEvents(false);
        }
    };

    const handleTestStage = async (stage: TestStage) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (stage.requiresEventId && !selectedEventId) {
            Alert.alert('No Event Selected', 'Please select an event first');
            return;
        }

        // Prep stage goes to waiting room
        if (stage.id === 'prep') {
            router.push(`/(main)/events/waiting/${selectedEventId}`);
            return;
        }

        // Other stages go to session with test phase parameter
        router.push({
            pathname: '/(main)/events/session/[id]',
            params: {
                id: selectedEventId || 'test',
                testPhase: stage.id,
            },
        });
    };

    const handleTestAgoraToken = async () => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            
            if (!selectedEventId) {
                Alert.alert('No Event Selected', 'Please select an event first');
                return;
            }

            const channelName = `event_${selectedEventId}_test`;
            const tokenData = await agoraService.getToken(channelName);

            Alert.alert(
                'Agora Token Generated',
                `Channel: ${tokenData.channelName}\nUID: ${tokenData.uid}\nApp ID: ${tokenData.appId}\n\nToken generated successfully!`,
                [{ text: 'OK' }]
            );
        } catch (error: any) {
            console.error('Agora token test failed:', error);
            Alert.alert(
                'Agora Token Test Failed',
                error.message || 'Failed to generate token. Check Agora credentials in server .env'
            );
        }
    };

    const handleTestNextPartner = async () => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            
            if (!selectedEventId) {
                Alert.alert('No Event Selected', 'Please select an event first');
                return;
            }

            const result = await agoraService.getNextPartner(selectedEventId);

            Alert.alert(
                'Next Partner Test',
                `Found partner: ${result.partner.name}\nTotal available: ${result.totalAvailable}\n\nPartner ID: ${result.partner.id}`,
                [{ text: 'OK' }]
            );
        } catch (error: any) {
            console.error('Next partner test failed:', error);
            Alert.alert(
                'Next Partner Test Failed',
                error.message || 'Failed to get next partner. Make sure you are booked for this event.'
            );
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backButton}
                >
                    <ArrowLeft size={24} color="#ffffff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Event Testing</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Event Selection */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Select Event</Text>
                    {isLoadingEvents ? (
                        <Text style={styles.loadingText}>Loading events...</Text>
                    ) : events.length === 0 ? (
                        <Text style={styles.emptyText}>No events available</Text>
                    ) : (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.eventList}
                        >
                            {events.map((event) => (
                                <TouchableOpacity
                                    key={event._id}
                                    onPress={() => {
                                        setSelectedEventId(event._id || null);
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }}
                                    style={[
                                        styles.eventCard,
                                        selectedEventId === event._id && styles.eventCardSelected,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.eventCardText,
                                            selectedEventId === event._id && styles.eventCardTextSelected,
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {event.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}
                </View>

                {/* Agora Tests */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Agora Implementation Tests</Text>
                    <Text style={styles.sectionDescription}>
                        Test Agora token generation and partner matching
                    </Text>

                    <TouchableOpacity
                        style={styles.testButton}
                        onPress={handleTestAgoraToken}
                    >
                        <LinearGradient
                            colors={['#3B82F6', '#60A5FA']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.testButtonGradient}
                        >
                            <Play size={20} color="#ffffff" />
                            <Text style={styles.testButtonText}>Test Agora Token</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.testButton}
                        onPress={handleTestNextPartner}
                    >
                        <LinearGradient
                            colors={['#22c55e', '#4ade80']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.testButtonGradient}
                        >
                            <Users size={20} color="#ffffff" />
                            <Text style={styles.testButtonText}>Test Next Partner</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* Stage Tests */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Event Stage Tests</Text>
                    <Text style={styles.sectionDescription}>
                        Test each stage of the event flow
                    </Text>

                    {TEST_STAGES.map((stage) => {
                        const Icon = stage.icon;
                        return (
                            <TouchableOpacity
                                key={stage.id}
                                style={styles.stageButton}
                                onPress={() => handleTestStage(stage)}
                            >
                                <View style={styles.stageIconContainer}>
                                    <Icon size={24} color="#3B82F6" />
                                </View>
                                <View style={styles.stageContent}>
                                    <Text style={styles.stageLabel}>{stage.label}</Text>
                                    <Text style={styles.stageDescription}>
                                        {stage.description}
                                    </Text>
                                </View>
                                <View style={styles.stageBadge}>
                                    <Text style={styles.stageBadgeText}>{stage.id}</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Implementation Notes */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Agora Implementation Status</Text>
                    <View style={styles.notesContainer}>
                        <Text style={styles.noteTitle}>✅ Completed:</Text>
                        <Text style={styles.noteText}>• Backend token generation endpoint</Text>
                        <Text style={styles.noteText}>• Backend next-partner endpoint</Text>
                        <Text style={styles.noteText}>• Frontend API service methods</Text>
                        <Text style={styles.noteText}>• Event session UI structure</Text>

                        <Text style={[styles.noteTitle, styles.noteTitleWarning]}>
                            ⚠️ Pending:
                        </Text>
                        <Text style={styles.noteText}>
                            • Install react-native-agora package
                        </Text>
                        <Text style={styles.noteText}>
                            • Configure Agora credentials (AGORA_APP_ID, AGORA_APP_CERTIFICATE)
                        </Text>
                        <Text style={styles.noteText}>
                            • Integrate Agora SDK in session screen
                        </Text>
                        <Text style={styles.noteText}>
                            • Implement video/audio track management
                        </Text>
                        <Text style={styles.noteText}>
                            • Handle remote user events (join/leave)
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#1e293b',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#1e293b',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#ffffff',
    },
    placeholder: {
        width: 40,
    },
    content: {
        flex: 1,
    },
    section: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1e293b',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: 4,
    },
    sectionDescription: {
        fontSize: 14,
        color: '#94a3b8',
        marginBottom: 16,
    },
    eventList: {
        marginTop: 8,
    },
    eventCard: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#1e293b',
        marginRight: 12,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    eventCardSelected: {
        borderColor: '#3B82F6',
        backgroundColor: '#1e3a5f',
    },
    eventCardText: {
        fontSize: 14,
        color: '#94a3b8',
        fontWeight: '500',
    },
    eventCardTextSelected: {
        color: '#ffffff',
        fontWeight: '600',
    },
    loadingText: {
        fontSize: 14,
        color: '#94a3b8',
        fontStyle: 'italic',
    },
    emptyText: {
        fontSize: 14,
        color: '#64748b',
    },
    testButton: {
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 12,
    },
    testButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 8,
    },
    testButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
    },
    stageButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    stageIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    stageContent: {
        flex: 1,
    },
    stageLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
        marginBottom: 4,
    },
    stageDescription: {
        fontSize: 14,
        color: '#94a3b8',
    },
    stageBadge: {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    stageBadgeText: {
        fontSize: 12,
        color: '#3B82F6',
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    notesContainer: {
        backgroundColor: '#1e293b',
        borderRadius: 12,
        padding: 16,
    },
    noteTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#22c55e',
        marginTop: 12,
        marginBottom: 8,
    },
    noteTitleWarning: {
        color: '#f59e0b',
        marginTop: 16,
    },
    noteText: {
        fontSize: 14,
        color: '#94a3b8',
        marginBottom: 4,
        lineHeight: 20,
    },
});

