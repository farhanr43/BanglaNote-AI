import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// NOTE: The Gemini API key is NOT bundled here anymore. It lives only in the
// Supabase Edge Function (ai-proxy), which enforces credits server-side.
export default defineConfig({
  plugins: [react()],
})
