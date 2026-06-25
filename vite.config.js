import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",

      includeAssets: ["icon.svg"],

      manifest: {
        name: "WorterHaus",
        short_name: "WorterHaus",
        start_url: "/",
        display: "standalone",
        background_color: "#111827",
        theme_color: "#111827",

        icons: [
          {
            src: "icon.svg",
            sizes: "192x192",
            type: "image/svg+xml",
          },
          {
            src: "icon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
          },
        ],
      },

      workbox: {
        navigateFallback: "/index.html",
      },
    }),
  ],
});
