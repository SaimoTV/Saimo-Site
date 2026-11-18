import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// A versão que a tela de Ajustes mostra sai do package.json (o release.sh atualiza ele),
// nunca de um número escrito no código.
const versao = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')).version as string;

export default defineConfig({
  root: '.',
  base: './',
  define: {
    __VERSAO_APP__: JSON.stringify(versao)
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: ['chrome53', 'es2016'],
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
