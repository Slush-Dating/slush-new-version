import { useState, useEffect } from 'react';
import { LayoutDashboard, Calendar, Users, Upload, BarChart3, Clock, MapPin, Plus, Trash2, Eye, Settings, LogOut, Lock } from 'lucide-react';
import type { EventData } from '../services/api';
import { getApiBaseUrl, getMediaBaseUrl, getAbsoluteMediaUrl } from '../services/apiConfig';
import { AdminLogin } from './AdminLogin';
import './AdminPanel.css';

export const AdminPanel: React.FC = () => {
    const [activeView, setActiveView] = useState<'dashboard' | 'events' | 'users' | 'reports' | 'system'>('dashboard');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [adminUser, setAdminUser] = useState<any>(null);
    const [sessionExpired, setSessionExpired] = useState(false);

    // Handle authentication errors (401) - auto logout
    const handleAuthError = () => {
        console.log('🔒 Admin session expired or invalid - logging out');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        setIsAuthenticated(false);
        setAdminUser(null);
        setSessionExpired(true);
    };

    // Check admin authentication on mount
    useEffect(() => {
        const adminToken = localStorage.getItem('adminToken');
        const adminUserData = localStorage.getItem('adminUser');

        if (adminToken && adminUserData) {
            try {
                const user = JSON.parse(adminUserData);
                if (user.isAdmin) {
                    setIsAuthenticated(true);
                    setAdminUser(user);
                } else {
                    // Clear invalid admin data
                    localStorage.removeItem('adminToken');
                    localStorage.removeItem('adminUser');
                }
            } catch (e) {
                localStorage.removeItem('adminToken');
                localStorage.removeItem('adminUser');
            }
        }
    }, []);

    const handleAdminLogin = (data: { token: string; user: any }) => {
        localStorage.setItem('adminToken', data.token);
        localStorage.setItem('adminUser', JSON.stringify(data.user));
        setIsAuthenticated(true);
        setAdminUser(data.user);
        setSessionExpired(false); // Clear session expired flag on login
    };

    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        setIsAuthenticated(false);
        setAdminUser(null);
    };

    // Enhanced fetch wrapper that handles 401 errors
    // NOTE: All child components can use this to make authenticated API calls
    // Example usage: const response = await fetchWithAuth(url, { method: 'POST', body: JSON.stringify(data) });
    // This automatically adds admin token and handles session expiration
    const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
        const adminToken = localStorage.getItem('adminToken');
        if (!adminToken) {
            handleAuthError();
            throw new Error('No admin token found');
        }

        const response = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            }
        });

        // Handle 401 Unauthorized - token expired or invalid
        if (response.status === 401) {
            handleAuthError();
            throw new Error('Session expired');
        }

        return response;
    };

    // Show login if not authenticated
    if (!isAuthenticated) {
        return <AdminLogin onLogin={handleAdminLogin} sessionExpired={sessionExpired} />;
    }

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
                    <button
                        className={`admin-nav-item ${activeView === 'users' ? 'active' : ''}`}
                        onClick={() => setActiveView('users')}
                    >
                        <Users size={20} />
                        <span>User Management</span>
                    </button>
                    <button
                        className={`admin-nav-item ${activeView === 'reports' ? 'active' : ''}`}
                        onClick={() => setActiveView('reports')}
                    >
                        <BarChart3 size={20} />
                        <span>Reports</span>
                    </button>
                    <button
                        className={`admin-nav-item ${activeView === 'system' ? 'active' : ''}`}
                        onClick={() => setActiveView('system')}
                    >
                        <Settings size={20} />
                        <span>System Tools</span>
                    </button>
                    <button className="admin-nav-item">
                        <BarChart3 size={20} />
                        <span>Analytics</span>
                    </button>
                </nav>
            </aside>

            <main className="admin-main">
                <header className="admin-header glass">
                    <h1>
                        {activeView === 'dashboard' ? 'Overview' :
                            activeView === 'events' ? 'Event Management' :
                                activeView === 'users' ? 'User Management' :
                                    activeView === 'reports' ? 'Reports Management' :
                                        'System Tools'}
                    </h1>
                    <div className="user-profile">
                        <div className="avatar glass">{adminUser?.name?.charAt(0).toUpperCase() || 'A'}</div>
                        <span>{adminUser?.name || adminUser?.email || 'Admin'}</span>
                        <button onClick={handleLogout} className="logout-btn" title="Logout">
                            <LogOut size={16} />
                        </button>
                    </div>
                </header>

                <section className="admin-content">
                    {activeView === 'dashboard' ? <AdminDashboard /> :
                        activeView === 'events' ? <EventUpload /> :
                            activeView === 'users' ? <UserManagement /> :
                                activeView === 'reports' ? <ReportsManagement /> :
                                    <SystemTools />}
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
            <div className="stat-content">
                <div className="stat-label">Total Users</div>
                <p className="stat-number">12,450</p>
                <span className="stat-change positive">+12% this week</span>
            </div>
        </div>
        <div className="stat-card">
            <div className="stat-icon-wrapper">
                <Clock size={28} />
            </div>
            <div className="stat-content">
                <div className="stat-label">Avg. Session</div>
                <p className="stat-number">18m 45s</p>
                <span className="stat-change positive">+5% from prev</span>
            </div>
        </div>
        <div className="stat-card">
            <div className="stat-icon-wrapper">
                <Calendar size={28} />
            </div>
            <div className="stat-content">
                <div className="stat-label">Upcoming Events</div>
                <p className="stat-number">8</p>
                <span className="stat-change neutral">Next: Tomorrow 7PM</span>
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
    const [activeTab, setActiveTab] = useState<'create' | 'history'>('history');
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<any>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [formData, setFormData] = useState<Omit<EventData, '_id' | 'status'> & { password?: string }>({
        name: '',
        date: '',
        location: '',
        imageUrl: '/default-event.png',
        description: '',
        eventType: 'straight',
        maxMaleParticipants: 10,
        maxFemaleParticipants: 10,
        minAge: 18,
        maxAge: 99,
        password: ''
    });

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        setLoading(true);
        try {
            const adminToken = localStorage.getItem('adminToken');
            if (!adminToken) {
                throw new Error('No admin authentication token found.');
            }

            const apiUrl = `${getApiBaseUrl()}/admin/events`;
            console.log('🔗 Fetching events from:', apiUrl);

            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`
                }
            });

            console.log('📡 Response status:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Error response:', errorText);
                throw new Error(`Failed to fetch events: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log('✅ Events fetched:', data);
            setEvents(data.events || []);
            setError(null);
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to load events';
            console.error('❌ Fetch events error:', err);
            setError(errorMessage);
            // Show more detailed error in console for debugging
            if (err.message?.includes('Failed to fetch') || err.message?.includes('ERR_CERT')) {
                console.error('💡 SSL/Certificate issue detected. Check browser console for certificate warnings.');
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchEventDetails = async (eventId: string) => {
        try {
            const adminToken = localStorage.getItem('adminToken');
            if (!adminToken) {
                throw new Error('No admin authentication token found.');
            }

            const apiUrl = `${getApiBaseUrl()}/admin/events/${eventId}/stats`;
            console.log('🔗 Fetching event details from:', apiUrl);

            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch event details: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            setSelectedEvent(data);
        } catch (err) {
            console.error('Failed to load event details:', err);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingImage(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const adminToken = localStorage.getItem('adminToken');

            // Check if admin token exists
            if (!adminToken) {
                throw new Error('No admin authentication token found. Please log in first.');
            }

            const response = await fetch(`${getApiBaseUrl()}/auth/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${adminToken}`
                },
                body: formData
            });

            if (!response.ok) {
                // Try to get error message from response
                let errorMessage = 'Upload failed';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {
                    // If response is not JSON, use status text
                    errorMessage = response.statusText || errorMessage;
                }

                // Provide more specific error messages
                if (response.status === 401) {
                    errorMessage = 'Authentication failed. Your session may have expired. Please log in again.';
                }

                throw new Error(errorMessage);
            }

            const data = await response.json();
            setFormData(prev => ({ ...prev, imageUrl: data.url }));
            setError(null);
        } catch (err: any) {
            console.error('Error uploading image:', err);
            const errorMessage = err.message || 'Failed to upload image. Please ensure you are logged in and try again.';
            setError(errorMessage);
            alert(errorMessage);
        } finally {
            setUploadingImage(false);
        }
    };

    const handleUpload = async () => {
        if (!formData.name || !formData.date || !formData.location) {
            alert('Please fill in all required fields');
            return;
        }

        setLoading(true);
        try {
            const adminToken = localStorage.getItem('adminToken');
            if (!adminToken) {
                throw new Error('No admin authentication token found. Please log in again.');
            }

            // Convert datetime-local value to UTC ISO string to prevent timezone shift
            // datetime-local gives format "YYYY-MM-DDTHH:mm" in local time
            // We need to convert it to UTC ISO string so server stores correct time
            let dateToSend = formData.date;
            if (formData.date && !formData.date.includes('Z') && !formData.date.includes('+')) {
                // Parse the local datetime and convert to UTC ISO string
                const localDate = new Date(formData.date);
                dateToSend = localDate.toISOString();
            }

            // Prepare event data, excluding password if empty
            const eventData: any = {
                name: formData.name,
                date: dateToSend,
                location: formData.location,
                imageUrl: formData.imageUrl || '/default-event.png',
                description: formData.description || '',
                eventType: formData.eventType || 'straight',
                maxMaleParticipants: formData.maxMaleParticipants || 10,
                maxFemaleParticipants: formData.maxFemaleParticipants || 10,
                minAge: formData.minAge || 18,
                maxAge: formData.maxAge || 99
            };

            // Only include password if provided
            if (formData.password && formData.password.trim()) {
                eventData.password = formData.password;
            }

            const apiUrl = `${getApiBaseUrl()}/events`;
            console.log('🔗 Creating event at:', apiUrl);

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`
                },
                body: JSON.stringify(eventData)
            });

            console.log('📡 Response status:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Error response:', errorText);
                let errorMessage = 'Failed to create event';
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {
                    errorMessage = `${errorMessage}: ${response.status} ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }

            const createdEvent = await response.json();
            console.log('✅ Event created:', createdEvent);

            setFormData({
                name: '',
                date: '',
                location: '',
                imageUrl: '/default-event.png',
                description: '',
                eventType: 'straight',
                maxMaleParticipants: 10,
                maxFemaleParticipants: 10,
                minAge: 18,
                maxAge: 99,
                password: ''
            });
            await fetchEvents();
            setError(null);
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to create event';
            console.error('❌ Create event error:', err);
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this event?')) return;

        try {
            const adminToken = localStorage.getItem('adminToken');
            if (!adminToken) {
                throw new Error('No admin authentication token found. Please log in again.');
            }

            const apiUrl = `${getApiBaseUrl()}/events/${id}`;
            console.log('🔗 Deleting event at:', apiUrl);

            const response = await fetch(apiUrl, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Error response:', errorText);
                let errorMessage = 'Failed to delete event';
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {
                    errorMessage = `${errorMessage}: ${response.status} ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }

            console.log('✅ Event deleted successfully');
            await fetchEvents();
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to delete event';
            console.error('❌ Delete event error:', err);
            alert(errorMessage);
        }
    };

    return (
        <div className="event-mgmt">
            <div className="tabs">
                <button
                    className={activeTab === 'history' ? 'active' : ''}
                    onClick={() => setActiveTab('history')}
                >
                    Event History
                </button>
                <button
                    className={activeTab === 'create' ? 'active' : ''}
                    onClick={() => setActiveTab('create')}
                >
                    Create Event
                </button>
            </div>

            {activeTab === 'create' && (
                <div className="event-form">
                    <h3>Create New Event</h3>
                    {error && <div className="error-message">{error}</div>}

                    <div className="form-section">
                        <div className="form-section-title">Basic Information</div>
                        <div className="form-grid">
                            <div className="input-group">
                                <label>Event Name</label>
                                <input
                                    name="name"
                                    type="text"
                                    placeholder="e.g. London Coffee Social"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div className="input-group">
                                <label>Date & Time</label>
                                <input
                                    name="date"
                                    type="datetime-local"
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
                                        value={formData.location}
                                        onChange={handleInputChange}
                                    />
                                </div>
                            </div>
                            <div className="input-group">
                                <label>Event Image</label>
                                <div className="image-upload-wrapper">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        id="event-image-upload"
                                        style={{ display: 'none' }}
                                    />
                                    <label htmlFor="event-image-upload" className="vibrant-btn small">
                                        <Upload size={16} />
                                        <span>{uploadingImage ? 'Uploading...' : 'Choose Image'}</span>
                                    </label>
                                    <div className="input-with-icon">
                                        <input
                                            name="imageUrl"
                                            type="text"
                                            placeholder="https://... or uploaded path"
                                            value={formData.imageUrl}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <div className="form-section-title">Event Details</div>
                        <div className="form-grid">
                            <div className="input-group">
                                <label>Event Type</label>
                                <select
                                    name="eventType"
                                    value={formData.eventType}
                                    onChange={(e) => setFormData(prev => ({ ...prev, eventType: e.target.value as 'straight' | 'gay' | 'bisexual' }))}
                                >
                                    <option value="straight">Straight</option>
                                    <option value="gay">Gay</option>
                                    <option value="bisexual">Bisexual</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label>Description</label>
                                <textarea
                                    name="description"
                                    placeholder="Describe your event..."
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                />
                            </div>
                            <div className="input-group">
                                <label>Event Password (Optional)</label>
                                <div className="input-with-icon">
                                    <Lock size={16} />
                                    <input
                                        type="password"
                                        placeholder="Leave empty for public event"
                                        value={formData.password}
                                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                    />
                                </div>
                                <small className="helper-text">
                                    Set a password to make this event private. Users will need to enter this password to book.
                                </small>
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <div className="form-section-title">Capacity & Age Restrictions</div>
                        <div className="form-grid">
                            <div className="input-group">
                                <label>Male Capacity</label>
                                <input
                                    name="maxMaleParticipants"
                                    type="number"
                                    min="1"
                                    max="50"
                                    placeholder="10"
                                    value={formData.maxMaleParticipants}
                                    onChange={(e) => setFormData(prev => ({ ...prev, maxMaleParticipants: parseInt(e.target.value) || 10 }))}
                                />
                            </div>
                            <div className="input-group">
                                <label>Female Capacity</label>
                                <input
                                    name="maxFemaleParticipants"
                                    type="number"
                                    min="1"
                                    max="50"
                                    placeholder="10"
                                    value={formData.maxFemaleParticipants}
                                    onChange={(e) => setFormData(prev => ({ ...prev, maxFemaleParticipants: parseInt(e.target.value) || 10 }))}
                                />
                            </div>
                            <div className="input-group">
                                <label>Min Age</label>
                                <input
                                    name="minAge"
                                    type="number"
                                    min="18"
                                    max="99"
                                    placeholder="18"
                                    value={formData.minAge}
                                    onChange={(e) => setFormData(prev => ({ ...prev, minAge: parseInt(e.target.value) || 18 }))}
                                />
                            </div>
                            <div className="input-group">
                                <label>Max Age</label>
                                <input
                                    name="maxAge"
                                    type="number"
                                    min="18"
                                    max="99"
                                    placeholder="99"
                                    value={formData.maxAge}
                                    onChange={(e) => setFormData(prev => ({ ...prev, maxAge: parseInt(e.target.value) || 99 }))}
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
            )}

            {activeTab === 'history' && (
                <div className="event-history">
                    <div className="event-stats-overview">
                        <div className="stat-card">
                            <h4>Total Events</h4>
                            <p className="stat-number">{events.length}</p>
                        </div>
                        <div className="stat-card">
                            <h4>Upcoming</h4>
                            <p className="stat-number">
                                {events.filter(e => new Date(e.date) > new Date()).length}
                            </p>
                        </div>
                        <div className="stat-card">
                            <h4>Completed</h4>
                            <p className="stat-number">
                                {events.filter(e => e.status === 'Completed').length}
                            </p>
                        </div>
                        <div className="stat-card">
                            <h4>Total Matches</h4>
                            <p className="stat-number">
                                {events.reduce((sum, e) => sum + (e.matches || 0), 0)}
                            </p>
                        </div>
                    </div>

                    <div className="event-history-list">
                        {loading ? (
                            <div className="loading">Loading events...</div>
                        ) : events.length === 0 ? (
                            <div className="no-events">No events found.</div>
                        ) : (
                            events.map(event => (
                                <div key={event._id} className="event-history-card">
                                    <div className="event-history-header">
                                        <div className="event-info">
                                            <h4>{event.name}</h4>
                                            <div className="event-meta">
                                                <span>{new Date(event.date).toLocaleDateString()}</span>
                                                <span>{event.location}</span>
                                                <span className={`status-badge ${event.status?.toLowerCase()}`}>
                                                    {event.status}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="event-stats">
                                            <div className="stat">
                                                <span className="stat-label">Bookings</span>
                                                <span className="stat-value">{event.bookings || 0}</span>
                                            </div>
                                            <div className="stat">
                                                <span className="stat-label">Matches</span>
                                                <span className="stat-value">{event.matches || 0}</span>
                                            </div>
                                            <div className="stat">
                                                <span className="stat-label">Match Rate</span>
                                                <span className="stat-value">
                                                    {event.bookings > 0 ? ((event.matches / event.bookings) * 100).toFixed(1) : 0}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="event-history-actions">
                                        <button
                                            className="view-details-btn"
                                            onClick={() => fetchEventDetails(event._id)}
                                        >
                                            View Details
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'create' && (
                <div className="event-list">
                    <h3>Existing Events</h3>
                    {loading && <p>Loading events...</p>}
                    {!loading && events.length === 0 && <p className="no-events">No events found.</p>}
                    {!loading && events.length > 0 && (
                        <div className="event-grid">
                            {events.map(event => (
                                <div key={event._id} className="event-card">
                                    <div className="event-card-status">
                                        <span className={`badge ${event.status?.toLowerCase() || 'scheduled'}`}>{event.status || 'Scheduled'}</span>
                                        {event.isPasswordProtected && (
                                            <span className="badge password-protected">
                                                <Lock size={12} />
                                                <span>Private</span>
                                            </span>
                                        )}
                                    </div>
                                    <div className="event-card-header">
                                        <div className="event-card-image">
                                            <img src={getAbsoluteMediaUrl(event.imageUrl || '/default-event.png')} alt={event.name} />
                                        </div>
                                        <div className="event-card-title">
                                            <h4>{event.name}</h4>
                                            <div className="event-card-meta">
                                                <div className="event-card-meta-item">
                                                    <Calendar size={16} />
                                                    <span>{new Date(event.date).toLocaleDateString()} at {new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <div className="event-card-meta-item">
                                                    <MapPin size={16} />
                                                    <span>{event.location}</span>
                                                </div>
                                                {event.isPasswordProtected && (
                                                    <div className="event-card-meta-item">
                                                        <Lock size={16} />
                                                        <span>Password Protected</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="event-card-actions">
                                        <button className="view-btn">
                                            <Eye size={16} />
                                            <span>View Details</span>
                                        </button>
                                        <button className="delete-btn" onClick={() => handleDelete(event._id!)}>
                                            <Trash2 size={16} />
                                            <span>Delete</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {selectedEvent && (
                <div className="event-modal" onClick={() => setSelectedEvent(null)}>
                    <div className="modal-content large" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{selectedEvent.event?.name} - Detailed Statistics</h3>
                            <button onClick={() => setSelectedEvent(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="event-stats-grid">
                                <div className="stat-section">
                                    <h4>Participation</h4>
                                    <div className="stats-grid">
                                        <div className="stat-item">
                                            <span>Total Bookings:</span>
                                            <strong>{selectedEvent.stats?.totalBookings || 0}</strong>
                                        </div>
                                        <div className="stat-item">
                                            <span>Male:</span>
                                            <strong>{selectedEvent.stats?.maleBookings || 0}</strong>
                                        </div>
                                        <div className="stat-item">
                                            <span>Female:</span>
                                            <strong>{selectedEvent.stats?.femaleBookings || 0}</strong>
                                        </div>
                                        <div className="stat-item">
                                            <span>Other:</span>
                                            <strong>{selectedEvent.stats?.otherBookings || 0}</strong>
                                        </div>
                                    </div>
                                </div>

                                <div className="stat-section">
                                    <h4>Matches</h4>
                                    <div className="stats-grid">
                                        <div className="stat-item">
                                            <span>Total Matches:</span>
                                            <strong>{selectedEvent.stats?.totalMatches || 0}</strong>
                                        </div>
                                        <div className="stat-item">
                                            <span>Match Rate:</span>
                                            <strong>{selectedEvent.stats?.matchRate || 0}%</strong>
                                        </div>
                                    </div>
                                </div>

                                <div className="stat-section">
                                    <h4>Age Distribution</h4>
                                    <div className="age-chart">
                                        {selectedEvent.stats?.ageGroups && Object.entries(selectedEvent.stats.ageGroups).map(([age, count]) => (
                                            <div key={age} className="age-bar">
                                                <span>{age}:</span>
                                                <div className="bar">
                                                    <div
                                                        className="fill"
                                                        style={{ width: `${(count as number / selectedEvent.stats.totalBookings) * 100}%` }}
                                                    ></div>
                                                </div>
                                                <span>{count as number}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="recent-activity">
                                <h4>Recent Matches</h4>
                                <div className="matches-list">
                                    {selectedEvent.matches?.slice(0, 10).map((match: any) => (
                                        <div key={match._id} className="match-item">
                                            <span>{match.user1?.name} matched with {match.user2?.name}</span>
                                            <small>{new Date(match.matchedAt).toLocaleDateString()}</small>
                                        </div>
                                    )) || <p>No matches yet</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const UserManagement = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [userDetails, setUserDetails] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('all');
    const [selectedMedia, setSelectedMedia] = useState<any>(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const adminToken = localStorage.getItem('adminToken');
            if (!adminToken) {
                throw new Error('No admin authentication token found.');
            }

            const response = await fetch(`${getApiBaseUrl()}/admin/users`, {
                headers: {
                    'Authorization': `Bearer ${adminToken}`
                }
            });
            const data = await response.json();
            setUsers(data.users);
        } catch (err) {
            console.error('Failed to fetch users:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchUserDetails = async (userId: string) => {
        try {
            const adminToken = localStorage.getItem('adminToken');
            if (!adminToken) {
                throw new Error('No admin authentication token found.');
            }

            const response = await fetch(`${getApiBaseUrl()}/admin/users/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${adminToken}`
                }
            });
            const data = await response.json();
            console.log('User details fetched:', data);
            console.log('Photos:', data.user?.photos);
            console.log('Videos:', data.user?.videos);
            setUserDetails(data);
        } catch (err) {
            console.error('Failed to fetch user details:', err);
        }
    };

    const handleUserAction = async (userId: string, action: string) => {
        const reason = prompt(`Reason for ${action}:`);
        if (!reason) return;

        try {
            const adminToken = localStorage.getItem('adminToken');
            if (!adminToken) {
                throw new Error('No admin authentication token found.');
            }

            const response = await fetch(`${getApiBaseUrl()}/admin/users/${userId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`
                },
                body: JSON.stringify({ action, reason })
            });

            if (response.ok) {
                alert(`User ${action} successfully`);
                fetchUsers();
            } else {
                alert('Failed to update user');
            }
        } catch (err) {
            console.error('Failed to update user:', err);
            alert('Error updating user');
        }
    };

    const filteredUsers = users.filter(user => {
        const matchesSearch = !searchTerm ||
            user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesFilter = filter === 'all' ||
            (filter === 'premium' && user.isPremium) ||
            (filter === 'reported' && user.reportsAgainst > 0);

        return matchesSearch && matchesFilter;
    });

    return (
        <div className="user-management">
            <div className="filters-section">
                <div className="search-bar">
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="filter-buttons">
                    <button
                        className={filter === 'all' ? 'active' : ''}
                        onClick={() => setFilter('all')}
                    >
                        All Users
                    </button>
                    <button
                        className={filter === 'premium' ? 'active' : ''}
                        onClick={() => setFilter('premium')}
                    >
                        Premium
                    </button>
                    <button
                        className={filter === 'reported' ? 'active' : ''}
                        onClick={() => setFilter('reported')}
                    >
                        Reported
                    </button>
                </div>
            </div>

            <div className="users-table">
                <div className="table-header">
                    <div>Name</div>
                    <div>Email</div>
                    <div>Status</div>
                    <div>Premium</div>
                    <div>Reports</div>
                    <div>Actions</div>
                </div>
                {loading ? (
                    <div className="loading">Loading users...</div>
                ) : (
                    filteredUsers.map(user => (
                        <div key={user._id} className="table-row">
                            <div className="user-info">
                                <strong>{user.name || 'No name'}</strong>
                                <span className="user-meta">
                                    Joined {new Date(user.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                            <div>{user.email}</div>
                            <div>
                                <span className={`status-badge ${user.status || 'active'}`}>
                                    {user.status || 'Active'}
                                </span>
                            </div>
                            <div>{user.isPremium ? 'Yes' : 'No'}</div>
                            <div>{user.reportsAgainst || 0}</div>
                            <div className="action-buttons">
                                <button
                                    className="view-btn"
                                    onClick={() => {
                                        setSelectedUser(user);
                                        fetchUserDetails(user._id);
                                    }}
                                >
                                    View Profile
                                </button>
                                <button
                                    className="action-btn suspend"
                                    onClick={() => handleUserAction(user._id, 'suspended')}
                                >
                                    Suspend
                                </button>
                                <button
                                    className="action-btn ban"
                                    onClick={() => handleUserAction(user._id, 'banned')}
                                >
                                    Ban
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {selectedUser && userDetails && (
                <div className="user-modal" onClick={() => setSelectedUser(null)}>
                    <div className="modal-content large" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{userDetails.user?.name || 'User Profile'}</h3>
                            <button onClick={() => setSelectedUser(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="user-profile-grid">
                                {/* Basic Information */}
                                <div className="profile-section">
                                    <h4>Basic Information</h4>
                                    <div className="profile-details">
                                        <p><strong>Email:</strong> {userDetails.user?.email}</p>
                                        <p><strong>Name:</strong> {userDetails.user?.name || 'Not provided'}</p>
                                        <p><strong>Gender:</strong> {userDetails.user?.gender || 'Not specified'}</p>
                                        <p><strong>Interested In:</strong> {userDetails.user?.interestedIn || 'Not specified'}</p>
                                        <p><strong>Date of Birth:</strong> {userDetails.user?.dob ? new Date(userDetails.user.dob).toLocaleDateString() : 'Not provided'}</p>
                                        <p><strong>Location:</strong> {userDetails.user?.location ? `${userDetails.user.location.coordinates[1]}, ${userDetails.user.location.coordinates[0]}` : 'Not provided'}</p>
                                        <p><strong>Premium:</strong> {userDetails.user?.isPremium ? 'Yes' : 'No'}</p>
                                        <p><strong>Status:</strong> {userDetails.user?.status || 'Active'}</p>
                                        <p><strong>Onboarding Completed:</strong> {userDetails.user?.onboardingCompleted ? 'Yes' : 'No'}</p>
                                        <p><strong>Joined:</strong> {new Date(userDetails.user?.createdAt).toLocaleDateString()}</p>
                                    </div>
                                </div>

                                {/* Bio and Prompts */}
                                {(userDetails.user?.bio || (userDetails.user?.prompts && userDetails.user.prompts.length > 0)) && (
                                    <div className="profile-section">
                                        <h4>About</h4>
                                        {userDetails.user?.bio && (
                                            <div className="bio-section">
                                                <h5>Bio</h5>
                                                <p>{userDetails.user.bio}</p>
                                            </div>
                                        )}
                                        {userDetails.user?.prompts && userDetails.user.prompts.length > 0 && (
                                            <div className="prompts-section">
                                                <h5>Prompts</h5>
                                                {userDetails.user.prompts.map((prompt: any, index: number) => (
                                                    <div key={index} className="prompt-item">
                                                        <strong>{prompt.question}</strong>
                                                        <p>{prompt.answer}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Interests */}
                                {userDetails.user?.interests && userDetails.user.interests.length > 0 && (
                                    <div className="profile-section">
                                        <h4>Interests</h4>
                                        <div className="interests-grid">
                                            {userDetails.user.interests.map((interest: string, index: number) => (
                                                <span key={index} className="interest-tag">{interest}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Statistics */}
                                <div className="profile-section">
                                    <h4>Statistics</h4>
                                    <div className="stats-grid">
                                        <div className="stat-item">
                                            <span>Events Attended</span>
                                            <strong>{userDetails.stats?.eventsAttended || 0}</strong>
                                        </div>
                                        <div className="stat-item">
                                            <span>Matches</span>
                                            <strong>{userDetails.stats?.matches || 0}</strong>
                                        </div>
                                        <div className="stat-item">
                                            <span>Reports Made</span>
                                            <strong>{userDetails.stats?.reportsMade || 0}</strong>
                                        </div>
                                        <div className="stat-item">
                                            <span>Reports Against</span>
                                            <strong>{userDetails.stats?.reportsAgainst || 0}</strong>
                                        </div>
                                    </div>
                                </div>

                                {/* Media Gallery - Always show, even if empty */}
                                <div className="profile-section full-width">
                                    {(() => {
                                        // Filter out empty/null/undefined values
                                        const photos = (userDetails.user?.photos || []).filter((p: string) => p && p.trim());
                                        const videos = (userDetails.user?.videos || []).filter((v: string) => v && v.trim());
                                        const totalMedia = photos.length + videos.length;

                                        return (
                                            <>
                                                <h4>Media ({totalMedia} items)</h4>
                                                {totalMedia > 0 ? (
                                                    <div className="media-gallery">
                                                        {/* Photos */}
                                                        {photos.map((photo: string, index: number) => {
                                                            // Handle different URL formats
                                                            const photoUrl = photo
                                                                ? (photo.startsWith('http') ? photo : `${getMediaBaseUrl()}${photo.startsWith('/') ? photo : '/' + photo}`)
                                                                : null;

                                                            return photoUrl ? (
                                                                <div key={`photo-${index}`} className="media-item">
                                                                    <img
                                                                        src={photoUrl}
                                                                        alt={`Photo ${index + 1}`}
                                                                        onClick={() => setSelectedMedia({ type: 'photo', url: photo, index })}
                                                                        onError={(e) => {
                                                                            console.error('Failed to load photo:', photoUrl);
                                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                                        }}
                                                                    />
                                                                </div>
                                                            ) : null;
                                                        })}

                                                        {/* Videos */}
                                                        {videos.map((video: string, index: number) => {
                                                            // Handle different URL formats
                                                            const videoUrl = video
                                                                ? (video.startsWith('http') ? video : `${getMediaBaseUrl()}${video.startsWith('/') ? video : '/' + video}`)
                                                                : null;

                                                            return videoUrl ? (
                                                                <div
                                                                    key={`video-${index}`}
                                                                    className="media-item video-item"
                                                                    onClick={() => setSelectedMedia({ type: 'video', url: video, index })}
                                                                >
                                                                    <video
                                                                        src={videoUrl}
                                                                        muted
                                                                        preload="metadata"
                                                                        playsInline
                                                                        onError={(e) => {
                                                                            console.error('Failed to load video:', videoUrl);
                                                                            (e.target as HTMLVideoElement).style.display = 'none';
                                                                        }}
                                                                    />
                                                                    <div className="video-overlay">
                                                                        <span>▶️</span>
                                                                    </div>
                                                                </div>
                                                            ) : null;
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="no-media-message">
                                                        <p>No photos or videos uploaded</p>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>

                                {/* Recent Activity */}
                                {(userDetails.recentBookings?.length > 0 || userDetails.recentMatches?.length > 0) && (
                                    <div className="profile-section">
                                        <h4>Recent Activity</h4>
                                        {userDetails.recentBookings?.length > 0 && (
                                            <div className="activity-section">
                                                <h5>Recent Event Bookings</h5>
                                                {userDetails.recentBookings.map((booking: any) => (
                                                    <div key={booking._id} className="activity-item">
                                                        <strong>{booking.eventId?.name}</strong>
                                                        <span>{new Date(booking.eventId?.date).toLocaleDateString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {userDetails.recentMatches?.length > 0 && (
                                            <div className="activity-section">
                                                <h5>Recent Matches</h5>
                                                {userDetails.recentMatches.map((match: any) => {
                                                    const otherUser = match.user1._id === userDetails.user._id ? match.user2 : match.user1;
                                                    return (
                                                        <div key={match._id} className="activity-item">
                                                            <span>Matched with {otherUser.name}</span>
                                                            <small>{new Date(match.matchedAt).toLocaleDateString()}</small>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Media Viewing Modal */}
            {selectedMedia && (() => {
                // Helper function to construct media URL
                const getMediaUrl = (url: string) => {
                    if (!url) return '';
                    if (url.startsWith('http')) return url;
                    return `${getMediaBaseUrl()}${url.startsWith('/') ? url : '/' + url}`;
                };

                const mediaUrl = getMediaUrl(selectedMedia.url);
                console.log('Opening media modal:', { type: selectedMedia.type, url: selectedMedia.url, constructedUrl: mediaUrl });

                return (
                    <div className="media-modal" onClick={() => setSelectedMedia(null)}>
                        <div className="modal-content large" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>{selectedMedia.type === 'photo' ? 'Photo' : 'Video'} - {userDetails?.user?.name}</h3>
                                <button onClick={() => setSelectedMedia(null)}>×</button>
                            </div>
                            <div className="modal-body">
                                <div className="media-full-view">
                                    {selectedMedia.type === 'photo' ? (
                                        <img
                                            src={mediaUrl}
                                            alt="User media"
                                            className="full-media"
                                            onError={(e) => {
                                                console.error('Failed to load photo in modal:', mediaUrl);
                                                (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect width="400" height="300" fill="%23f0f0f0"/%3E%3Ctext x="200" y="150" text-anchor="middle" dy=".3em" fill="%23666" font-family="Arial" font-size="16"%3EFailed to load image%3C/text%3E%3C/svg%3E';
                                            }}
                                        />
                                    ) : (
                                        <div className="video-container">
                                            <video
                                                key={mediaUrl}
                                                src={mediaUrl}
                                                controls
                                                autoPlay
                                                playsInline
                                                preload="metadata"
                                                className="full-media"
                                                crossOrigin="anonymous"
                                                onError={(e) => {
                                                    console.error('Failed to load video in modal:', {
                                                        url: selectedMedia.url,
                                                        constructedUrl: mediaUrl,
                                                        error: e
                                                    });
                                                    const videoEl = e.target as HTMLVideoElement;
                                                    videoEl.style.display = 'none';

                                                    // Remove existing error message if any
                                                    const existingError = videoEl.parentElement?.querySelector('.video-error');
                                                    if (existingError) existingError.remove();

                                                    const errorDiv = document.createElement('div');
                                                    errorDiv.className = 'video-error';
                                                    errorDiv.innerHTML = `
                                                        <p><strong>Failed to load video</strong></p>
                                                        <p>URL: ${mediaUrl}</p>
                                                        <p>Please check if the video file exists and is accessible.</p>
                                                    `;
                                                    videoEl.parentElement?.appendChild(errorDiv);
                                                }}
                                                onLoadedMetadata={() => {
                                                    console.log('Video metadata loaded successfully:', mediaUrl);
                                                }}
                                                onCanPlay={() => {
                                                    console.log('Video can play:', mediaUrl);
                                                }}
                                                onLoadStart={() => {
                                                    console.log('Video loading started:', mediaUrl);
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

const ReportsManagement = () => {
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('pending');

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const adminToken = localStorage.getItem('adminToken');
            if (!adminToken) {
                throw new Error('No admin authentication token found.');
            }

            const response = await fetch(`${getApiBaseUrl()}/admin/reports?status=${filter}`, {
                headers: {
                    'Authorization': `Bearer ${adminToken}`
                }
            });
            const data = await response.json();
            setReports(data.reports);
        } catch (err) {
            console.error('Failed to fetch reports:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, [filter]);

    const handleReportAction = async (reportId: string, status: string, actionTaken: string) => {
        const adminNotes = prompt('Admin notes (optional):');

        try {
            const adminToken = localStorage.getItem('adminToken');
            if (!adminToken) {
                throw new Error('No admin authentication token found.');
            }

            const response = await fetch(`${getApiBaseUrl()}/admin/reports/${reportId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`
                },
                body: JSON.stringify({ status, actionTaken, adminNotes, adminId: 'admin' })
            });

            if (response.ok) {
                alert('Report updated successfully');
                fetchReports();
            } else {
                alert('Failed to update report');
            }
        } catch (err) {
            console.error('Failed to update report:', err);
            alert('Error updating report');
        }
    };

    const getReasonBadgeColor = (reason: string) => {
        const colors: { [key: string]: string } = {
            harassment: 'red',
            inappropriate_content: 'orange',
            spam: 'yellow',
            fake_profile: 'purple',
            underage: 'red',
            other: 'gray'
        };
        return colors[reason] || 'gray';
    };

    return (
        <div className="reports-management">
            <div className="filters-section">
                <div className="filter-buttons">
                    <button
                        className={filter === 'pending' ? 'active' : ''}
                        onClick={() => setFilter('pending')}
                    >
                        Pending ({reports.filter(r => r.status === 'pending').length})
                    </button>
                    <button
                        className={filter === 'reviewed' ? 'active' : ''}
                        onClick={() => setFilter('reviewed')}
                    >
                        Reviewed
                    </button>
                    <button
                        className={filter === 'dismissed' ? 'active' : ''}
                        onClick={() => setFilter('dismissed')}
                    >
                        Dismissed
                    </button>
                </div>
            </div>

            <div className="reports-list">
                {loading ? (
                    <div className="loading">Loading reports...</div>
                ) : reports.length === 0 ? (
                    <div className="no-reports">No reports found</div>
                ) : (
                    reports.map(report => (
                        <div key={report._id} className="report-card">
                            <div className="report-header">
                                <div className="report-meta">
                                    <span className={`reason-badge ${getReasonBadgeColor(report.reason)}`}>
                                        {report.reason.replace('_', ' ')}
                                    </span>
                                    <span className={`status-badge ${report.status}`}>
                                        {report.status}
                                    </span>
                                    <span className="date">
                                        {new Date(report.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                            <div className="report-content">
                                <div className="report-users">
                                    <div className="user-info">
                                        <strong>Reporter:</strong> {report.reporterId?.name || 'Unknown'}
                                    </div>
                                    <div className="user-info">
                                        <strong>Reported:</strong> {report.reportedUserId?.name || 'Unknown'}
                                    </div>
                                </div>
                                {report.description && (
                                    <div className="report-description">
                                        <strong>Description:</strong> {report.description}
                                    </div>
                                )}
                                {report.adminNotes && (
                                    <div className="admin-notes">
                                        <strong>Admin Notes:</strong> {report.adminNotes}
                                    </div>
                                )}
                            </div>
                            {report.status === 'pending' && (
                                <div className="report-actions">
                                    <button
                                        className="action-btn review"
                                        onClick={() => handleReportAction(report._id, 'reviewed', 'warning')}
                                    >
                                        Send Warning
                                    </button>
                                    <button
                                        className="action-btn suspend"
                                        onClick={() => handleReportAction(report._id, 'reviewed', 'suspension')}
                                    >
                                        Suspend User
                                    </button>
                                    <button
                                        className="action-btn ban"
                                        onClick={() => handleReportAction(report._id, 'reviewed', 'ban')}
                                    >
                                        Ban User
                                    </button>
                                    <button
                                        className="action-btn dismiss"
                                        onClick={() => handleReportAction(report._id, 'dismissed', 'none')}
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const SystemTools = () => {
    const [forceLogoutStatus, setForceLogoutStatus] = useState<string>('');

    const handleForceLogout = async () => {
        try {
            const adminToken = localStorage.getItem('adminToken');
            if (!adminToken) {
                throw new Error('No admin authentication token found.');
            }

            setForceLogoutStatus('Sending logout command...');
            const response = await fetch(`${getApiBaseUrl()}/admin/force-logout-all`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`
                },
            });

            if (response.ok) {
                setForceLogoutStatus('✅ All users have been logged out successfully');
                setTimeout(() => setForceLogoutStatus(''), 5000);
            } else {
                throw new Error('Failed to force logout');
            }
        } catch (error) {
            console.error('Force logout error:', error);
            setForceLogoutStatus('❌ Failed to force logout users');
            setTimeout(() => setForceLogoutStatus(''), 5000);
        }
    };

    return (
        <div className="system-tools">
            <div className="tool-section">
                <h3>User Management</h3>
                <div className="tool-card">
                    <div className="tool-header">
                        <LogOut size={24} />
                        <h4>Force Logout All Users</h4>
                    </div>
                    <p>Immediately log out all connected users from the application. This will clear their authentication tokens and redirect them to login.</p>
                    <button
                        className="tool-btn danger"
                        onClick={handleForceLogout}
                        disabled={forceLogoutStatus.includes('Sending')}
                    >
                        {forceLogoutStatus.includes('Sending') ? 'Logging out...' : 'Force Logout All Users'}
                    </button>
                    {forceLogoutStatus && (
                        <div className="tool-status">
                            {forceLogoutStatus}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;
