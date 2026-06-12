import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      // Expose optional Gemini key to the browser bundle (never log this)
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY ?? ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR can be disabled via env var to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        // Proxy all /api and /socket.io calls to the Express backend
        '/api': {
          target: `http://localhost:${env.PORT ?? 3000}`,
          changeOrigin: true,
        },
        '/socket.io': {
          target: `http://localhost:${env.PORT ?? 3000}`,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
