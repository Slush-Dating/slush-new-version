import { useState } from 'react';
import { AuthLayout } from './AuthLayout';
import { authService } from '../services/authService';
import { ChevronRight } from 'lucide-react';

interface LoginProps {
    onLogin: (data: { token: string; user: any }) => void;
    onSwitchToRegister: () => void;
}

export function Login({ onLogin, onSwitchToRegister }: LoginProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await authService.login(email, password);
            onLogin(data);
        } catch (err: any) {
            // Provide more helpful error messages
            let errorMessage = err.message || 'Login failed';
            
            // Check for network errors
            if (err.message?.includes('Failed to fetch') || 
                err.message?.includes('NetworkError') ||
                err.message?.includes('Network request failed')) {
                errorMessage = 'Unable to connect to server. Please check your network connection and ensure the server is running.';
                
                // If on mobile, provide additional guidance
                if ((window as any).Capacitor) {
                    errorMessage += ' If accessing via network, ensure you\'ve specified the server IP (e.g., ?host=192.168.1.208)';
                }
            }
            
            setError(errorMessage);
            console.error('Login error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout title="Welcome back" subtitle="Sign in to your Slush account">
            <form onSubmit={handleSubmit} className="auth-content">
                {error && <div className="error-message">{error}</div>}
                <div className="auth-input-group">
                    <label>Email Address</label>
                    <input
                        type="email"
                        className="auth-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        required
                        autoFocus
                    />
                </div>
                <div className="auth-input-group">
                    <label>Password</label>
                    <input
                        type="password"
                        className="auth-input"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                    />
                </div>
                <button type="submit" className="auth-submit-btn" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign In'} <ChevronRight size={20} />
                </button>
                <p className="auth-switch">
                    Don't have an account?
                    <button type="button" onClick={onSwitchToRegister}>Sign Up</button>
                </p>
            </form>
        </AuthLayout>
    );
}
