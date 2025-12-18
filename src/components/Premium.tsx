import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Crown, Zap, Sparkles, ShieldCheck } from 'lucide-react';
import { authService } from '../services/authService';
import './Premium.css';

interface PremiumProps {
    onBack: () => void;
    onUpgradeSuccess: (updatedUser: any) => void;
}

export const Premium: React.FC<PremiumProps> = ({ onBack, onUpgradeSuccess }) => {
    const [isUpgrading, setIsUpgrading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleUpgrade = async () => {
        setIsUpgrading(true);
        setError(null);
        const token = localStorage.getItem('token');
        if (!token) {
            setError('Authentication required');
            setIsUpgrading(false);
            return;
        }

        try {
            const response = await authService.upgradeMock(token);
            // Wait a little to simulate a "processing" feel
            await new Promise(resolve => setTimeout(resolve, 1500));
            onUpgradeSuccess(response.user);
        } catch (err: any) {
            setError(err.message || 'Upgrade failed. Please try again.');
            setIsUpgrading(false);
        }
    };

    const benefits = [
        {
            icon: <Sparkles className="benefit-icon" />,
            title: "See Who Liked You",
            description: "Unblur all profiles in your 'Liked You' tab and start matching instantly."
        },
        {
            icon: <Zap className="benefit-icon" />,
            title: "Unlimited Likes",
            description: "Swipe to your heart's content without any daily limits."
        },
        {
            icon: <ShieldCheck className="benefit-icon" />,
            title: "Priority Discovery",
            description: "Your profile gets seen by more people in the feed."
        },
        {
            icon: <Crown className="benefit-icon" />,
            title: "Premium Badge",
            description: "Stand out with a distinctive crown on your profile."
        }
    ];

    return (
        <motion.div
            className="premium-page"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
        >
            <header className="premium-header">
                <button className="back-btn" onClick={onBack}>
                    <ChevronLeft size={20} />
                </button>
                <div className="premium-title">Slush Silver</div>
            </header>

            <main className="premium-content">
                <div className="premium-hero">
                    <div className="crown-container">
                        <motion.div
                            animate={{
                                scale: [1, 1.05, 1],
                                rotate: [0, 3, -3, 0]
                            }}
                            transition={{
                                duration: 5,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                        >
                            <Crown size={72} className="large-crown" />
                        </motion.div>
                        <div className="glow-effect" />
                    </div>
                    <h1>Unlock Slush Silver</h1>
                    <p className="hero-subtitle">Make every connection count with our premium features designed to help you find your spark.</p>
                </div>

                <div className="benefits-list">
                    {benefits.map((benefit, index) => (
                        <motion.div
                            key={index}
                            className="benefit-card"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 * index }}
                        >
                            <div className="benefit-icon-wrapper">
                                {benefit.icon}
                            </div>
                            <div className="benefit-text">
                                <h3>{benefit.title}</h3>
                                <p>{benefit.description}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {error && <div className="premium-error">{error}</div>}
            </main>

            <footer className="premium-footer">
                <div className="premium-price">
                    <span className="price-amount">£0.00</span>
                    <span className="price-period">/ month</span>
                </div>
                <button
                    className={`upgrade-btn ${isUpgrading ? 'loading' : ''}`}
                    onClick={handleUpgrade}
                    disabled={isUpgrading}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        {isUpgrading ? 'Processing...' : (
                            <>
                                <Crown size={20} />
                                Upgrade to Slush Silver
                            </>
                        )}
                    </div>
                </button>
                <p className="footer-note">Experience the best of Slush. No real payment required.</p>
            </footer>
        </motion.div>
    );
};
