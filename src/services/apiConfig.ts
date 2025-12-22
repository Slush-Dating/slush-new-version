/**
 * Centralised API configuration
 * Handles API base URL determination for web and mobile (Capacitor) environments
 * 
 * Priority order for determining API URL:
 * 1. VITE_API_URL environment variable (recommended for staging/production)
 * 2. VITE_PRODUCTION_API_HOST environment variable (legacy support)
 * 3. Automatic detection based on hostname (production domains, network IP, localhost)
 */

/**
 * Extracts the server host address
 * Uses environment variables first, then falls back to automatic detection
 */
const getServerHost = (): string => {
    // Priority 1: Use VITE_API_URL if set (extracts origin from full URL)
    const apiUrl = import.meta.env.VITE_API_URL;
    if (apiUrl) {
        try {
            const url = new URL(apiUrl);
            console.log('📍 Using API host from VITE_API_URL:', url.origin);
            return url.origin;
        } catch {
            console.warn('⚠️ Invalid VITE_API_URL, falling back to detection');
        }
    }

    const currentHostname = window.location.hostname;
    const isNetworkIP = /^\d+\.\d+\.\d+\.\d+$/.test(currentHostname) && currentHostname !== '127.0.0.1';
    const isLocalhost = currentHostname === 'localhost' || currentHostname === '127.0.0.1';

    // Priority 2: Legacy VITE_PRODUCTION_API_HOST support
    const prodHost = import.meta.env.VITE_PRODUCTION_API_HOST;
    if (prodHost) {
        console.log('📍 Using production host from VITE_PRODUCTION_API_HOST:', prodHost);
        return prodHost;
    }

    // Priority 3: Check if we're on a production/staging domain
    const isProductionDomain = currentHostname.endsWith('slushdating.com') ||
        currentHostname.endsWith('slushdating.co.uk') ||
        currentHostname.startsWith('staging.');
    if (isProductionDomain) {
        console.log('📍 Using production/staging domain for API calls:', currentHostname);
        return currentHostname;
    }

    // If accessing via network IP address (e.g., from mobile device), use that IP
    if (isNetworkIP) {
        console.log('📍 Using network IP address for API calls:', currentHostname);
        return currentHostname;
    }

    // If accessing via localhost, use localhost
    if (isLocalhost) {
        console.log('📍 Using localhost for API calls');
        return 'localhost';
    }

    // Fallback: use current hostname
    console.log('📍 Using current hostname:', currentHostname);
    return currentHostname;
};


/**
 * Gets the base URL for API requests
 * Dynamically uses the current hostname/IP to support mobile device access
 */
export const getApiBaseUrl = (): string => {
    const hostname = getServerHost();

    // Use http protocol for local development, respect current protocol otherwise
    // For production domain, don't include port (nginx handles routing)
    // Check if hostname is already a full URL (from VITE_API_URL)
    const isFullUrl = hostname.startsWith('http');
    const hostForCheck = isFullUrl ? new URL(hostname).hostname : hostname;
    const isProductionDomain = hostForCheck.endsWith('slushdating.com') ||
        hostForCheck.endsWith('slushdating.co.uk') ||
        hostForCheck.startsWith('staging.');
    const protocol = (hostname === 'localhost' || hostname.startsWith('192.168.') || hostname.startsWith('10.'))
        ? 'http:'
        : window.location.protocol;

    // Production domain uses nginx proxy, no port needed
    const port = isProductionDomain ? '' : ':5001';
    const apiUrl = `${protocol}//${hostname}${port}/api`;

    console.log('🔗 API Base URL:', apiUrl);
    return apiUrl;
};

/**
 * Gets the socket server URL
 * Uses the same logic as API base URL for consistency
 */
export const getSocketUrl = (): string => {
    const hostname = getServerHost();

    // Use http protocol for local development, respect current protocol otherwise
    // For production domain, don't include port (nginx handles routing)
    const isFullUrl = hostname.startsWith('http');
    const hostForCheck = isFullUrl ? new URL(hostname).hostname : hostname;
    const isProductionDomain = hostForCheck.endsWith('slushdating.com') ||
        hostForCheck.endsWith('slushdating.co.uk') ||
        hostForCheck.startsWith('staging.');

    // If we got a full URL from VITE_API_URL, use it directly (without /api path)
    if (isFullUrl) {
        return hostname;
    }

    const protocol = (hostname === 'localhost' || hostname.startsWith('192.168.') || hostname.startsWith('10.'))
        ? 'http:'
        : window.location.protocol;

    // Production domain uses nginx proxy, no port needed
    const port = isProductionDomain ? '' : ':5001';
    return `${protocol}//${hostname}${port}`;
};

/**
 * Gets the base URL for media assets (images, videos)
 * Can be used in components to prefix relative media paths
 * Example: getMediaBaseUrl() + '/uploads/image.jpg' => 'http://192.168.1.208:5001/uploads/image.jpg'
 */
export const getMediaBaseUrl = (): string => {
    const hostname = getServerHost();

    // Use http protocol for local development, respect current protocol otherwise
    // For production domain, don't include port (nginx handles routing)
    const isFullUrl = hostname.startsWith('http');
    const hostForCheck = isFullUrl ? new URL(hostname).hostname : hostname;
    const isProductionDomain = hostForCheck.endsWith('slushdating.com') ||
        hostForCheck.endsWith('slushdating.co.uk') ||
        hostForCheck.startsWith('staging.');

    // If we got a full URL from VITE_API_URL, use it directly
    if (isFullUrl) {
        return hostname;
    }

    const protocol = (hostname === 'localhost' || hostname.startsWith('192.168.') || hostname.startsWith('10.'))
        ? 'http:'
        : window.location.protocol;

    // Production domain uses nginx proxy, no port needed
    const port = isProductionDomain ? '' : ':5001';
    return `${protocol}//${hostname}${port}`;
};

/**
 * Converts a relative media URL to an absolute URL
 * If the URL is already absolute, returns it as-is
 * @param url - The media URL (can be relative like '/uploads/image.jpg' or absolute)
 * @returns Absolute URL for the media
 */
export const getAbsoluteMediaUrl = (url: string): string => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    return `${getMediaBaseUrl()}${url.startsWith('/') ? url : '/' + url}`;
};
