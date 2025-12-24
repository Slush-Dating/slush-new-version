/**
 * Event Detail Screen
 * View event details and book
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    TextInput,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ArrowLeft,
    Calendar,
    MapPin,
    Users,
    Lock,
    Clock,
    Bookmark,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { eventService, type EventData } from '../../../services/api';
import { getAbsoluteMediaUrl } from '../../../services/apiConfig';

export default function EventDetailScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [event, setEvent] = useState<EventData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isBooking, setIsBooking] = useState(false);
    const [password, setPassword] = useState('');
    const [bookingStatus, setBookingStatus] = useState<{ isBooked: boolean } | null>(null);
    const [isBookmarked, setIsBookmarked] = useState(false);

    useEffect(() => {
        if (!id) return;

        const fetchEvent = async () => {
            try {
                const [eventData, status] = await Promise.all([
                    eventService.getEventById(id),
                    eventService.getBookingStatus(id),
                ]);
                setEvent(eventData);
                setBookingStatus(status);
            } catch (err) {
                console.error('Failed to fetch event:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchEvent();
        
        // Refresh booking status periodically while viewing event detail
        const interval = setInterval(() => {
            eventService.getBookingStatus(id)
                .then(status => {
                    setBookingStatus(status);
                })
                .catch(err => {
                    console.error('Failed to refresh booking status:', err);
                });
        }, 10000); // Refresh every 10 seconds
        
        return () => clearInterval(interval);
    }, [id]);

    const handleBook = async () => {
        if (!id) return;

        if (event?.isPasswordProtected && !password) {
            Alert.alert('Password Required', 'Please enter the event password');
            return;
        }

        setIsBooking(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            await eventService.bookEvent(id, password);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setBookingStatus({ isBooked: true });
            Alert.alert('Success', 'You have successfully booked this event!');
        } catch (err: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', err.message || 'Failed to book event');
        } finally {
            setIsBooking(false);
        }
    };

    const handleCancelBooking = async () => {
        if (!id) return;

        Alert.alert(
            'Cancel Booking',
            'Are you sure you want to cancel your booking?',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await eventService.cancelBooking(id);
                            setBookingStatus({ isBooked: false });
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        } catch (err: any) {
                            Alert.alert('Error', err.message || 'Failed to cancel booking');
                        }
                    },
                },
            ]
        );
    };

    const handleBack = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.back();
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const endDate = new Date(date.getTime() + 63 * 60 * 1000); // Add 63 minutes for end time

        const formatTime = (d: Date) => {
            const hours = d.getHours();
            const minutes = d.getMinutes();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours % 12 || 12;
            const displayMinutes = minutes.toString().padStart(2, '0');
            return `${displayHours}:${displayMinutes}${ampm}`;
        };

        return {
            date: date.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            }),
            weekday: date.toLocaleDateString('en-GB', {
                weekday: 'long',
            }),
            startTime: formatTime(date),
            endTime: formatTime(endDate),
        };
    };

    const handleBookmark = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsBookmarked(!isBookmarked);
    };

    // participants count
    const participantCount = event ? (event.maleCount || 0) + (event.femaleCount || 0) : 0;

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#ec4899" />
            </View>
        );
    }

    if (!event) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Event not found</Text>
            </View>
        );
    }

    const { date, weekday, startTime, endTime } = formatDate(event.date);

    return (
        <View style={styles.container}>
            {/* Header Image */}
            <Image
                source={{
                    uri: event.imageUrl
                        ? getAbsoluteMediaUrl(event.imageUrl)
                        : 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800',
                }}
                style={styles.headerImage}
            />
            <LinearGradient
                colors={['transparent', 'rgba(255, 255, 255, 0.95)', '#ffffff']}
                style={styles.headerGradient}
            />

            {/* Navigation Buttons */}
            <SafeAreaView style={styles.backButtonContainer} edges={['top']}>
                <View style={styles.headerButtons}>
                    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                        <ArrowLeft size={24} color="#ffffff" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleBookmark} style={styles.bookmarkButton}>
                        <View style={[styles.bookmarkCircle, isBookmarked && styles.bookmarkCircleActive]}>
                            <Bookmark size={18} color={isBookmarked ? "#ffffff" : "#3B82F6"} fill={isBookmarked ? "#3B82F6" : "none"} />
                        </View>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            {/* Content */}
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.eventInfo}>
                    <Text style={styles.eventName}>{event.name}</Text>

                    {/* Date and Time */}
                    <View style={styles.detailItem}>
                        <Calendar size={20} color="#3B82F6" />
                        <View style={styles.detailTextContainer}>
                            <Text style={styles.detailValue}>{date}</Text>
                            <Text style={styles.detailSubtext}>{weekday}, {startTime} - {endTime}</Text>
                        </View>
                    </View>

                    {/* Location */}
                    <View style={styles.detailItem}>
                        <MapPin size={20} color="#3B82F6" />
                        <Text style={styles.detailValue}>{event.location}</Text>
                    </View>

                    {/* About Event */}
                    {event.description && (
                        <View style={styles.descriptionSection}>
                            <Text style={styles.sectionTitle}>About Event</Text>
                            <Text style={styles.description}>{event.description}</Text>
                        </View>
                    )}

                    {/* Event Participants */}
                    <View style={styles.participantsSection}>
                        <Text style={styles.sectionTitle}>Event participants ({participantCount})</Text>
                        <Text style={styles.description}>
                            Join {participantCount} other people at this event!
                        </Text>
                    </View>

                    {/* Password Input */}
                    {event.isPasswordProtected && !bookingStatus?.isBooked && (
                        <View style={styles.passwordSection}>
                            <View style={styles.passwordHeader}>
                                <Lock size={16} color="#f59e0b" />
                                <Text style={styles.passwordLabel}>This event requires a password</Text>
                            </View>
                            <TextInput
                                style={styles.passwordInput}
                                placeholder="Enter event password"
                                placeholderTextColor="#64748b"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Footer */}
            <SafeAreaView style={styles.footer} edges={['bottom']}>
                {bookingStatus?.isBooked ? (
                    <View style={styles.bookedFooter}>
                        <View style={styles.priceContainer}>
                            <Text style={styles.priceText}>Free</Text>
                            <Text style={styles.priceSubtext}>You're booked for this event</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.bookedButton}
                            disabled={true}
                        >
                            <Text style={styles.bookedButtonText}>Booked</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.footerContent}>
                        <View style={styles.priceContainer}>
                            <Text style={styles.priceText}>Free</Text>
                            <Text style={styles.priceSubtext}>Join our free event</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.bookButton}
                            onPress={handleBook}
                            disabled={isBooking}
                        >
                            {isBooking ? (
                                <ActivityIndicator color="#ffffff" />
                            ) : (
                                <Text style={styles.buttonText}>Book now</Text>
                            )}
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
        backgroundColor: '#ffffff',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ffffff',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ffffff',
    },
    errorText: {
        color: '#ef4444',
        fontSize: 16,
    },
    headerImage: {
        width: '100%',
        height: 300,
        position: 'absolute',
    },
    headerGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 350,
    },
    backButtonContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    headerButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    bookmarkButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bookmarkCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    bookmarkCircleActive: {
        backgroundColor: '#3B82F6',
    },
    content: {
        flex: 1,
        marginTop: 220,
        backgroundColor: '#ffffff',
    },
    eventInfo: {
        padding: 24,
        gap: 24,
    },
    eventName: {
        fontSize: 28,
        fontWeight: '700',
        color: '#000000',
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    detailTextContainer: {
        flex: 1,
    },
    detailValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#000000',
    },
    detailSubtext: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 2,
    },
    descriptionSection: {
        gap: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#000000',
    },
    description: {
        fontSize: 14,
        color: '#64748b',
        lineHeight: 22,
    },
    participantsSection: {
        gap: 12,
    },
    participantsList: {
        gap: 12,
        paddingRight: 24,
    },
    participantAvatar: {
        width: 60,
        height: 60,
        borderRadius: 8,
        marginRight: 12,
    },
    passwordSection: {
        gap: 12,
    },
    passwordHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    passwordLabel: {
        fontSize: 14,
        color: '#f59e0b',
    },
    passwordInput: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: '#000000',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    footer: {
        padding: 20,
        backgroundColor: '#ffffff',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    footerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    bookedFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    priceContainer: {
        flex: 1,
    },
    priceText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#000000',
    },
    priceSubtext: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 2,
    },
    bookButton: {
        backgroundColor: '#3B82F6',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 32,
        minWidth: 120,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
    },
    joinButton: {
        backgroundColor: '#3B82F6',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 32,
        minWidth: 120,
        alignItems: 'center',
        justifyContent: 'center',
    },
    joinButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
    },
    bookedButton: {
        backgroundColor: '#94a3b8',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 32,
        minWidth: 120,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.7,
    },
    bookedButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
    },
});

