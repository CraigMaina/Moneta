import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // favicon.svg is already precached via workbox.globPatterns below;
      // listing it in includeAssets too would double-register it.
      manifest: {
        id: '/',
        name: 'Moneta',
        short_name: 'Moneta',
        description: 'Safe-to-spend money manager for Kenya.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#E8474B',
        background_color: '#FFFDFB',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        share_target: {
          action: '/add',
          method: 'POST',
          enctype: 'application/x-www-form-urlencoded',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
          },
        },
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    // The default 5s timeout is tight for userEvent/timer-based tests when the
    // full suite's parallel workers contend for CPU on a busy machine — they
    // pass in isolation but occasionally time out under load (a spurious,
    // environment-dependent flake, never an assertion failure). A roomier
    // budget removes that class of flake without slowing tests that are fast.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
})
