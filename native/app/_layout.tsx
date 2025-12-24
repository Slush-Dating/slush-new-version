/**
 * Root Layout - Entry point for Expo Router
 * Handles auth state and redirects
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getToken, getUser, type User } from '../services/authService';
import { AuthProvider, useAuth } from '../hooks/useAuth';

// Keep splash screen visible while we check auth
SplashScreen.preventAutoHideAsync();

console.log('🚀 RootLayout loaded');

// Error Boundary Component
class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error: Error | null }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('❌ Error Boundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorTitle}>🚨 Something went wrong</Text>
                    <Text style={styles.errorText}>
                        {this.state.error?.message || 'An unexpected error occurred'}
                    </Text>
                    <Text style={styles.errorDetails}>
                        {this.state.error?.toString()}
                    </Text>
                </View>
            );
        }

        return this.props.children;
    }
}

function RootLayoutNav() {
    console.log('🧭 RootLayoutNav rendering');
    const { user, isLoading, isAuthenticated } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) {
            console.log('⏳ Still loading auth state...');
            return;
        }

        try {
            const currentSegment = segments?.[0] || '';
            const inAuthGroup = currentSegment === '(auth)';
            const inOnboardingGroup = currentSegment === '(onboarding)';
            const inMainGroup = currentSegment === '(main)';

            console.log('📍 Current segment:', currentSegment);
            console.log('👤 Auth state:', { isAuthenticated, hasUser: !!user, onboardingCompleted: user?.onboardingCompleted });

            if (!isAuthenticated) {
                // Not authenticated, redirect to auth
                if (!inAuthGroup) {
                    console.log('🔐 Redirecting to auth...');
                    router.replace('/(auth)/landing');
                }
            } else if (user && !user.onboardingCompleted) {
                // Authenticated but onboarding not complete
                if (!inOnboardingGroup) {
                    console.log('📋 Redirecting to onboarding...');
                    router.replace('/(onboarding)');
                }
            } else if (user?.onboardingCompleted) {
                // Fully authenticated and onboarded
                if (!inMainGroup) {
                    console.log('💕 Redirecting to main feed...');
                    router.replace('/(main)/feed');
                }
            }
        } catch (error) {
            console.error('❌ Navigation error:', error);
        }
    }, [user, isLoading, isAuthenticated, segments, router]);

    if (isLoading) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color="#3B82F6" />
            </View>
        );
    }

    return (
        <>
            <StatusBar style="light" />
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: '#ffffff' },
                    animation: 'fade',
                }}
            >
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(onboarding)" />
                <Stack.Screen name="(main)" />
            </Stack>
        </>
    );
}

export default function RootLayout() {
    const [fontsLoaded, fontError] = useFonts({
        // Add custom fonts here if needed
    });

    const onLayoutRootView = useCallback(async () => {
        if (fontsLoaded || fontError) {
            try {
                await SplashScreen.hideAsync();
            } catch (error) {
                console.warn('⚠️ Failed to hide splash screen:', error);
            }
        }
    }, [fontsLoaded, fontError]);

    useEffect(() => {
        onLayoutRootView();
    }, [onLayoutRootView]);

    if (!fontsLoaded && !fontError) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color="#3B82F6" />
            </View>
        );
    }

    return (
        <ErrorBoundary>
            <GestureHandlerRootView style={styles.container} onLayout={onLayoutRootView}>
                <SafeAreaProvider>
                    <AuthProvider>
                        <RootLayoutNav />
                    </AuthProvider>
                </SafeAreaProvider>
            </GestureHandlerRootView>
        </ErrorBoundary>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        padding: 20,
    },
    errorTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: 16,
    },
    errorText: {
        fontSize: 16,
        color: '#ec4899',
        marginBottom: 12,
        textAlign: 'center',
    },
    errorDetails: {
        fontSize: 12,
        color: '#94a3b8',
        textAlign: 'center',
        marginTop: 8,
    },
});
