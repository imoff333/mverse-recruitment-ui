import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxy: forward /api to the local Project backend (port 4003).
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:4003' } },
});
