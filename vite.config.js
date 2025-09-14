import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vitejs.dev/config/
export default defineConfig({
  // Укажите здесь имя вашего репозитория на GitHub
  base: "/",
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  server: {
    host: true,
  },
  plugins: [vue()],
  test: {
    // Включаем API, совместимое с Jest (describe, it, expect)
    globals: true,
    // Указываем окружение для тестов
    environment: "jsdom",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('vuetify')) return 'vuetify';
            if (id.includes('vue')) return 'vue';
            if (id.includes('pinia')) return 'pinia';
          }
        }
      }
    }
  }
});
