import { useState, useEffect } from 'react';
import { LayoutDashboard, Calendar, Users, Upload, BarChart3, Clock, MapPin, Plus, Trash2 } from 'lucide-react';
import { eventService, type EventData } from '../services/api';
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
    const [events, setEvents] = useState<EventData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<Omit<EventData, '_id' | 'status'>>({
        name: '',
        date: '',
        location: '',
        imageUrl: '/default-event.png',
    });

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        setLoading(true);
        try {
            const data = await eventService.getAllEvents();
            setEvents(data);
            setError(null);
        } catch (err) {
            setError('Failed to load events');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleUpload = async () => {
        if (!formData.name || !formData.date || !formData.location) {
            alert('Please fill in all required fields');
            return;
        }

        setLoading(true);
        try {
            await eventService.createEvent(formData as EventData);
            setFormData({ name: '', date: '', location: '', imageUrl: '/default-event.png' });
            await fetchEvents();
            setError(null);
        } catch (err) {
            setError('Failed to create event');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this event?')) return;

        try {
            await eventService.deleteEvent(id);
            await fetchEvents();
        } catch (err) {
            alert('Failed to delete event');
            console.error(err);
        }
    };

    return (
        <div className="event-mgmt">
            <div className="event-form glass">
                <h3>Create New Event</h3>
                {error && <div className="error-message">{error}</div>}
                <div className="form-grid">
                    <div className="input-group">
                        <label>Event Name</label>
                        <input
                            name="name"
                            type="text"
                            placeholder="e.g. London Coffee Social"
                            className="glass"
                            value={formData.name}
                            onChange={handleInputChange}
                        />
                    </div>
                    <div className="input-group">
                        <label>Date & Time</label>
                        <input
                            name="date"
                            type="datetime-local"
                            className="glass"
                            value={formData.date}
                            onChange={handleInputChange}
                        />
                    </div>
                    <div className="input-group">
                        <label>Location</label>
                        <div className="input-with-icon">
                            <MapPin size={16} />
                            <input
                                name="location"
                                type="text"
                                placeholder="Enter venue..."
                                className="glass"
                                value={formData.location}
                                onChange={handleInputChange}
                            />
                        </div>
                    </div>
                    <div className="input-group">
                        <label>Event Image URL</label>
                        <div className="input-with-icon">
                            <Upload size={16} />
                            <input
                                name="imageUrl"
                                type="text"
                                placeholder="https://..."
                                className="glass"
                                value={formData.imageUrl}
                                onChange={handleInputChange}
                            />
                        </div>
                    </div>
                </div>
                <button
                    className="vibrant-btn"
                    onClick={handleUpload}
                    disabled={loading}
                >
                    <Plus size={18} />
                    <span>{loading ? 'Uploading...' : 'Upload Event'}</span>
                </button>
            </div>

            <div className="event-list glass">
                <h3>Existing Events</h3>
                {loading && <p>Loading events...</p>}
                {!loading && events.length === 0 && <p>No events found.</p>}
                {!loading && events.length > 0 && (
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Image</th>
                                <th>Event Name</th>
                                <th>Date</th>
                                <th>Location</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.map(event => (
                                <tr key={event._id}>
                                    <td>
                                        <div className="table-thumbnail glass">
                                            <img src={event.imageUrl || '/default-event.png'} alt={event.name} />
                                        </div>
                                    </td>
                                    <td>{event.name}</td>
                                    <td>
                                        <div>{new Date(event.date).toLocaleDateString()}</div>
                                        <div className="table-time">{new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                    </td>
                                    <td>{event.location}</td>
                                    <td><span className={`badge ${event.status?.toLowerCase() || 'scheduled'}`}>{event.status || 'Scheduled'}</span></td>
                                    <td>
                                        <button className="text-btn icon-btn" onClick={() => handleDelete(event._id!)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
