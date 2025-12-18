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

export const Events: React.FC<{ onJoin: (eventId: string) => void; user?: User }> = ({ onJoin, user }) => {
    const [events, setEvents] = useState<EventData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
                            {user?.location || 'London, UK'}
                            {user?.id && `, ${user.id}`}
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
