import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    proxy: {
      '/ig-api': {
        target: 'https://www.instagram.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ig-api/, ''),
        headers: {
          'Referer': 'https://www.instagram.com/',
          'Origin': 'https://www.instagram.com',
        },
      },
    },
  },
})
