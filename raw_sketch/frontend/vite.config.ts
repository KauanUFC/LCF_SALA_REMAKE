import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev, proxy API + SSE to the local backend so the frontend can
// run on its own port without CORS configuration.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/events': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
  },
})