# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Setup & Testing

### Seed Test Users & Testing

Before testing the app, you need to create test users with profiles and videos. Run this command to seed the database:

```bash
# Make sure your server is running first (cd server && npm start)
curl -X POST http://localhost:5001/api/seed/users
```

Or use a tool like Postman/Insomnia to POST to `http://localhost:5001/api/seed/users`

This will create 8 test users with:
- Profiles (names, bios, photos, interests)
- TikTok-style videos for the video feed
- Proper gender and preference settings
- All users have password: `password123`
- Emails: `test1@slush.com` through `test8@slush.com`

#### Testing Steps

1. **Start the servers:**
   ```bash
   # Terminal 1: Backend
   cd server && npm start

   # Terminal 2: Frontend
   npm run dev
   ```

2. **Seed test users:**
   ```bash
   curl -X POST http://localhost:5001/api/seed/users
   ```

3. **Access the app** at `http://localhost:5175/`

4. **Log in** with any test account:
   - Email: `test1@slush.com` (or test2@slush.com, etc.)
   - Password: `password123`

5. **Complete onboarding** if prompted

6. **Browse the video feed** - you should now see real user profiles with videos!

The video feed will show profiles based on your gender preferences. If you log in as test1 (Sophia, woman interested in men), you'll see male profiles with videos.

## Development Workflow

### Web Development (Vite Dev Server)

Start the development server for web development with hot reloading:

```bash
npm run dev
```

The app will be available at `http://localhost:5177/`

### Mobile Development (Capacitor)

This project is configured with Capacitor to deploy to iOS and Android app stores.

#### Prerequisites
- **iOS**: Xcode (macOS only)
- **Android**: Android Studio + Java 11+ (currently requires Java 11+)

#### Mobile Development Steps

1. **Build for production:**
   ```bash
   npm run build
   ```

2. **Sync web assets to native projects:**
   ```bash
   npm run cap:sync
   ```

3. **Open in native IDEs:**
   ```bash
   npm run cap:ios     # Opens Xcode for iOS development
   npm run cap:android # Opens Android Studio for Android development
   ```

#### Quick Commands
- `npm run cap:ios` - Build + sync + open iOS project (one command)
- `npm run cap:android` - Build + sync + open Android project (one command)

#### Development Flow
1. Develop on `localhost:5177` using `npm run dev`
2. When ready to test on mobile: `npm run build && npm run cap:sync`
3. Open native IDE and run on simulator/device
4. Iterate: make changes → build → sync → test

#### Network Access on Mobile (Troubleshooting)

If you're unable to login when accessing the app via network on mobile, follow these steps:

1. **Find your computer's IP address:**
   ```bash
   # macOS/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Windows
   ipconfig
   ```
   Look for an IP like `192.168.1.XXX` or `10.0.0.XXX`

2. **Ensure your server is running and accessible:**
   ```bash
   cd server && npm start
   ```
   The server should be running on `0.0.0.0:5001` (accessible from network)

3. **Set the server IP when accessing the app:**
   - **Option A**: Add URL parameter when loading the app:
     ```
     http://YOUR_IP:5175/?host=YOUR_IP
     ```
     Example: `http://192.168.1.208:5175/?host=192.168.1.208`
   
   - **Option B**: Create a `.env` file in the project root:
     ```
     VITE_API_HOST=192.168.1.208
     ```
     (Replace with your actual IP)

4. **Check the debug info:**
   - When you open the login page, you'll see debug information showing the API URL being used
   - Verify it shows `http://YOUR_IP:5001/api` (not localhost)

5. **Common issues:**
   - **Firewall blocking**: Ensure your firewall allows connections on port 5001
   - **Wrong IP**: Make sure both devices (computer and mobile) are on the same network
   - **Server not running**: Verify the server is running with `npm start` in the `server` directory
   - **CORS errors**: The server is configured to allow all origins, but check browser console for errors

6. **Verify connection:**
   - Try accessing `http://YOUR_IP:5001/api/events` from your mobile browser
   - You should see JSON data (or an empty array)
   - If this works, the API is accessible and the issue is likely in the app configuration

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

Test users:
test1@slush.com (Sophia) - Woman interested in men
test2@slush.com (Alex) - Man interested in women
test3@slush.com (Chloe) - Woman interested in men
test4@slush.com (Jordan) - Non-binary interested in everyone

password123


REMOVAL OF MATCH DATA:
cd server
node clear-matches.js

Kill all servers:
pkill -f node

When ready for IPA
1. Open Xcode on your Mac (not via SSH)
2. Go to Xcode → Settings → Accounts tab
3. Add your Apple ID: khalil.kirkwood@hotmail.co.uk
4. Sign in with your Apple Developer password
5. Once authenticated, Xcode will be able to create the necessary provisioning profiles

db user:

virtualspeeddate1_db_user
NRvKXCsUqnbUKw4P


## Deployment

### 🎯 Branch Strategy (IMPORTANT!)

- **Work on `develop` branch** → Deploys to staging for testing
- **Only merge to `main`** → Deploys to production when ready

### 🚀 Deploy to Staging (For Testing)

**Always work here first!**

```bash
# Switch to develop branch
git checkout develop

# Make your changes
git add .
git commit -m "your commit message"
git push origin develop
```

**Result**: Auto-deploys to `https://staging.slushdating.com` within 2-5 minutes.

### 🚀 Deploy to Production (When Ready)

**Only after testing on staging!**

```bash
# Switch to main branch
git checkout main

# Merge tested changes from develop
git merge develop
git push origin main
```

**Result**: Auto-deploys to `https://app.slushdating.com` within 2-5 minutes.

### 📋 Quick Start Checklist

1. **Configure GitHub Secrets** (see [GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md))
2. **Work on `develop` branch** (staging)
3. **Test on `https://staging.slushdating.com`**
4. **Merge to `main`** (production) when ready
5. **Check `https://app.slushdating.com`** for live site

### 🔧 Manual Deployment (Emergency Only)

```bash
npm run deploy:staging      # Manual staging deploy
npm run deploy:production   # Manual production deploy
```

**Note**: Use automated deployment for all regular deployments. Manual deployment requires SSH access.# Test CI/CD
