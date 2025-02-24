import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: true,
      },
      manifest: {
        name: "agency",
        short_name: "ReactPWA",
        description: "AI agent builder",
        theme_color: "#ffffff",
        icons: [
          {
            src: "icon2.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icon3.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icon1.png",
            sizes: "180x180",
            type: "image/png",
          },
        ],
        apple_mobile_web_app_capable: "yes",
        apple_mobile_web_app_status_bar_style: "black-translucent",
        apple_mobile_web_app_title: "agency",
      },
      includeAssets: ["icon1.png"],
    }),
  ],
});
