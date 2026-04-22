import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isProd = mode === "production";
  return {
  build: {
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('firebase/firestore')) return 'firebase-firestore';
          if (id.includes('firebase/auth')) return 'firebase-auth';
          if (id.includes('firebase/storage')) return 'firebase-storage';
          if (id.includes('firebase/functions')) return 'firebase-functions';
          if (id.includes('firebase')) return 'firebase';
          if (id.includes('react-dom')) return 'react';
          if (id.includes('react')) return 'react';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('zustand')) return 'state';
          if (id.includes('jszip')) return 'export';
        },
      },
    },
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    ...(isProd
      ? []
      : [
          traeBadgePlugin({
            variant: "dark",
            position: "bottom-right",
            prodOnly: false,
            clickable: false,
            clickUrl: "",
            autoTheme: true,
            autoThemeTarget: "#root",
          }),
        ]),
    tsconfigPaths(),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        globPatterns: ['**/*.{js,css,html,ico,webmanifest,svg}'],
        globIgnores: ['**/*.{png,jpg,jpeg,gif,webp,avif}'],
      },
      devOptions: {
        enabled: false
      },
      manifest: {
        name: 'PetLyon',
        short_name: 'PetLyon',
        description: 'Care, planning, and insights for your pets',
        theme_color: '#009DFF',
        background_color: '#0B1220',
        display: 'standalone',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          },
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
  };
})
