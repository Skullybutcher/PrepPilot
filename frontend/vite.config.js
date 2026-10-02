import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    historyApiFallback: true,
    // Proxy /api calls to the local backend in development.
    // This lets the frontend work without VITE_API_URL set locally —
    // api.js falls back to '/api' which Vite then forwards here.
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    historyApiFallback: true,
  },
})
