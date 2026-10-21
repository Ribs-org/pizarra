import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Rutas relativas: funciona igual en GitHub Pages (/pizarra/), Vercel o abriendo dist/ en un servidor local.
  base: './',
  plugins: [react()],
})
