import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const frontendPort = parseInt(process.env.AGENT_OS_FRONTEND_PORT || process.env.VITE_PORT || '43173', 10);
const backendPort = parseInt(process.env.AGENT_OS_BACKEND_PORT || process.env.PORT || '43101', 10);

export default defineConfig({
  plugins: [react()],
  server: {
    port: frontendPort,
    proxy: {
      '/api': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
      '/ws': {
        target: `http://localhost:${backendPort}`,
        ws: true,
      },
    },
  },
});
