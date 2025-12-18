import { useState, useEffect } from 'react';
import { MapPin, Clock, Bookmark, Search, Filter, MessageSquare, Bell, Music, Dumbbell, Coffee, BarChart, Loader2 } from 'lucide-react';
import { eventService, type EventData } from '../services/api';
import './Events.css';

interface User {
    name?: string;
    location?: string;
    profilePicture?: string;
    id?: string;
}

interface EventsProps {
    onJoin: (eventId: string) => void;
    user?: User;
    bookedEventId?: string | null;
    onJoinWaitingRoom: (eventId: string) => void;
}

export const Events: React.FC<EventsProps> = ({ onJoin, user, bookedEventId, onJoinWaitingRoom }) => {
    const [events, setEvents] = useState<EventData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [bookedEvent, setBookedEvent] = useState<EventData | null>(null);
    const [timeUntilEvent, setTimeUntilEvent] = useState<number>(0);
    const [canJoin, setCanJoin] = useState(false);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const data = await eventService.getAllEvents();
                setEvents(data);
                setError(null);
            } catch (err) {
                console.error('Failed to fetch events:', err);
                setError('Could not load events. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
    }, []);

    // Fetch booked event details
    useEffect(() => {
        if (bookedEventId) {
            const fetchBookedEvent = async () => {
                try {
                    const data = await eventService.getEventById(bookedEventId);
                    setBookedEvent(data);
                } catch (err) {
                    console.error('Failed to fetch booked event:', err);
                }
            };
            fetchBookedEvent();
        } else {
            setBookedEvent(null);
        }
    }, [bookedEventId]);

    // Countdown timer for booked events
    useEffect(() => {
        if (!bookedEvent) return;

        const updateCountdown = () => {
            const eventDate = new Date(bookedEvent.date);
            const now = new Date();
            const diffMs = eventDate.getTime() - now.getTime();
            const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));
            
            setTimeUntilEvent(diffSeconds);
            
            // Can join 15 minutes (900 seconds) before event starts
            setCanJoin(diffSeconds <= 900 && diffSeconds > 0);
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

    if (loading) {
        return (
            <div className="events-loading">
                <Loader2 className="animate-spin" size={40} />
                <p>Loading discovery feed...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="events-error glass">
                <p>{error}</p>
                <button className="vibrant-btn" onClick={() => window.location.reload()}>Retry</button>
            </div>
        );
    }

    return (
        <div className="events-container">
            {/* Countdown Banner for Booked Events */}
            {bookedEvent && (
                <div className="events-countdown-banner glass">
                    <div className="countdown-content">
                        <div className="countdown-info">
                            <span className="countdown-label">Next event starts in</span>
                            <span className="countdown-time">{formatCountdown(timeUntilEvent)}</span>
                        </div>
                        <div className="countdown-actions">
                            <button 
                                className={`countdown-join-btn vibrant-btn ${canJoin ? '' : 'disabled'}`}
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
            <div className="events-profile-header">
                <div className="profile-info">
                    <div className="profile-avatar">
                        {user?.profilePicture ? (
                            <img src={user.profilePicture} alt={user.name || 'User'} />
                        ) : (
                            <div className="avatar-placeholder">
                                {(user?.name || 'U')[0].toUpperCase()}
                            </div>
                        )}
                    </div>
                    <div className="profile-details">
                        <h2 className="profile-name">{user?.name || 'Guest User'}</h2>
                        <p className="profile-location">
                            {user?.locationString || 'Sheffield, UK'}
                        </p>
                    </div>
                </div>
                <div className="profile-actions">
                    <button className="icon-btn-circle">
                        <MessageSquare size={20} />
                    </button>
                    <button className="icon-btn-circle">
                        <Bell size={20} />
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="events-search-bar">
                <div className="search-input-wrapper">
                    <Search size={18} className="search-icon" />
                    <input 
                        type="text" 
                        placeholder="Search Location" 
                        className="search-input"
                    />
                </div>
                <button className="filter-btn">
                    <Filter size={18} />
                </button>
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
                    {events.length === 0 ? (
                        <div className="no-events glass">
                            <p>No upcoming events found. Check back later!</p>
                        </div>
                    ) : (
                        events.map((event) => (
                            <div
                                key={event._id}
                                className="event-card-new"
                                onClick={() => event._id && onJoin(event._id)}
                            >
                                <div className="event-image-wrapper">
                                    <img 
                                        src={event.imageUrl || '/default-event.png'} 
                                        alt={event.name}
                                        className="event-image"
                                    />
                                    <div className="event-tags">
                                        <span className="event-tag age-tag">Age group: 21-30</span>
                                        <span className="event-tag orientation-tag">Straight</span>
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
                                                {event.location}
                                            </span>
                                            <span className="meta-item">
                                                <Clock size={14} />
                                                {formatTime(event.date)}
                                            </span>
                                        </div>
                                        <div className="event-footer">
                                            <div className="gender-pills">
                                                <span className="gender-pill full">
                                                    <span className="gender-symbol">♂</span>
                                                    Full
                                                </span>
                                                <span className="gender-pill available">
                                                    <span className="gender-symbol">♀</span>
                                                    Available
                                                </span>
                                            </div>
                                            <div className="available-count">
                                                Available : 2
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
