import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Use /app/ base path for production builds (VPS deployment)
  // Use ./ for development and mobile builds (Capacitor)
  // Check for VITE_USE_SUBPATH env var to override
  const useSubpath = process.env.VITE_USE_SUBPATH === 'true' || 
                     (mode === 'production' && process.env.VITE_USE_SUBPATH !== 'false');
  
  return {
    plugins: [react()],
    base: useSubpath ? '/app/' : './',
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
