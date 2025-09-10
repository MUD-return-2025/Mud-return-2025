
<template>
  <v-theme-provider theme="dark" with-background class="app">
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
        <GameTerminal />
      </v-main>

      <v-footer app class="game-footer">
        <span>Используйте 'help' для справки. Автосохранение каждые 30 секунд.</span>
      </v-footer>
    </v-app>
  </v-theme-provider>
</template>

<script setup>
import GameTerminal from './components/game/GameTerminal.vue';
</script>

<style> /* Глобальные стили для всего приложения */
.app {
  background: #000 !important;
  color: #00ff00 !important;
  font-family: 'Courier New', monospace;
  text-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
}

.scanline-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.1));
  background-size: 100% 4px;
  z-index: 100;
  opacity: 0.3;
}

.game-header {
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%) !important;
  border-bottom: 2px solid #00ff00 !important;
  color: #00ff00 !important;
}

.header-title {
  font-weight: bold;
}

.subtitle {
  margin-right: 16px;
  color: #888;
  font-size: 14px;
}

.game-footer {
  background-color: #1a1a1a !important;
  border-top: 1px solid #333 !important;
  font-size: 12px;
  color: #888;
  justify-content: center;
}
</style>
