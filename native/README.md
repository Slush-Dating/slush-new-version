# Slush Dating - React Native

A native mobile dating app built with React Native and Expo.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

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
- **Video**: expo-av
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

The app connects to the existing backend at `/server`:
- Auth: `/api/auth/*`
- Discovery: `/api/discovery/*`
- Matches: `/api/matches/*`
- Events: `/api/events/*`
- Chat: `/api/chat/*`
- WebSocket for real-time updates

## 📄 License

Private - All rights reserved

kill servers - 

pkill -f "expo"

start expo:

 npx expo start

 cd /Users/user/Desktop/slush-new-version-react/native