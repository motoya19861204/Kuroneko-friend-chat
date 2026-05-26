import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    minify: false,
    rollupOptions: {
      input: {
        main: './index.html',
        room: './room.html',
        newspaper: './newspaper.html',
        local_room: './local-room.html',
      },
    },
  },
})
