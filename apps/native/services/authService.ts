/**
 * Authentication Service for React Native
 * Handles user authentication with secure token storage
 */

import { Platform } from 'react-native';
import { getApiBaseUrl } from './apiConfig';

// Conditionally import SecureStore (not available on web)
let SecureStore: typeof import('expo-secure-store') | null = null;
try {
    if (Platform.OS !== 'web') {
        SecureStore = require('expo-secure-store');
    }
} catch (error) {
    console.warn('⚠️ SecureStore not available:', error);
}

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const ONBOARDING_STATE_KEY = 'onboarding_state';

// Web-compatible storage functions
const getWebStorage = () => {
    try {
        return typeof window !== 'undefined' ? window.localStorage : null;
    } catch {
        return null;
    }
};

const isWeb = Platform.OS === 'web';

export interface User {
    _id: string;
    id?: string;
    email: string;
    name?: string;
    dob?: string;
    gender?: string;
    interestedIn?: string;
    interests?: string[];
    prompts?: Array<{
        question: string;
        answer: string;
    }>;
    photos?: string[];
    videos?: string[];
    bio?: string;
    onboardingCompleted?: boolean;
    isPremium?: boolean;
    isAdmin?: boolean;
    location?: {
        type: string;
        coordinates: number[];
        city?: string;
        state?: string;
        country?: string;
        locationString?: string;
    };
}

export interface AuthResponse {
    token: string;
    user: User;
}

/**
 * Get stored auth token
 */
export const getToken = async (): Promise<string | null> => {
    try {
        if (isWeb) {
            const storage = getWebStorage();
            return storage ? storage.getItem(TOKEN_KEY) : null;
        }
        if (!SecureStore) {
            console.warn('⚠️ SecureStore not available, falling back to web storage');
            const storage = getWebStorage();
            return storage ? storage.getItem(TOKEN_KEY) : null;
        }
        return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch (error) {
        console.error('Failed to get token from storage:', error);
        // Fallback to web storage on error
        try {
            const storage = getWebStorage();
            return storage ? storage.getItem(TOKEN_KEY) : null;
        } catch {
            return null;
        }
    }
};

/**
 * Save auth token securely
 */
export const saveToken = async (token: string): Promise<void> => {
    try {
        if (isWeb) {
            const storage = getWebStorage();
            if (storage) {
                storage.setItem(TOKEN_KEY, token);
                return;
            }
            throw new Error('Web storage not available');
        }
        if (!SecureStore) {
            console.warn('⚠️ SecureStore not available, falling back to web storage');
            const storage = getWebStorage();
            if (storage) {
                storage.setItem(TOKEN_KEY, token);
                return;
            }
            throw new Error('Storage not available');
        }
        await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch (error) {
        console.error('Failed to save token to storage:', error);
        // Try web storage as fallback
        if (!isWeb) {
            try {
                const storage = getWebStorage();
                if (storage) {
                    storage.setItem(TOKEN_KEY, token);
                    return;
                }
            } catch {
                // Ignore fallback errors
            }
        }
        throw error;
    }
};

/**
 * Remove auth token
 */
export const removeToken = async (): Promise<void> => {
    try {
        if (isWeb) {
            const storage = getWebStorage();
            if (storage) {
                storage.removeItem(TOKEN_KEY);
                return;
            }
        }
        if (!SecureStore) {
            const storage = getWebStorage();
            if (storage) {
                storage.removeItem(TOKEN_KEY);
            }
            return;
        }
        await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch (error) {
        console.error('Failed to remove token from storage:', error);
        // Try web storage as fallback
        try {
            const storage = getWebStorage();
            if (storage) {
                storage.removeItem(TOKEN_KEY);
            }
        } catch {
            // Ignore fallback errors
        }
    }
};

/**
 * Get stored user data
 */
export const getUser = async (): Promise<User | null> => {
    try {
        let userJson: string | null = null;
        if (isWeb) {
            const storage = getWebStorage();
            userJson = storage ? storage.getItem(USER_KEY) : null;
        } else {
            if (!SecureStore) {
                const storage = getWebStorage();
                userJson = storage ? storage.getItem(USER_KEY) : null;
            } else {
                userJson = await SecureStore.getItemAsync(USER_KEY);
            }
        }
        return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
        console.error('Failed to get user from storage:', error);
        // Try web storage as fallback
        try {
            const storage = getWebStorage();
            const userJson = storage ? storage.getItem(USER_KEY) : null;
            return userJson ? JSON.parse(userJson) : null;
        } catch {
            return null;
        }
    }
};

/**
 * Save user data securely
 */
export const saveUser = async (user: User): Promise<void> => {
    try {
        if (isWeb) {
            const storage = getWebStorage();
            if (storage) {
                storage.setItem(USER_KEY, JSON.stringify(user));
                return;
            }
            throw new Error('Web storage not available');
        }
        if (!SecureStore) {
            console.warn('⚠️ SecureStore not available, falling back to web storage');
            const storage = getWebStorage();
            if (storage) {
                storage.setItem(USER_KEY, JSON.stringify(user));
                return;
            }
            throw new Error('Storage not available');
        }
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    } catch (error) {
        console.error('Failed to save user to storage:', error);
        // Try web storage as fallback
        if (!isWeb) {
            try {
                const storage = getWebStorage();
                if (storage) {
                    storage.setItem(USER_KEY, JSON.stringify(user));
                    return;
                }
            } catch {
                // Ignore fallback errors
            }
        }
        throw error;
    }
};

/**
 * Remove user data
 */
export const removeUser = async (): Promise<void> => {
    try {
        if (isWeb) {
            const storage = getWebStorage();
            if (storage) {
                storage.removeItem(USER_KEY);
                return;
            }
        }
        if (!SecureStore) {
            const storage = getWebStorage();
            if (storage) {
                storage.removeItem(USER_KEY);
            }
            return;
        }
        await SecureStore.deleteItemAsync(USER_KEY);
    } catch (error) {
        console.error('Failed to remove user from storage:', error);
        // Try web storage as fallback
        try {
            const storage = getWebStorage();
            if (storage) {
                storage.removeItem(USER_KEY);
            }
        } catch {
            // Ignore fallback errors
        }
    }
};

/**
 * Login with email and password
 */
export const login = async (email: string, password: string): Promise<AuthResponse> => {
    const API_BASE_URL = getApiBaseUrl();

    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Login failed' }));
        throw new Error(error.message || 'Login failed');
    }

    const data = await response.json();

    // Save credentials
    await saveToken(data.token);
    await saveUser(data.user);

    return data;
};

/**
 * Register a new user
 */
export const register = async (email: string, password: string): Promise<AuthResponse> => {
    const API_BASE_URL = getApiBaseUrl();

    const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Registration failed' }));
        throw new Error(error.message || 'Registration failed');
    }

    const data = await response.json();

    // Save credentials
    await saveToken(data.token);
    await saveUser(data.user);

    return data;
};

/**
 * Logout user
 */
export const logout = async (): Promise<void> => {
    await removeToken();
    await removeUser();
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = async (): Promise<boolean> => {
    const token = await getToken();
    return !!token;
};

/**
 * Get current user ID from token
 */
export const getCurrentUserId = async (): Promise<string | null> => {
    try {
        const token = await getToken();
        if (!token) return null;

        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.userId;
    } catch {
        return null;
    }
};

/**
 * Update user profile
 */
export const updateProfile = async (updates: Partial<User>): Promise<User> => {
    const API_BASE_URL = getApiBaseUrl();
    const token = await getToken();

    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Profile update failed' }));
        throw new Error(error.message || 'Profile update failed');
    }

    const data = await response.json();

    // Update stored user
    await saveUser(data.user);

    return data.user;
};

/**
 * Complete onboarding
 */
export const completeOnboarding = async (onboardingData: Partial<User>): Promise<User> => {
    const API_BASE_URL = getApiBaseUrl();
    const token = await getToken();

    if (!token) {
        throw new Error('Not authenticated');
    }

    // Prepare data for the PUT /onboarding endpoint
    const onboardingPayload = {
        ...onboardingData,
        finalStep: true, // Mark as final step to complete onboarding
    };

    const response = await fetch(`${API_BASE_URL}/auth/onboarding`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(onboardingPayload),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Onboarding failed' }));
        throw new Error(error.message || 'Onboarding failed');
    }

    const data = await response.json();

    // Update stored user
    await saveUser(data.user);

    return data.user;
};

/**
 * Fetch current user profile from API
 */
export const getCurrentProfile = async (): Promise<User> => {
    const API_BASE_URL = getApiBaseUrl();
    const token = await getToken();

    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to fetch profile' }));
        throw new Error(error.message || 'Failed to fetch profile');
    }

    const user = await response.json();

    // Update stored user with fresh data from API
    await saveUser(user);

    return user;
};

/**
 * Onboarding state interface for persistence
 */
export interface OnboardingState {
    currentStep: number;
    name: string;
    dob: string;
    gender: string;
    interestedIn: string;
    interests: string[];
    prompts: Array<{ question: string; answer: string }>;
    photos: string[];
    videos: Array<{ url: string; thumbnailUrl?: string }>;
    userLocation: {
        coordinates: [number, number];
        city: string;
        state: string;
        country: string;
        locationString: string;
    } | null;
}

/**
 * Save onboarding state for later resume
 */
export const saveOnboardingState = async (state: OnboardingState): Promise<void> => {
    try {
        const stateJson = JSON.stringify(state);
        if (isWeb) {
            const storage = getWebStorage();
            if (storage) {
                storage.setItem(ONBOARDING_STATE_KEY, stateJson);
                return;
            }
            throw new Error('Web storage not available');
        }
        if (!SecureStore) {
            const storage = getWebStorage();
            if (storage) {
                storage.setItem(ONBOARDING_STATE_KEY, stateJson);
                return;
            }
            throw new Error('Storage not available');
        }
        await SecureStore.setItemAsync(ONBOARDING_STATE_KEY, stateJson);
        console.log('💾 Onboarding state saved at step', state.currentStep);
    } catch (error) {
        console.error('Failed to save onboarding state:', error);
    }
};

/**
 * Get saved onboarding state
 */
export const getOnboardingState = async (): Promise<OnboardingState | null> => {
    try {
        let stateJson: string | null = null;
        if (isWeb) {
            const storage = getWebStorage();
            stateJson = storage ? storage.getItem(ONBOARDING_STATE_KEY) : null;
        } else {
            if (!SecureStore) {
                const storage = getWebStorage();
                stateJson = storage ? storage.getItem(ONBOARDING_STATE_KEY) : null;
            } else {
                stateJson = await SecureStore.getItemAsync(ONBOARDING_STATE_KEY);
            }
        }
        if (stateJson) {
            console.log('📂 Onboarding state found');
            return JSON.parse(stateJson);
        }
        return null;
    } catch (error) {
        console.error('Failed to get onboarding state:', error);
        return null;
    }
};

/**
 * Clear onboarding state (call after completing onboarding)
 */
export const clearOnboardingState = async (): Promise<void> => {
    try {
        if (isWeb) {
            const storage = getWebStorage();
            if (storage) {
                storage.removeItem(ONBOARDING_STATE_KEY);
                return;
            }
        }
        if (!SecureStore) {
            const storage = getWebStorage();
            if (storage) {
                storage.removeItem(ONBOARDING_STATE_KEY);
            }
            return;
        }
        await SecureStore.deleteItemAsync(ONBOARDING_STATE_KEY);
        console.log('🗑️ Onboarding state cleared');
    } catch (error) {
        console.error('Failed to clear onboarding state:', error);
    }
};

export default {
    getToken,
    saveToken,
    removeToken,
    getUser,
    saveUser,
    removeUser,
    login,
    register,
    logout,
    isAuthenticated,
    getCurrentUserId,
    updateProfile,
    completeOnboarding,
    getCurrentProfile,
    saveOnboardingState,
    getOnboardingState,
    clearOnboardingState,
};
