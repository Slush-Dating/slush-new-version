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
        // If a fallback route is explicitly provided, always use it
        // This ensures we go back to the correct screen (e.g., profile -> settings -> profile)
        // We use replace to go back to the fallback route without adding to the stack
        if (fallbackRoute) {
            // Use dismissAll or replace depending on navigation context
            // For tab screens, replace should work correctly
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

