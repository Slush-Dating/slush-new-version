import { motion } from 'framer-motion';
import { MessageCircle, Heart, Search } from 'lucide-react';
import './Matches.css';

interface Match {
    id: string;
    name: string;
    age: number;
    imageUrl: string;
    lastActive: string;
    isNew: boolean;
}

const DUMMY_MATCHES: Match[] = [
    { id: 'm1', name: 'Sophia', age: 23, imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80', lastActive: '2m ago', isNew: true },
    { id: 'm2', name: 'Emma', age: 26, imageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80', lastActive: '15m ago', isNew: true },
    { id: 'm3', name: 'Liam', age: 27, imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80', lastActive: '1h ago', isNew: false },
    { id: 'm4', name: 'Olivia', age: 24, imageUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80', lastActive: '3h ago', isNew: false },
    { id: 'm5', name: 'Noah', age: 25, imageUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80', lastActive: 'Yesterday', isNew: false },
];

export const Matches: React.FC<{ onChat: (matchId: string) => void }> = ({ onChat }) => {
    return (
        <motion.div
            className="matches-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <header className="matches-header">
                <h1 className="gradient-text">Matches</h1>
                <p>You have {DUMMY_MATCHES.length} connections</p>
            </header>

            <div className="discovery-search glass">
                <Search size={20} />
                <input type="text" placeholder="Search matches..." />
            </div>

            <section className="new-matches">
                <h3>New Sparks <Heart size={14} fill="var(--primary)" color="var(--primary)" /></h3>
                <div className="sparks-scroll">
                    {DUMMY_MATCHES.filter(m => m.isNew).map(match => (
                        <motion.div key={match.id} className="spark-item" whileTap={{ scale: 0.9 }}>
                            <div className="spark-avatar">
                                <img src={match.imageUrl} alt={match.name} />
                                <div className="new-indicator"></div>
                            </div>
                            <span>{match.name}</span>
                        </motion.div>
                    ))}
                </div>
            </section>

            <section className="matches-grid-section">
                <h3>Recent Activity</h3>
                <div className="matches-grid">
                    {DUMMY_MATCHES.map(match => (
                        <motion.div
                            key={match.id}
                            className="match-card glass"
                            onClick={() => onChat(match.id)}
                            whileHover={{ scale: 1.02 }}
                        >
                            <img src={match.imageUrl} alt={match.name} className="match-img" />
                            <div className="match-info-overlay">
                                <h4>{match.name}, {match.age}</h4>
                                <div className="match-status">
                                    <div className="online-dot"></div>
                                    <span>{match.lastActive}</span>
                                </div>
                            </div>
                            <button className="chat-shortcut">
                                <MessageCircle size={18} />
                            </button>
                        </motion.div>
                    ))}
                </div>
            </section>
        </motion.div>
    );
};
