import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5220,
    // Receipt scanning runs in server/index.js so the Anthropic API key
    // never reaches the browser.
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.SCAN_PORT || 8789}`,
        changeOrigin: true,
      },
    },
  },
})
