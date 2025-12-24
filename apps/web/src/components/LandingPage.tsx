import { motion } from 'framer-motion';
import { Video, Heart, Sparkles, ChevronRight } from 'lucide-react';
import './LandingPage.css';

interface LandingPageProps {
    onCreateAccount: () => void;
    onSignIn: () => void;
}

export function LandingPage({ onCreateAccount, onSignIn }: LandingPageProps) {
    return (
        <motion.div
            className="landing-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
        >
            {/* Animated background */}
            <div className="landing-background">
                <motion.div
                    className="landing-orb landing-orb-1"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 0.4, scale: 1 }}
                    transition={{ duration: 1, delay: 0.2 }}
                />
                <motion.div
                    className="landing-orb landing-orb-2"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 0.4, scale: 1 }}
                    transition={{ duration: 1, delay: 0.4 }}
                />
                <motion.div
                    className="landing-orb landing-orb-3"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 0.4, scale: 1 }}
                    transition={{ duration: 1, delay: 0.6 }}
                />
            </div>

            <div className="landing-content">
                {/* Logo section */}
                <motion.div
                    className="landing-logo-section"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                >
                    <h1 className="landing-logo">slush</h1>
                    <p className="landing-tagline">
                        Break the ice through{' '}
                        <span className="landing-tagline-accent">video</span>
                    </p>
                </motion.div>

                {/* Hero section */}
                <motion.div
                    className="landing-hero"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                >
                    <h2 className="landing-hero-title">
                        Real connections start with real faces
                    </h2>
                    <p className="landing-hero-subtitle">
                        Skip the small talk. Connect through video and find meaningful connections faster.
                    </p>
                </motion.div>

                {/* Feature highlights */}
                <motion.div
                    className="landing-features"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                >
                    <div className="landing-feature">
                        <div className="landing-feature-icon">
                            <Video size={22} />
                        </div>
                        <span className="landing-feature-text">Video First</span>
                    </div>
                    <div className="landing-feature">
                        <div className="landing-feature-icon">
                            <Heart size={22} />
                        </div>
                        <span className="landing-feature-text">Real Matches</span>
                    </div>
                    <div className="landing-feature">
                        <div className="landing-feature-icon">
                            <Sparkles size={22} />
                        </div>
                        <span className="landing-feature-text">Live Events</span>
                    </div>
                </motion.div>

                {/* CTA buttons */}
                <motion.div
                    className="landing-cta-section"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                >
                    <motion.button
                        className="landing-btn-primary"
                        onClick={onCreateAccount}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        Create Account
                        <ChevronRight size={20} />
                    </motion.button>

                    <div className="landing-divider">or</div>

                    <motion.button
                        className="landing-btn-secondary"
                        onClick={onSignIn}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        Sign In
                    </motion.button>
                </motion.div>

                {/* Footer */}
                <motion.div
                    className="landing-footer"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.6 }}
                >
                    <p className="landing-footer-text">
                        By continuing, you agree to our{' '}
                        <a href="#" className="landing-footer-link">Terms of Service</a>
                        {' '}and{' '}
                        <a href="#" className="landing-footer-link">Privacy Policy</a>
                    </p>
                </motion.div>
            </div>
        </motion.div>
    );
}
