import { useState, useEffect } from 'react';
import { ArrowLeft, Bookmark, Calendar, MapPin, Clock, Users, Loader2 } from 'lucide-react';
import { eventService, type EventData } from '../services/api';
import './EventDetail.css';

interface EventDetailProps {
    eventId: string;
    onBack: () => void;
    onBook: () => void;
}

// Mock participants data - in production this would come from the API
const MOCK_PARTICIPANTS = [
    { id: '1', name: 'Alex', profilePicture: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80' },
    { id: '2', name: 'Sarah', profilePicture: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80' },
    { id: '3', name: 'Emma', profilePicture: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&q=80' },
    { id: '4', name: 'James', profilePicture: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&q=80' },
    { id: '5', name: 'Mia', profilePicture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&q=80' },
];

export const EventDetail: React.FC<EventDetailProps> = ({ eventId, onBack, onBook }) => {
    const [event, setEvent] = useState<EventData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isBookmarked, setIsBookmarked] = useState(false);

    useEffect(() => {
        const fetchEvent = async () => {
            try {
                const data = await eventService.getEventById(eventId);
                setEvent(data);
                setError(null);
            } catch (err) {
                console.error('Failed to fetch event:', err);
                setError('Could not load event details. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchEvent();
    }, [eventId]);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const formatDayOfWeek = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', { weekday: 'long' });
    };

    const formatTimeRange = (dateString: string) => {
        const date = new Date(dateString);
        const startTime = date.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
        // Assuming 1 hour duration - in production this would come from event data
        const endDate = new Date(date.getTime() + 63 * 60 * 1000); // 63 minutes later
        const endTime = endDate.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
        return `${startTime} - ${endTime}`;
    };

    if (loading) {
        return (
            <div className="event-detail-loading">
                <Loader2 className="animate-spin" size={40} />
                <p>Loading event details...</p>
            </div>
        );
    }

    if (error || !event) {
        return (
            <div className="event-detail-error glass">
                <p>{error || 'Event not found'}</p>
                <button className="vibrant-btn" onClick={onBack}>Go Back</button>
            </div>
        );
    }

    return (
        <div className="event-detail-container">
            {/* Header with Image */}
            <div className="event-detail-header">
                <div className="event-header-image">
                    <img 
                        src={event.imageUrl || '/default-event.png'} 
                        alt={event.name}
                    />
                    <div className="event-header-overlay"></div>
                </div>
                
                {/* Top Navigation */}
                <div className="event-detail-nav">
                    <button className="nav-back-btn" onClick={onBack}>
                        <ArrowLeft size={24} />
                    </button>
                    <button 
                        className={`nav-bookmark-btn ${isBookmarked ? 'bookmarked' : ''}`}
                        onClick={() => setIsBookmarked(!isBookmarked)}
                    >
                        <Bookmark size={22} fill={isBookmarked ? 'currentColor' : 'none'} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="event-detail-content">
                {/* Title */}
                <h1 className="event-detail-title">{event.name}</h1>

                {/* Date and Time */}
                <div className="event-detail-info-row">
                    <div className="info-item">
                        <Calendar size={20} className="info-icon" />
                        <div className="info-text">
                            <span className="info-primary">{formatDate(event.date)}</span>
                            <span className="info-secondary">{formatDayOfWeek(event.date)}, {formatTimeRange(event.date)}</span>
                        </div>
                    </div>
                </div>

                {/* Location */}
                <div className="event-detail-info-row">
                    <div className="info-item">
                        <MapPin size={20} className="info-icon" />
                        <span className="info-primary">{event.location}</span>
                    </div>
                </div>

                {/* About Event Section */}
                <section className="event-detail-section">
                    <h2 className="section-heading">About Event</h2>
                    <p className="section-description">
                        You will virtually meet up to 10 different people. Each date will last 3 minutes and you will have an opportunity to decide whether or not you like the person. If you both like each other, you will match at the end of the session and can continue your conversation. Most importantly, have fun!
                    </p>
                </section>

                {/* Event Participants Section */}
                <section className="event-detail-section">
                    <h2 className="section-heading">Event participants</h2>
                    <div className="participants-scroll">
                        {MOCK_PARTICIPANTS.map((participant) => (
                            <div key={participant.id} className="participant-avatar">
                                <img 
                                    src={participant.profilePicture} 
                                    alt={participant.name}
                                />
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* Footer with Book Button */}
            <div className="event-detail-footer">
                <div className="footer-left">
                    <span className="footer-price">Free</span>
                    <span className="footer-subtitle">Join our free event</span>
                </div>
                <button className="footer-book-btn vibrant-btn" onClick={onBook}>
                    Book now
                </button>
            </div>
        </div>
    );
};

