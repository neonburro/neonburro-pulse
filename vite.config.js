// vite.config.js
// Vendor chunks, same policy as the studio's vite.config.js. The app code
// splits per route in src/App.jsx, the libraries split here, so a change to
// one page never busts the cached react or chakra chunk. recharts rides in
// the Analytics route chunk on its own because only that page imports it.
// Read the chunk table on every build.
//
// The dev proxy mirrors the /studio-library/* rewrite in netlify.toml, the
// Socials picture picker reads the studio library index through it because
// neonburro.com sends no CORS header. Change both or neither.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/studio-library': {
        target: 'https://neonburro.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/studio-library/, '/library'),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@chakra-ui/react', '@emotion/react', '@emotion/styled', 'framer-motion'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
