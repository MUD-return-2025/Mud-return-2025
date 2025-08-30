
<template>
  <div class="game-terminal">
    <!-- Область вывода сообщений -->
    <div class="output-area" ref="outputArea">
      <div 
        v-for="(message, index) in messages" 
        :key="index" 
        class="message"
        v-html="formatMessage(message)"
      ></div>
    </div>
    
    <!-- Строка ввода -->
    <div class="input-area">
      <span class="prompt">&gt; </span>
      <input 
        ref="inputField"
        v-model="currentInput"
        @keydown.enter="executeCommand"
        @keydown.up="historyUp"
        @keydown.down="historyDown"
        class="command-input"
        placeholder="Введите команду..."
        :disabled="gameState !== 'playing'"
      />
    </div>
    
    <!-- Панель статуса игрока -->
    <div class="status-bar" v-if="gameState === 'playing'">
      <span class="hp">HP: {{ player.hitPoints }}/{{ player.maxHitPoints }}</span>
      <span class="level">Ур. {{ player.level }}</span>
      <span class="exp">Опыт: {{ player.experience }}/{{ player.experienceToNext }}</span>
      <span class="location">{{ currentRoomName }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue';
import { GameEngine } from '../../game/GameEngine.js';

// Реактивные данные
const game = ref(new GameEngine());
const currentInput = ref('');
const messages = ref([]);
const commandHistory = ref([]);
const historyIndex = ref(-1);
const outputArea = ref(null);
const inputField = ref(null);

// Вычисляемые свойства
const gameState = computed(() => game.value.gameState);
const player = computed(() => game.value.player);
const currentRoomName = computed(() => {
  if (gameState.value !== 'playing') return '';
  const room = game.value.getCurrentRoom();
  return room ? room.name : '';
});

/**
 * Выполняет введенную команду
 */
const executeCommand = async () => {
  const command = currentInput.value.trim();
  if (!command) return;
  
  // Добавляем в историю команд
  commandHistory.value.push(command);
  if (commandHistory.value.length > 50) {
    commandHistory.value = commandHistory.value.slice(-25);
  }
  historyIndex.value = -1;
  
  // Добавляем команду в вывод
  messages.value.push(`> ${command}`);
  
  // Выполняем команду
  const result = game.value.processCommand(command);
  messages.value.push(result);
  
  // Ограничиваем количество сообщений
  if (messages.value.length > 200) {
    messages.value = messages.value.slice(-100);
  }
  
  currentInput.value = '';
  
  // Прокручиваем вниз
  await nextTick();
  scrollToBottom();
};

/**
 * Навигация по истории команд (стрелка вверх)
 */
const historyUp = () => {
  if (commandHistory.value.length === 0) return;
  
  if (historyIndex.value === -1) {
    historyIndex.value = commandHistory.value.length - 1;
  } else if (historyIndex.value > 0) {
    historyIndex.value--;
  }
  
  currentInput.value = commandHistory.value[historyIndex.value];
};

/**
 * Навигация по истории команд (стрелка вниз)
 */
const historyDown = () => {
  if (historyIndex.value === -1) return;
  
  if (historyIndex.value < commandHistory.value.length - 1) {
    historyIndex.value++;
    currentInput.value = commandHistory.value[historyIndex.value];
  } else {
    historyIndex.value = -1;
    currentInput.value = '';
  }
};

/**
 * Прокручивает область вывода вниз
 */
const scrollToBottom = () => {
  if (outputArea.value) {
    outputArea.value.scrollTop = outputArea.value.scrollHeight;
  }
};

/**
 * Форматирует сообщение для вывода (простое форматирование)
 * @param {string} message - сообщение
 * @returns {string} отформатированное сообщение
 */
const formatMessage = (message) => {
  // Простое форматирование - заменяем переносы строк на <br>
  return message.replace(/\n/g, '<br>');
};

/**
 * Начинает новую игру
 */
const startNewGame = () => {
  const playerName = prompt('Введите имя персонажа:', 'Герой') || 'Герой';
  const welcomeMessage = game.value.startNewGame(playerName);
  messages.value = [welcomeMessage];
  
  nextTick(() => {
    if (inputField.value) {
      inputField.value.focus();
    }
  });
};

/**
 * Загружает сохраненную игру
 */
const loadSavedGame = () => {
  const loaded = game.value.loadGame();
  if (loaded) {
    game.value.gameState = 'playing';
    const currentRoom = game.value.getCurrentRoom();
    messages.value = [
      'Игра загружена.',
      '',
      currentRoom.getFullDescription(game.value)
    ];
  } else {
    messages.value = ['Сохраненная игра не найдена. Начинаем новую игру.'];
    startNewGame();
  }
  
  nextTick(() => {
    if (inputField.value) {
      inputField.value.focus();
    }
  });
};

// Следим за изменениями сообщений для автопрокрутки
watch(messages, () => {
  nextTick(scrollToBottom);
});

// Инициализация при монтировании компонента
onMounted(() => {
  // Проверяем, есть ли сохранение
  const hasSave = localStorage.getItem('mudgame_save');
  
  if (hasSave) {
    const choice = confirm('Найдено сохранение. Загрузить игру?');
    if (choice) {
      loadSavedGame();
    } else {
      startNewGame();
    }
  } else {
    startNewGame();
  }
});

// Автосохранение каждые 30 секунд
let autoSaveInterval;
onMounted(() => {
  autoSaveInterval = setInterval(() => {
    if (gameState.value === 'playing') {
      game.value.saveGame();
    }
  }, 30000);
});

// Очистка при размонтировании
onUnmounted(() => {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
  }
});
</script>

<style scoped>
.game-terminal {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-height: 100vh;
  font-family: 'Courier New', monospace;
  background-color: #000;
  color: #00ff00;
  padding: 10px;
  box-sizing: border-box;
}

.output-area {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 10px;
  padding: 10px;
  background-color: #111;
  border: 1px solid #333;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.message {
  margin-bottom: 5px;
  line-height: 1.4;
}

.input-area {
  display: flex;
  align-items: center;
  background-color: #111;
  border: 1px solid #333;
  padding: 5px;
}

.prompt {
  color: #00ff00;
  margin-right: 5px;
  font-weight: bold;
}

.command-input {
  flex: 1;
  background: transparent;
  border: none;
  color: #00ff00;
  font-family: inherit;
  font-size: 14px;
  outline: none;
}

.command-input::placeholder {
  color: #006600;
}

.command-input:disabled {
  color: #666;
}

.status-bar {
  display: flex;
  justify-content: space-between;
  padding: 5px 10px;
  background-color: #222;
  border: 1px solid #333;
  margin-top: 10px;
  font-size: 12px;
}

.status-bar span {
  color: #ffff00;
}

.hp {
  color: #ff4444 !important;
}

.level {
  color: #44ff44 !important;
}

.exp {
  color: #4444ff !important;
}

.location {
  color: #ff44ff !important;
}

/* Скроллбар для области вывода */
.output-area::-webkit-scrollbar {
  width: 8px;
}

.output-area::-webkit-scrollbar-track {
  background: #222;
}

.output-area::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 4px;
}

.output-area::-webkit-scrollbar-thumb:hover {
  background: #666;
}
</style>
