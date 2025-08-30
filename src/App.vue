
<template>
  <div class="app">
    <header class="game-header">
      <h1>🏰 Circle MUD Clone - Мидгард</h1>
      <p class="subtitle">Текстовая приключенческая игра</p>
    </header>
    
    <GameTerminal />
    
    <footer class="game-footer">
      <p>
        Используйте команду 'help' для получения справки. 
        Игра автоматически сохраняется каждые 30 секунд.
      </p>
    </footer>
  </div>
</template>

<script setup>
import GameTerminal from './components/game/GameTerminal.vue';
</script>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 1200px;
  margin: 0 auto;
  background-color: #000;
  color: #00ff00;
}

.game-header {
  text-align: center;
  padding: 20px;
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
  border-bottom: 2px solid #00ff00;
}

.game-header h1 {
  margin: 0;
  color: #00ff00;
  font-family: 'Courier New', monospace;
  text-shadow: 0 0 10px #00ff00;
}

.subtitle {
  margin: 5px 0 0 0;
  color: #888;
  font-size: 14px;
  font-family: 'Courier New', monospace;
}

.game-footer {
  text-align: center;
  padding: 10px;
  background-color: #1a1a1a;
  border-top: 1px solid #333;
  font-size: 12px;
  color: #888;
}
</style>
</template>
