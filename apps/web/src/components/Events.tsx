import { useState, useEffect, useCallback } from 'react';
import { MapPin, Clock, Bookmark, Search, Filter, MessageSquare, Bell, Music, Dumbbell, Coffee, BarChart, Loader2, Calendar, Sparkles, Lock } from 'lucide-react';
import { eventService, type EventData } from '../services/api';
import { authService } from '../services/authService';
import { getAbsoluteMediaUrl } from '../services/apiConfig';
import './Events.css';

interface User {
    name?: string;
    location?: string;
    profilePicture?: string;
    id?: string;
}

interface EventsProps {
    onJoin: (eventId: string, password?: string) => void;
    user?: User;
    bookedEventId?: string | null;
    onJoinWaitingRoom: (eventId: string) => void;
    onNotificationsClick?: () => void;
}

export const Events: React.FC<EventsProps> = ({ onJoin, user, bookedEventId, onJoinWaitingRoom, onNotificationsClick }) => {
    const [events, setEvents] = useState<EventData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [bookedEventIds, setBookedEventIds] = useState<Set<string>>(new Set());

    // Debug logging
    useEffect(() => {
        console.log('Events component mounted');
        return () => {
            console.log('Events component unmounted');
        };
    }, []);
    const [bookedEvent, setBookedEvent] = useState<EventData | null>(null);
    const [timeUntilEvent, setTimeUntilEvent] = useState<number>(0);
    const [canJoin, setCanJoin] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | undefined>(user);
    const [passwordModal, setPasswordModal] = useState<{ event: EventData | null; password: string }>({ event: null, password: '' });

    // Helper function to construct full image URL
    const getImageUrl = (url: string | null | undefined): string | undefined => {
        if (!url) return undefined;
        return getAbsoluteMediaUrl(url);
    };

    // Fetch fresh user data
    useEffect(() => {
        const fetchUserProfile = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const profile = await authService.getProfile(token);
                    // Get the first photo from photos array, or use imageUrl if available
                    const photoUrl = profile.imageUrl || (profile.photos && profile.photos.length > 0 ? profile.photos[0] : null);
                    setCurrentUser({
                        id: profile._id || profile.id,
                        name: profile.name,
                        location: profile.location,
                        profilePicture: getImageUrl(photoUrl)
                    });
                } catch (err: any) {
                    console.error('Failed to fetch user profile:', err);
                    // If authentication fails, clear invalid token locally
                    if (err.message?.includes('Invalid token') || err.message?.includes('Unauthorized')) {
                        console.warn('Authentication token invalid, clearing stored credentials');
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                        // Show error and redirect to login after a brief delay
                        setError('Your session has expired. Please log in again.');
                        setTimeout(() => {
                            window.location.reload();
                        }, 2000);
                        return;
                    }
                    // Don't crash the component if profile fetch fails
                    // Just use the user prop if available
                    if (user) {
                        setCurrentUser({
                            id: user.id,
                            name: user.name,
                            location: user.location,
                            profilePicture: user.profilePicture
                        });
                    }
                }
            } else if (user) {
                // Use user prop if no token
                setCurrentUser({
                    id: user.id,
                    name: user.name,
                    location: user.location,
                    profilePicture: user.profilePicture
                });
            }
        };

        fetchUserProfile();
    }, [user]);

    // Fetch all user bookings to check which events are booked
    const fetchBookings = useCallback(async () => {
        try {
            const bookings = await eventService.getUserBookings();
            const bookedIds = new Set<string>();
            bookings.forEach((booking: any) => {
                const eventId = booking.eventId?._id || booking.eventId;
                if (eventId) {
                    bookedIds.add(eventId.toString());
                }
            });
            console.log('[Events] Booked event IDs:', Array.from(bookedIds));
            setBookedEventIds(bookedIds);

            // If we have bookings and no bookedEventId prop, set the most recent one for countdown
            if (bookedIds.size > 0 && !bookedEventId) {
                const mostRecentId = Array.from(bookedIds)[0];
                const fetchBookedEvent = async () => {
                    try {
                        const data = await eventService.getEventById(mostRecentId);
                        setBookedEvent(data);
                    } catch (err) {
                        console.error('[Events] Failed to fetch booked event:', err);
                    }
                };
                fetchBookedEvent();
            }
        } catch (err) {
            console.error('[Events] Failed to fetch bookings:', err);
        }
    }, [bookedEventId]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            fetchBookings();
        }
    }, [fetchBookings]);

    // Refresh bookings when bookedEventId changes (from parent component)
    useEffect(() => {
        if (bookedEventId) {
            setBookedEventIds(prev => new Set([...prev, bookedEventId]));
        }
    }, [bookedEventId]);

    // Refresh bookings periodically and when component becomes visible
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                const token = localStorage.getItem('token');
                if (token) {
                    fetchBookings();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Refresh every 30 seconds while component is mounted
        const interval = setInterval(() => {
            const token = localStorage.getItem('token');
            if (token) {
                fetchBookings();
            }
        }, 30000);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearInterval(interval);
        };
    }, [fetchBookings]);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await eventService.getAllEvents();
                console.log('[Events] Fetched events:', data.length, data);
                // Ensure data is an array
                if (Array.isArray(data)) {
                    setEvents(data);
                } else {
                    console.warn('Events API returned non-array data:', data);
                    setEvents([]);
                }
            } catch (err: any) {
                console.error('Failed to fetch events:', err);
                const errorMessage = err?.message || 'Could not load events. Please try again later.';
                setError(errorMessage);
                setEvents([]); // Set empty array on error so component still renders
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
    }, []);

    // Fetch booked event details for countdown banner
    useEffect(() => {
        console.log('[Events] bookedEventId changed:', bookedEventId);
        if (bookedEventId) {
            const fetchBookedEvent = async () => {
                try {
                    console.log('[Events] Fetching booked event details for:', bookedEventId);
                    const data = await eventService.getEventById(bookedEventId);
                    console.log('[Events] Fetched booked event:', data);
                    setBookedEvent(data);
                } catch (err) {
                    console.error('[Events] Failed to fetch booked event:', err);
                    setBookedEvent(null);
                }
            };
            fetchBookedEvent();
        } else {
            // If no bookedEventId, try to find the most recent booked event from bookedEventIds
            if (bookedEventIds.size > 0) {
                const mostRecentBookedId = Array.from(bookedEventIds)[0];
                console.log('[Events] No bookedEventId prop, using most recent booked event:', mostRecentBookedId);
                const fetchBookedEvent = async () => {
                    try {
                        const data = await eventService.getEventById(mostRecentBookedId);
                        setBookedEvent(data);
                    } catch (err) {
                        console.error('[Events] Failed to fetch booked event:', err);
                        setBookedEvent(null);
                    }
                };
                fetchBookedEvent();
            } else {
                console.log('[Events] No bookedEventId and no booked events, clearing bookedEvent');
                setBookedEvent(null);
            }
        }
    }, [bookedEventId, bookedEventIds]);

    // Countdown timer for booked events
    useEffect(() => {
        if (!bookedEvent) {
            console.log('[Events] No bookedEvent, clearing countdown');
            setTimeUntilEvent(0);
            setCanJoin(false);
            return;
        }

        console.log('[Events] Setting up countdown for event:', bookedEvent.name, 'Date:', bookedEvent.date);

        const updateCountdown = () => {
            const eventDate = new Date(bookedEvent.date);
            const now = new Date();
            const diffMs = eventDate.getTime() - now.getTime();
            const diffSeconds = Math.floor(diffMs / 1000);

            setTimeUntilEvent(diffSeconds);

            // Can join 15 minutes (900 seconds) before event starts
            const canJoinNow = diffSeconds <= 900 && diffSeconds > 0;
            setCanJoin(canJoinNow);

            if (diffSeconds <= 900 && diffSeconds > 0) {
                console.log('[Events] Join button should be active. Time remaining:', diffSeconds, 'seconds');
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);

        return () => clearInterval(interval);
    }, [bookedEvent]);

    const categories = [
        { id: 'music', label: 'Music', icon: Music },
        { id: 'sports', label: 'Sports', icon: Dumbbell },
        { id: 'food', label: 'Food', icon: Coffee },
        { id: 'business', label: 'Business', icon: BarChart },
    ];

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

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

    // Helper function to format location (handles both string and GeoJSON object)
    const formatLocation = (location: any): string => {
        if (!location) return 'Sheffield, UK';

        // If it's already a string, return it
        if (typeof location === 'string') {
            return location;
        }

        // If it's a GeoJSON object with coordinates
        if (location && typeof location === 'object' && location.coordinates && Array.isArray(location.coordinates)) {
            // For now, just return a default location since we don't have reverse geocoding
            // In production, you'd want to reverse geocode the coordinates to get a city name
            return 'Sheffield, UK';
        }

        // Fallback
        return 'Sheffield, UK';
    };

    if (loading) {
        return (
            <div className="events-container">
                <div className="events-loading">
                    <Loader2 className="animate-spin" size={40} />
                    <p>Loading events...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="events-container">
                <div className="events-error glass">
                    <p>{error}</p>
                    <button className="vibrant-btn" onClick={() => {
                        setLoading(true);
                        setError(null);
                        // Retry fetching
                        eventService.getAllEvents()
                            .then(data => {
                                setEvents(Array.isArray(data) ? data : []);
                                setError(null);
                            })
                            .catch(err => {
                                console.error('Retry failed:', err);
                                setError(err?.message || 'Could not load events. Please try again later.');
                            })
                            .finally(() => setLoading(false));
                    }}>Retry</button>
                </div>
            </div>
        );
    }

    // Safety check: ensure we always have events array
    const safeEvents = Array.isArray(events) ? events : [];

    // Debug logging for banner rendering
    console.log('[Events] Render state:', {
        bookedEvent: !!bookedEvent,
        bookedEventId,
        timeUntilEvent,
        canJoin,
        bookedEventName: bookedEvent?.name
    });

    return (
        <div className="events-container">
            {/* Animated background orbs */}
            <div className="events-orbs">
                <div className="events-orb events-orb-1" />
                <div className="events-orb events-orb-2" />
                <div className="events-orb events-orb-3" />
            </div>

            {/* Content wrapper for z-index layering */}
            <div className="events-content">
                {/* Countdown Banner for Booked Events */}
                {bookedEvent && (
                    <div className="events-countdown-banner">
                        <div className="countdown-content">
                            <div className="countdown-info">
                                <span className="countdown-label">
                                    {timeUntilEvent > 0 ? 'Next event starts in' : 'Event is starting'}
                                </span>
                                <span className="countdown-time">{formatCountdown(timeUntilEvent)}</span>
                            </div>
                            <div className="countdown-actions">
                                <button
                                    className={`countdown-join-btn ${canJoin ? '' : 'disabled'}`}
                                    onClick={() => bookedEventId && onJoinWaitingRoom(bookedEventId)}
                                    disabled={!canJoin}
                                >
                                    Join
                                </button>
                                <button
                                    className="countdown-test-btn"
                                    onClick={() => bookedEventId && onJoinWaitingRoom(bookedEventId)}
                                    title="Skip to waiting room (testing only)"
                                >
                                    Test
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* User Profile Header */}
                <div className="events-header-wrapper">
                    <div className="events-header-bg"></div>
                    <div className="events-profile-header">
                        <div className="profile-info-absolute">
                            <div className="profile-avatar">
                                {currentUser?.profilePicture ? (
                                    <img
                                        src={currentUser.profilePicture}
                                        alt={currentUser.name || 'User'}
                                        onError={(e) => {
                                            // Fallback to placeholder if image fails to load
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                            const placeholder = target.nextElementSibling as HTMLElement;
                                            if (placeholder) placeholder.style.display = 'flex';
                                        }}
                                    />
                                ) : null}
                                <div className="avatar-placeholder" style={{ display: currentUser?.profilePicture ? 'none' : 'flex' }}>
                                    {(currentUser?.name || 'U')[0].toUpperCase()}
                                </div>
                            </div>
                            <div className="profile-text-container">
                                <h2 className="profile-name-full">
                                    <span className="greeting">Hello,</span>
                                    {' '}
                                    {currentUser?.name || 'Guest User'}
                                </h2>
                                <p className="profile-location-below">
                                    <MapPin size={12} />
                                    {formatLocation(currentUser?.location)}
                                </p>
                            </div>
                        </div>
                        <div className="profile-actions">
                            <button className="icon-btn-circle glass-action">
                                <MessageSquare size={20} />
                            </button>
                            <button className="icon-btn-circle glass-action" onClick={onNotificationsClick}>
                                <Bell size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="events-search-bar">
                        <div className="search-input-wrapper glass">
                            <Search size={18} className="search-icon" />
                            <input
                                type="text"
                                placeholder="Find an event or location"
                                className="search-input"
                            />
                        </div>
                        <button className="filter-btn glass">
                            <Filter size={18} />
                        </button>
                    </div>
                </div>

                {/* Categories */}
                <div className="events-categories">
                    <h3 className="section-title">Categories</h3>
                    <div className="categories-scroll">
                        {categories.map((category) => {
                            const Icon = category.icon;
                            return (
                                <button key={category.id} className="category-item">
                                    <div className="category-icon">
                                        <Icon size={24} />
                                    </div>
                                    <span className="category-label">{category.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Upcoming Events */}
                <div className="events-section">
                    <div className="section-header">
                        <h3 className="section-title">Upcoming Events</h3>
                        <button className="see-more-btn">See More</button>
                    </div>

                    <div className="events-list">
                        {safeEvents.length === 0 ? (
                            <div className="no-events glass-dark">
                                <div className="no-events-icon">
                                    <Calendar size={48} />
                                    <Sparkles size={24} className="sparkle-icon" />
                                </div>
                                <h3 className="no-events-title">No Events Yet</h3>
                                <p className="no-events-message">We're working on bringing you amazing events. Check back soon for the latest gatherings and experiences!</p>
                                <div className="no-events-tip">
                                    <Bell size={16} />
                                    <span>Enable notifications to be the first to know</span>
                                </div>
                            </div>
                        ) : (
                            safeEvents.map((event) => {
                                const isBooked = event._id ? bookedEventIds.has(event._id) : false;
                                return (
                                    <div
                                        key={event._id}
                                        className={`event-card-new ${isBooked ? 'booked' : ''}`}
                                        onClick={() => {
                                            if (isBooked) {
                                                // Don't open detail if already booked, just show message or do nothing
                                                return;
                                            }
                                            if (event.isPasswordProtected) {
                                                setPasswordModal({ event, password: '' });
                                            } else {
                                                event._id && onJoin(event._id);
                                            }
                                        }}
                                    >
                                        <div className="event-image-wrapper">
                                            <img
                                                src={getImageUrl(event.imageUrl) || '/default-event.png'}
                                                alt={event.name}
                                                className="event-image"
                                                onError={(e) => {
                                                    console.warn('[Events] Image load failed:', event.imageUrl);
                                                    (e.target as HTMLImageElement).src = '/default-event.png';
                                                }}
                                            />
                                            <div className="event-tags">
                                                {isBooked && (
                                                    <span className="event-tag booked-tag" style={{
                                                        background: 'rgba(34, 197, 94, 0.2)',
                                                        color: '#15803d',
                                                        fontWeight: 700
                                                    }}>
                                                        ✓ Booked
                                                    </span>
                                                )}
                                                <span className="event-tag age-tag">
                                                    Age group: {event.minAge || 18}-{event.maxAge || 99}
                                                </span>
                                                <span className="event-tag orientation-tag">{event.eventType || 'Straight'}</span>
                                                {event.isPasswordProtected && (
                                                    <span className="event-tag private-tag">
                                                        <Lock size={12} />
                                                        Private
                                                    </span>
                                                )}
                                            </div>
                                            <button className="bookmark-btn">
                                                <Bookmark size={20} fill="currentColor" />
                                            </button>
                                        </div>

                                        <div className="event-overlay">
                                            <div className="event-date-box">
                                                {formatDate(event.date)}
                                            </div>
                                            <div className="event-content">
                                                <h3 className="event-title">{event.name}</h3>
                                                <div className="event-meta">
                                                    <span className="meta-item">
                                                        <MapPin size={14} />
                                                        {formatLocation(event.location)}
                                                    </span>
                                                    <span className="meta-item">
                                                        <Clock size={14} />
                                                        {formatTime(event.date)}
                                                    </span>
                                                </div>
                                                <div className="event-footer">
                                                    <div className="gender-pills">
                                                        {(() => {
                                                            const maleCount = Number(event.maleCount) || 0;
                                                            const maxMale = Number(event.maxMaleParticipants) || 10;
                                                            const isMaleFull = maxMale > 0 && maleCount >= maxMale;
                                                            return (
                                                                <span className={`gender-pill ${isMaleFull ? 'full' : 'available'}`}>
                                                                    <span className="gender-symbol">♂</span>
                                                                    {isMaleFull ? 'Full' : 'Available'}
                                                                </span>
                                                            );
                                                        })()}
                                                        {(() => {
                                                            const femaleCount = Number(event.femaleCount) || 0;
                                                            const maxFemale = Number(event.maxFemaleParticipants) || 10;
                                                            const isFemaleFull = maxFemale > 0 && femaleCount >= maxFemale;
                                                            return (
                                                                <span className={`gender-pill ${isFemaleFull ? 'full' : 'available'}`}>
                                                                    <span className="gender-symbol">♀</span>
                                                                    {isFemaleFull ? 'Full' : 'Available'}
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>
                                                    <div className="available-count">
                                                        Available: {(event.maxMaleParticipants || 10) + (event.maxFemaleParticipants || 10) - (event.maleCount || 0) - (event.femaleCount || 0)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Password Modal */}
            {passwordModal.event && (
                <div className="password-modal-overlay" onClick={() => setPasswordModal({ event: null, password: '' })}>
                    <div className="password-modal" onClick={e => e.stopPropagation()}>
                        <div className="password-modal-header">
                            <h3>Join {passwordModal.event.name}</h3>
                            <button onClick={() => setPasswordModal({ event: null, password: '' })}>×</button>
                        </div>
                        <div className="password-modal-body">
                            <p>This event requires a password to join.</p>
                            <div className="password-input-group">
                                <label>Enter Event Password</label>
                                <input
                                    type="password"
                                    value={passwordModal.password}
                                    onChange={(e) => setPasswordModal(prev => ({ ...prev, password: e.target.value }))}
                                    placeholder="Enter password..."
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter' && passwordModal.event?._id) {
                                            onJoin(passwordModal.event._id, passwordModal.password);
                                            setPasswordModal({ event: null, password: '' });
                                        }
                                    }}
                                />
                            </div>
                            <div className="password-modal-actions">
                                <button
                                    className="cancel-btn"
                                    onClick={() => setPasswordModal({ event: null, password: '' })}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="join-btn"
                                    onClick={() => {
                                        if (passwordModal.event?._id) {
                                            onJoin(passwordModal.event._id, passwordModal.password);
                                            setPasswordModal({ event: null, password: '' });
                                        }
                                    }}
                                    disabled={!passwordModal.password.trim()}
                                >
                                    Join Event
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
