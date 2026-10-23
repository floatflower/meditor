import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves the committed docs/ folder of this branch. `base: './'` keeps every link relative, so the
// page works at https://<user>.github.io/meditor/ and on the custom domain alike. public/CNAME (the domain) is copied
// into docs/ by every build, since the build empties that folder.
export default defineConfig({
  base: './',
  resolve: { alias: { '@': resolve('src') } },
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    rollupOptions: { input: { main: resolve('index.html'), syntax: resolve('syntax/index.html') } }
  }
})
