import React, { useState } from 'react';
import { ChevronLeft, Crown, Zap, Sparkles, Heart } from 'lucide-react';
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
            icon: <Heart className="benefit-icon" />,
            title: "See Who Liked You",
            description: "Discover profiles that have already shown interest in you and connect instantly."
        },
        {
            icon: <Zap className="benefit-icon" />,
            title: "Unlimited Likes",
            description: "Express yourself freely without worrying about daily limits."
        },
        {
            icon: <Sparkles className="benefit-icon" />,
            title: "Priority Discovery",
            description: "Get seen by more people and increase your chances of meaningful connections."
        },
        {
            icon: <Crown className="benefit-icon" />,
            title: "Premium Badge",
            description: "Stand out with a distinctive badge that shows your commitment to finding real connections."
        }
    ];

    return (
        <div className="premium-page">
            <header className="premium-header">
                <button className="back-btn" onClick={onBack}>
                    <ChevronLeft size={20} />
                </button>
                <div className="premium-title">Premium</div>
            </header>

            <main className="premium-content">
                <div className="premium-hero">
                    <div className="hero-icon">
                        <Crown size={48} className="hero-crown" />
                    </div>
                    <h1>Unlock Premium</h1>
                    <p className="hero-subtitle">Take your dating experience to the next level with features designed to help you find genuine connections.</p>
                </div>

                <div className="benefits-section">
                    <h2 className="benefits-title">What you'll get</h2>
                    <div className="benefits-list">
                        {benefits.map((benefit, index) => (
                            <div key={index} className="benefit-card">
                                <div className="benefit-icon-wrapper">
                                    {benefit.icon}
                                </div>
                                <div className="benefit-text">
                                    <h3>{benefit.title}</h3>
                                    <p>{benefit.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {error && <div className="premium-error">{error}</div>}
            </main>

            <footer className="premium-footer">
                <div className="pricing-section">
                    <div className="price-display">
                        <span className="price-amount">£0.00</span>
                        <span className="price-period">per month</span>
                    </div>
                    <p className="pricing-note">Free for now • No payment required</p>
                </div>

                <button
                    className={`upgrade-btn ${isUpgrading ? 'loading' : ''}`}
                    onClick={handleUpgrade}
                    disabled={isUpgrading}
                >
                    <div className="upgrade-btn-content">
                        {isUpgrading ? 'Processing...' : (
                            <>
                                <Crown size={20} />
                                Upgrade to Premium
                            </>
                        )}
                    </div>
                </button>
            </footer>
        </div>
    );
};
