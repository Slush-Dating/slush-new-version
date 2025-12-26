# Development Workflow

This monorepo contains three main applications that can be developed and deployed independently.

## 🏗️ Project Structure

```
├── apps/
│   ├── web/          # React web app + admin panel
│   └── native/       # React Native mobile app
├── packages/
│   └── server/       # Node.js API server
```

## 🌿 Branching Strategy

### Main Branches
- **`main`** - Production deployments (web + server)
- **`develop`** - Staging deployments (web + server)

### Component Branches
- **`feature/web-*`** - Web app features
- **`feature/native-*`** - Native app features
- **`feature/server-*`** - Server/API features
- **`fix/web-*`** - Web app bug fixes
- **`fix/native-*`** - Native app bug fixes
- **`fix/server-*`** - Server/API bug fixes

## 🚀 Development Workflow

### Web App Development
```bash
# Install dependencies
npm install

# Start development server
npm run web:dev

# Build for staging
npm run web:build:staging

# Build for production
npm run web:build
```

### Native App Development
```bash
# Install dependencies
npm install

# Start Expo development server
npm run native:start

# Build for iOS
npm run native:ios

# Build for Android
npm run native:android
```

### Server Development
```bash
# Install dependencies
npm install

# Start development server
npm run server:dev
```

## 📦 Deployment

### Automatic Deployments
- **Staging**: Push to `develop` branch → deploys web + server to staging.slushdating.com
- **Production**: Push to `main` branch → deploys web + server to app.slushdating.com

### Selective Deployment
Only components that have changes will be deployed:
- Web app changes → rebuild and redeploy frontend
- Server changes → redeploy backend API
- Native changes → trigger mobile app builds

### Manual Deployments
- **Native App**: Use GitHub Actions workflow "Deploy Native App" to build iOS/Android manually

## 🔄 Pull Request Process

1. Create feature branch from appropriate base:
   - Web features: `develop`
   - Native features: `develop`
   - Server features: `develop`

2. Make changes in the appropriate directory:
   - Web: `apps/web/`
   - Native: `apps/native/`
   - Server: `packages/server/`

3. Test your changes locally

4. Push branch and create PR targeting the correct base branch

5. PR will trigger CI checks and potentially staging deployment

## 🏷️ Commit Message Convention

```
type(scope): description

Types:
- feat: new feature
- fix: bug fix
- docs: documentation
- style: formatting
- refactor: code restructuring
- test: testing
- chore: maintenance

Scopes:
- web: web app changes
- native: native app changes
- server: server changes
- ci: CI/CD changes
```

## 🔧 Environment Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- For native: Xcode (macOS) + Android Studio

### Environment Variables
Copy `env-example.txt` to appropriate locations and fill in values:
- Web app: `apps/web/.env`
- Server: `packages/server/.env`
- Native app: uses Expo configuration

## 📱 Mobile Development

### iOS Development
```bash
cd apps/native
npx expo start --ios
```

### Android Development
```bash
cd apps/native
npx expo start --android
```

### Development Builds
```bash
cd apps/native
# Install EAS CLI
npm install -g eas-cli

# Configure
eas build:configure

# Build development client
eas build --profile development --platform ios
# or
eas build --profile development --platform android
```

## 🧪 Testing

### Web App
```bash
cd apps/web
npm run lint
npm run build
```

### Server
```bash
cd packages/server
npm test
```

### Native App
```bash
cd apps/native
npm run lint
# Manual testing on device/simulator
```

## 📚 Additional Resources

- [Web App README](apps/web/README.md)
- [Native App README](apps/native/README.md)
- [Server API Documentation](packages/server/API_DOCUMENTATION.md)

