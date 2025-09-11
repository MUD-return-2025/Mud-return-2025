
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

<style scoped></style>
