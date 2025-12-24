/**
 * Theme Constants for React Native
 * Matches the web design at www.slushdating.com
 */

// Brand Colors - Slush
export const colors = {
    // Primary - Slush Blue
    primary: '#3B82F6',
    primaryDark: '#1D4ED8',
    primaryLight: '#60A5FA',
    primaryPale: '#DBEAFE',

    // Secondary Colors
    purple: '#8B5CF6',
    purpleDark: '#7C3AED',
    purpleLight: '#A78BFA',
    pink: '#EC4899',
    pinkDark: '#BE185D',
    orange: '#F59E0B',
    orangeDark: '#D97706',
    red: '#EF4444',

    // Semantic Colors
    success: '#10B981',
    successLight: '#34D399',
    successPale: '#D1FAE5',
    warning: '#F59E0B',
    warningLight: '#FCD34D',
    warningPale: '#FEF3C7',
    error: '#EF4444',
    errorLight: '#F87171',
    errorPale: '#FEE2E2',

    // Backgrounds (Light Theme)
    bgPrimary: '#F8F9FA',
    bgSecondary: '#F1F3F4',
    bgTertiary: '#FAF9F6',
    bgAccent: '#E9ECEF',
    bgWhite: '#FFFFFF',

    // Text Colors (Light Theme)
    textPrimary: '#1A202C',
    textSecondary: '#4A5568',
    textTertiary: '#718096',
    textMuted: '#A0AEC0',

    // Borders
    borderLight: 'rgba(0, 0, 0, 0.05)',
    borderMedium: 'rgba(0, 0, 0, 0.08)',
    borderStrong: 'rgba(0, 0, 0, 0.12)',

    // Glass Effects
    glassBackground: 'rgba(255, 255, 255, 0.7)',
    glassBackgroundStrong: 'rgba(255, 255, 255, 0.9)',
    glassBorder: 'rgba(0, 0, 0, 0.05)',

    // Ice Breaker / Arctic
    arcticLight: '#7DD3FC',
    arcticDark: '#0EA5E9',
    arcticGlow: 'rgba(125, 211, 252, 0.4)',
};

// Radius Scale
export const radius = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    full: 9999,
};

// Shadow Styles
export const shadows = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    xl: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
    },
    blue: {
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
    },
    arctic: {
        shadowColor: '#7DD3FC',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
        elevation: 6,
    },
};

// Typography
export const typography = {
    fontFamily: 'System', // Will use system font until Outfit is loaded
    sizes: {
        xs: 11,
        sm: 13,
        md: 15,
        lg: 17,
        xl: 20,
        xxl: 24,
        xxxl: 32,
    },
    weights: {
        regular: '400' as const,
        medium: '500' as const,
        semibold: '600' as const,
        bold: '700' as const,
    },
};

// Spacing
export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
};

export default {
    colors,
    radius,
    shadows,
    typography,
    spacing,
};
