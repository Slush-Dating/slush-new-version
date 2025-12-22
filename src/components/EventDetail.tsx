import { useState, useEffect } from 'react';
import { ArrowLeft, Bookmark, Calendar, MapPin, Loader2 } from 'lucide-react';
import { eventService, type EventData } from '../services/api';
import './EventDetail.css';

interface EventDetailProps {
    eventId: string;
    onBack: () => void;
    onBook: () => void;
    password?: string;
}

// Participants will be fetched from the API when event booking is implemented

export const EventDetail: React.FC<EventDetailProps> = ({ eventId, onBack, onBook, password }) => {
    const [event, setEvent] = useState<EventData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [booking, setBooking] = useState(false);
    const [isBooked, setIsBooked] = useState(false);

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

        const fetchBookingStatus = async () => {
            // Only check booking status if user is authenticated
            const token = localStorage.getItem('token');
            if (!token) {
                // User is not logged in, so they're not booked
                setIsBooked(false);
                return;
            }

            try {
                const status = await eventService.getBookingStatus(eventId);
                setIsBooked(status.isBooked);
            } catch (err: any) {
                console.error('Failed to fetch booking status:', err);
                // If authentication fails, clear invalid token locally
                if (err.message?.includes('Invalid token') || err.message?.includes('Not authenticated')) {
                    console.warn('Authentication token invalid, clearing stored credentials');
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setIsBooked(false);
                    // Show error message
                    setError('Your session has expired. Please refresh the page and log in again.');
                } else {
                    // For other errors, assume not booked
                    setIsBooked(false);
                }
            }
        };

        fetchEvent();
        fetchBookingStatus();
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
                        {event.description || 'You will virtually meet up to 10 different people. Each date will last 3 minutes and you will have an opportunity to decide whether or not you like the person. If you both like each other, you will match at the end of the session and can continue your conversation. Most importantly, have fun!'}
                    </p>
                    <div style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <span className="event-tag" style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.15)', color: '#1d4ed8', fontSize: '13px', fontWeight: 600 }}>
                            {event.eventType || 'Straight'} Event
                        </span>
                        <span className="event-tag" style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.15)', color: '#15803d', fontSize: '13px', fontWeight: 600 }}>
                            {(event.maxMaleParticipants || 10) - (event.maleCount || 0)} male slots
                        </span>
                        <span className="event-tag" style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(236, 72, 153, 0.15)', color: '#be185d', fontSize: '13px', fontWeight: 600 }}>
                            {(event.maxFemaleParticipants || 10) - (event.femaleCount || 0)} female slots
                        </span>
                    </div>
                </section>

                {/* Event Participants Section */}
                <section className="event-detail-section">
                    <h2 className="section-heading">Event participants</h2>
                    <div className="participants-scroll">
                        <p className="section-description" style={{ marginTop: '8px' }}>
                            Participants will be shown here once the event is booked.
                        </p>
                    </div>
                </section>
            </div>

            {/* Footer with Book Button */}
            <div className="event-detail-footer">
                <div className="footer-left">
                    <span className="footer-price">Free</span>
                    <span className="footer-subtitle">Join our free event</span>
                </div>
                <button
                    className={`footer-book-btn ${isBooked ? 'booked-btn' : 'vibrant-btn'}`}
                    onClick={async () => {
                        if (booking || isBooked) return;
                        setBooking(true);
                        try {
                            await eventService.bookEvent(eventId, password);
                            setIsBooked(true);
                            onBook();
                        } catch (err: any) {
                            alert(err.message || 'Failed to book event');
                        } finally {
                            setBooking(false);
                        }
                    }}
                    disabled={booking || isBooked}
                >
                    {booking ? 'Booking...' : isBooked ? 'Booked' : 'Book now'}
                </button>
            </div>
        </div>
    );
};

