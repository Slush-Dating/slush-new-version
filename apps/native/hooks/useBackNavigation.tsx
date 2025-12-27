/**
 * Custom hook for proper back navigation
 * Handles back button navigation with fallback to sensible defaults
 */

import { useEffect, useCallback } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useRouter, useSegments } from 'expo-router';

/**
 * Hook to handle back navigation properly
 * @param fallbackRoute - Route to navigate to when going back (always used if provided)
 */
export function useBackNavigation(fallbackRoute?: string) {
    const router = useRouter();
    const segments = useSegments();

    const handleBack = useCallback(() => {
        // Try to go back if possible first to respect user history
        if (router.canGoBack()) {
            router.back();
            return;
        }

        // If we can't go back, use fallback if provided
        if (fallbackRoute) {
            router.replace(fallbackRoute);
            return;
        }

        // Otherwise, try to go back if possible
        if (router.canGoBack()) {
            router.back();
        } else {
            // If we can't go back, navigate to a sensible default
            // Determine fallback based on current route context
            const currentSegment = segments?.[0] || '';

            if (currentSegment === '(main)') {
                // If we're in main app, go to profile tab (safe default)
                router.replace('/(main)/profile');
            } else {
                // For other contexts, go to main feed
                router.replace('/(main)/feed');
            }
        }
    }, [router, segments, fallbackRoute]);

    // Handle Android hardware back button
    useEffect(() => {
        if (Platform.OS !== 'android') return;

        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            handleBack();
            return true; // Prevent default back behavior
        });

        return () => backHandler.remove();
    }, [handleBack]);

    return handleBack;
}

