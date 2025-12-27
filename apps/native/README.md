# Slush Dating - React Native

A native mobile dating app built with React Native and Expo.

## 🚀 Quick Start

```bash
# Install dependencies (from monorepo root)
npm install -w apps/native

# Start development server
npx expo start

# Run on iOS Simulator
npx expo start --ios

# Run on Android Emulator
npx expo start --android
```

## 📱 Features

- **Video Feed**: TikTok-style swipeable profiles
- **Speed Dating Events**: Join virtual speed dating events
- **Real-time Chat**: Instant messaging with matches
- **Profile Management**: Photo uploads, bio, preferences
- **Secure Auth**: JWT authentication with encrypted storage

## 🏗️ Tech Stack

- **Framework**: React Native 0.81 + Expo SDK 54
- **Navigation**: Expo Router (file-based routing)
- **State Management**: React Context + Hooks
- **Styling**: React Native StyleSheet
- **Video**: expo-av + react-native-agora (for live video calls)
- **Real-time**: Socket.IO
- **Storage**: expo-secure-store (encrypted)

## 📁 Project Structure

```
├── app/                    # Expo Router pages
│   ├── (auth)/             # Authentication screens
│   ├── (onboarding)/       # Profile setup flow
│   └── (main)/             # Main app screens
├── components/             # Reusable UI components
├── hooks/                  # Custom React hooks
├── services/               # API & Socket services
└── types/                  # TypeScript definitions
```

## 🔧 Configuration

### Environment Variables

Set your API URL in `app.json`:

```json
{
  "expo": {
    "extra": {
      "apiUrl": "https://your-api-url.com"
    }
  }
}
```

### Agora Video Calls Setup

The app uses `react-native-agora` for live video calls during speed dating events. Since this requires native modules, you need to use Expo development builds:

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure development build
eas build:configure

# Build development client (use the helper script to disable capability sync)
./build-dev.sh

# Or manually set the environment variable:
EXPO_NO_CAPABILITY_SYNC=1 eas build --profile development --platform ios
# or
EXPO_NO_CAPABILITY_SYNC=1 eas build --profile development --platform android

# Note: Capability syncing must be disabled to avoid conflicts with existing
# Apple Developer account configurations. The environment variable must be set
# before running the eas build command.
```

Alternatively, use Expo prebuild:
```bash
npx expo prebuild
cd ios && pod install  # For iOS only
```

**Important**: The server must have Agora credentials configured in `packages/server/.env`:
```
AGORA_APP_ID=your_app_id
AGORA_APP_CERTIFICATE=your_certificate
```

See `AGORA_IMPLEMENTATION_REVIEW.md` for full implementation details.

### Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

## 🔗 API Endpoints

The app connects to the backend at `packages/server`:
- Auth: `/api/auth/*`
- Discovery: `/api/discovery/*`
- Matches: `/api/matches/*`
- Events: `/api/events/*`
- Chat: `/api/chat/*`
- WebSocket for real-time updates

## 📄 License

Private - All rights reserved

## 🚀 Running Development Build

After installing the development build on your device:

```bash
# Start the development server (use --dev-client flag for custom builds)
npx expo start --dev-client

# The server will show a QR code and connection URL
# In your development build app:
# 1. Shake device or tap the dev menu
# 2. Select "Enter URL manually" or scan QR code
# 3. Enter the connection URL shown in terminal
```

**Troubleshooting "No development servers found":**
- Ensure device and computer are on the same Wi‑Fi network
- Check firewall isn't blocking the connection
- Try entering the URL manually: `exp://YOUR_IP:8081`
- Restart the dev server: `npx expo start --dev-client --clear`

**Quick commands:**
```bash
# Kill all Expo servers
pkill -f "expo"

# Start dev server for development build (from monorepo root)
npm run native:start
```

bash
# Terminal 1: Start server with staging DB
cd packages/server
MONGODB_URI="$MONGODB_URI_STAGING" PORT=5001 node index.js
# Terminal 2: Run tests
cd packages/server
node test-events-automated.js
