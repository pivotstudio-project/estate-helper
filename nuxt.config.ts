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

  nitro: {
    storage: {
      estate: process.env.KV_REST_API_URL
        ? {
          // Vercel 환경 변수가 있을 때 (운영 환경)
          driver: 'vercelKV',
          url: process.env.KV_REST_API_URL,
          token: process.env.KV_REST_API_TOKEN
        }
        : {
          // 로컬 개발 환경 (파일 시스템 사용)
          driver: 'fs',
          base: './.data/estate'
        }
    }
  }
});
