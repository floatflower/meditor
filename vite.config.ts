import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves the committed docs/ folder of this branch. `base: './'` keeps every link relative, so the
// page works at https://<user>.github.io/meditor/ and on a custom domain alike.
export default defineConfig({
  base: './',
  resolve: { alias: { '@': resolve('src') } },
  plugins: [react(), tailwindcss()],
  build: { outDir: 'docs', emptyOutDir: true }
})
