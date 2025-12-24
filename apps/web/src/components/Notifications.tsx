import { useState, useEffect } from 'react';
import { ArrowLeft, User, Shield, Loader2 } from 'lucide-react';
import { notificationService, type NotificationData } from '../services/api';
import { getAbsoluteMediaUrl } from '../services/apiConfig';
import './Notifications.css';

interface NotificationsProps {
    onBack: () => void;
    isPremium?: boolean;
    onUpgrade?: () => void;
}

type NotificationFilter = 'all' | 'general' | 'match' | 'likes';

export const Notifications: React.FC<NotificationsProps> = ({ onBack, isPremium: propIsPremium, onUpgrade }) => {
    const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');
    const [notifications, setNotifications] = useState<NotificationData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isPremium, setIsPremium] = useState(propIsPremium ?? false);

    const filters: { id: NotificationFilter; label: string }[] = [
        { id: 'all', label: 'All' },
        { id: 'general', label: 'General' },
        { id: 'match', label: 'Match' },
        { id: 'likes', label: 'Likes' }
    ];

    useEffect(() => {
        fetchNotifications();
    }, [activeFilter]);

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            setError(null);
            const filterType = activeFilter === 'likes' ? 'like' : activeFilter;
            const response = await notificationService.getNotifications(filterType);
            setNotifications(response.notifications);
            setIsPremium(response.isPremium);
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
            setError('Failed to load notifications');
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAsRead = async (id: string) => {
        try {
            await notificationService.markAsRead(id);
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, isRead: true } : n)
            );
        } catch (err) {
            console.error('Failed to mark as read:', err);
        }
    };

    const getBadgeLabel = (type: NotificationData['type']) => {
        switch (type) {
            case 'like': return 'Likes';
            case 'match': return 'Match';
            default: return null;
        }
    };

    const renderNotificationIcon = (notification: NotificationData) => {
        if (notification.userImage) {
            return (
                <div className="notification-avatar">
                    <img
                        src={getAbsoluteMediaUrl(notification.userImage)}
                        alt=""
                    />
                </div>
            );
        }

        // For likes without image (non-premium users)
        if (notification.type === 'like') {
            return (
                <div className="notification-icon like-icon">
                    <User size={24} />
                </div>
            );
        }

        if (notification.type === 'security') {
            return (
                <div className="notification-icon security-icon">
                    <Shield size={24} />
                </div>
            );
        }

        return (
            <div className="notification-icon default-icon">
                <User size={24} />
            </div>
        );
    };

    if (loading) {
        return (
            <div className="notifications-container">
                <div className="notifications-header">
                    <button className="back-button" onClick={onBack}>
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="header-title">Notification</h1>
                    <div className="header-spacer" />
                </div>
                <div className="notifications-loading">
                    <Loader2 className="animate-spin" size={32} />
                    <p>Loading notifications...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="notifications-container">
            {/* Header */}
            <div className="notifications-header">
                <button className="back-button" onClick={onBack}>
                    <ArrowLeft size={24} />
                </button>
                <h1 className="header-title">Notification</h1>
                <div className="header-spacer" />
            </div>

            {/* Filter Tabs */}
            <div className="notifications-filters">
                {filters.map(filter => (
                    <button
                        key={filter.id}
                        className={`filter-tab ${activeFilter === filter.id ? 'active' : ''}`}
                        onClick={() => setActiveFilter(filter.id)}
                    >
                        {filter.label}
                    </button>
                ))}
            </div>

            {/* Premium Banner for Likes */}
            {!isPremium && activeFilter === 'likes' && notifications.length > 0 && (
                <div className="premium-banner">
                    <p>Upgrade to Premium to see who liked you!</p>
                    {onUpgrade && (
                        <button className="upgrade-btn" onClick={onUpgrade}>
                            Upgrade Now
                        </button>
                    )}
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="notifications-error">
                    <p>{error}</p>
                    <button onClick={fetchNotifications}>Retry</button>
                </div>
            )}

            {/* Notifications List */}
            <div className="notifications-list">
                {notifications.map(notification => (
                    <div
                        key={notification.id}
                        className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
                        onClick={() => !notification.isRead && handleMarkAsRead(notification.id)}
                    >
                        {renderNotificationIcon(notification)}

                        <div className="notification-content">
                            <div className="notification-header-row">
                                <span className="notification-title">{notification.title}</span>
                                {getBadgeLabel(notification.type) && (
                                    <span className={`notification-badge badge-${notification.type}`}>
                                        {getBadgeLabel(notification.type)}
                                    </span>
                                )}
                            </div>

                            {notification.description && (
                                <p className="notification-description">{notification.description}</p>
                            )}

                            {notification.actionButton && (
                                <button className="notification-action-btn">
                                    {notification.actionButton}
                                </button>
                            )}

                            <span className="notification-timestamp">{notification.timestamp}</span>
                        </div>
                    </div>
                ))}

                {notifications.length === 0 && !error && (
                    <div className="no-notifications">
                        <p>No notifications yet</p>
                    </div>
                )}
            </div>
        </div>
    );
};
