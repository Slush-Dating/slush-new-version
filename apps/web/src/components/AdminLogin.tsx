import { useState } from 'react';
import { AuthLayout } from './AuthLayout';
import { getApiBaseUrl } from '../services/apiConfig';
import { ChevronRight, Shield } from 'lucide-react';
import './AdminLogin.css';

interface AdminLoginProps {
    onLogin: (data: { token: string; user: any }) => void;
}

export function AdminLogin({ onLogin }: AdminLoginProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        
        try {
            const apiUrl = `${getApiBaseUrl()}/auth/admin/login`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Admin login failed');
            }

            const data = await response.json();
            onLogin(data);
        } catch (err: any) {
            let errorMessage = err.message || 'Admin login failed';
            
            if (err.message?.includes('Failed to fetch') || 
                err.message?.includes('NetworkError') ||
                err.message?.includes('Network request failed')) {
                errorMessage = 'Unable to connect to server. Please check your network connection.';
            }
            
            setError(errorMessage);
            console.error('Admin login error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout title="Admin Access" subtitle="Sign in to the admin panel">
            <div className="admin-login-badge">
                <Shield size={20} />
                <span>Administrator Only</span>
            </div>
            <form onSubmit={handleSubmit} className="auth-content">
                {error && <div className="error-message">{error}</div>}
                <div className="auth-input-group">
                    <label>Email Address</label>
                    <input
                        type="email"
                        className="auth-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@example.com"
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
                <button type="submit" className="auth-submit-btn admin-submit-btn" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign In as Admin'} <ChevronRight size={20} />
                </button>
            </form>
        </AuthLayout>
    );
}


