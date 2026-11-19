import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
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

export default defineConfig({
  plugins: [stripPreviewHooks(), react(), nodePolyfills()],
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
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
