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