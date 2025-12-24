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
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { eventService, type EventData } from '../../../services/api';
import { getAbsoluteMediaUrl } from '../../../services/apiConfig';
import { useAuth } from '../../../hooks/useAuth';

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

    // Fetch events and bookings together to ensure synchronization
    const fetchEventsAndBookings = useCallback(async () => {
        try {
            setIsLoading(true);
            console.log('🔄 Fetching events and bookings...');

            // Fetch both in parallel
            const [allEvents, bookings] = await Promise.all([
                eventService.getAllEvents(),
                eventService.getUserBookings().catch((err) => {
                    console.warn('Failed to fetch bookings:', err);
                    return [];
                })
            ]);

            console.log('📋 Received events:', allEvents.length);
            console.log('📅 Received bookings:', bookings.length);

            // Process bookings to get booked event IDs and event data
            const bookedIds = new Set<string>();
            const bookedEventsMap = new Map<string, EventData>();

            bookings.forEach((booking: any) => {
                // Handle both populated and non-populated eventId
                // When populated, eventId is an object with _id property
                // When not populated, eventId is just the ObjectId string
                const eventId = booking.eventId?._id || booking.eventId?._id?.toString() || booking.eventId;
                const eventData = booking.eventId;

                if (eventId) {
                    const eventIdStr = eventId.toString();
                    bookedIds.add(eventIdStr);
                    console.log('📅 Found booking for event:', eventIdStr);

                    // If eventId is populated with full event data, use it
                    if (eventData && typeof eventData === 'object') {
                        // Check if it has event properties (not just an ID)
                        if (eventData.name || eventData.date) {
                            // Ensure _id is set
                            const fullEventData: EventData = {
                                ...eventData,
                                _id: eventData._id || eventIdStr
                            };
                            bookedEventsMap.set(eventIdStr, fullEventData);
                            console.log('📅 Added booked event to map:', fullEventData.name, fullEventData._id);
                        }
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
            // Use the bookedEventsMap directly since it contains populated event data from the bookings API
            console.log('📅 Looking for countdown event from bookedEventsMap');

            const upcomingBookedFromMap = Array.from(bookedEventsMap.values())
                .filter((event) => {
                    const eventDate = new Date(event.date);
                    const isUpcoming = eventDate >= now && event.status !== 'Cancelled';
                    console.log('📅 Checking booked event from map:', event.name, 'date:', event.date, 'isUpcoming:', isUpcoming);
                    return isUpcoming;
                })
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            console.log('📅 Found', upcomingBookedFromMap.length, 'upcoming booked events from bookings API');

            if (upcomingBookedFromMap.length > 0) {
                const mostUpcoming = upcomingBookedFromMap[0];
                console.log('📅 Setting booked event for countdown from bookings:', mostUpcoming.name, mostUpcoming.date, mostUpcoming._id);
                setBookedEvent(mostUpcoming);
            } else {
                // Fallback: try to find from the events list (in case bookings weren't populated with event data)
                console.log('📅 No events in bookedEventsMap, checking upcomingEvents list');
                const upcomingBookedEvents = upcomingEvents.filter((event) => {
                    const eventIdStr = event._id ? String(event._id) : '';
                    return eventIdStr && bookedIds.has(eventIdStr);
                });

                if (upcomingBookedEvents.length > 0) {
                    const mostUpcoming = upcomingBookedEvents[0];
                    console.log('📅 Setting booked event for countdown from events list:', mostUpcoming.name, mostUpcoming.date);
                    setBookedEvent(mostUpcoming);
                } else {
                    console.log('📅 No upcoming booked events found anywhere - clearing bookedEvent state');
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
                const eventId = booking.eventId?._id || booking.eventId?._id?.toString() || booking.eventId;
                const eventData = booking.eventId;

                if (eventId) {
                    const eventIdStr = eventId.toString();
                    bookedIds.add(eventIdStr);

                    if (eventData && typeof eventData === 'object' && (eventData.name || eventData.date)) {
                        const fullEventData: EventData = {
                            ...eventData,
                            _id: eventData._id || eventIdStr
                        };
                        bookedEventsMap.set(eventIdStr, fullEventData);
                        console.log('📅 Refresh: Added booked event to map:', fullEventData.name);
                    }
                }
            });

            setBookedEventIds(bookedIds);

            // Update booked event for countdown directly from bookedEventsMap
            const now = new Date();
            const upcomingBookedFromMap = Array.from(bookedEventsMap.values())
                .filter((event) => {
                    const eventDate = new Date(event.date);
                    return eventDate >= now && event.status !== 'Cancelled';
                })
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            console.log('📅 Refresh: Found', upcomingBookedFromMap.length, 'upcoming booked events');

            if (upcomingBookedFromMap.length > 0) {
                const mostUpcoming = upcomingBookedFromMap[0];
                console.log('📅 Refresh: Setting booked event for countdown:', mostUpcoming.name, mostUpcoming.date);
                setBookedEvent(mostUpcoming);
            } else {
                console.log('📅 Refresh: No upcoming booked events found');
                setBookedEvent(null);
            }

            // Update events list to include any new booked events
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
                const nowTime = new Date();
                const upcomingEvents = Array.from(eventsMap.values())
                    .filter((event) => {
                        const eventDate = new Date(event.date);
                        return eventDate >= nowTime && event.status !== 'Cancelled';
                    })
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                return upcomingEvents;
            });
        } catch (err) {
            console.error('Failed to fetch bookings:', err);
        }
    }, []);

    useEffect(() => {
        fetchEventsAndBookings();
    }, [fetchEventsAndBookings]);

    // Refresh when screen comes into focus (e.g., after booking an event)
    useFocusEffect(
        React.useCallback(() => {
            // Refresh bookings when screen comes into focus
            fetchBookings();
        }, [fetchBookings])
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
        fetchEventsAndBookings();
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

    const getUserDisplayId = () => {
        return user?._id?.slice(-8) || user?.id?.slice(-8) || '45485852';
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
                                {getUserLocation()}, {getUserDisplayId()}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.profileActions}>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => router.push('/(main)/chat')}
                        >
                            <MessageSquare size={20} color="#1A202C" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => router.push('/(main)/notifications')}
                        >
                            <Bell size={20} color="#1A202C" />
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
});
