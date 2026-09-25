import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:3001' },
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        masterAdmin: 'master-admin.html',
        signIn: 'sign-in.html',
        staffSignIn: 'staff-sign-in.html',
        staffDashboard: 'staff-dashboard.html',
        portfolio: 'portfolio.html',
      },
    },
  },
})
