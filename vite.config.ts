import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Use / base path for web builds (VPS deployment)
  // Use ./ only if specifically requested (e.g. for pure static or some mobile builds)
  const base = (mode === 'production' || mode === 'staging') ? '/' : './';

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
