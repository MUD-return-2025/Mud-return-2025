<template>
  <div class="game-terminal" :class="{ fullscreen: isFullscreen }">
    <div class="terminal-output" ref="outputElement">
      <button @click="toggleFullscreen" class="fullscreen-btn" :title="isFullscreen ? 'Свернуть' : 'Во весь экран'">
        {{ isFullscreen ? '⤡' : '⛶' }}
      </button>
      <div class="welcome-message">
        <p>🏰 Добро пожаловать в Мидгард! 🏰</p>
        <p>Введите "new" для начала новой игры или "load" для загрузки сохранения.</p>
      </div>

      <div v-for="(message, index) in gameMessages" :key="index" class="message" v-html="message">
      </div>
    </div>

    <div class="terminal-input">
      <span class="prompt">></span>
      <input
        v-model="currentInput"
        @keyup.enter="processCommand"
        ref="inputElement"
        placeholder="Введите команду..."
        autocomplete="off"
      />
    </div>

    <PlayerStatsPanel
      :player="player" 
      :game-started="gameStarted"
      :game-engine="gameEngine"
      @command="executeCommand"
      @move="handleMove"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick, watch } from 'vue';
import { GameEngine } from '../../game/GameEngine.js';
import PlayerStatsPanel from './PlayerStatsPanel.vue';

const gameEngine = new GameEngine();
const gameMessages = ref([]);
const currentInput = ref('');
const gameStarted = ref(false);
const outputElement = ref(null);
const inputElement = ref(null);
const isFullscreen = ref(false);

const player = reactive(gameEngine.player);

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value;
  nextTick(() => inputElement.value?.focus());
};

// Автоскролл к низу при добавлении сообщений
const scrollToBottom = () => {
  nextTick(() => {
    if (outputElement.value) {
      outputElement.value.scrollTop = outputElement.value.scrollHeight;
    }
  });
};

watch(gameMessages, scrollToBottom, { deep: true });

const executeCommand = (command) => {
  if (!gameStarted.value) return;
  
  const result = gameEngine.processCommand(command);
  gameMessages.value.push(`> ${command}`);
  gameMessages.value.push(...result.split('\n'));

  // Обновляем данные игрока
  Object.assign(player, gameEngine.player);

  // Автосохранение каждые несколько команд
  if (gameMessages.value.length % 10 === 0) {
    gameEngine.saveGame();
  }
};

const handleMove = (message) => {
  if (!gameStarted.value) return;
  
  gameMessages.value.push(message);
  
  // Обновляем данные игрока
  Object.assign(player, gameEngine.player);
  
  // Автосохранение
  gameEngine.saveGame();
};

const processCommand = () => {
  const input = currentInput.value.trim();
  if (!input) return;

  if (!gameStarted.value) {
    if (input.toLowerCase() === 'new') {
      const welcomeMsg = gameEngine.startNewGame();
      gameMessages.value = welcomeMsg.split('\n');
      gameStarted.value = true;
      Object.assign(player, gameEngine.player);
    } else if (input.toLowerCase() === 'load') {
      if (gameEngine.loadGame()) {
        gameMessages.value.push('Игра загружена!');
        const currentRoom = gameEngine.getCurrentRoom();
        gameMessages.value.push('', currentRoom.getFullDescription(gameEngine));
        gameStarted.value = true;
        Object.assign(player, gameEngine.player);
      } else {
        gameMessages.value.push('Сохранение не найдено. Используйте "new" для новой игры.');
      }
    } else {
      gameMessages.value.push('Используйте "new" для новой игры или "load" для загрузки.');
    }
  } else {
    executeCommand(input);
  }

  currentInput.value = '';
};

onMounted(() => {
  inputElement.value?.focus();

  // Автосохранение каждые 30 секунд
  setInterval(() => {
    if (gameStarted.value) {
      gameEngine.saveGame();
    }
  }, 30000);
});
</script>

<style scoped>
.game-terminal {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
  background-color: #000;
  border: 2px solid #00ff00;
  font-family: 'Courier New', monospace;
  position: relative;
}

.game-terminal.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 2000;
  border: none;
}

.game-terminal.fullscreen .terminal-output {
  height: calc(100% - 42px); /* Full height minus input bar */
}

.terminal-output {
  flex: 1;
  padding: 10px;
  overflow-y: auto;
  background-color: #001100;
  color: #00ff00;
  font-size: 14px;
  line-height: 1.4;
  position: relative;
}

.fullscreen-btn {
  position: absolute;
  top: 5px;
  right: 5px;
  background: #002200;
  border: 1px solid #00ff00;
  color: #00ff00;
  cursor: pointer;
  z-index: 1001;
  font-size: 18px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  padding: 0;
}

.fullscreen-btn:hover {
  background-color: #00ff00;
  color: #000;
}

.welcome-message {
  color: #ffff00;
  text-align: center;
  margin-bottom: 20px;
}

.message {
  margin: 2px 0;
  white-space: pre-wrap;
}

.message :deep(.room-name) {
  color: #00ffff; /* Cyan */
  font-weight: bold;
}

.message :deep(.exit-name) {
  color: #ffff00; /* Yellow */
}

.message :deep(.item-name) {
  color: #ff00ff; /* Magenta */
}

.message :deep(.npc-name.npc-friendly) {
  color: #55ff55; /* Bright Green */
}

.message :deep(.npc-name.npc-hostile) {
  color: #ff4444; /* Red */
  font-weight: bold;
}

.message :deep(.npc-name.npc-neutral) {
  color: #aaaaaa; /* Gray */
}

.message :deep(.npc-dead) {
  color: #777777;
  font-style: italic;
}

.message :deep(.player-speech) {
  color: #dddddd; /* Светло-серый для речи игрока */
  font-style: italic;
}

.message :deep(.npc-speech) {
  color: #aaffaa; /* Слегка другой зеленый для речи НПС */
}

.message :deep(.combat-player-attack) {
  color: #ffcc66; /* Оранжевый для атак игрока */
}

.message :deep(.combat-npc-attack) {
  color: #ff6666; /* Светло-красный для атак НПС */
}

.message :deep(.combat-npc-death) {
  color: #ff9999; /* Более светлый красный для смерти */
  font-weight: bold;
}

.message :deep(.combat-exp-gain) {
  color: #66ff66; /* Ярко-зеленый для опыта */
}

.message :deep(.combat-player-hp) {
  color: #cccccc; /* Серый для статуса */
}

.message :deep(.combat-player-death) {
  color: #ff3333; /* Ярко-красный для смерти игрока */
  font-weight: bold;
}

.terminal-input {
  display: flex;
  align-items: center;
  padding: 10px;
  background-color: #002200;
  border-top: 1px solid #00ff00;
}

.prompt {
  color: #00ff00;
  margin-right: 8px;
  font-weight: bold;
}

input {
  flex: 1;
  background: transparent;
  border: none;
  color: #00ff00;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  outline: none;
}

input::placeholder {
  color: #006600;
}



.terminal-output::-webkit-scrollbar {
  width: 8px;
}

.terminal-output::-webkit-scrollbar-track {
  background: #001100;
}

.terminal-output::-webkit-scrollbar-thumb {
  background: #00ff00;
  border-radius: 4px;
}
</style>