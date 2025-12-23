import { getApiBaseUrl } from './apiConfig';

// Get API URL dynamically on each request to handle network changes
const getAuthApiUrl = () => `${getApiBaseUrl()}/auth`;

export const authService = {
    async register(email: string, password: string) {
        const API_URL = getAuthApiUrl();
        const fullUrl = `${API_URL}/register`;
        console.log('🔗 Register API URL:', fullUrl);
        console.log('📍 Current hostname:', window.location.hostname);
        console.log('📍 Current protocol:', window.location.protocol);
        
        try {
            const response = await fetch(fullUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            
            console.log('📡 Register response status:', response.status, response.statusText);
            
            if (!response.ok) {
                let error;
                try {
                    error = await response.json();
                    console.error('❌ Register error response:', error);
                } catch (e) {
                    // Handle 502 Bad Gateway specifically
                    if (response.status === 502) {
                        throw new Error(`502 Bad Gateway: The server cannot reach the backend. Please ensure:\n1. The backend server is running on port 5001\n2. nginx is configured to proxy /api requests to http://localhost:5001/api\n3. Check server logs for errors\n\nAPI URL attempted: ${fullUrl}`);
                    }
                    // Handle 504 Gateway Timeout
                    if (response.status === 504) {
                        throw new Error(`504 Gateway Timeout: The backend server is not responding. Please check:\n1. Backend server is running: pm2 status\n2. Backend logs: pm2 logs slush-server\n\nAPI URL attempted: ${fullUrl}`);
                    }
                    throw new Error(`Network error: ${response.status} ${response.statusText}\nAPI URL: ${fullUrl}`);
                }
                throw new Error(error.message || 'Registration failed');
            }
            return response.json();
        } catch (err: any) {
            // Handle network errors
            if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError') || err.message?.includes('Network request failed')) {
                const errorMsg = `Cannot connect to server at ${fullUrl}.\n\nPossible causes:\n1. Backend server is not running (check: pm2 status)\n2. nginx is not properly configured or not running\n3. SSL certificate issues\n4. Network connectivity problems\n\nCurrent location: ${window.location.href}`;
                console.error('❌ Connection error:', errorMsg);
                throw new Error(errorMsg);
            }
            console.error('❌ Register error:', err);
            throw err;
        }
    },

    async login(email: string, password: string) {
        const API_URL = getAuthApiUrl();
        const fullUrl = `${API_URL}/login`;
        console.log('🔗 Login API URL:', fullUrl);
        console.log('📍 Current hostname:', window.location.hostname);
        console.log('📍 Current protocol:', window.location.protocol);
        
        try {
            const response = await fetch(fullUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            
            console.log('📡 Login response status:', response.status, response.statusText);
            
            if (!response.ok) {
                let error;
                try {
                    error = await response.json();
                    console.error('❌ Login error response:', error);
                } catch (e) {
                    // Handle 502 Bad Gateway specifically
                    if (response.status === 502) {
                        throw new Error(`502 Bad Gateway: The server cannot reach the backend. Please ensure:\n1. The backend server is running on port 5001\n2. nginx is configured to proxy /api requests to http://localhost:5001/api\n3. Check server logs for errors\n\nAPI URL attempted: ${fullUrl}`);
                    }
                    // Handle 504 Gateway Timeout
                    if (response.status === 504) {
                        throw new Error(`504 Gateway Timeout: The backend server is not responding. Please check:\n1. Backend server is running: pm2 status\n2. Backend logs: pm2 logs slush-server\n\nAPI URL attempted: ${fullUrl}`);
                    }
                    throw new Error(`Network error: ${response.status} ${response.statusText}\nAPI URL: ${fullUrl}`);
                }
                throw new Error(error.message || 'Login failed');
            }
            return response.json();
        } catch (err: any) {
            // Handle network errors
            if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError') || err.message?.includes('Network request failed')) {
                const errorMsg = `Cannot connect to server at ${fullUrl}.\n\nPossible causes:\n1. Backend server is not running (check: pm2 status)\n2. nginx is not properly configured or not running\n3. SSL certificate issues\n4. Network connectivity problems\n\nCurrent location: ${window.location.href}`;
                console.error('❌ Connection error:', errorMsg);
                throw new Error(errorMsg);
            }
            console.error('❌ Login error:', err);
            throw err;
        }
    },

    async updateOnboarding(token: string, data: any) {
        const API_URL = getAuthApiUrl();
        const response = await fetch(`${API_URL}/onboarding`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Update failed');
        }
        return response.json();
    },

    async uploadFile(token: string, file: File) {
        const API_URL = getAuthApiUrl();
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData,
        });

        if (!response.ok) {
            let errorMessage = 'Upload failed';
            let errorType = 'unknown';
            try {
                const error = await response.json();
                errorMessage = error.message || errorMessage;
                errorType = error.errorType || errorType;
            } catch (e) {
                // If response is not JSON, use status text
                errorMessage = response.statusText || errorMessage;
            }

            // Provide user-friendly messages for common errors
            if (errorType === 'ffmpeg_missing') {
                errorMessage = 'Video processing is not available on this server. Please contact support.';
            } else if (errorType === 'processing_timeout') {
                errorMessage = 'Video upload timed out. Please try with a smaller video file.';
            } else if (errorType === 'file_not_found') {
                errorMessage = 'Upload failed - file could not be processed. Please try again.';
            } else if (response.status === 413) {
                errorMessage = 'File is too large. Please choose a file smaller than 20MB or wait for compression to complete.';
            } else if (response.status === 401) {
                errorMessage = 'Authentication failed. Please log in again.';
            }

            throw new Error(errorMessage);
        }

        return response.json();
    },

    async getProfile(token: string) {
        const API_URL = getAuthApiUrl();
        const response = await fetch(`${API_URL}/profile`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch profile');
        }
        return response.json();
    },

    async getUserProfile(token: string, userId: string) {
        const API_URL = getAuthApiUrl();
        const response = await fetch(`${API_URL}/profile/${userId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch user profile');
        }
        return response.json();
    },

    async upgradeMock(token: string) {
        const API_URL = getAuthApiUrl();
        const response = await fetch(`${API_URL}/upgrade-mock`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Upgrade failed');
        }
        return response.json();
    }
};
