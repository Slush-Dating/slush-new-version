import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import './AuthLayout.css';

interface AuthLayoutProps {
    children: ReactNode;
    title: string;
    subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
    return (
        <div className="auth-container">
            {/* Animated background */}
            <div className="auth-background">
                <motion.div
                    className="auth-orb auth-orb-1"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 0.4, scale: 1 }}
                    transition={{ duration: 1, delay: 0.2 }}
                />
                <motion.div
                    className="auth-orb auth-orb-2"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 0.4, scale: 1 }}
                    transition={{ duration: 1, delay: 0.4 }}
                />
                <motion.div
                    className="auth-orb auth-orb-3"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 0.4, scale: 1 }}
                    transition={{ duration: 1, delay: 0.6 }}
                />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="auth-card"
            >
                <div className="auth-header">
                    <h1 className="auth-title">{title}</h1>
                    {subtitle && <p className="auth-subtitle">{subtitle}</p>}
                </div>
                <div className="auth-content">
                    {children}
                </div>
            </motion.div>
        </div>
    );
}
