/**
 * Centralized API configuration for React Native
 * Handles API base URL determination for iOS/Android environments
 */

import Constants from 'expo-constants';

// Get API URL from expo config or use default
const getApiUrl = (): string => {
    // Priority 1: Check expo config extra (app.json)
    const configApiUrl = Constants.expoConfig?.extra?.apiUrl;
    if (configApiUrl) {
        console.log('📍 Using API URL from expo config:', configApiUrl);
        return configApiUrl;
    }

    // Priority 2: Check environment variables
    const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
    if (envApiUrl) {
        console.log('📍 Using API URL from environment:', envApiUrl);
        return envApiUrl;
    }

    // Priority 3: Check for local web development only if no explicit config
    if (Constants.platform?.web && typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            // Only use localhost:5001 if the backend is expected to run locally
            // For testing with staging, set apiUrl in app.json or EXPO_PUBLIC_API_URL
            console.log('📍 Local development detected, using staging API URL');
            // Previously returned localhost:5001 but this causes issues when backend isn't running
            // return 'http://localhost:5001';
        }
    }

    // Default to staging
    console.log('📍 Using default staging API URL');
    return 'https://staging.slushdating.com';
};

const API_BASE = getApiUrl();

/**
 * Gets the base URL for API requests
 */
export const getApiBaseUrl = (): string => {
    const apiUrl = `${API_BASE}/api`;
    console.log('🔗 API Base URL:', apiUrl);
    return apiUrl;
};

/**
 * Gets the socket server URL
 */
export const getSocketUrl = (): string => {
    console.log('🔌 Socket URL:', API_BASE);
    return API_BASE;
};

/**
 * Gets the base URL for media assets (images, videos)
 */
export const getMediaBaseUrl = (): string => {
    return API_BASE;
};

/**
 * Converts a relative media URL to an absolute URL
 * If the URL is already absolute, returns it as-is
 * @param url - The media URL (can be relative like '/uploads/image.jpg' or absolute)
 * @returns Absolute URL for the media or empty string if invalid
 */
export const getAbsoluteMediaUrl = (url: string): string => {
    if (!url || typeof url !== 'string') return '';

    // Trim whitespace
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return '';

    // Check if already absolute URL
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
        // Basic URL validation - ensure it has a valid structure
        try {
            new URL(trimmedUrl);
            return trimmedUrl;
        } catch {
            console.warn('Invalid absolute URL:', trimmedUrl);
            return '';
        }
    }

    // For relative URLs, construct absolute URL
    const baseUrl = getMediaBaseUrl();
    const relativePath = trimmedUrl.startsWith('/') ? trimmedUrl : '/' + trimmedUrl;
    const fullUrl = baseUrl + relativePath;

    // Validate the constructed URL
    try {
        new URL(fullUrl);
        return fullUrl;
    } catch {
        console.warn('Invalid constructed URL:', fullUrl);
        return '';
    }
};

export default {
    getApiBaseUrl,
    getSocketUrl,
    getMediaBaseUrl,
    getAbsoluteMediaUrl,
};
