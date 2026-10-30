import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: ['chrome68', 'es2018'],
    minify: 'esbuild',
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
      output: {
        format: 'iife',
        entryFileNames: 'saimo-tv.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'saimo-tv.[ext]'
      }
    }
  }
});
