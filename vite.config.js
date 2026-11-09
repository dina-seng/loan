import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['masculine-carnivore-untidy.ngrok-free.dev'],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{js,ts,jsx,tsx}', '__tests__/unit/**/*.test.{js,ts}'],
  },
});
