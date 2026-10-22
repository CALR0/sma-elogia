import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// El frontend habla con el backend (puerto 3001) a traves de /api,
// redirigido por el proxy de Vite en desarrollo.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
