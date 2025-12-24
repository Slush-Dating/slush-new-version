/**
 * Video Processing Utility
 * 
 * Handles video compression, thumbnail generation, and quality variants
 * for TikTok-level performance optimization.
 */

import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Video quality presets optimized for mobile streaming
const QUALITY_PRESETS = {
    low: {
        width: 360,
        videoBitrate: '500k',
        audioBitrate: '64k',
        suffix: '_low'
    },
    medium: {
        width: 540,
        videoBitrate: '1000k',
        audioBitrate: '96k',
        suffix: '_medium'
    },
    high: {
        width: 720,
        videoBitrate: '2000k',
        audioBitrate: '128k',
        suffix: '_high'
    }
};

// Default compression settings (balanced quality/size)
const DEFAULT_SETTINGS = {
    codec: 'libx264',
    crf: 23,           // Constant Rate Factor (18-28, lower = better quality)
    preset: 'medium',  // Encoding speed vs compression ratio
    profile: 'main',   // H.264 profile for broad compatibility
    level: '3.1',      // H.264 level for mobile compatibility
    pixelFormat: 'yuv420p', // Most compatible pixel format
    audioCodec: 'aac',
    audioChannels: 2,
    sampleRate: 44100
};

/**
 * Ensure upload directories exist
 */
const ensureDirectories = () => {
    const baseDir = path.join(__dirname, '..', 'uploads');
    const dirs = [
        path.join(baseDir, 'videos', 'compressed'),
        path.join(baseDir, 'videos', 'thumbnails'),
        path.join(baseDir, 'videos', 'qualities'),
        path.join(baseDir, 'images', 'original'),
        path.join(baseDir, 'images', 'thumbnails'),
        path.join(baseDir, 'images', 'medium'),
        path.join(baseDir, 'images', 'full')
    ];

    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    return baseDir;
};

/**
 * Get video metadata (duration, dimensions, codec info)
 */
export const getVideoMetadata = (inputPath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (err, metadata) => {
            if (err) {
                reject(err);
                return;
            }

            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

            resolve({
                duration: metadata.format.duration || 0,
                width: videoStream?.width || 0,
                height: videoStream?.height || 0,
                bitrate: metadata.format.bit_rate || 0,
                fps: videoStream?.r_frame_rate ? eval(videoStream.r_frame_rate) : 30,
                codec: videoStream?.codec_name || 'unknown',
                hasAudio: !!audioStream,
                fileSize: metadata.format.size || 0
            });
        });
    });
};

/**
 * Generate thumbnail from video at specified timestamp
 */
export const generateThumbnail = (inputPath, outputPath, timestamp = '00:00:01') => {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .screenshots({
                timestamps: [timestamp],
                filename: path.basename(outputPath),
                folder: path.dirname(outputPath),
                size: '720x?' // Maintain aspect ratio with 720px width
            })
            .on('end', () => {
                console.log(`[VideoProcessor] Thumbnail generated: ${outputPath}`);
                resolve(outputPath);
            })
            .on('error', (err) => {
                console.error(`[VideoProcessor] Thumbnail error:`, err);
                reject(err);
            });
    });
};

/**
 * Compress video with optimized settings for mobile streaming
 * Auto-trims to 30 seconds max for dating app UX
 */
export const compressVideo = (inputPath, outputPath, options = {}) => {
    return new Promise((resolve, reject) => {
        const settings = { ...DEFAULT_SETTINGS, ...options };
        const maxDuration = options.maxDuration || 30; // 30 seconds max

        console.log(`[VideoProcessor] Compressing video: ${inputPath} (max ${maxDuration}s)`);
        const startTime = Date.now();

        ffmpeg(inputPath)
            .duration(maxDuration) // Auto-trim to 30 seconds
            .videoCodec(settings.codec)
            .addOption('-crf', settings.crf.toString())
            .addOption('-preset', settings.preset)
            .addOption('-profile:v', settings.profile)
            .addOption('-level', settings.level)
            .addOption('-pix_fmt', settings.pixelFormat)
            .addOption('-movflags', '+faststart') // Enable fast start for streaming
            .audioCodec(settings.audioCodec)
            .audioChannels(settings.audioChannels)
            .audioFrequency(settings.sampleRate)
            .audioBitrate('128k')
            // Limit max dimensions while maintaining aspect ratio
            .size('?x720')
            .autopad()
            .output(outputPath)
            .on('progress', (progress) => {
                if (progress.percent) {
                    console.log(`[VideoProcessor] Progress: ${Math.round(progress.percent)}%`);
                }
            })
            .on('end', () => {
                const duration = (Date.now() - startTime) / 1000;
                console.log(`[VideoProcessor] Compression complete in ${duration.toFixed(1)}s: ${outputPath}`);
                resolve(outputPath);
            })
            .on('error', (err) => {
                console.error(`[VideoProcessor] Compression error:`, err);
                reject(err);
            })
            .run();
    });
};

/**
 * Create multiple quality versions of a video
 */
export const createQualityVariants = async (inputPath, baseName, qualities = ['low', 'medium', 'high']) => {
    const baseDir = ensureDirectories();
    const qualitiesDir = path.join(baseDir, 'videos', 'qualities');
    const results = {};

    for (const quality of qualities) {
        const preset = QUALITY_PRESETS[quality];
        if (!preset) continue;

        const outputFilename = `${baseName}${preset.suffix}.mp4`;
        const outputPath = path.join(qualitiesDir, outputFilename);

        try {
            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .videoCodec('libx264')
                    .addOption('-crf', '23')
                    .addOption('-preset', 'medium')
                    .addOption('-profile:v', 'main')
                    .addOption('-movflags', '+faststart')
                    .size(`${preset.width}x?`)
                    .videoBitrate(preset.videoBitrate)
                    .audioCodec('aac')
                    .audioBitrate(preset.audioBitrate)
                    .output(outputPath)
                    .on('end', () => {
                        console.log(`[VideoProcessor] Created ${quality} quality: ${outputPath}`);
                        resolve(outputPath);
                    })
                    .on('error', reject)
                    .run();
            });

            results[quality] = `/uploads/videos/qualities/${outputFilename}`;
        } catch (err) {
            console.error(`[VideoProcessor] Failed to create ${quality} quality:`, err);
        }
    }

    return results;
};

/**
 * Process uploaded video - full pipeline
 * 
 * 1. Extract metadata
 * 2. Generate thumbnail
 * 3. Compress to optimized format
 * 4. Optionally create quality variants
 * 
 * @param {string} inputPath - Path to uploaded video
 * @param {Object} options - Processing options
 * @returns {Object} - Processed video information
 */
export const processVideo = async (inputPath, options = {}) => {
    const {
        generateQualities = false,
        qualities = ['low', 'medium']
    } = options;

    const baseDir = ensureDirectories();
    const filename = path.basename(inputPath);
    const baseName = path.parse(filename).name;
    const ext = path.parse(filename).ext;

    console.log(`[VideoProcessor] Processing video: ${filename}`);

    try {
        // 1. Get original metadata
        const metadata = await getVideoMetadata(inputPath);
        console.log(`[VideoProcessor] Original: ${Math.round(metadata.fileSize / 1024 / 1024)}MB, ${metadata.width}x${metadata.height}, ${metadata.duration.toFixed(1)}s`);

        // 2. Generate thumbnail
        const thumbnailFilename = `${baseName}_thumb.jpg`;
        const thumbnailPath = path.join(baseDir, 'videos', 'thumbnails', thumbnailFilename);

        // Generate thumbnail at 1 second or 25% into video
        const thumbTimestamp = metadata.duration > 4
            ? `00:00:${Math.floor(metadata.duration * 0.25).toString().padStart(2, '0')}`
            : '00:00:01';

        await generateThumbnail(inputPath, thumbnailPath, thumbTimestamp);

        // 3. Compress video
        const compressedFilename = `${baseName}_compressed.mp4`;
        const compressedPath = path.join(baseDir, 'videos', 'compressed', compressedFilename);
        await compressVideo(inputPath, compressedPath);

        // Get compressed file size
        const compressedStats = fs.statSync(compressedPath);
        const compressionRatio = ((1 - compressedStats.size / metadata.fileSize) * 100).toFixed(1);
        console.log(`[VideoProcessor] Compressed: ${Math.round(compressedStats.size / 1024 / 1024)}MB (${compressionRatio}% reduction)`);

        // 4. Create quality variants if requested
        let qualityUrls = {};
        if (generateQualities) {
            qualityUrls = await createQualityVariants(compressedPath, baseName, qualities);
        }

        // Build result object
        const result = {
            original: {
                path: inputPath,
                url: `/uploads/${filename}`,
                size: metadata.fileSize,
                width: metadata.width,
                height: metadata.height
            },
            compressed: {
                url: `/uploads/videos/compressed/${compressedFilename}`,
                size: compressedStats.size
            },
            thumbnail: {
                url: `/uploads/videos/thumbnails/${thumbnailFilename}`
            },
            metadata: {
                duration: metadata.duration,
                width: metadata.width,
                height: metadata.height,
                fps: metadata.fps,
                hasAudio: metadata.hasAudio,
                compressionRatio: parseFloat(compressionRatio)
            },
            qualities: qualityUrls
        };

        console.log(`[VideoProcessor] Processing complete for ${filename}`);
        return result;

    } catch (error) {
        console.error(`[VideoProcessor] Error processing video:`, error);
        throw error;
    }
};

/**
 * Check if FFmpeg is available
 */
export const checkFfmpegAvailable = () => {
    return new Promise((resolve) => {
        ffmpeg.getAvailableFormats((err, formats) => {
            if (err) {
                console.error('[VideoProcessor] FFmpeg not available:', err);
                resolve(false);
            } else {
                console.log('[VideoProcessor] FFmpeg is available');
                resolve(true);
            }
        });
    });
};

export default {
    processVideo,
    compressVideo,
    generateThumbnail,
    getVideoMetadata,
    createQualityVariants,
    checkFfmpegAvailable
};

// Ensure directories exist on startup
ensureDirectories();
