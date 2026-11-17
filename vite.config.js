import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// MockTest admin panel — its own app and port, separate from the student website (port 3000).
export default defineConfig({
  plugins: [react()],
  server: { port: 3001, strictPort: true },    // strictPort: fail clearly if 3001 is taken
  preview: { port: 3001, strictPort: true },
})
