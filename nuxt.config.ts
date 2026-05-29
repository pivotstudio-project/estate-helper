import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  ssr: false,
  future: {
    compatibilityVersion: 4,
  },

  devServer: {
    port: 5000,
    host: '127.0.0.1'
  },

  css: ['~/assets/css/global.css'],

  vite: {
    plugins: [
      tailwindcss(),
    ],
  },

  compatibilityDate: '2025-01-01',
});
