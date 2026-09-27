import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: {
    build: {
      outDir: 'dist'
    }
  },
  preload: {
    build: {
      outDir: 'dist'
    }
  },
  renderer: {
    root: 'src/renderer',
    build: {
      outDir: 'dist/renderer'
    }
  }
})