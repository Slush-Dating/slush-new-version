# Slush Dating Monorepo

A modern dating app with web and native mobile applications.

## 🏗️ Project Structure

This is a monorepo containing three main applications:

### Apps
- **`apps/web/`** - React web application with Capacitor for mobile deployment
- **`apps/native/`** - React Native mobile application (Expo)

### Packages
- **`packages/server/`** - Node.js/Express backend API server

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- For native app: Expo CLI and Xcode/Android Studio

### Installation
```bash
# Install all dependencies
npm run install:all

# Or install individually:
npm install                    # Root workspace
npm install -w apps/web        # Web app
npm install -w apps/native     # Native app
npm install -w packages/server # Server
```

### Development

```bash
# Web app
npm run web:dev

# Native app
npm run native:start

# Server
npm run server:dev
```

### Building

```bash
# Web app
npm run web:build

# Web app for staging
npm run web:build:staging

# Native app (iOS/Android)
npm run native:ios
npm run native:android
```

## 📱 Applications

### Web App (`apps/web/`)
- React + TypeScript + Vite
- Capacitor for iOS/Android deployment
- Modern responsive design

### Native App (`apps/native/`)
- React Native + Expo
- Native video calling with Agora
- Cross-platform iOS/Android support

### API Server (`packages/server/`)
- Node.js + Express
- MongoDB database
- Real-time features with Socket.IO
- RESTful API with Swagger documentation

## 🔧 Configuration

Environment variables should be configured in each app/package. See `env-example.txt` for reference.

## 📄 License

Private - All rights reserved


