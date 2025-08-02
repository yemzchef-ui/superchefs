import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/ 
export default defineConfig({
  server: {
    host: "::",
    port: 3000,
  },
  plugins: [
    react(),
    VitePWA({
      // ✅ Correct: Let SW wait, and control update via message
      registerType: "autoUpdate", // New SW waits until we say SKIP_WAITING

      // ✅ Remove skipWaiting: true so it doesn't auto-activate
      workbox: {
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/ckkvnnphgceesuftupyj\.supabase\.co\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
              },
            },
          },
          {
            urlPattern:
              /\.(?:js|css|html|png|jpg|jpeg|svg|gif|woff2?|eot|ttf|otf)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
        ],
      },

      // Assets to cache
      includeAssets: [
        "dovvia-logo.png",
        "superchefs-logo.png",
        "favicon.svg",
        "favicon.ico",
        "robots.txt",
        "apple-touch-icon.png",
        "favicon-16x16.png",
        "favicon-32x32.png",
      ],

      // Manifest
      manifest: {
        name: "Dovvia",
        short_name: "Dovvia",
        description:
          "Dovvia is a platform for businesses to administer and manage their operations easily.",
        theme_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        background_color: "#ffffff",
        icons: [
          {
            src: "superchefs-logo192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "apple-touch-icon180.png",
            sizes: "180x180",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "superchefs-logo512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "superchefs-logo150.png",
            sizes: "150x150",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      // Enable during development if testing PWA behavior
      devOptions: {
        enabled: false, // Set to true only if testing SW in dev
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});