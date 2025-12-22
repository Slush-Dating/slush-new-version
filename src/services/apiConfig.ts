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
    const currentHostname = window.location.hostname;
    const currentProtocol = window.location.protocol;

    // Check if hostname is already a full URL (from VITE_API_URL)
    const isFullUrl = hostname.startsWith('http');

    if (isFullUrl) {
        // Check if the VITE_API_URL is pointing to the same domain as the current page
        // If so, use relative URLs to avoid SSL certificate issues
        try {
            const apiUrlObj = new URL(hostname);
            const apiHostname = apiUrlObj.hostname;

            // More comprehensive same-domain detection
            const isSameDomain = apiHostname === currentHostname ||
                // Both are slushdating.com domains (handles www.slushdating.com and staging.slushdating.com)
                (apiHostname.includes('slushdating.com') && currentHostname.includes('slushdating.com')) ||
                // Both are www subdomain
                (apiHostname.startsWith('www.') && currentHostname.startsWith('www.') &&
                    apiHostname.replace('www.', '') === currentHostname.replace('www.', ''));

            if (isSameDomain) {
                // Use relative URL - browser will use same certificate as page load
                console.log('🔗 API Base URL (relative, same domain detected):', '/api');
                console.log('   Current page:', `${currentProtocol}//${currentHostname}`);
                console.log('   API would be:', `${currentProtocol}//${currentHostname}/api`);
                return '/api';
            } else {
                // Different domain - use full URL from VITE_API_URL
                const apiUrl = `${hostname}/api`;
                console.log('🔗 API Base URL (different domain):', apiUrl);
                return apiUrl;
            }
        } catch (error) {
            // If URL parsing fails, log error and fall through to auto-detection
            console.warn('⚠️ Failed to parse VITE_API_URL:', hostname, error);
        }
    }

    // Use relative URL when on the same domain to avoid SSL certificate issues
    // This is especially important for self-signed certificates
    const isProductionDomain = hostname.endsWith('slushdating.com') ||
        hostname.startsWith('staging.');
    const isSameDomain = hostname === currentHostname ||
        (isProductionDomain && currentHostname.endsWith('slushdating.com'));

    if (isSameDomain) {
        // Use relative URL - browser will use same certificate as page load
        console.log('🔗 API Base URL (relative, same hostname):', '/api');
        return '/api';
    }

    // Use http protocol for local development, respect current protocol otherwise
    // For production domain, don't include port (nginx handles routing)
    const protocol = (hostname === 'localhost' || hostname.startsWith('192.168.') || hostname.startsWith('10.'))
        ? 'http:'
        : currentProtocol;

    // Production domain uses nginx proxy, no port needed
    const port = isProductionDomain ? '' : ':5001';
    const apiUrl = `${protocol}//${hostname}${port}/api`;

    console.log('🔗 API Base URL (absolute):', apiUrl);
    return apiUrl;
};

/**
 * Gets the socket server URL
 * Uses the same logic as API base URL for consistency
 */
export const getSocketUrl = (): string => {
    const hostname = getServerHost();
    const currentHostname = window.location.hostname;
    const currentProtocol = window.location.protocol;

    // Check if hostname is already a full URL (from VITE_API_URL)
    const isFullUrl = hostname.startsWith('http');

    if (isFullUrl) {
        try {
            const apiUrlObj = new URL(hostname);
            const apiHostname = apiUrlObj.hostname;

            // Check if socket server is on same domain as current page
            const isSameDomain = apiHostname === currentHostname ||
                (apiHostname.includes('slushdating.com') && currentHostname.includes('slushdating.com')) ||
                (apiHostname.startsWith('www.') && currentHostname.startsWith('www.') &&
                    apiHostname.replace('www.', '') === currentHostname.replace('www.', ''));

            if (isSameDomain) {
                // Use relative path - browser will automatically use correct protocol and same certificate
                // Socket.io will connect to the same origin as the page
                console.log('🔌 Socket URL (relative, same domain):', window.location.origin);
                return window.location.origin;
            } else {
                // Different domain - use the full URL from VITE_API_URL
                console.log('🔌 Socket URL (different domain):', hostname);
                return hostname;
            }
        } catch (error) {
            console.warn('⚠️ Failed to parse URL for socket:', hostname, error);
            // Fall through to auto-detection
        }
    }

    // Auto-detect based on hostname
    const isProductionDomain = hostname.endsWith('slushdating.com') ||
        hostname.startsWith('staging.');
    const isSameDomain = hostname === currentHostname ||
        (isProductionDomain && currentHostname.endsWith('slushdating.com'));

    if (isSameDomain) {
        // Use current origin - browser handles protocol and certificate automatically
        console.log('🔌 Socket URL (relative, same hostname):', window.location.origin);
        return window.location.origin;
    }

    // Different hostname - build absolute URL
    const protocol = (hostname === 'localhost' || hostname.startsWith('192.168.') || hostname.startsWith('10.'))
        ? 'http:'
        : currentProtocol;

    // Production domain uses nginx proxy, no port needed
    const port = isProductionDomain ? '' : ':5001';
    const socketUrl = `${protocol}//${hostname}${port}`;
    console.log('🔌 Socket URL (absolute):', socketUrl);
    return socketUrl;
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
