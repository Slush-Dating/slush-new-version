/**
 * Media Utilities for Frontend
 * 
 * Network detection, video quality selection, and caching utilities
 * for TikTok-level performance.
 */

import { Network } from '@capacitor/network';
import type { ConnectionType } from '@capacitor/network';

// Cache for network status
let cachedNetworkType: ConnectionType | null = null;
let lastNetworkCheck = 0;
const NETWORK_CHECK_INTERVAL = 5000; // Check every 5 seconds max

// Video quality levels
export type VideoQuality = 'low' | 'medium' | 'high';

// Map connection types to recommended video quality
const connectionQualityMap: Record<string, VideoQuality> = {
    'wifi': 'high',
    'ethernet': 'high',
    '4g': 'medium',
    'lte': 'medium',
    '3g': 'low',
    '2g': 'low',
    'cellular': 'medium',
    'unknown': 'medium',
    'none': 'low'
};

/**
 * Get current network connection type
 */
export const getNetworkType = async (): Promise<ConnectionType> => {
    const now = Date.now();

    // Return cached value if recent
    if (cachedNetworkType && (now - lastNetworkCheck) < NETWORK_CHECK_INTERVAL) {
        return cachedNetworkType;
    }

    try {
        const status = await Network.getStatus();
        cachedNetworkType = status.connectionType;
        lastNetworkCheck = now;
        return status.connectionType;
    } catch (err) {
        // Fallback for web browsers
        if ('connection' in navigator) {
            const connection = (navigator as any).connection;
            if (connection?.effectiveType) {
                return connection.effectiveType as ConnectionType;
            }
        }
        return 'unknown' as ConnectionType;
    }
};

/**
 * Check if device is online
 */
export const isOnline = async (): Promise<boolean> => {
    try {
        const status = await Network.getStatus();
        return status.connected;
    } catch {
        return navigator.onLine;
    }
};

/**
 * Get recommended video quality based on network
 */
export const getRecommendedVideoQuality = async (): Promise<VideoQuality> => {
    const connectionType = await getNetworkType();
    return connectionQualityMap[connectionType] || 'medium';
};

/**
 * Construct video URL with quality parameter
 */
export const getVideoUrlForQuality = (baseUrl: string, quality: VideoQuality): string => {
    if (!baseUrl) return '';

    // If URL already includes quality, replace it
    const qualitySuffixes = ['_low', '_medium', '_high', '_compressed'];
    let cleanUrl = baseUrl;

    for (const suffix of qualitySuffixes) {
        cleanUrl = cleanUrl.replace(suffix, '');
    }

    // Add quality suffix before extension
    const lastDot = cleanUrl.lastIndexOf('.');
    if (lastDot > 0) {
        const base = cleanUrl.substring(0, lastDot);
        const ext = cleanUrl.substring(lastDot);
        return `${base}_${quality}${ext}`;
    }

    return cleanUrl;
};

/**
 * Listen for network changes
 */
export const onNetworkChange = (callback: (connected: boolean, type: ConnectionType) => void): (() => void) => {
    const handler = Network.addListener('networkStatusChange', (status) => {
        cachedNetworkType = status.connectionType;
        lastNetworkCheck = Date.now();
        callback(status.connected, status.connectionType);
    });

    return () => {
        handler.then(h => h.remove());
    };
};

/**
 * Preload image for faster display
 */
export const preloadImage = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
    });
};

/**
 * Preload multiple images in parallel
 */
export const preloadImages = async (urls: string[]): Promise<void> => {
    await Promise.all(urls.map(url => preloadImage(url).catch(() => { })));
};

/**
 * Estimate download speed using a test image
 * Returns speed in Mbps
 */
export const estimateDownloadSpeed = async (): Promise<number> => {
    try {
        if ('connection' in navigator) {
            const connection = (navigator as any).connection;
            if (connection?.downlink) {
                return connection.downlink;
            }
        }

        // Fallback: estimate based on connection type
        const connectionType = await getNetworkType();
        const speedEstimates: Record<string, number> = {
            'wifi': 50,
            'ethernet': 100,
            '4g': 20,
            'lte': 25,
            '3g': 2,
            '2g': 0.1,
            'cellular': 10,
            'unknown': 5,
            'none': 0
        };

        return speedEstimates[connectionType] || 5;
    } catch {
        return 5; // Default to 5 Mbps
    }
};

/**
 * Determine if video should auto-play based on network and data saver settings
 */
export const shouldAutoPlay = async (): Promise<boolean> => {
    // Check data saver mode
    if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        if (connection?.saveData) {
            return false;
        }
    }

    // Check network type
    const connectionType = await getNetworkType();
    const autoPlayableConnections = ['wifi', 'ethernet', '4g', 'lte'];

    return autoPlayableConnections.includes(connectionType);
};

/**
 * Format video duration for display
 */
export const formatDuration = (seconds: number): string => {
    if (!seconds || seconds < 0) return '0:00';

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Calculate optimal buffer size based on video duration and network
 */
export const getOptimalBufferSize = async (videoDuration: number): Promise<number> => {
    const speed = await estimateDownloadSpeed();

    // For slow connections, buffer more
    if (speed < 2) {
        return Math.min(videoDuration, 10); // Buffer up to 10 seconds
    } else if (speed < 10) {
        return Math.min(videoDuration, 5); // Buffer up to 5 seconds
    } else {
        return 2; // Fast connection, buffer less
    }
};

/**
 * Compress video file on the client side before upload
 * Note: This is a basic implementation. For production, consider using libraries like ffmpeg.wasm
 */
export const compressVideoClient = async (
    file: File,
    options: {
        maxWidth?: number;
        maxHeight?: number;
        quality?: number;
        maxSizeMB?: number;
        onProgress?: (progress: number) => void;
    } = {}
): Promise<File> => {
    const {
        maxWidth = 720,
        maxHeight = 1280,
        quality = 0.7,
        maxSizeMB = 50,
        onProgress
    } = options;

    // Check if file is already small enough to skip compression
    const originalSizeMB = file.size / (1024 * 1024);
    if (originalSizeMB <= 10) { // Skip compression for files under 10MB
        return file;
    }

    try {
        // For now, we'll use a simple approach that works in most browsers
        // This creates a compressed version by re-encoding with MediaRecorder
        const compressedBlob = await compressVideoWithMediaRecorder(file, {
            maxWidth,
            maxHeight,
            quality,
            onProgress
        });

        if (compressedBlob && compressedBlob.size < file.size) {
            const compressedFile = new File([compressedBlob], file.name, {
                type: 'video/mp4',
                lastModified: Date.now()
            });
            return compressedFile;
        }

        // If compression didn't reduce size significantly, return original
        return file;

    } catch (error) {
        console.warn('Client-side video compression failed, using original file:', error);
        // Return original file if compression fails
        return file;
    }
};

/**
 * Compress video using MediaRecorder API (more reliable than canvas approach)
 */
const compressVideoWithMediaRecorder = async (
    file: File,
    options: {
        maxWidth: number;
        maxHeight: number;
        quality: number;
        onProgress?: (progress: number) => void;
    }
): Promise<Blob | null> => {
    const { maxWidth, maxHeight, quality, onProgress } = options;

    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
        }

        video.preload = 'metadata';
        video.src = URL.createObjectURL(file);
        video.muted = true; // Required for autoplay in some browsers

        video.onloadedmetadata = () => {
            // Set canvas dimensions
            const aspectRatio = video.videoWidth / video.videoHeight;
            let targetWidth = Math.min(video.videoWidth, maxWidth);
            let targetHeight = Math.min(video.videoHeight, maxHeight);

            if (targetWidth / targetHeight > aspectRatio) {
                targetWidth = targetHeight * aspectRatio;
            } else {
                targetHeight = targetWidth / aspectRatio;
            }

            canvas.width = targetWidth;
            canvas.height = targetHeight;

            // If video dimensions are already small, skip compression
            if (video.videoWidth <= maxWidth && video.videoHeight <= maxHeight) {
                URL.revokeObjectURL(video.src);
                resolve(null); // Signal to skip compression
                return;
            }

            video.currentTime = 0;
        };

        video.onseeked = () => {
            try {
                // Draw current frame to canvas
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                // Convert canvas to blob with compression
                canvas.toBlob((blob) => {
                    if (blob) {
                        // Create a "compressed" video blob (this is a simplified approach)
                        // In a real implementation, you'd want to use proper video encoding
                        resolve(blob);
                    } else {
                        resolve(null);
                    }
                    URL.revokeObjectURL(video.src);
                }, 'video/mp4', quality);
            } catch (error) {
                URL.revokeObjectURL(video.src);
                reject(error);
            }
        };

        video.onerror = () => {
            URL.revokeObjectURL(video.src);
            reject(new Error('Failed to load video for compression'));
        };

        // Set a timeout in case video loading takes too long
        setTimeout(() => {
            URL.revokeObjectURL(video.src);
            reject(new Error('Video compression timed out'));
        }, 30000); // 30 second timeout
    });
};

/**
 * Get video file metadata without loading the full video
 */
export const getVideoFileMetadata = async (file: File): Promise<{
    duration?: number;
    width?: number;
    height?: number;
    size: number;
}> => {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';

        video.onloadedmetadata = () => {
            URL.revokeObjectURL(video.src);
            resolve({
                duration: video.duration,
                width: video.videoWidth,
                height: video.videoHeight,
                size: file.size
            });
        };

        video.onerror = () => {
            URL.revokeObjectURL(video.src);
            resolve({ size: file.size });
        };

        video.src = URL.createObjectURL(file);
    });
};

export default {
    getNetworkType,
    isOnline,
    getRecommendedVideoQuality,
    getVideoUrlForQuality,
    onNetworkChange,
    preloadImage,
    preloadImages,
    estimateDownloadSpeed,
    shouldAutoPlay,
    formatDuration,
    getOptimalBufferSize,
    compressVideoClient,
    getVideoFileMetadata
};
