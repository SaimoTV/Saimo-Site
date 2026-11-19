import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// A versão que a tela de Ajustes mostra sai do package.json (o release.sh atualiza ele),
// nunca de um número escrito no código.
const versao = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')).version as string;

/**
 * Tema: troca as cores de destaque escritas à mão no CSS por variáveis
 * (`var(--saimo-acento, #4fe3d0)`), com a cor original de reserva. Sem tema
 * escolhido nada muda; com ele, `plataforma/tema.ts` define as variáveis.
 * A página de apresentação (landing) tem paleta própria e fica de fora.
 */
function temaCss() {
  const HEX: Record<string, string> = {
    '#4fe3d0': '--saimo-acento',
    '#8b5cf6': '--saimo-roxo',
    '#a855f7': '--saimo-roxo',
    '#a78bfa': '--saimo-roxo-claro',
    '#c4b5fd': '--saimo-roxo-claro',
    '#7c3aed': '--saimo-roxo-escuro',
    '#6d28d9': '--saimo-roxo-escuro',
    '#0a0a0a': '--saimo-fundo',
    '#070709': '--saimo-fundo',
  }
  const RGB: [RegExp, string, string][] = [
    [/\b(rgba?)\(\s*79\s*,\s*227\s*,\s*208\s*(,\s*[\d.]+\s*)?\)/gi, '--saimo-acento-rgb', '79, 227, 208'],
    [/\b(rgba?)\(\s*139\s*,\s*92\s*,\s*246\s*(,\s*[\d.]+\s*)?\)/gi, '--saimo-roxo-rgb', '139, 92, 246'],
    [/\b(rgba?)\(\s*168\s*,\s*85\s*,\s*247\s*(,\s*[\d.]+\s*)?\)/gi, '--saimo-roxo-rgb', '139, 92, 246'],
  ]
  return {
    postcssPlugin: 'saimo-tema',
    Declaration(decl: { value: string; source?: { input?: { file?: string } } }) {
      const arquivo = decl.source?.input?.file ?? ''
      if (arquivo.includes('/landing/') || decl.value.includes('--saimo-')) return
      let v = decl.value
      for (const [hex, nome] of Object.entries(HEX)) {
        v = v.replace(new RegExp(hex + '(?![0-9a-f])', 'gi'), `var(${nome}, ${hex})`)
      }
      for (const [re, nome, padrao] of RGB) {
        v = v.replace(re, (_m, f: string, alfa?: string) => `${f}(var(${nome}, ${padrao})${alfa ?? ''})`)
      }
      if (v !== decl.value) decl.value = v
    },
  }
}
temaCss.postcss = true

export default defineConfig({
  css: { postcss: { plugins: [temaCss()] } },
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
