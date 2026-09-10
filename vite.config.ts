import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // The site is served from https://kaonhew02.github.io/SchedulePlan/, so every
  // asset URL needs that prefix. The dev server uses it too, which keeps the
  // two identical.
  base: '/SchedulePlan/',
  plugins: [react()],
  server: {
    // host: true so the app can be opened from a phone on the same wifi.
    host: true,
    port: 5173,
  },
})
