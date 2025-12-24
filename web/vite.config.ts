import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Check for VITE_USE_SUBPATH environment variable
  // If true, use /app/ base path for production (www.slushdating.com/app)
  // Otherwise use / for staging (staging.slushdating.com) or ./ for dev
  const useSubpath = process.env.VITE_USE_SUBPATH === 'true';
  const base = useSubpath ? '/app/' : (mode === 'production' || mode === 'staging') ? '/' : './';

  return {
    plugins: [react()],
    base,
    server: {
      host: true, // Listen on all addresses, including LAN
      port: 5175,
      strictPort: false, // Allow fallback to another port if 5175 is taken
      cors: true,
      hmr: {
        port: 5175,
      }
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
    },
  }
})
