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
        onProgress?: (progress: number) => void;
    } = {}
): Promise<File> => {
    const {
        maxWidth = 720,
        maxHeight = 1280,
        quality = 0.7,
        onProgress
    } = options;

    // Check if file is already small enough to skip compression
    const originalSizeMB = file.size / (1024 * 1024);
    if (originalSizeMB <= 5) { // Skip compression for files under 5MB
        return file;
    }

    try {
        // Double check threshold (redundant but safe)
        if (originalSizeMB <= 5) {
            console.log('Video is small enough, skipping compression');
            return file;
        }

        console.log(`Starting video compression for ${originalSizeMB.toFixed(1)}MB file`);

        // Compress video using MediaRecorder approach
        const compressedBlob = await compressVideoWithMediaRecorder(file, {
            maxWidth,
            maxHeight,
            quality,
            onProgress
        });

        if (compressedBlob && compressedBlob.size < file.size * 0.7) { // Only use if reduced by at least 30%
            const compressedSizeMB = compressedBlob.size / (1024 * 1024);
            console.log(`Compression successful: ${originalSizeMB.toFixed(1)}MB → ${compressedSizeMB.toFixed(1)}MB`);

            const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, '.webm'), {
                type: 'video/webm',
                lastModified: Date.now()
            });
            return compressedFile;
        } else {
            console.log('Compression did not reduce file size significantly, using original');
            return file;
        }

    } catch (error) {
        console.warn('Client-side video compression failed, using original file:', error);
        // Return original file if compression fails
        return file;
    }
};

/**
 * Compress video using MediaRecorder API with better quality settings
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
        let mediaRecorder: MediaRecorder | null = null;
        const chunks: Blob[] = [];

        if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
        }

        video.preload = 'auto';
        video.src = URL.createObjectURL(file);
        video.muted = true;
        video.playsInline = true;

        video.onloadedmetadata = () => {
            // Calculate target dimensions
            const aspectRatio = video.videoWidth / video.videoHeight;
            let targetWidth = Math.min(video.videoWidth, maxWidth);
            let targetHeight = Math.min(video.videoHeight, maxHeight);

            // Maintain aspect ratio
            if (targetWidth / targetHeight > aspectRatio) {
                targetWidth = targetHeight * aspectRatio;
            } else {
                targetHeight = targetWidth / aspectRatio;
            }

            canvas.width = targetWidth;
            canvas.height = targetHeight;

            // If video is already small enough, skip compression
            if (video.videoWidth <= maxWidth && video.videoHeight <= maxHeight && file.size <= 10 * 1024 * 1024) {
                URL.revokeObjectURL(video.src);
                resolve(null); // Signal to skip compression
                return;
            }

            // Start playing video for recording
            video.play().catch(reject);
        };

        video.onplay = () => {
            try {
                // Set up MediaRecorder with canvas stream
                const stream = canvas.captureStream(30); // 30 FPS
                const options = {
                    mimeType: 'video/webm;codecs=vp9',
                    videoBitsPerSecond: Math.min(2000000, quality * 2000000) // Adaptive bitrate based on quality
                };

                // Fallback if vp9 is not supported
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    options.mimeType = 'video/webm;codecs=vp8';
                }
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    options.mimeType = 'video/mp4';
                }

                mediaRecorder = new MediaRecorder(stream, options);

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        chunks.push(event.data);
                    }
                };

                mediaRecorder.onstop = () => {
                    const compressedBlob = new Blob(chunks, { type: 'video/webm' });
                    URL.revokeObjectURL(video.src);
                    resolve(compressedBlob);
                };

                mediaRecorder.onerror = () => {
                    URL.revokeObjectURL(video.src);
                    reject(new Error('MediaRecorder error'));
                };

                // Start recording
                mediaRecorder.start();

                // Draw video frames to canvas and stop after full video
                const drawFrame = () => {
                    if (video.ended || !mediaRecorder || mediaRecorder.state === 'inactive') {
                        if (mediaRecorder && mediaRecorder.state === 'recording') {
                            mediaRecorder.stop();
                        }
                        return;
                    }

                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    if (onProgress) {
                        const progress = (video.currentTime / video.duration) * 100;
                        onProgress(progress);
                    }

                    requestAnimationFrame(drawFrame);
                };

                drawFrame();

            } catch (error) {
                URL.revokeObjectURL(video.src);
                reject(error);
            }
        };

        video.onended = () => {
            // Stop recording when video ends
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
        };

        video.onerror = () => {
            URL.revokeObjectURL(video.src);
            reject(new Error('Failed to load video for compression'));
        };

        // Set timeout for compression
        setTimeout(() => {
            URL.revokeObjectURL(video.src);
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
            reject(new Error('Video compression timed out'));
        }, 60000); // 60 second timeout for compression
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
