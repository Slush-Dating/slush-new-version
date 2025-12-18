import { motion } from 'framer-motion';
import { Settings, Edit2, MapPin, Heart, Star, ChevronRight, LogOut } from 'lucide-react';
import './Profile.css';

export const Profile: React.FC = () => {
    return (
        <motion.div
            className="profile-container"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
        >
            <header className="profile-header">
                <div className="header-image">
                    <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80" alt="Profile" />
                    <div className="header-overlay">
                        <button className="icon-btn glass"><Settings size={20} /></button>
                        <button className="icon-btn glass"><Edit2 size={20} /></button>
                    </div>
                </div>

                <div className="profile-basics glass">
                    <h1>Isabella, 25</h1>
                    <p className="location"><MapPin size={14} /> New York, NY</p>
                    <div className="stats">
                        <div className="stat-item">
                            <span className="stat-value">124</span>
                            <span className="stat-label">Matches</span>
                        </div>
                        <div className="stat-divider"></div>
                        <div className="stat-item">
                            <span className="stat-value">4.9</span>
                            <span className="stat-label">Rating</span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="profile-content">
                <section className="profile-section">
                    <h3>About Me</h3>
                    <p>Creative soul, coffee addict, and weekend hiker. Looking for someone who can match my energy and loves good conversation. ☕️✨</p>
                </section>

                <section className="profile-section">
                    <h3>Interests</h3>
                    <div className="interest-tags">
                        <span className="tag glass">Photography</span>
                        <span className="tag glass">Hiking</span>
                        <span className="tag glass">Jazz</span>
                        <span className="tag glass">Cooking</span>
                        <span className="tag glass">Travel</span>
                    </div>
                </section>

                <section className="profile-menu">
                    <div className="menu-item glass">
                        <div className="menu-left">
                            <div className="menu-icon vibrant-btn"><Heart size={18} /></div>
                            <span>My Likes</span>
                        </div>
                        <ChevronRight size={18} />
                    </div>
                    <div className="menu-item glass">
                        <div className="menu-left">
                            <div className="menu-icon vibrant-btn" style={{ background: 'var(--secondary)' }}><Star size={18} /></div>
                            <span>Premium Features</span>
                        </div>
                        <ChevronRight size={18} />
                    </div>
                    <div className="menu-item glass logout">
                        <div className="menu-left">
                            <div className="menu-icon"><LogOut size={18} /></div>
                            <span>Logout</span>
                        </div>
                    </div>
                </section>
            </main>
        </motion.div>
    );
};
