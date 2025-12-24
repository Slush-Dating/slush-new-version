/**
 * Authentication Context and Provider
 * Manages auth state across the entire app
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as authService from '../services/authService';
import type { User, AuthResponse } from '../services/authService';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<AuthResponse>;
    register: (email: string, password: string) => Promise<AuthResponse>;
    logout: () => Promise<void>;
    updateUser: (updates: Partial<User>) => Promise<User>;
    completeOnboarding: (data: Partial<User>) => Promise<User>;
    refreshUser: () => Promise<void>;
    fetchCurrentProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load user on mount
    useEffect(() => {
        loadUser();
    }, []);

    const loadUser = async () => {
        try {
            setIsLoading(true);
            console.log('🔄 Loading user from storage...');
            
            const [token, savedUser] = await Promise.all([
                authService.getToken().catch(err => {
                    console.warn('⚠️ Failed to get token:', err);
                    return null;
                }),
                authService.getUser().catch(err => {
                    console.warn('⚠️ Failed to get user:', err);
                    return null;
                }),
            ]);

            if (token && savedUser) {
                console.log('👤 User loaded from storage:', savedUser.email);
                setUser(savedUser);
            } else {
                console.log('🔒 No authenticated user found');
                setUser(null);
            }
        } catch (error) {
            console.error('❌ Failed to load user:', error);
            setUser(null);
        } finally {
            setIsLoading(false);
            console.log('✅ Auth loading complete');
        }
    };

    const login = async (email: string, password: string): Promise<AuthResponse> => {
        const response = await authService.login(email, password);
        setUser(response.user);
        return response;
    };

    const register = async (email: string, password: string): Promise<AuthResponse> => {
        const response = await authService.register(email, password);
        setUser(response.user);
        return response;
    };

    const logout = async () => {
        await authService.logout();
        setUser(null);
    };

    const updateUser = async (updates: Partial<User>): Promise<User> => {
        const updatedUser = await authService.updateProfile(updates);
        setUser(updatedUser);
        return updatedUser;
    };

    const completeOnboarding = async (data: Partial<User>): Promise<User> => {
        const updatedUser = await authService.completeOnboarding(data);
        setUser(updatedUser);
        return updatedUser;
    };

    const refreshUser = async () => {
        const savedUser = await authService.getUser();
        if (savedUser) {
            setUser(savedUser);
        }
    };

    const fetchCurrentProfile = async () => {
        try {
            const profile = await authService.getCurrentProfile();
            setUser(profile);
        } catch (error) {
            console.error('Failed to fetch current profile:', error);
            // Fallback to stored user if API call fails
            const savedUser = await authService.getUser();
            if (savedUser) {
                setUser(savedUser);
            }
        }
    };

    const value: AuthContextType = {
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        updateUser,
        completeOnboarding,
        refreshUser,
        fetchCurrentProfile,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export default useAuth;
