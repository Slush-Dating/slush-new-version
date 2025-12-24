import React, { useState, useEffect } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    User,
    Bell,
    Lock,
    Eye,
    CircleDollarSign,
    HelpCircle,
    Info,
    Trash2,
    Sliders,
    LogOut,
    X,
    Shield,
    Globe
} from 'lucide-react';
import { authService } from '../services/authService';
import './Settings.css';

interface SettingsProps {
    onBack: () => void;
    onLogout: () => void;
}

interface UserSettings {
    name: string;
    notifications: boolean;
    distancePreference: number;
    ageRangeMin: number;
    ageRangeMax: number;
    showOnlineStatus: boolean;
    darkMode: boolean;
    subscription: string;
}

type SettingsItem = {
    icon: React.ReactElement;
    label: string;
    value?: string | boolean;
    action?: () => void;
    isToggle?: boolean;
    toggleKey?: keyof UserSettings;
    isPremium?: boolean;
};

export const Settings: React.FC<SettingsProps> = ({ onBack, onLogout }) => {
    const [loading, setLoading] = useState(true);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [activePanel, setActivePanel] = useState<string | null>(null);

    // Settings state
    const [settings, setSettings] = useState<UserSettings>({
        name: '',
        notifications: true,
        distancePreference: 25,
        ageRangeMin: 18,
        ageRangeMax: 35,
        showOnlineStatus: true,
        darkMode: true,
        subscription: 'Free'
    });

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchUserData = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    // Set loading to false immediately to show UI, then update with data
                    setLoading(false);
                    const data = await authService.getProfile(token);
                    setSettings(prev => ({
                        ...prev,
                        name: data.name || '',
                        notifications: data.notifications ?? true,
                        distancePreference: data.distancePreference || 25,
                        ageRangeMin: data.ageRangeMin || 18,
                        ageRangeMax: data.ageRangeMax || 35,
                        showOnlineStatus: data.showOnlineStatus ?? true,
                        subscription: data.subscription || 'Free'
                    }));
                } catch (err) {
                    console.error('Failed to fetch user data:', err);
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        };
        fetchUserData();
    }, []);

    const handleToggle = async (key: keyof UserSettings) => {
        const newValue = !settings[key];
        setSettings(prev => ({ ...prev, [key]: newValue }));

        // Save to backend
        try {
            const token = localStorage.getItem('token');
            if (token) {
                await authService.updateOnboarding(token, { [key]: newValue });
            }
        } catch (err) {
            console.error('Failed to save setting:', err);
            // Revert on error
            setSettings(prev => ({ ...prev, [key]: !newValue }));
        }
    };

    const handleSliderChange = (key: 'distancePreference' | 'ageRangeMin' | 'ageRangeMax', value: number) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const saveSliderSettings = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            if (token) {
                await authService.updateOnboarding(token, {
                    distancePreference: settings.distancePreference,
                    ageRangeMin: settings.ageRangeMin,
                    ageRangeMax: settings.ageRangeMax
                });
            }
        } catch (err) {
            console.error('Failed to save discovery settings:', err);
        }
        setSaving(false);
    };

    const handleLogoutConfirm = () => {
        setShowLogoutConfirm(false);
        onLogout();
    };

    const handleDeleteAccount = async () => {
        // In a real app, this would call a delete account API
        setShowDeleteConfirm(false);
        onLogout();
    };

    const settingsSections: { title: string; items: SettingsItem[] }[] = [
        {
            title: 'Account',
            items: [
                {
                    icon: <User size={20} />,
                    label: 'Profile Information',
                    value: settings.name || 'Not set',
                    action: () => setActivePanel('profile')
                },
                {
                    icon: <Bell size={20} />,
                    label: 'Notifications',
                    isToggle: true,
                    toggleKey: 'notifications' as keyof UserSettings,
                    value: settings.notifications
                },
                {
                    icon: <Lock size={20} />,
                    label: 'Privacy & Security',
                    action: () => setActivePanel('privacy')
                },
            ]
        },
        {
            title: 'Discovery',
            items: [
                {
                    icon: <Sliders size={20} />,
                    label: 'Distance',
                    value: `${settings.distancePreference} miles`,
                    action: () => setActivePanel('distance')
                },
                {
                    icon: <Eye size={20} />,
                    label: 'Age Range',
                    value: `${settings.ageRangeMin} - ${settings.ageRangeMax}`,
                    action: () => setActivePanel('age-range')
                },
            ]
        },
        {
            title: 'Premium',
            items: [
                {
                    icon: <CircleDollarSign size={20} />,
                    label: 'Subscription',
                    value: settings.subscription,
                    isPremium: settings.subscription !== 'Free'
                },
            ]
        },
        {
            title: 'Support',
            items: [
                { icon: <HelpCircle size={20} />, label: 'Help Center' },
                { icon: <Info size={20} />, label: 'About Slush' },
            ]
        }
    ];

    const renderToggle = (isOn: boolean, onToggle: () => void) => (
        <div
            className={`toggle-switch ${isOn ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
        >
            <div className="toggle-thumb" />
        </div>
    );

    const renderPanel = () => {
        switch (activePanel) {
            case 'distance':
                return (
                    <div className="settings-panel settings-panel-enter">
                        <header className="panel-header glass">
                            <button className="back-btn" onClick={() => setActivePanel(null)}>
                                <ChevronLeft size={24} />
                            </button>
                            <h2>Maximum Distance</h2>
                            <button
                                className="save-btn"
                                onClick={() => { saveSliderSettings(); setActivePanel(null); }}
                                disabled={saving}
                            >
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                        </header>
                        <div className="panel-content">
                            <div className="slider-container">
                                <div className="slider-header">
                                    <span>Distance</span>
                                    <span className="slider-value">{settings.distancePreference} miles</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="100"
                                    value={settings.distancePreference}
                                    onChange={(e) => handleSliderChange('distancePreference', parseInt(e.target.value))}
                                    className="settings-slider"
                                />
                                <div className="slider-labels">
                                    <span>1 mi</span>
                                    <span>100 mi</span>
                                </div>
                            </div>
                            <p className="panel-description">
                                Show people within {settings.distancePreference} miles of your location.
                            </p>
                        </div>
                    </div>
                );

            case 'age-range':
                return (
                    <div className="settings-panel settings-panel-enter">
                        <header className="panel-header glass">
                            <button className="back-btn" onClick={() => setActivePanel(null)}>
                                <ChevronLeft size={24} />
                            </button>
                            <h2>Age Range</h2>
                            <button
                                className="save-btn"
                                onClick={() => { saveSliderSettings(); setActivePanel(null); }}
                                disabled={saving}
                            >
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                        </header>
                        <div className="panel-content">
                            <div className="slider-container">
                                <div className="slider-header">
                                    <span>Minimum Age</span>
                                    <span className="slider-value">{settings.ageRangeMin}</span>
                                </div>
                                <input
                                    type="range"
                                    min="18"
                                    max={settings.ageRangeMax - 1}
                                    value={settings.ageRangeMin}
                                    onChange={(e) => handleSliderChange('ageRangeMin', parseInt(e.target.value))}
                                    className="settings-slider"
                                />
                            </div>
                            <div className="slider-container">
                                <div className="slider-header">
                                    <span>Maximum Age</span>
                                    <span className="slider-value">{settings.ageRangeMax}</span>
                                </div>
                                <input
                                    type="range"
                                    min={settings.ageRangeMin + 1}
                                    max="80"
                                    value={settings.ageRangeMax}
                                    onChange={(e) => handleSliderChange('ageRangeMax', parseInt(e.target.value))}
                                    className="settings-slider"
                                />
                            </div>
                            <p className="panel-description">
                                Show people between ages {settings.ageRangeMin} and {settings.ageRangeMax}.
                            </p>
                        </div>
                    </div>
                );

            case 'privacy':
                return (
                    <div className="settings-panel settings-panel-enter">
                        <header className="panel-header glass">
                            <button className="back-btn" onClick={() => setActivePanel(null)}>
                                <ChevronLeft size={24} />
                            </button>
                            <h2>Privacy & Security</h2>
                            <div style={{ width: 60 }}></div>
                        </header>
                        <div className="panel-content">
                            <div className="privacy-option">
                                <div className="privacy-option-left">
                                    <div className="privacy-icon"><Globe size={20} /></div>
                                    <div className="privacy-text">
                                        <span className="privacy-label">Show Online Status</span>
                                        <span className="privacy-description">Let others see when you're active</span>
                                    </div>
                                </div>
                                {renderToggle(settings.showOnlineStatus, () => handleToggle('showOnlineStatus'))}
                            </div>
                            <div className="privacy-option">
                                <div className="privacy-option-left">
                                    <div className="privacy-icon"><Shield size={20} /></div>
                                    <div className="privacy-text">
                                        <span className="privacy-label">Read Receipts</span>
                                        <span className="privacy-description">Show when you've read messages</span>
                                    </div>
                                </div>
                                {renderToggle(true, () => { })}
                            </div>
                            <div className="privacy-option">
                                <div className="privacy-option-left">
                                    <div className="privacy-icon"><Eye size={20} /></div>
                                    <div className="privacy-text">
                                        <span className="privacy-label">Profile Visibility</span>
                                        <span className="privacy-description">Allow others to discover your profile</span>
                                    </div>
                                </div>
                                {renderToggle(true, () => { })}
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div className="settings-container">
                <div className="settings-loading">
                    <div className="spinner"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="settings-container settings-page-enter">
            <header className="settings-header glass">
                <button className="back-btn" onClick={onBack}>
                    <ChevronLeft size={24} />
                </button>
                <h1>Settings</h1>
                <div style={{ width: 24 }}></div>
            </header>

            <div className="settings-content">
                {settingsSections.map((section, idx) => (
                    <section key={idx} className="settings-section">
                        <h3>{section.title}</h3>
                        <div className="settings-group glass">
                            {section.items.map((item, itemIdx) => (
                                <div
                                    key={itemIdx}
                                    className={`settings-item ${item.action ? 'clickable' : ''}`}
                                    onClick={item.action}
                                >
                                    <div className="item-left">
                                        <div className={`item-icon ${item.isPremium ? 'premium' : ''}`}>
                                            {item.icon}
                                        </div>
                                        <span>{item.label}</span>
                                    </div>
                                    <div className="item-right">
                                        {item.isToggle && item.toggleKey ? (
                                            renderToggle(
                                                settings[item.toggleKey] as boolean,
                                                () => handleToggle(item.toggleKey!)
                                            )
                                        ) : (
                                            <>
                                                {item.value && (
                                                    <span className={`item-value ${item.isPremium ? 'premium-badge' : ''}`}>
                                                        {item.value}
                                                    </span>
                                                )}
                                                <ChevronRight size={16} className="chevron-right" />
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                ))}

                <button className="logout-btn glass" onClick={() => setShowLogoutConfirm(true)}>
                    <LogOut size={18} />
                    <span>Log Out</span>
                </button>

                <button className="delete-account-btn glass" onClick={() => setShowDeleteConfirm(true)}>
                    <Trash2 size={18} />
                    <span>Delete Account</span>
                </button>

                <div className="settings-footer">
                    <p className="version-text">Slush v1.0.0</p>
                </div>
            </div>

            {/* Sub-panels */}
            {activePanel && renderPanel()}

            {/* Logout Confirmation Modal */}
            {showLogoutConfirm && (
                    <div className="modal-overlay modal-enter">
                        <div className="modal-content glass modal-content-enter">
                            <button className="modal-close" onClick={() => setShowLogoutConfirm(false)}>
                                <X size={20} />
                            </button>
                            <div className="modal-icon logout-icon">
                                <LogOut size={32} />
                            </div>
                            <h2>Log Out?</h2>
                            <p>Are you sure you want to log out of your account?</p>
                            <div className="modal-actions">
                                <button className="modal-btn cancel" onClick={() => setShowLogoutConfirm(false)}>
                                    Cancel
                                </button>
                                <button className="modal-btn confirm" onClick={handleLogoutConfirm}>
                                    Log Out
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            {/* Delete Account Confirmation Modal */}
            {showDeleteConfirm && (
                    <div className="modal-overlay modal-enter">
                        <div className="modal-content glass modal-content-enter">
                            <button className="modal-close" onClick={() => setShowDeleteConfirm(false)}>
                                <X size={20} />
                            </button>
                            <div className="modal-icon delete-icon">
                                <Trash2 size={32} />
                            </div>
                            <h2>Delete Account?</h2>
                            <p>This action cannot be undone. All your data, matches, and messages will be permanently deleted.</p>
                            <div className="modal-actions">
                                <button className="modal-btn cancel" onClick={() => setShowDeleteConfirm(false)}>
                                    Cancel
                                </button>
                                <button className="modal-btn delete" onClick={handleDeleteAccount}>
                                    Delete Account
                                </button>
                            </div>
                        </div>
                    </div>
                )}
        </div>
    );
};
