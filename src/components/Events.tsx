import { motion } from 'framer-motion';
import { Calendar, MapPin, Users, Info, Ticket } from 'lucide-react';
import './Events.css';

interface Event {
    id: string;
    name: string;
    date: string;
    time: string;
    location: string;
    participants: number;
    imageUrl: string;
    category: string;
    description: string;
}

const DUMMY_EVENTS: Event[] = [
    {
        id: 'e1',
        name: 'Sunset Rooftop Mixer',
        date: 'Dec 22',
        time: '7:00 PM',
        location: 'Sky Lounge, Manhattan',
        participants: 45,
        imageUrl: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80',
        category: 'Speed Dating',
        description: 'Join us for an evening of connections under the stars. Perfect for singles looking for a refined experience.'
    },
    {
        id: 'e2',
        name: 'Tech & Soul Connection',
        date: 'Dec 24',
        time: '6:30 PM',
        location: 'The Hub, Brooklyn',
        participants: 30,
        imageUrl: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&q=80',
        category: 'Networking',
        description: 'A curated evening for the tech-savvy and soul-driven. Meet like-minded professionals in a relaxed setting.'
    }
];

export const Events: React.FC<{ onJoin: (eventId: string) => void }> = ({ onJoin }) => {
    return (
        <motion.div
            className="events-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <header className="events-header">
                <h1 className="gradient-text">Discovery</h1>
                <p>Book your spot for the next exclusive encounter</p>
            </header>

            <div className="events-list">
                {DUMMY_EVENTS.map((event) => (
                    <motion.div
                        key={event.id}
                        className="event-card-v2 glass"
                        whileHover={{ y: -4 }}
                    >
                        <div className="event-media">
                            <img src={event.imageUrl} alt={event.name} />
                            <div className="event-badge">{event.category}</div>
                        </div>
                        <div className="event-body">
                            <div className="event-main-info">
                                <h3>{event.name}</h3>
                                <p className="description">{event.description}</p>
                                <div className="meta-tags">
                                    <div className="meta-tag">
                                        <Calendar size={12} />
                                        <span>{event.date}</span>
                                    </div>
                                    <div className="meta-tag">
                                        <MapPin size={12} />
                                        <span>{event.location}</span>
                                    </div>
                                    <div className="meta-tag">
                                        <Users size={12} />
                                        <span>{event.participants}0% Full</span>
                                    </div>
                                </div>
                            </div>
                            <div className="event-actions">
                                <button className="secondary-btn">
                                    <Info size={16} /> Details
                                </button>
                                <button className="vibrant-btn book-btn" onClick={() => onJoin(event.id)}>
                                    <Ticket size={16} /> Book Now
                                </button>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
};
