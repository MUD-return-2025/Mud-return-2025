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
        @keydown.up.prevent="navigateHistoryUp"
        @keydown.down.prevent="navigateHistoryDown"
        ref="inputElement"
        placeholder="Введите команду..."
        autocomplete="off"
      />
    </div>

    <PlayerStatsPanel
      :player="player" 
      :game-started="gameStarted"
      :game-engine="gameEngine"
      :update-counter="updateCounter"
      @command="executeCommand"
      @move="handleMove"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick, watch } from 'vue';
import { GameEngine } from '../../game/GameEngine.js';
import PlayerStatsPanel from './PlayerStatsPanel.vue';

// --- Состояние компонента ---

/** @type {GameEngine} Экземпляр игрового движка. */
const gameEngine = new GameEngine();
/** @type {import('vue').Ref<string[]>} Массив сообщений для вывода в терминал. */
const gameMessages = ref([]);
/** @type {import('vue').Ref<string>} Текущий текст в поле ввода. */
const currentInput = ref('');
/** @type {import('vue').Ref<boolean>} Флаг, указывающий, началась ли игра. */
const gameStarted = ref(false);
/** @type {import('vue').Ref<string[]>} История введенных команд. */
const commandHistory = ref([]);
/** @type {import('vue').Ref<number>} Текущий индекс в истории команд для навигации. */
const historyIndex = ref(0);
/** @type {string} Временное хранилище для текста в поле ввода при навигации по истории. */
let tempInputOnNavStart = '';
/** @type {import('vue').Ref<number>} Счетчик обновлений для принудительной перерисовки дочерних компонентов. */
const updateCounter = ref(0);
/** @type {import('vue').Ref<HTMLElement|null>} Ссылка на DOM-элемент вывода терминала. */
const outputElement = ref(null);
/** @type {import('vue').Ref<HTMLElement|null>} Ссылка на DOM-элемент поля ввода. */
const inputElement = ref(null);
/** @type {import('vue').Ref<boolean>} Флаг полноэкранного режима. */
const isFullscreen = ref(false);

/** @type {import('../../game/classes/Player').Player} Реактивный объект игрока. */
const player = reactive(gameEngine.player);

/**
 * Переключает полноэкранный режим терминала.
 */
const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value;
  // Возвращаем фокус на поле ввода после изменения DOM
  nextTick(() => inputElement.value?.focus());
};

/**
 * Перемещается вверх по истории команд при нажатии стрелки вверх.
 */
const navigateHistoryUp = (e) => {
  if (commandHistory.value.length === 0) return;
  // Сохраняем текущий ввод, если мы начинаем навигацию с конца истории
  if (historyIndex.value === commandHistory.value.length) {
    tempInputOnNavStart = currentInput.value;
  }

  if (historyIndex.value > 0) {
    historyIndex.value--;
    currentInput.value = commandHistory.value[historyIndex.value];
  }
};

/**
 * Перемещается вниз по истории команд при нажатии стрелки вниз.
 */
const navigateHistoryDown = (e) => {
  if (commandHistory.value.length === 0) return;

  if (historyIndex.value < commandHistory.value.length) {
    historyIndex.value++;
    currentInput.value = commandHistory.value[historyIndex.value] ?? tempInputOnNavStart;
  }
};

/**
 * Прокручивает вывод терминала вниз.
 * Вызывается при обновлении `gameMessages`.
 */
const scrollToBottom = () => {
  nextTick(() => {
    if (outputElement.value) {
      outputElement.value.scrollTop = outputElement.value.scrollHeight;
    }
  });
};

// Отслеживаем изменения в `gameMessages` для автопрокрутки.
watch(gameMessages, scrollToBottom, { deep: true });

/**
 * Выполняет команду, отправленную из дочернего компонента (например, PlayerStatsPanel).
 * @param {string} command - Команда для выполнения.
 */
const executeCommand = async (command) => {
  if (!gameStarted.value) return;
  
  gameMessages.value.push(` `);
  if (command) gameMessages.value.push(`> ${command}`);
  const result = await gameEngine.processCommand(command);
  if (result) gameMessages.value.push(...result.split('\n'));

  // Автосохранение каждые несколько команд для удобства.
  if (gameMessages.value.length % 10 === 0) {
    gameEngine.saveGame();
  }
};

/**
 * Обрабатывает событие перемещения игрока, инициированное из PlayerStatsPanel.
 * @param {string} message - Сообщение о результате перемещения.
 */
const handleMove = (message) => {
  if (!gameStarted.value) return;
  
  gameMessages.value.push(message);
  
  // Автосохранение после каждого перемещения.
  gameEngine.saveGame();
};

/**
 * Обрабатывает ввод команды в терминале.
 * Это основная функция взаимодействия игрока с игрой.
 */
const processCommand = async () => {
  const input = currentInput.value.trim();
  if (!input) return;

  // Добавляем команду в историю, если она не дублирует последнюю.
  if (commandHistory.value.length === 0 || commandHistory.value[commandHistory.value.length - 1] !== input) {
    commandHistory.value.push(input);
  }
  // Сбрасываем индекс истории, чтобы при следующем нажатии "вверх" показалась последняя команда.
  historyIndex.value = commandHistory.value.length;

  if (!gameStarted.value) {
    // Обработка команд до начала игры (new/load)
    if (input.toLowerCase() === 'new') {
      const welcomeMsg = await gameEngine.startNewGame();
      gameMessages.value = welcomeMsg.split('\n');
      gameStarted.value = true;
      Object.assign(player, gameEngine.player);
    } else if (input.toLowerCase() === 'load') {
      const loaded = await gameEngine.loadGame();
      if (loaded) {
        gameMessages.value.push('Игра загружена!');
        const currentRoom = gameEngine.getCurrentRoom();
        const [areaId] = gameEngine._parseGlobalId(player.currentRoom);
        gameMessages.value.push('', currentRoom.getFullDescription(gameEngine, areaId));
        gameStarted.value = true;
        Object.assign(player, gameEngine.player);
      } else {
        gameMessages.value.push('Сохранение не найдено. Используйте "new" для новой игры.');
      }
    } else {
      gameMessages.value.push('Используйте "new" для новой игры или "load" для загрузки.');
    }
  } else {
    // Обработка игровых команд
    await executeCommand(input);
  }

  currentInput.value = '';
};

onMounted(() => {
  // Фокусируемся на поле ввода при загрузке компонента.
  inputElement.value?.focus();
  historyIndex.value = commandHistory.value.length;

  // Подписываемся на событие 'update' от игрового движка.
  // Это позволяет UI реагировать на изменения состояния игрока (HP, статы и т.д.).
  gameEngine.on('update', () => {
    // Обновляем реактивный объект игрока, чтобы UI (панель статистики) перерисовался.
    const newPlayerState = { ...gameEngine.player };
    // Принудительно создаем новый массив инвентаря, чтобы Vue точно отследил изменения
    newPlayerState.inventory = [...gameEngine.player.inventory];
    Object.assign(player, newPlayerState);
    updateCounter.value++;
  });

  // Подписываемся на асинхронные сообщения от движка (например, раунды боя).
  gameEngine.on('message', (message) => {
    if (message) {
      gameMessages.value.push(...message.split('\n'));
    }
  });

  let tickCount = 0;
  // Основной игровой цикл (тикер), запускается каждую секунду.
  setInterval(() => {
    if (gameStarted.value) {
      // 1. Обрабатываем асинхронные события движка (например, респавн NPC, блуждание).
      const tickMessages = gameEngine.update();
      if (tickMessages.length > 0) {
        gameMessages.value.push(...tickMessages);
      }

      // 2. Автосохранение каждые 30 секунд.
      tickCount++;
      if (tickCount >= 30) {
        gameEngine.saveGame();
        tickCount = 0;
      }
    }
  }, 1000);
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