/**
 * Events Screen
 * Browse and join dating events
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
    Calendar,
    MapPin,
    Clock,
    Bell,
    MessageSquare,
    Search,
    Filter,
    Bookmark,
    Music,
    Dumbbell,
    Coffee,
    BarChart,
    HelpCircle,
    X,
    ChevronRight,
    ChevronLeft,
    BookOpen,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { eventService, notificationService, type EventData } from '../../../services/api';
import { getAbsoluteMediaUrl } from '../../../services/apiConfig';
import { useAuth } from '../../../hooks/useAuth';
import { colors, spacing, radius, typography, shadows } from '../../../constants/theme';
import { Modal, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const categories = [
    { id: 'music', label: 'Music', icon: Music },
    { id: 'sports', label: 'Sports', icon: Dumbbell },
    { id: 'food', label: 'Food', icon: Coffee },
    { id: 'business', label: 'Business', icon: BarChart },
];

export default function EventsScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [events, setEvents] = useState<EventData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [bookedEvent, setBookedEvent] = useState<EventData | null>(null);
    const [bookedEventIds, setBookedEventIds] = useState<Set<string>>(new Set());
    const [timeUntilEvent, setTimeUntilEvent] = useState<number>(0);
    const [canJoin, setCanJoin] = useState(false);
    const [notificationCount, setNotificationCount] = useState(0);
    const [showGuideModal, setShowGuideModal] = useState(false);
    const [currentGuideStep, setCurrentGuideStep] = useState(1);
    const [activeTab, setActiveTab] = useState<'guide' | 'faq'>('guide');

    // Fetch events and bookings together to ensure synchronization
    const fetchEventsAndBookings = useCallback(async (silent = false) => {
        try {
            if (!silent) {
                setIsLoading(true);
            }
            console.log('🔄 Fetching events and bookings...');

            // Fetch both in parallel
            const [allEvents, bookings] = await Promise.all([
                eventService.getAllEvents(),
                eventService.getUserBookings().catch((err) => {
                    console.warn('Failed to fetch bookings:', err);
                    return [] as any[];
                }) as Promise<any[]>
            ]);

            console.log('📋 Received events:', allEvents.length);
            console.log('📅 Received bookings:', bookings.length);
            console.log('📅 Bookings data:', JSON.stringify(bookings, null, 2));

            // If bookings array is empty but we have events, try checking booking status for each event
            // This is a fallback in case the bookings endpoint isn't working but individual status checks work
            if (bookings.length === 0 && allEvents.length > 0) {
                console.log('📅 No bookings from API, checking individual event booking statuses...');
                const bookingChecks = await Promise.allSettled(
                    allEvents.slice(0, 5).map(event =>
                        event._id ? eventService.getBookingStatus(event._id) : Promise.resolve({ isBooked: false, booking: null })
                    )
                );

                const bookedEventIds = new Set<string>();
                bookingChecks.forEach((result, index) => {
                    if (result.status === 'fulfilled' && result.value.isBooked && allEvents[index]?._id) {
                        bookedEventIds.add(String(allEvents[index]._id));
                        console.log('📅 Found booked event via status check:', allEvents[index].name, allEvents[index]._id);
                    }
                });

                if (bookedEventIds.size > 0) {
                    console.log('📅 Found', bookedEventIds.size, 'booked events via status checks');
                    // Create mock bookings from the events
                    const mockBookings = Array.from(bookedEventIds).map(eventId => {
                        const event = allEvents.find(e => e._id?.toString() === eventId);
                        return {
                            _id: `mock-${eventId}`,
                            eventId: event || { _id: eventId },
                            userId: user?._id || user?.id,
                            status: 'booked'
                        };
                    });
                    bookings.push(...mockBookings);
                    console.log('📅 Added mock bookings, total now:', bookings.length);
                }
            }

            // Process bookings to get booked event IDs and event data
            const bookedIds = new Set<string>();
            const bookedEventsMap = new Map<string, EventData>();

            bookings.forEach((booking: any) => {
                // Handle both populated and non-populated eventId
                // When populated, eventId is an object with _id property
                // When not populated, eventId is just the ObjectId string
                let eventId: string | null = null;
                let eventData: any = null;

                if (!booking.eventId) {
                    console.log('📅 Booking has no eventId:', booking);
                    return;
                }

                // Check if eventId is populated (object) or just an ID (string/ObjectId)
                if (typeof booking.eventId === 'object' && booking.eventId !== null) {
                    // Populated event object
                    eventId = booking.eventId._id?.toString() || booking.eventId._id || null;
                    eventData = booking.eventId;
                } else {
                    // Not populated - just an ID string or ObjectId
                    eventId = booking.eventId.toString();
                    eventData = null;
                }

                if (eventId) {
                    const eventIdStr = eventId.toString();
                    bookedIds.add(eventIdStr);
                    console.log('📅 Found booking for event:', eventIdStr);

                    // If eventId is populated with full event data, use it
                    if (eventData && typeof eventData === 'object' && eventData !== null) {
                        // Check if it has event properties (not just an ID)
                        if (eventData.name || eventData.date) {
                            // Ensure _id is set correctly
                            const fullEventData: EventData = {
                                ...eventData,
                                _id: eventData._id?.toString() || eventIdStr
                            };
                            bookedEventsMap.set(eventIdStr, fullEventData);
                            console.log('📅 Added booked event to map:', fullEventData.name, fullEventData._id, 'Date:', fullEventData.date);
                        } else {
                            console.log('📅 Event data missing name/date:', eventData);
                        }
                    } else {
                        console.log('📅 Booking eventId not populated, will try to find in events list');
                    }
                }
            });

            console.log('📅 Booked event IDs:', Array.from(bookedIds));
            console.log('📅 Booked events map size:', bookedEventsMap.size);
            setBookedEventIds(bookedIds);

            // Merge events: start with all events, add any booked events that aren't in the list
            const eventsMap = new Map<string, EventData>();

            // Add all events from getAllEvents
            allEvents.forEach((event) => {
                if (event._id) {
                    eventsMap.set(String(event._id), event);
                }
            });

            // Add booked events that might not be in the main list
            bookedEventsMap.forEach((event, eventId) => {
                if (!eventsMap.has(eventId)) {
                    console.log('📅 Adding booked event not in main list:', event.name);
                    eventsMap.set(eventId, event);
                } else {
                    console.log('📅 Booked event already in main list:', event.name);
                }
            });

            // Filter to show only upcoming events
            const now = new Date();
            const upcomingEvents = Array.from(eventsMap.values()).filter(
                (event) => {
                    const eventDate = new Date(event.date);
                    const isUpcoming = eventDate >= now && event.status !== 'Cancelled';
                    if (!isUpcoming && bookedIds.has(event._id?.toString() || '')) {
                        console.log('📅 Filtered out booked event (past or cancelled):', event.name, 'Date:', event.date, 'Status:', event.status);
                    }
                    return isUpcoming;
                }
            );

            // Sort by date
            upcomingEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            console.log('📅 Upcoming events (including booked):', upcomingEvents.length);
            setEvents(upcomingEvents);
            setError('');

            // Set the most upcoming booked event for countdown banner
            // First try bookedEventsMap (populated event data from bookings API)
            console.log('📅 Looking for countdown event from bookedEventsMap (size:', bookedEventsMap.size, ')');

            const upcomingBookedFromMap = Array.from(bookedEventsMap.values())
                .filter((event) => {
                    if (!event.date) {
                        console.log('📅 Event missing date:', event.name || event._id);
                        return false;
                    }
                    const eventDate = new Date(event.date);
                    const isUpcoming = eventDate >= now && event.status !== 'Cancelled';
                    console.log('📅 Checking booked event from map:', event.name || 'Unknown', 'date:', event.date, 'isUpcoming:', isUpcoming, 'status:', event.status);
                    return isUpcoming;
                })
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            console.log('📅 Found', upcomingBookedFromMap.length, 'upcoming booked events from bookings API map');

            if (upcomingBookedFromMap.length > 0) {
                const mostUpcoming = upcomingBookedFromMap[0];
                console.log('✅ Setting booked event for countdown from bookings map:', mostUpcoming.name, mostUpcoming.date, mostUpcoming._id);
                setBookedEvent(mostUpcoming);
            } else {
                // Fallback: try to find from the events list (in case bookings weren't populated with event data)
                console.log('📅 No events in bookedEventsMap, checking upcomingEvents list (', upcomingEvents.length, 'events)');
                const upcomingBookedEvents = upcomingEvents.filter((event) => {
                    const eventIdStr = event._id ? String(event._id) : '';
                    const isBooked = eventIdStr && bookedIds.has(eventIdStr);
                    if (isBooked) {
                        console.log('📅 Found booked event in events list:', event.name, event._id);
                    }
                    return isBooked;
                })
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                if (upcomingBookedEvents.length > 0) {
                    const mostUpcoming = upcomingBookedEvents[0];
                    console.log('✅ Setting booked event for countdown from events list:', mostUpcoming.name, mostUpcoming.date, mostUpcoming._id);
                    setBookedEvent(mostUpcoming);
                } else {
                    console.log('⚠️ No upcoming booked events found anywhere - clearing bookedEvent state');
                    console.log('📅 Booked IDs:', Array.from(bookedIds));
                    console.log('📅 Upcoming events IDs:', upcomingEvents.map(e => e._id));
                    setBookedEvent(null);
                }
            }

        } catch (err: any) {
            console.error('❌ Error fetching events:', err);
            setError(err.message || 'Failed to load events');
            setEvents([]); // Clear events on error
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    // Separate function for refreshing bookings only (used after booking/cancelling)
    const fetchBookings = useCallback(async () => {
        try {
            const bookings = await eventService.getUserBookings();
            console.log('📅 Refreshing bookings:', bookings.length);

            const bookedIds = new Set<string>();
            const bookedEventsMap = new Map<string, EventData>();

            bookings.forEach((booking: any) => {
                let eventId: string | null = null;
                let eventData: any = null;

                if (!booking.eventId) {
                    console.log('📅 Refresh: Booking has no eventId:', booking);
                    return;
                }

                // Check if eventId is populated (object) or just an ID (string/ObjectId)
                if (typeof booking.eventId === 'object' && booking.eventId !== null) {
                    // Populated event object
                    eventId = booking.eventId._id?.toString() || booking.eventId._id || null;
                    eventData = booking.eventId;
                } else {
                    // Not populated - just an ID string or ObjectId
                    eventId = booking.eventId.toString();
                    eventData = null;
                }

                if (eventId) {
                    const eventIdStr = eventId.toString();
                    bookedIds.add(eventIdStr);

                    if (eventData && typeof eventData === 'object' && eventData !== null && (eventData.name || eventData.date)) {
                        const fullEventData: EventData = {
                            ...eventData,
                            _id: eventData._id?.toString() || eventIdStr
                        };
                        bookedEventsMap.set(eventIdStr, fullEventData);
                        console.log('📅 Refresh: Added booked event to map:', fullEventData.name, fullEventData._id, 'Date:', fullEventData.date);
                    } else {
                        console.log('📅 Refresh: Booking eventId not populated or missing data');
                    }
                }
            });

            setBookedEventIds(bookedIds);

            // Update events list and find booked event for countdown
            const now = new Date();

            setEvents((currentEvents) => {
                const eventsMap = new Map<string, EventData>();

                // Add current events
                currentEvents.forEach((event) => {
                    if (event._id) {
                        eventsMap.set(event._id.toString(), event);
                    }
                });

                // Add booked events that aren't in the list
                bookedEventsMap.forEach((event, eventId) => {
                    if (!eventsMap.has(eventId)) {
                        eventsMap.set(eventId, event);
                    }
                });

                // Filter and sort
                const upcomingEvents = Array.from(eventsMap.values())
                    .filter((event) => {
                        const eventDate = new Date(event.date);
                        return eventDate >= now && event.status !== 'Cancelled';
                    })
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                // Find booked event for countdown from the merged events
                const upcomingBookedFromMap = Array.from(bookedEventsMap.values())
                    .filter((event) => {
                        if (!event.date) {
                            return false;
                        }
                        const eventDate = new Date(event.date);
                        return eventDate >= now && event.status !== 'Cancelled';
                    })
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                console.log('📅 Refresh: Found', upcomingBookedFromMap.length, 'upcoming booked events from map');

                if (upcomingBookedFromMap.length > 0) {
                    const mostUpcoming = upcomingBookedFromMap[0];
                    console.log('✅ Refresh: Setting booked event for countdown:', mostUpcoming.name, mostUpcoming.date, mostUpcoming._id);
                    // Schedule state update after this setState completes
                    Promise.resolve().then(() => setBookedEvent(mostUpcoming));
                } else {
                    // Fallback: find from merged events list
                    const upcomingBookedFromList = upcomingEvents
                        .filter((event) => {
                            const eventIdStr = event._id ? String(event._id) : '';
                            return eventIdStr && bookedIds.has(eventIdStr);
                        })
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                    if (upcomingBookedFromList.length > 0) {
                        const mostUpcoming = upcomingBookedFromList[0];
                        console.log('✅ Refresh: Setting booked event for countdown from events list:', mostUpcoming.name, mostUpcoming.date);
                        Promise.resolve().then(() => setBookedEvent(mostUpcoming));
                    } else {
                        console.log('⚠️ Refresh: No upcoming booked events found');
                        Promise.resolve().then(() => setBookedEvent(null));
                    }
                }

                return upcomingEvents;
            });
        } catch (err) {
            console.error('Failed to fetch bookings:', err);
        }
    }, []);

    useEffect(() => {
        fetchEventsAndBookings(false); // Initial load
    }, [fetchEventsAndBookings]);

    // Refresh when screen comes into focus (e.g., after booking an event)
    useFocusEffect(
        React.useCallback(() => {
            // Refresh both events and bookings when screen comes into focus
            // This ensures bookedEvent and countdown are properly restored
            fetchEventsAndBookings(true); // Silent refresh on focus

            // Fetch notification count
            const fetchNotificationCount = async () => {
                try {
                    const { unreadCount } = await notificationService.getUnreadCount();
                    setNotificationCount(unreadCount || 0);
                } catch (error) {
                    console.warn('Failed to fetch notification count:', error);
                }
            };
            fetchNotificationCount();
        }, [fetchEventsAndBookings])
    );

    // Countdown timer for booked events
    useEffect(() => {
        if (!bookedEvent) {
            setTimeUntilEvent(0);
            setCanJoin(false);
            return;
        }

        const updateCountdown = () => {
            const eventDate = new Date(bookedEvent.date);
            const now = new Date();
            const diffMs = eventDate.getTime() - now.getTime();
            const diffSeconds = Math.floor(diffMs / 1000);

            setTimeUntilEvent(diffSeconds);
            // Can join 15 minutes (900 seconds) before event starts
            setCanJoin(diffSeconds <= 900 && diffSeconds > 0);
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);

        return () => clearInterval(interval);
    }, [bookedEvent]);

    const formatCountdown = (seconds: number) => {
        if (seconds <= 0) return 'Event starting now';

        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    };

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchEventsAndBookings(true); // Silent because we have RefreshControl
    };

    const handleEventPress = (event: EventData) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/(main)/events/${event._id}`);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const day = date.getDate();
        const month = date.toLocaleDateString('en-GB', { month: 'short' });
        return `${day} ${month}`;
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    };

    const formatLocation = (location: string) => {
        if (!location) return 'London, UK';
        if (typeof location === 'string') return location;
        return 'London, UK';
    };

    const getUserLocation = () => {
        if (user?.location?.city) {
            return `${user.location.city}, UK`;
        }
        return 'London, UK';
    };


    const getEventTypeLabel = (eventType?: string) => {
        switch (eventType) {
            case 'straight':
                return 'Straight';
            case 'gay':
                return 'Gay';
            case 'bisexual':
                return 'Bisexual';
            default:
                return 'Straight';
        }
    };

    const getGenderAvailability = (event: EventData) => {
        const maleAvailable = (event.maxMaleParticipants || 10) - (event.maleCount || 0);
        const femaleAvailable = (event.maxFemaleParticipants || 10) - (event.femaleCount || 0);
        return {
            maleAvailable: Math.max(0, maleAvailable),
            femaleAvailable: Math.max(0, femaleAvailable)
        };
    };


    const profileImage = user?.photos?.[0]
        ? getAbsoluteMediaUrl(user.photos[0])
        : 'https://via.placeholder.com/50';

    const handleEventGuide = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setCurrentGuideStep(1);
        setActiveTab('guide');
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
            image: require('../../../assets/event-guide-1.png'),
        },
        {
            step: 2,
            title: 'Like or Dislike',
            description: 'After your video-date, you will need to decide whether you like or dislike your date.',
            image: require('../../../assets/event-guide-2.png'),
        },
        {
            step: 3,
            title: 'Match & Chat',
            description: 'At the end of the event, match and chat.',
            image: require('../../../assets/event-guide-3.png'),
        },
    ];

    const faqItems = [
        {
            question: 'How do I join an event?',
            answer: 'Book an event from the list. 15 minutes before it starts, a "Join" button will appear on your dashboard. Tap it to enter the waiting room.'
        },
        {
            question: 'What if I am late?',
            answer: 'You can join up to 10 minutes after the event has started, but you might miss some dates!'
        },
        {
            question: 'Can I leave early?',
            answer: 'Yes, you can leave at any time. However, to get matches, we recommend staying until the end.'
        },
        {
            question: 'How are matches made?',
            answer: 'If you and another participant both "Like" each other after your video date, you\'ll find them in your matches screen after the event.'
        },
        {
            question: 'Is my video recorded?',
            answer: 'No, video dates are live and never recorded. We value your privacy.'
        }
    ];

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        tintColor="#3B82F6"
                    />
                }
            >
                {/* Countdown Banner for Booked Events */}
                {bookedEvent && (
                    <View style={styles.countdownBanner}>
                        <View style={styles.countdownContent}>
                            <View style={styles.countdownInfo}>
                                <Text style={styles.countdownLabel}>
                                    {timeUntilEvent > 0 ? 'Next event starts in' : 'Event is starting'}
                                </Text>
                                <Text style={styles.countdownTime}>{formatCountdown(timeUntilEvent)}</Text>
                            </View>
                            <TouchableOpacity
                                style={[styles.countdownJoinButton, !canJoin && styles.countdownJoinButtonDisabled]}
                                onPress={() => {
                                    if (canJoin && bookedEvent._id) {
                                        router.push(`/(main)/events/waiting/${bookedEvent._id}`);
                                    }
                                }}
                                disabled={!canJoin}
                            >
                                <Text style={styles.countdownJoinButtonText}>Join</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* User Profile Header */}
                <View style={styles.profileHeader}>
                    <View style={styles.profileInfo}>
                        <Image
                            source={{ uri: profileImage }}
                            style={styles.profileImage}
                        />
                        <View style={styles.profileText}>
                            <Text style={styles.profileName}>
                                {user?.name || 'Guest User'}
                            </Text>
                            <Text style={styles.profileLocation}>
                                {getUserLocation()}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.profileActions}>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => {
                                // Mark notifications as read and clear count
                                setNotificationCount(0);
                                notificationService.markAllAsRead().catch(err => {
                                    console.warn('Failed to mark notifications as read:', err);
                                });
                                router.push('/(main)/notifications');
                            }}
                        >
                            <Bell size={20} color="#1A202C" />
                            {notificationCount > 0 && (
                                <View style={styles.notificationBadge}>
                                    <Text style={styles.notificationBadgeText}>
                                        {notificationCount > 99 ? '99+' : notificationCount}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={handleEventGuide}
                        >
                            <HelpCircle size={20} color="#1A202C" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.testButton]}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                router.push('/(main)/events/test');
                            }}
                        >
                            <Text style={styles.testButtonText}>🧪</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <View style={styles.searchBar}>
                        <Search size={18} color="#718096" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search Location"
                            placeholderTextColor="#94a3b8"
                        />
                    </View>
                    <TouchableOpacity style={styles.filterButton}>
                        <Filter size={18} color="#1A202C" />
                    </TouchableOpacity>
                </View>

                {/* Categories */}
                <View style={styles.categoriesSection}>
                    <Text style={styles.sectionTitle}>Categories</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.categoriesList}
                    >
                        {categories.map((category) => {
                            const Icon = category.icon;
                            const isSelected = selectedCategory === category.id;
                            return (
                                <TouchableOpacity
                                    key={category.id}
                                    style={[
                                        styles.categoryChip,
                                        isSelected && styles.categoryChipSelected,
                                    ]}
                                    onPress={() => {
                                        setSelectedCategory(
                                            isSelected ? null : category.id
                                        );
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }}
                                >
                                    <Icon
                                        size={20}
                                        color={isSelected ? '#3B82F6' : '#718096'}
                                    />
                                    <Text
                                        style={[
                                            styles.categoryLabel,
                                            isSelected && styles.categoryLabelSelected,
                                        ]}
                                    >
                                        {category.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* Upcoming Events */}
                <View style={styles.eventsSection}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Upcoming Events</Text>
                        <TouchableOpacity>
                            <Text style={styles.seeMoreText}>See More</Text>
                        </TouchableOpacity>
                    </View>

                    {error ? (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : events.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Calendar size={64} color="#94a3b8" />
                            <Text style={styles.emptyTitle}>No upcoming events</Text>
                            <Text style={styles.emptyText}>
                                Check back soon for new speed dating events
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.eventsList}>
                            {events.map((event) => {
                                const { maleAvailable, femaleAvailable } = getGenderAvailability(event);
                                const totalAvailable = maleAvailable + femaleAvailable;
                                const isBooked = event._id ? bookedEventIds.has(String(event._id)) : false;

                                return (
                                    <TouchableOpacity
                                        key={event._id || event.name}
                                        style={styles.eventCard}
                                        onPress={() => handleEventPress(event)}
                                        activeOpacity={0.9}
                                    >
                                        <Image
                                            source={{
                                                uri: event.imageUrl
                                                    ? getAbsoluteMediaUrl(event.imageUrl)
                                                    : 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400',
                                            }}
                                            style={styles.eventImage}
                                            resizeMode="cover"
                                        />

                                        {/* Tags */}
                                        <View style={styles.eventTags}>
                                            {isBooked && (
                                                <View style={styles.bookedTag}>
                                                    <Text style={styles.bookedTagText}>✓ Booked</Text>
                                                </View>
                                            )}
                                            <View style={styles.ageTag}>
                                                <Text style={styles.ageTagText}>
                                                    Age group: {event.minAge || 18}-{event.maxAge || 99}
                                                </Text>
                                            </View>
                                            <View style={styles.typeTag}>
                                                <Text style={styles.typeTagText}>{getEventTypeLabel(event.eventType)}</Text>
                                            </View>
                                        </View>

                                        {/* Bottom Overlay */}
                                        <LinearGradient
                                            colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']}
                                            style={styles.eventOverlay}
                                        >
                                            <View style={styles.eventContent}>
                                                <View style={styles.eventHeader}>
                                                    <View style={styles.dateBox}>
                                                        <Text style={styles.dateText}>{formatDate(event.date)}</Text>
                                                    </View>
                                                    <TouchableOpacity
                                                        style={styles.bookmarkButton}
                                                        onPress={(e) => {
                                                            e.stopPropagation();
                                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                        }}
                                                    >
                                                        <Bookmark size={20} color="#ffffff" fill="none" />
                                                    </TouchableOpacity>
                                                </View>

                                                <Text style={styles.eventTitle}>{event.name}</Text>

                                                <View style={styles.eventMeta}>
                                                    <View style={styles.metaRow}>
                                                        <MapPin size={14} color="#94a3b8" />
                                                        <Text style={styles.metaText}>{formatLocation(event.location)}</Text>
                                                    </View>
                                                    <View style={styles.metaRow}>
                                                        <Clock size={14} color="#94a3b8" />
                                                        <Text style={styles.metaText}>{formatTime(event.date)}</Text>
                                                    </View>
                                                </View>

                                                <View style={styles.availabilityRow}>
                                                    <View style={styles.genderBadges}>
                                                        <View style={[styles.genderBadge, maleAvailable === 0 && styles.genderBadgeFull]}>
                                                            <Text style={styles.genderSymbol}>♂</Text>
                                                            <Text style={styles.genderLabel}>
                                                                {maleAvailable === 0 ? 'Full' : 'Available'}
                                                            </Text>
                                                        </View>
                                                        <View style={[styles.genderBadge, femaleAvailable === 0 && styles.genderBadgeFull]}>
                                                            <Text style={styles.genderSymbol}>♀</Text>
                                                            <Text style={styles.genderLabel}>
                                                                {femaleAvailable === 0 ? 'Full' : 'Available'}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                    <Text style={styles.availableCount}>Available : {totalAvailable}</Text>
                                                </View>
                                            </View>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Event Guide & FAQ Modal */}
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
                            <Text style={styles.guideModalTitle}>Event Information</Text>
                            <TouchableOpacity
                                onPress={handleCloseGuide}
                                style={styles.guideCloseButton}
                                activeOpacity={0.8}
                            >
                                <X size={20} color={colors.textPrimary} />
                            </TouchableOpacity>
                        </View>

                        {/* Tabs */}
                        <View style={styles.modalTabs}>
                            <TouchableOpacity
                                style={[styles.modalTab, activeTab === 'guide' && styles.modalTabActive]}
                                onPress={() => setActiveTab('guide')}
                            >
                                <Text style={[styles.modalTabText, activeTab === 'guide' && styles.modalTabTextActive]}>Guide</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalTab, activeTab === 'faq' && styles.modalTabActive]}
                                onPress={() => setActiveTab('faq')}
                            >
                                <Text style={[styles.modalTabText, activeTab === 'faq' && styles.modalTabTextActive]}>FAQ</Text>
                            </TouchableOpacity>
                        </View>

                        {activeTab === 'guide' ? (
                            <>
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
                                                <Text style={styles.stepTitle}>{step.title}</Text>
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
                                            <Text style={styles.navButtonTextDone}>Got it!</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </>
                        ) : (
                            <ScrollView
                                style={styles.faqContent}
                                contentContainerStyle={styles.faqContentContainer}
                                showsVerticalScrollIndicator={false}
                            >
                                {faqItems.map((item, index) => (
                                    <View key={index} style={styles.faqItem}>
                                        <Text style={styles.faqQuestion}>{item.question}</Text>
                                        <Text style={styles.faqAnswer}>{item.answer}</Text>
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
    },
    scrollView: {
        flex: 1,
    },
    // Profile Header
    profileHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 16,
    },
    profileInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    profileImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#E9ECEF',
        marginRight: 12,
    },
    profileText: {
        flex: 1,
    },
    profileName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1A202C',
        marginBottom: 2,
    },
    profileLocation: {
        fontSize: 13,
        color: '#718096',
    },
    profileActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    testButton: {
        backgroundColor: '#3B82F6',
    },
    testButtonText: {
        fontSize: 18,
    },
    // Search Bar
    searchContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 20,
        gap: 12,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#1A202C',
        padding: 0,
    },
    filterButton: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    // Categories
    categoriesSection: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1A202C',
        marginBottom: 12,
        paddingHorizontal: 20,
    },
    categoriesList: {
        paddingHorizontal: 20,
        gap: 12,
    },
    categoryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 8,
        marginRight: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    categoryChipSelected: {
        backgroundColor: '#DBEAFE',
    },
    categoryLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#718096',
    },
    categoryLabelSelected: {
        color: '#3B82F6',
    },
    // Events Section
    eventsSection: {
        paddingBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    seeMoreText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#3B82F6',
    },
    eventsList: {
        paddingHorizontal: 20,
        gap: 16,
    },
    // Event Card
    eventCard: {
        height: 320,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#1e293b',
        marginBottom: 16,
    },
    eventImage: {
        width: '100%',
        height: '100%',
        position: 'absolute',
    },
    eventTags: {
        position: 'absolute',
        top: 12,
        left: 12,
        right: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        zIndex: 1,
    },
    ageTag: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    ageTagText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#1A202C',
    },
    typeTag: {
        backgroundColor: '#3B82F6',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    typeTagText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#FFFFFF',
    },
    eventOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
    },
    eventContent: {
        gap: 12,
    },
    eventHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    dateBox: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    dateText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1A202C',
    },
    bookmarkButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    eventTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
        marginTop: 4,
    },
    eventMeta: {
        flexDirection: 'row',
        gap: 16,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    metaText: {
        fontSize: 13,
        color: '#94a3b8',
    },
    availabilityRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    genderBadges: {
        flexDirection: 'row',
        gap: 8,
    },
    genderBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 16,
        paddingHorizontal: 10,
        paddingVertical: 6,
        gap: 6,
    },
    genderBadgeFull: {
        backgroundColor: 'rgba(239, 68, 68, 0.3)',
    },
    genderSymbol: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    genderLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#FFFFFF',
    },
    availableCount: {
        fontSize: 13,
        fontWeight: '500',
        color: '#FFFFFF',
    },
    errorContainer: {
        padding: 24,
        alignItems: 'center',
    },
    errorText: {
        color: '#EF4444',
        fontSize: 16,
        textAlign: 'center',
    },
    emptyContainer: {
        padding: 48,
        alignItems: 'center',
    },
    emptyTitle: {
        color: '#1A202C',
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16,
    },
    emptyText: {
        color: '#718096',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
    },
    // Countdown Banner
    countdownBanner: {
        backgroundColor: '#3B82F6',
        paddingHorizontal: 20,
        paddingVertical: 16,
        marginHorizontal: 20,
        marginTop: 12,
        marginBottom: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    countdownContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
    },
    countdownInfo: {
        flex: 1,
        gap: 4,
    },
    countdownLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: 'rgba(255, 255, 255, 0.9)',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    countdownTime: {
        fontSize: 24,
        fontWeight: '800',
        color: '#FFFFFF',
        fontVariant: ['tabular-nums'],
    },
    countdownJoinButton: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        paddingVertical: 12,
        paddingHorizontal: 24,
        minWidth: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    countdownJoinButtonDisabled: {
        opacity: 0.5,
    },
    countdownJoinButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#3B82F6',
    },
    // Booked Tag
    bookedTag: {
        backgroundColor: 'rgba(34, 197, 94, 0.9)',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginRight: 8,
    },
    bookedTagText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    notificationBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    notificationBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    // Guide Modal Styles
    guideModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    guideModalBackdropTouchable: {
        ...StyleSheet.absoluteFillObject,
    },
    guideModalContainer: {
        width: SCREEN_WIDTH * 0.9,
        maxHeight: '80%',
        backgroundColor: colors.bgWhite,
        borderRadius: radius.xl,
        padding: spacing.xl,
        ...shadows.lg,
    },
    guideModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    guideModalTitle: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: colors.textPrimary,
    },
    guideCloseButton: {
        padding: spacing.xs,
    },
    modalTabs: {
        flexDirection: 'row',
        marginBottom: spacing.lg,
        backgroundColor: colors.bgSecondary,
        borderRadius: radius.md,
        padding: 4,
    },
    modalTab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: radius.sm,
    },
    modalTabActive: {
        backgroundColor: colors.bgWhite,
        ...shadows.sm,
    },
    modalTabText: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
        color: colors.textTertiary,
    },
    modalTabTextActive: {
        color: colors.primary,
        fontWeight: typography.weights.bold,
    },
    stepIndicator: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.sm,
        marginBottom: spacing.xl,
    },
    stepDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.bgSecondary,
    },
    stepDotActive: {
        backgroundColor: colors.primary,
        width: 20,
    },
    guideContent: {
        maxHeight: 350,
    },
    guideContentContainer: {
        alignItems: 'center',
    },
    stepContent: {
        alignItems: 'center',
        width: '100%',
    },
    stepTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.textPrimary,
        marginBottom: spacing.md,
    },
    stepImageContainer: {
        width: '100%',
        height: 200,
        backgroundColor: colors.bgSecondary,
        borderRadius: radius.lg,
        marginBottom: spacing.xl,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
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
    },
    guideNavigation: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: spacing.xl,
        gap: spacing.md,
    },
    navButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
        borderRadius: radius.lg,
        gap: spacing.xs,
    },
    navButtonLeft: {
        backgroundColor: colors.bgSecondary,
    },
    navButtonRight: {
        backgroundColor: colors.primary,
    },
    navButtonDisabled: {
        opacity: 0.5,
    },
    navButtonText: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.primary,
    },
    navButtonTextDisabled: {
        color: colors.textTertiary,
    },
    navButtonTextRight: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.bgWhite,
    },
    navButtonDone: {
        flex: 1,
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        borderRadius: radius.lg,
        alignItems: 'center',
    },
    navButtonTextDone: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        color: colors.bgWhite,
    },
    faqContent: {
        maxHeight: 450,
    },
    faqContentContainer: {
        paddingBottom: spacing.lg,
    },
    faqItem: {
        marginBottom: spacing.xl,
    },
    faqQuestion: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        color: colors.textPrimary,
        marginBottom: spacing.xs,
    },
    faqAnswer: {
        fontSize: typography.sizes.sm,
        color: colors.textSecondary,
        lineHeight: 20,
    },
});
