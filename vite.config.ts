import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// El front habla con el back en /api, y Vite lo reenvía al Django en el 8000.
// Así el navegador ve todo same-origin y no hay ni CORS ni preflight: la cookie
// HttpOnly del refresh viaja sin SameSite=None ni HTTPS, que en desarrollo es un
// quilombo. En producción se saca el proxy y VITE_API_URL apunta al dominio real.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      // Para que el chequeo de vida se pueda probar desde el front sin CORS.
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
