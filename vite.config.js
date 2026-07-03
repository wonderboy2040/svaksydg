import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ===========================================
// Vite Configuration
// ===========================================
// `base: '/'` ensures asset URLs are absolute (e.g. /assets/index.js).
// This is correct for deploying to the root domain on Render, Netlify,
// Vercel, GitHub Pages (with custom domain), etc.
// If you deploy to a sub-path (e.g. https://example.com/svaks/), change
// base to '/svaks/'.
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    // Generate sourcemaps for easier debugging in production
    sourcemap: false,
    // Chunk size warning threshold
    chunkSizeWarningLimit: 1000,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
