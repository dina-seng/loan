import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['masculine-carnivore-untidy.ngrok-free.dev'],
  },
  test: {
    environment: 'node',
  },
});
