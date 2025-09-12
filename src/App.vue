
<template>
  <v-theme-provider theme="dark" with-background class="app" :class="{ 'terminal-fullscreen-active': isFullscreen }">
    <v-app>
      <div class="scanline-overlay"></div>
      <v-app-bar density="compact" class="game-header">
        <v-app-bar-title class="header-title">
          <span class="title-icon">🏰</span> Circle MUD Clone - Мидгард
        </v-app-bar-title>
        <template v-slot:append>
          <span class="subtitle">Текстовая приключенческая игра</span>
        </template>
      </v-app-bar>

      <v-main>
        <GameTerminal @toggle-fullscreen="handleToggleFullscreen" />
      </v-main>

      <v-footer app class="game-footer">
        <span>Используйте 'help' для справки. Автосохранение каждые 30 секунд.</span>
      </v-footer>
    </v-app>
  </v-theme-provider>
</template>

<script setup>
import GameTerminal from './components/game/GameTerminal.vue';
import { ref } from 'vue';

const isFullscreen = ref(false);

const handleToggleFullscreen = (value) => {
  isFullscreen.value = value;
};
</script>

<style>
/* Стили для полноэкранного режима */
.terminal-fullscreen-active .game-header,
.terminal-fullscreen-active .game-footer {
  display: none !important;
}
</style>
