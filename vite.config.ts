import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

/**
 * The Arc Studio preview hooks forward console output and network calls to a parent window.
 * They are for the preview only: production builds swap them for empty modules.
 */
function stripPreviewHooks(): Plugin {
  return {
    name: 'strip-preview-hooks',
    enforce: 'pre',
    apply: 'build',
    resolveId(source) {
      if (source === './tracing') return path.resolve(__dirname, 'src/stubs/tracing.ts')
      if (source === './console-capture') return path.resolve(__dirname, 'src/stubs/console-capture.ts')
      return null
    },
  }
}

/**
 * When the wallet is mounted under a sub-path (VITE_BASE=/app-static/, VITE_APP_PATH=/app) the manifest and
 * the headers file must point at the mount, not at "/". Rewrites them in dist after the build.
 * Also adds the ramp server origin (VITE_RAMP_API_URL) to the CSP connect-src.
 */
function mountFiles(base: string, appPath: string, rampUrl: string): Plugin {
  let outDir = path.resolve(__dirname, 'dist')
  return {
    name: 'mount-files',
    apply: 'build',
    configResolved(c) {
      outDir = path.resolve(c.root, c.build.outDir)
    },
    closeBundle() {
      const dist = outDir
      const scope = appPath ? appPath + '/' : base
      const mp = path.join(dist, 'manifest.webmanifest')
      if (fs.existsSync(mp)) {
        const m = JSON.parse(fs.readFileSync(mp, 'utf8'))
        m.start_url = scope
        m.scope = scope
        m.id = scope
        m.icons = m.icons.map((i: { src: string }) => ({ ...i, src: base + i.src.replace(/^\//, '') }))
        fs.writeFileSync(mp, JSON.stringify(m, null, 2))
      }
      const hp = path.join(dist, '_headers')
      if (fs.existsSync(hp)) {
        let h = fs.readFileSync(hp, 'utf8')
        let origin = ''
        try { origin = rampUrl.startsWith('http') ? new URL(rampUrl).origin : '' } catch { /* relative or invalid */ }
        if (origin) h = h.replace("connect-src 'self'", `connect-src 'self' ${origin}`)
        if (base !== '/') {
          // Same security headers for the page path and the asset path (the host site must apply them).
          const m = h.match(/^\/\*\n((?: {2}.*\n?)+)/m)
          if (m) {
            const body = m[1].replace(/\n?$/, '\n')
            const paths = [...new Set([appPath, appPath && appPath + '/*', base + '*'].filter(Boolean))]
            h = h.replace(m[0], paths.map((p) => p + '\n' + body).join('\n'))
          }
          h = h.replace(/^\/manifest\.webmanifest/m, base + 'manifest.webmanifest')
          if (appPath) h = h.replace(/^\/sw\.js\n((?: {2}.*\n?)+)/m, (x) => x + '  Service-Worker-Allowed: ' + appPath + '\n')
        }
        fs.writeFileSync(hp, h)
      }
    },
  }
}

const proxy = {
  '/ramp-api': {
    target: 'http://localhost:8787',
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/ramp-api/, ''),
  },
  '/api': {
    target: 'http://localhost:3001',
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/api/, ''),
  },
}

const BASE = (process.env.VITE_BASE || '/').replace(/\/?$/, '/')
const APP_PATH = (process.env.VITE_APP_PATH || '').replace(/\/+$/, '')

export default defineConfig({
  base: BASE,
  plugins: [stripPreviewHooks(), react(), nodePolyfills(), mountFiles(BASE, APP_PATH, process.env.VITE_RAMP_API_URL || '')],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      '@tanstack/react-query',
      'wagmi',
      'wagmi/chains',
      'wagmi/connectors',
      'viem',
      'viem/chains',
      'connectkit',
      '@circle-fin/app-kit',
      'qrcode',
      'jsqr',
      'framer-motion',
      'lucide-react',
      'sonner',
      'clsx',
      'tailwind-merge',
      'vite-plugin-node-polyfills/shims/buffer',
      'vite-plugin-node-polyfills/shims/global',
      'vite-plugin-node-polyfills/shims/process',
    ],
  },
  server: {
    allowedHosts: true,
    proxy,
  },
  preview: { allowedHosts: true, proxy },
})
