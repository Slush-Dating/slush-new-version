import { useState } from 'react';
import { LayoutDashboard, Calendar, Users, Upload, BarChart3, Clock, MapPin, Plus } from 'lucide-react';
import './AdminPanel.css';

export const AdminPanel: React.FC = () => {
    const [activeView, setActiveView] = useState<'dashboard' | 'events'>('dashboard');

    return (
        <div className="admin-container">
            <aside className="admin-sidebar glass">
                <div className="admin-logo">
                    <h2 className="gradient-text">Nova Admin</h2>
                </div>
                <nav className="admin-nav">
                    <button
                        className={`admin-nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
                        onClick={() => setActiveView('dashboard')}
                    >
                        <LayoutDashboard size={20} />
                        <span>Dashboard</span>
                    </button>
                    <button
                        className={`admin-nav-item ${activeView === 'events' ? 'active' : ''}`}
                        onClick={() => setActiveView('events')}
                    >
                        <Calendar size={20} />
                        <span>Speed Dating</span>
                    </button>
                    <div className="nav-divider"></div>
                    <button className="admin-nav-item">
                        <Users size={20} />
                        <span>User Management</span>
                    </button>
                    <button className="admin-nav-item">
                        <BarChart3 size={20} />
                        <span>Analytics</span>
                    </button>
                </nav>
            </aside>

            <main className="admin-main">
                <header className="admin-header glass">
                    <h1>{activeView === 'dashboard' ? 'Overview' : 'Event Management'}</h1>
                    <div className="user-profile">
                        <div className="avatar glass">AD</div>
                        <span>Admin User</span>
                    </div>
                </header>

                <section className="admin-content">
                    {activeView === 'dashboard' ? <AdminDashboard /> : <EventUpload />}
                </section>
            </main>
        </div>
    );
};

const AdminDashboard = () => (
    <div className="dashboard-grid">
        <div className="stat-card">
            <div className="stat-icon-wrapper">
                <Users size={28} />
            </div>
            <div>
                <span className="stat-label">Total Users</span>
                <p className="stat-number">12,450</p>
                <span className="stat-change positive">+12% this week</span>
            </div>
        </div>
        <div className="stat-card">
            <div className="stat-icon-wrapper" style={{ background: '#fff0f3', color: 'var(--slush-red)' }}>
                <Clock size={28} />
            </div>
            <div>
                <span className="stat-label">Avg. Session</span>
                <p className="stat-number">18m 45s</p>
                <span className="stat-change positive">+5% from prev</span>
            </div>
        </div>
        <div className="stat-card">
            <div className="stat-icon-wrapper" style={{ background: '#fff9db', color: '#f59e0b' }}>
                <Calendar size={28} />
            </div>
            <div>
                <span className="stat-label">Upcoming Events</span>
                <p className="stat-number">8</p>
                <span className="stat-change">Next: Tomorrow 7PM</span>
            </div>
        </div>

        <div className="recent-activity">
            <h3>Recent Signups</h3>
            <div className="activity-list">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="activity-item">
                        <div className="small-avatar" style={{ background: `hsl(${i * 40}, 70%, 90%)` }}></div>
                        <div className="activity-text">
                            <strong>User_{i}</strong> just joined the app
                            <span>{i * 2} minutes ago</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

const EventUpload = () => {
    const [events] = useState([
        { id: 1, name: 'Sleek Speed Dating', date: '2025-12-25', location: 'Manhattan, NY' },
        { id: 2, name: 'Sunset Rooftop Meet', date: '2025-12-30', location: 'Brooklyn, NY' },
    ]);

    return (
        <div className="event-mgmt">
            <div className="event-form glass">
                <h3>Create New Event</h3>
                <div className="form-grid">
                    <div className="input-group">
                        <label>Event Name</label>
                        <input type="text" placeholder="e.g. London Coffee Social" className="glass" />
                    </div>
                    <div className="input-group">
                        <label>Date & Time</label>
                        <input type="datetime-local" className="glass" />
                    </div>
                    <div className="input-group">
                        <label>Location</label>
                        <div className="input-with-icon">
                            <MapPin size={16} />
                            <input type="text" placeholder="Enter venue..." className="glass" />
                        </div>
                    </div>
                    <div className="input-group">
                        <label>Highlight Video URL</label>
                        <div className="input-with-icon">
                            <Upload size={16} />
                            <input type="text" placeholder="https://..." className="glass" />
                        </div>
                    </div>
                </div>
                <button className="vibrant-btn">
                    <Plus size={18} />
                    <span>Upload Event</span>
                </button>
            </div>

            <div className="event-list glass">
                <h3>Existing Events</h3>
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Event Name</th>
                            <th>Date</th>
                            <th>Location</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {events.map(event => (
                            <tr key={event.id}>
                                <td>{event.name}</td>
                                <td>{event.date}</td>
                                <td>{event.location}</td>
                                <td><span className="badge active">Scheduled</span></td>
                                <td><button className="text-btn">Edit</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
