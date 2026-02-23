import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path: override with --base flag in CLI, or defaults to /competition/
export default defineConfig({
  plugins: [react()],
  base: '/competition/',
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
