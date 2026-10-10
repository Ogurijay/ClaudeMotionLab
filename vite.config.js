import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // relative asset paths so the build works both locally and under /ClaudeMotionLab/ on GitHub Pages
  base: './',
  server: { watch: { usePolling: true, interval: 200 } },
  build: {
    // three.js (~700 kB minified) gets its own long-cached chunk; effects load lazily on demand
    rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'three', test: /node_modules[/\\]three/}] } } },
    chunkSizeWarningLimit: 800,
  },
})
