import React from 'react';
import { motion } from 'framer-motion';
import {
    ChevronLeft,
    User,
    Bell,
    Lock,
    Eye,
    CircleDollarSign,
    HelpCircle,
    Info,
    Trash2,
    Sliders,
    LogOut
} from 'lucide-react';
import './Settings.css';

interface SettingsProps {
    onBack: () => void;
    onLogout: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onBack, onLogout }) => {
    const settingsSections = [
        {
            title: 'Account',
            items: [
                { icon: <User size={20} />, label: 'Profile Information', value: 'Isabella' },
                { icon: <Bell size={20} />, label: 'Notifications', value: 'On' },
                { icon: <Lock size={20} />, label: 'Privacy & Security' },
            ]
        },
        {
            title: 'Discovery',
            items: [
                { icon: <Sliders size={20} />, label: 'Distance', value: '25 miles' },
                { icon: <Eye size={20} />, label: 'Age Range', value: '22 - 30' },
            ]
        },
        {
            title: 'Premium',
            items: [
                { icon: <CircleDollarSign size={20} />, label: 'Subscription', value: 'Gold' },
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

    return (
        <motion.div
            className="settings-container"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        >
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
                                <div key={itemIdx} className="settings-item">
                                    <div className="item-left">
                                        <div className="item-icon">{item.icon}</div>
                                        <span>{item.label}</span>
                                    </div>
                                    <div className="item-right">
                                        {item.value && <span className="item-value">{item.value}</span>}
                                        <ChevronLeft size={16} className="chevron-right" style={{ transform: 'rotate(180deg)' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                ))}

                <button className="logout-btn glass" onClick={onLogout}>
                    <LogOut size={18} />
                    <span>Log Out</span>
                </button>

                <button className="delete-account-btn glass">
                    <Trash2 size={18} />
                    <span>Delete Account</span>
                </button>
            </div>
        </motion.div>
    );
};
