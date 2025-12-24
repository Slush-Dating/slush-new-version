/**
 * Image Processing Utility
 * 
 * Handles image compression, resizing, and WebP conversion
 * for optimal loading performance.
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Image size presets
const SIZE_PRESETS = {
    thumbnail: {
        width: 200,
        height: 300,
        quality: 70,
        suffix: '_thumb'
    },
    medium: {
        width: 600,
        height: 900,
        quality: 80,
        suffix: '_medium'
    },
    full: {
        width: 1200,
        height: 1800,
        quality: 85,
        suffix: '_full'
    }
};

/**
 * Ensure image directories exist
 */
const ensureDirectories = () => {
    const baseDir = path.join(__dirname, '..', 'uploads', 'images');
    const dirs = [
        path.join(baseDir, 'original'),
        path.join(baseDir, 'thumbnails'),
        path.join(baseDir, 'medium'),
        path.join(baseDir, 'full'),
        path.join(baseDir, 'webp')
    ];

    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    return baseDir;
};

/**
 * Get image metadata
 */
export const getImageMetadata = async (inputPath) => {
    try {
        const metadata = await sharp(inputPath).metadata();
        const stats = fs.statSync(inputPath);

        return {
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            size: stats.size,
            hasAlpha: metadata.hasAlpha || false,
            orientation: metadata.orientation || 1
        };
    } catch (error) {
        console.error('[ImageProcessor] Error getting metadata:', error);
        throw error;
    }
};

/**
 * Compress and resize image to specified dimensions
 */
export const resizeImage = async (inputPath, outputPath, options = {}) => {
    const {
        width = 1200,
        height = 1800,
        quality = 85,
        format = 'jpeg',
        fit = 'inside'
    } = options;

    try {
        let pipeline = sharp(inputPath)
            .rotate() // Auto-rotate based on EXIF orientation
            .resize(width, height, {
                fit: fit,
                withoutEnlargement: true // Don't upscale smaller images
            });

        // Apply format-specific options
        if (format === 'webp') {
            pipeline = pipeline.webp({ quality });
        } else if (format === 'jpeg' || format === 'jpg') {
            pipeline = pipeline.jpeg({
                quality,
                progressive: true, // Progressive JPEG for faster perceived loading
                mozjpeg: true // Use MozJPEG for better compression
            });
        } else if (format === 'png') {
            pipeline = pipeline.png({
                quality,
                progressive: true,
                compressionLevel: 9
            });
        }

        await pipeline.toFile(outputPath);

        const outputStats = fs.statSync(outputPath);
        console.log(`[ImageProcessor] Resized: ${path.basename(outputPath)} (${Math.round(outputStats.size / 1024)}KB)`);

        return outputPath;
    } catch (error) {
        console.error('[ImageProcessor] Resize error:', error);
        throw error;
    }
};

/**
 * Convert image to WebP format
 */
export const convertToWebP = async (inputPath, outputPath, quality = 80) => {
    try {
        await sharp(inputPath)
            .rotate()
            .webp({ quality })
            .toFile(outputPath);

        const outputStats = fs.statSync(outputPath);
        console.log(`[ImageProcessor] WebP created: ${path.basename(outputPath)} (${Math.round(outputStats.size / 1024)}KB)`);

        return outputPath;
    } catch (error) {
        console.error('[ImageProcessor] WebP conversion error:', error);
        throw error;
    }
};

/**
 * Create all size variants of an image
 */
export const createSizeVariants = async (inputPath, baseName, sizes = ['thumbnail', 'medium', 'full']) => {
    const baseDir = ensureDirectories();
    const results = {};

    for (const size of sizes) {
        const preset = SIZE_PRESETS[size];
        if (!preset) continue;

        // Create JPEG version
        const jpegFilename = `${baseName}${preset.suffix}.jpg`;
        const jpegPath = path.join(baseDir, size === 'thumbnail' ? 'thumbnails' : size, jpegFilename);

        try {
            await resizeImage(inputPath, jpegPath, {
                width: preset.width,
                height: preset.height,
                quality: preset.quality,
                format: 'jpeg'
            });

            results[size] = {
                jpeg: `/uploads/images/${size === 'thumbnail' ? 'thumbnails' : size}/${jpegFilename}`
            };

            // Create WebP version for each size
            const webpFilename = `${baseName}${preset.suffix}.webp`;
            const webpPath = path.join(baseDir, 'webp', webpFilename);

            await convertToWebP(inputPath, webpPath, preset.quality);
            results[size].webp = `/uploads/images/webp/${webpFilename}`;

        } catch (err) {
            console.error(`[ImageProcessor] Failed to create ${size} variant:`, err);
        }
    }

    return results;
};

/**
 * Process uploaded image - full pipeline
 * 
 * 1. Extract metadata
 * 2. Create size variants (thumbnail, medium, full)
 * 3. Create WebP versions for each size
 * 
 * @param {string} inputPath - Path to uploaded image
 * @param {Object} options - Processing options
 * @returns {Object} - Processed image information
 */
export const processImage = async (inputPath, options = {}) => {
    const {
        sizes = ['thumbnail', 'medium', 'full'],
        createWebP = true
    } = options;

    const baseDir = ensureDirectories();
    const filename = path.basename(inputPath);
    const baseName = path.parse(filename).name;

    console.log(`[ImageProcessor] Processing image: ${filename}`);

    try {
        // 1. Get original metadata
        const metadata = await getImageMetadata(inputPath);
        console.log(`[ImageProcessor] Original: ${Math.round(metadata.size / 1024)}KB, ${metadata.width}x${metadata.height}, ${metadata.format}`);

        // 2. Copy original to organized location
        const originalFilename = `${baseName}_original${path.extname(filename)}`;
        const originalPath = path.join(baseDir, 'original', originalFilename);
        fs.copyFileSync(inputPath, originalPath);

        // 3. Create size variants
        const variants = await createSizeVariants(inputPath, baseName, sizes);

        // Calculate total size savings
        let totalOriginalSize = metadata.size;
        let totalCompressedSize = 0;

        for (const size of sizes) {
            if (variants[size]?.jpeg) {
                const variantPath = path.join(baseDir, size === 'thumbnail' ? 'thumbnails' : size, `${baseName}${SIZE_PRESETS[size].suffix}.jpg`);
                if (fs.existsSync(variantPath)) {
                    totalCompressedSize += fs.statSync(variantPath).size;
                }
            }
        }

        // Build result object
        const result = {
            original: {
                url: `/uploads/images/original/${originalFilename}`,
                size: metadata.size,
                width: metadata.width,
                height: metadata.height,
                format: metadata.format
            },
            variants: variants,
            metadata: {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                hasAlpha: metadata.hasAlpha
            },
            // Provide easy access to most common URLs
            thumbnailUrl: variants.thumbnail?.webp || variants.thumbnail?.jpeg,
            mediumUrl: variants.medium?.webp || variants.medium?.jpeg,
            fullUrl: variants.full?.webp || variants.full?.jpeg
        };

        console.log(`[ImageProcessor] Processing complete for ${filename}`);
        return result;

    } catch (error) {
        console.error(`[ImageProcessor] Error processing image:`, error);
        throw error;
    }
};

/**
 * Optimize a single image without creating variants
 * Good for quick compression of profile photos
 */
export const optimizeImage = async (inputPath, outputPath, options = {}) => {
    const {
        maxWidth = 1200,
        maxHeight = 1800,
        quality = 85,
        format = 'jpeg'
    } = options;

    try {
        const metadata = await getImageMetadata(inputPath);

        let pipeline = sharp(inputPath)
            .rotate();

        // Only resize if larger than max dimensions
        if (metadata.width > maxWidth || metadata.height > maxHeight) {
            pipeline = pipeline.resize(maxWidth, maxHeight, {
                fit: 'inside',
                withoutEnlargement: true
            });
        }

        if (format === 'webp') {
            pipeline = pipeline.webp({ quality });
        } else {
            pipeline = pipeline.jpeg({
                quality,
                progressive: true,
                mozjpeg: true
            });
        }

        await pipeline.toFile(outputPath);

        const inputStats = fs.statSync(inputPath);
        const outputStats = fs.statSync(outputPath);
        const savingsPercent = ((1 - outputStats.size / inputStats.size) * 100).toFixed(1);

        console.log(`[ImageProcessor] Optimized: ${Math.round(inputStats.size / 1024)}KB -> ${Math.round(outputStats.size / 1024)}KB (${savingsPercent}% savings)`);

        return {
            path: outputPath,
            originalSize: inputStats.size,
            optimizedSize: outputStats.size,
            savings: parseFloat(savingsPercent)
        };
    } catch (error) {
        console.error('[ImageProcessor] Optimization error:', error);
        throw error;
    }
};

/**
 * Check if Sharp is working correctly
 */
export const checkSharpAvailable = async () => {
    try {
        const info = await sharp.versions;
        console.log('[ImageProcessor] Sharp is available:', info);
        return true;
    } catch (err) {
        console.error('[ImageProcessor] Sharp not available:', err);
        return false;
    }
};

export default {
    processImage,
    optimizeImage,
    resizeImage,
    convertToWebP,
    getImageMetadata,
    createSizeVariants,
    checkSharpAvailable
};
