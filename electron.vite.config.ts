import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()] },
  preload: { plugins: [externalizeDepsPlugin()] },
  renderer: {
    resolve: { alias: { '@': resolve('src/renderer/src') } },
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          // Fonts keep their names (no hash) so the main process can read the same files for export.
          assetFileNames: (info) => ((info.names?.[0] ?? '').endsWith('.woff2') ? 'fonts/[name][extname]' : 'assets/[name]-[hash][extname]')
        }
      }
    }
  }
})
