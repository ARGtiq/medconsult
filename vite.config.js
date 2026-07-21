import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ВАЖНО для GitHub Pages: base должен совпадать с названием репозитория.
// Если репозиторий называется, например, "medconsult", то деплой будет на
// https://<username>.github.io/medconsult/ — тогда base: '/medconsult/'
// Если это репозиторий вида <username>.github.io (корневой сайт) — base: '/'
export default defineConfig({
  plugins: [react()],
  base: '/medconsult/',
})
