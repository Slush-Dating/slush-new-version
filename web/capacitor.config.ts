import type { CapacitorConfig } from '@capacitor/cli';

// Determine hostname based on environment
// TestFlight builds use staging by default, production requires explicit CAPACITOR_HOSTNAME
const getHostname = (): string => {
  // Check for environment variable first
  if (process.env.CAPACITOR_HOSTNAME) {
    return process.env.CAPACITOR_HOSTNAME;
  }
  // Default to staging for TestFlight builds
  return 'staging.slushdating.com';
};

const config: CapacitorConfig = {
  appId: 'com.mobile.app.virtualspeeddate',
  appName: 'Slush Dating',
  webDir: 'dist',

  // Server configuration for optimal performance
  server: {
    // Always use HTTPS for production builds to satisfy Agora SDK requirements
    androidScheme: 'https',
    // Allow cleartext traffic only for development builds
    cleartext: process.env.NODE_ENV !== 'production',
    // Use environment-driven hostname (staging for TestFlight, production when explicitly set)
    hostname: getHostname(),
  },

  // iOS-specific configurations
  ios: {
    // Enable smooth scrolling
    scrollEnabled: true,
    // Background fetch for preloading content
    backgroundColor: '#000000',
    // Allow arbitrary loads for video streaming in development
    allowsLinkPreview: true,
    // Preferred content mode for better video performance
    preferredContentMode: 'mobile',
    // Fix transition issues on iOS
    contentInset: 'never',
    // Improve animation performance
    animationDuration: 0.3,
    // Prevent viewport issues during transitions
    viewportFit: 'cover',
  },

  // Android-specific configurations
  android: {
    // Enable hardware acceleration for video playback
    useLegacyBridge: false,
    // Background color while loading
    backgroundColor: '#000000',
    // Allow mixed content for development (if needed)
    allowMixedContent: process.env.NODE_ENV !== 'production',
    // WebView settings for better performance
    webContentsDebuggingEnabled: process.env.NODE_ENV !== 'production',
  },

  // Plugin configurations
  plugins: {
    // SplashScreen configuration
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      androidSplashResourceName: 'splash',
      iosSplashResourceName: 'Splash',
      splashFullScreen: true,
      splashImmersive: true,
    },

    // Keyboard configuration for better UX
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },

    // HTTP caching for better media performance
    CapacitorHttp: {
      enabled: true,
    },

    // Status bar configuration for better iOS experience
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0f172a',
    },

    // Safe area handling for iOS devices
    SafeArea: {
      enabled: true,
      customColorsForSystemBars: true,
    },
  },

  // Additional loggingConfig for debugging
  loggingBehavior: process.env.NODE_ENV !== 'production' ? 'debug' : 'none',
};

export default config;
