<template>
  <div class="game-terminal">
    <div class="terminal-output" ref="outputElement">
      <div class="welcome-message">
        <p>🏰 Добро пожаловать в Мидгард! 🏰</p>
        <p>Введите "new" для начала новой игры или "load" для загрузки сохранения.</p>
      </div>

      <div v-for="(message, index) in gameMessages" :key="index" class="message">
        {{ message }}
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

    <div class="player-stats" v-if="gameStarted">
      <h3>📊 Статистика</h3>
      <div class="stat-line">💗 HP: {{ player.hitPoints }}/{{ player.maxHitPoints }}</div>
      <div class="stat-line">⭐ Уровень: {{ player.level }}</div>
      <div class="stat-line">✨ Опыт: {{ player.experience }}/{{ player.experienceToNext }}</div>
      <div class="stat-line">💪 Сила: {{ player.strength }}</div>
      <div class="stat-line">⚡ Ловкость: {{ player.dexterity }}</div>
      <div class="stat-line">🛡️ Телосложение: {{ player.constitution }}</div>

      <div v-if="player.equippedWeapon" class="equipped-item">
        ⚔️ Оружие: {{ player.equippedWeapon.name }}
      </div>
      <div v-if="player.equippedArmor" class="equipped-item">
        🛡️ Броня: {{ player.equippedArmor.name }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick, watch } from 'vue';
import { GameEngine } from '../../game/GameEngine.js';

const gameEngine = new GameEngine();
const gameMessages = ref([]);
const currentInput = ref('');
const gameStarted = ref(false);
const outputElement = ref(null);
const inputElement = ref(null);

const player = reactive(gameEngine.player);

// Автоскролл к низу при добавлении сообщений
const scrollToBottom = () => {
  nextTick(() => {
    if (outputElement.value) {
      outputElement.value.scrollTop = outputElement.value.scrollHeight;
    }
  });
};

watch(gameMessages, scrollToBottom, { deep: true });

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
    const result = gameEngine.processCommand(input);
    gameMessages.value.push(`> ${input}`);
    gameMessages.value.push(...result.split('\n'));

    // Обновляем данные игрока
    Object.assign(player, gameEngine.player);

    // Автосохранение каждые несколько команд
    if (gameMessages.value.length % 10 === 0) {
      gameEngine.saveGame();
    }
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
}

.terminal-output {
  flex: 1;
  padding: 10px;
  overflow-y: auto;
  background-color: #001100;
  color: #00ff00;
  font-size: 14px;
  line-height: 1.4;
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

.player-stats {
  position: absolute;
  top: 80px;
  right: 10px;
  width: 250px;
  background-color: #001100;
  border: 1px solid #00ff00;
  padding: 10px;
  font-size: 12px;
}

.stat-line {
  margin: 3px 0;
  color: #00ff00;
}

.equipped-item {
  margin: 5px 0;
  color: #ffff00;
  font-weight: bold;
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