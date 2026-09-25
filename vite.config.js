import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'API_URL'],
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
        staffAdmin: 'staff-admin.html',
        staffDashboard: 'staff-dashboard.html',
        staffPortfolio: 'staff-portfolio.html',
        portfolio: 'portfolio.html',
      },
    },
  },
})
