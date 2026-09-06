import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      port: Number(process.env.PORT) || 5220,
      // Receipt scanning runs in server/index.js so the Anthropic API key
      // never reaches the browser.
      proxy: {
        '/api': {
          target: `http://localhost:${env.SCAN_PORT || 8789}`,
          changeOrigin: true,
        },
      },
    },
  }
})
