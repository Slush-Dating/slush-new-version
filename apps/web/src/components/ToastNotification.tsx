import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, Heart } from 'lucide-react';
import { getAbsoluteMediaUrl } from '../services/apiConfig';
import './ToastNotification.css';

export interface Toast {
    id: string;
    type: 'message' | 'match';
    title: string;
    message: string;
    imageUrl?: string;
    matchId?: string;
    userId?: string;
}

interface ToastNotificationProps {
    toasts: Toast[];
    onDismiss: (id: string) => void;
    onAction: (toast: Toast) => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({
    toasts,
    onDismiss,
    onAction
}) => {
    return (
        <div className="toast-container">
            <AnimatePresence>
                {toasts.map((toast) => (
                    <motion.div
                        key={toast.id}
                        className={`toast-notification glass ${toast.type}`}
                        initial={{ opacity: 0, y: -100, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -50, scale: 0.9 }}
                        transition={{
                            type: 'spring',
                            stiffness: 400,
                            damping: 30
                        }}
                        onClick={() => onAction(toast)}
                        layout
                    >
                        <div className="toast-icon-wrapper">
                            {toast.imageUrl ? (
                                <img
                                    src={getAbsoluteMediaUrl(toast.imageUrl)}
                                    alt=""
                                    className="toast-avatar"
                                />
                            ) : (
                                <div className={`toast-icon ${toast.type}`}>
                                    {toast.type === 'message' ? (
                                        <MessageSquare size={20} />
                                    ) : (
                                        <Heart size={20} fill="currentColor" />
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="toast-content">
                            <div className="toast-header">
                                <span className="toast-title">{toast.title}</span>
                                {toast.type === 'match' && (
                                    <span className="toast-badge">New Match! 💕</span>
                                )}
                            </div>
                            <p className="toast-message">{toast.message}</p>
                        </div>

                        <button
                            className="toast-dismiss"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDismiss(toast.id);
                            }}
                        >
                            <X size={16} />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};

export default ToastNotification;
