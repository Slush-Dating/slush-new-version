import { useEffect } from 'react';
import { motion } from 'framer-motion';
import './SplashScreen.css';

interface SplashScreenProps {
    onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
    useEffect(() => {
        // Auto-transition after animation completes
        const timer = setTimeout(() => {
            onComplete();
        }, 2500);

        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <motion.div
            className="splash-container"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
        >
            {/* Animated background */}
            <div className="splash-background">
                <div className="splash-orb splash-orb-1" />
                <div className="splash-orb splash-orb-2" />
                <div className="splash-orb splash-orb-3" />
            </div>

            {/* Ice particles */}
            <div className="ice-particles">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="ice-particle" />
                ))}
            </div>

            {/* Main content */}
            <motion.div
                className="splash-content"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
                <div className="splash-logo-container">
                    <motion.div
                        className="ice-crack-effect"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    />
                    <motion.h1
                        className="splash-logo"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                        slush
                    </motion.h1>
                </div>

                <motion.p
                    className="splash-tagline"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.7 }}
                >
                    Break the ice through{' '}
                    <span className="splash-tagline-accent">video</span>
                </motion.p>

                <motion.div
                    className="splash-loader"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: 1.2 }}
                >
                    <div className="splash-loader-dot" />
                    <div className="splash-loader-dot" />
                    <div className="splash-loader-dot" />
                </motion.div>
            </motion.div>
        </motion.div>
    );
}
