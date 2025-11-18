import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Rule to redirect all /identify requests to the backend server
      '/identify': {
        target: 'http://localhost:5000', // Matches your backend PORT=5000
        changeOrigin: true, // Necessary for virtual hosted sites
        secure: false, // Use if your backend is not running HTTPS (which it isn't)
      },
      // If you have other backend routes, you'd add them here
    },
  },
})