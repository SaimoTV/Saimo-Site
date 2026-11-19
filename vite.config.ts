import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { onRequestGet as onResolveVod } from './functions/api/resolve-vod'

/**
 * Serve `/api/resolve-vod` no servidor de desenvolvimento com a
 * mesma função que roda em produção.
 *
 * Sem isto o desenvolvimento tocaria por um caminho que o visitante nunca usa —
 * era assim que uma correção de CDN passava no `bun run dev` e falhava no ar.
 */
function proxyDev(): Plugin {
  return {
    name: 'saimo-proxy-dev',
    configureServer(server) {
      server.middlewares.use('/api/resolve-vod', async (req, res) => {
        const url = `http://${req.headers.host ?? 'localhost'}${req.originalUrl ?? req.url ?? ''}`
        try {
          const response = await onResolveVod({
            request: new Request(url, { method: req.method ?? 'GET' }),
          })
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(await response.text())
        } catch (error) {
          res.statusCode = 500
          res.end(String(error))
        }
      })
    },
  }
}


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

// https://vite.dev/config/
// Pacote das TVs Samsung/LG (`vite build --mode tv`): um arquivo comum (IIFE, sem
// módulos ES, que o webOS bloqueia quando a página vem de file://) mais o CSS, para o
// carregador de tv/ injetar como <script>/<link> clássicos.
const configTv = defineConfig({
  base: './',
  plugins: [react()],
  css: { postcss: { plugins: [temaCss()] } },
  worker: { format: 'iife' },
  define: { 'process.env.NODE_ENV': JSON.stringify('production'), 'import.meta.env.VITE_TV': '"1"' },
  build: {
    outDir: 'dist-tv',
    target: 'chrome68',
    cssTarget: 'chrome61',
    minify: 'oxc',
    lib: { entry: 'src/entrada-tv.ts', name: 'SaimoTV', formats: ['iife'], fileName: () => 'saimo.js', cssFileName: 'saimo' },
    chunkSizeWarningLimit: 4000,
    copyPublicDir: false,
  },
})

export default defineConfig(({ mode }) => mode === 'tv' ? configTv : {
  base: '/',
  plugins: [react(), proxyDev()],
  css: { postcss: { plugins: [temaCss()] } },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vendor chunks - bibliotecas externas
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            if (id.includes('hls.js')) {
              return 'vendor-hls';
            }
            // Shaka só desce para quem abre um canal DASH; junto do resto do
            // vendor ele viraria 700 KB no primeiro acesso de todo mundo.
            if (id.includes('shaka-player')) {
              return 'vendor-shaka';
            }
            // Outras bibliotecas em um chunk separado
            return 'vendor';
          }
          // Players em chunk separado
          if (id.includes('/components/VideoPlayer') || id.includes('/components/MoviePlayer')) {
            return 'player';
          }
          // Catálogo em chunk separado
          if (id.includes('/components/MovieCatalog') || id.includes('/components/VodCatalog') ||
            id.includes('/components/MovieCard')) {
            return 'catalog';
          }
          // TV em chunk separado
          if (id.includes('/components/Sidebar') || id.includes('/components/ChannelCard') ||
            id.includes('/components/ProgramGuide') || id.includes('/components/ProgramInfo')) {
            return 'tv';
          }
        },
      },
    },
    // Aumenta um pouco o limite para evitar warnings desnecessários
    chunkSizeWarningLimit: 600,
  },
})
