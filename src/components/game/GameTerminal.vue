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

    <div class="input-container">
      <div v-if="suggestions.length > 0" class="suggestions-box">
        <div
          v-for="(suggestion, index) in suggestions"
          :key="index"
          :class="['suggestion-item', { active: activeSuggestionIndex === index }]"
          @click="applySuggestion(suggestion)"
        >
          <span :class="`suggestion-type-${suggestion.type}`">{{ suggestion.type.charAt(0).toUpperCase() }}</span> {{ suggestion.text }}
        </div>
      </div>
      <div class="terminal-input">
        <span class="prompt">></span>
        <input
          v-model="currentInput"
          @keyup.enter="processCommand"
          @keydown.up.prevent="navigateSuggestionsUp"
          @keydown.down.prevent="navigateSuggestionsDown"
          @keydown.tab.prevent="applyActiveSuggestion"
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick, watch, computed } from 'vue';
import { GameEngine } from '../../game/GameEngine.js';
import PlayerStatsPanel from './PlayerStatsPanel.vue';

// --- Состояние компонента ---

/** @type {GameEngine} Экземпляр игрового движка. */
const gameEngine = reactive(new GameEngine());
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
/** @type {import('vue').Ref<object>} Реактивная обертка для данных игрока. */
const player = reactive(gameEngine.player);
/** @type {import('vue').Ref<object|null>} Реактивная ссылка на текущего противника. */
const currentEnemy = ref(null);
/** @type {import('vue').Ref<HTMLElement|null>} Ссылка на DOM-элемент вывода терминала. */
const outputElement = ref(null);
/** @type {import('vue').Ref<HTMLElement|null>} Ссылка на DOM-элемент поля ввода. */
const inputElement = ref(null);
/** @type {import('vue').Ref<boolean>} Флаг полноэкранного режима. */
const isFullscreen = ref(false);
/** @type {import('vue').Ref<Array<{text: string, type: string}>>} Массив подсказок для автодополнения. */
const suggestions = ref([]);
/** @type {import('vue').Ref<number>} Индекс активной подсказки. */
const activeSuggestionIndex = ref(-1);

/**
 * Переключает полноэкранный режим терминала.
 */
const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value;
  // Возвращаем фокус на поле ввода после изменения DOM
  nextTick(() => inputElement.value?.focus());
};

/**
 * Осуществляет навигацию по списку подсказок или истории команд.
 */
const navigateSuggestionsUp = () => {
  if (suggestions.value.length > 0) {
    // Корректная навигация вверх по подсказкам
    activeSuggestionIndex.value = activeSuggestionIndex.value <= 0
      ? suggestions.value.length - 1
      : activeSuggestionIndex.value - 1;
  } else {
    navigateHistory('up');
  }
};

const navigateSuggestionsDown = () => {
  if (suggestions.value.length > 0) {
    // Корректная навигация вниз по подсказкам
    activeSuggestionIndex.value = (activeSuggestionIndex.value + 1) % suggestions.value.length;
  } else {
    navigateHistory('down');
  }
};

/**
 * Перемещается по истории команд.
 * @param {'up' | 'down'} direction
 */
const navigateHistory = (direction) => {
  if (commandHistory.value.length === 0) return;
  if (direction === 'up') {
    if (historyIndex.value === commandHistory.value.length) {
      tempInputOnNavStart = currentInput.value;
    }
    if (historyIndex.value > 0) historyIndex.value--;
  } else {
    if (historyIndex.value < commandHistory.value.length) historyIndex.value++;
  }
  currentInput.value = commandHistory.value[historyIndex.value] ?? tempInputOnNavStart;
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

// Отслеживаем изменения в поле ввода для генерации подсказок.
watch(currentInput, (newInput) => {
  if (!gameStarted.value || !newInput.trim()) {
    suggestions.value = [];
    return;
  }

  const parts = newInput.split(' ');
  const command = parts[0].toLowerCase();
  const prefix = parts.length > 1 ? parts.slice(1).join(' ') : '';

  // Если вводится только первая команда, предлагаем сами команды
  if (parts.length === 1) {
    suggestions.value = gameEngine.getCommandSuggestions(null, command);
  } else {
    suggestions.value = gameEngine.getCommandSuggestions(command, prefix);
  }
  activeSuggestionIndex.value = -1; // Сбрасываем выбор
});

/** Применяет выбранную подсказку к полю ввода. */
const applySuggestion = (suggestion) => {
  const parts = currentInput.value.split(' ');
  parts[parts.length - 1] = suggestion.text;
  currentInput.value = parts.join(' ');
  suggestions.value = []; // Скрываем подсказки
  inputElement.value?.focus(); // Возвращаем фокус
};

/** Применяет активную (или первую) подсказку по нажатию Tab. */
const applyActiveSuggestion = () => {
  if (suggestions.value.length === 0) return;
  // Если подсказка выбрана стрелками, используем ее. Иначе — первую в списке.
  const suggestionToApply = activeSuggestionIndex.value !== -1
    ? suggestions.value[activeSuggestionIndex.value]
    : suggestions.value[0];
  applySuggestion(suggestionToApply);
};

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
  updateReactiveState();
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
  updateReactiveState();
};

/**
 * Обрабатывает ввод и выполнение команды.
 * Если выбрана подсказка, сначала применяет ее.
 */
const processCommand = async () => {
  if (suggestions.value.length > 0 && activeSuggestionIndex.value !== -1) {
    applySuggestion(suggestions.value[activeSuggestionIndex.value]);
  }
  const input = currentInput.value.trim();
  if (!input) return;

  suggestions.value = []; // Скрываем подсказки после отправки

  // Добавляем команду в историю, если она не дублирует последнюю.
  if (commandHistory.value.length === 0 || commandHistory.value[commandHistory.value.length - 1] !== input) {
    commandHistory.value.push(input);
  }
  // Сбрасываем индекс истории, чтобы при следующем нажатии "вверх" показалась последняя команда.
  historyIndex.value = commandHistory.value.length;

  if (!gameStarted.value) {
    const [command, ...args] = input.split(/\s+/);
    // Обработка команд до начала игры (new/load)
    if (command.toLowerCase() === 'new') {
      const playerName = args.length > 0 ? args.join(' ') : undefined;
      const welcomeMsg = await gameEngine.startNewGame(playerName);
      gameMessages.value = welcomeMsg.split('\n');
      Object.assign(player, gameEngine.player); // Синхронизируем реактивный объект
      gameStarted.value = true;
    } else if (command.toLowerCase() === 'load') {
      const loaded = await gameEngine.loadGame();
      if (loaded) {
        gameMessages.value.push('Игра загружена!');
        const currentRoom = gameEngine.getCurrentRoom();
        Object.assign(player, gameEngine.player); // Синхронизируем реактивный объект
        gameMessages.value.push('', currentRoom.getFullDescription(gameEngine));
        gameStarted.value = true;
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

/** Обновляет реактивные переменные, которые передаются в дочерние компоненты */
const updateReactiveState = () => {
  // Object.assign для обновления полей реактивного объекта player
  Object.assign(player, gameEngine.player);
};

onMounted(() => {
  // Фокусируемся на поле ввода при загрузке компонента.
  inputElement.value?.focus();
  historyIndex.value = commandHistory.value.length;

  // Подписываемся на асинхронные сообщения от движка (например, раунды боя).
  gameEngine.on('message', (message) => {
    if (message) {
      gameMessages.value.push(...message.split('\n'));
      updateReactiveState();
    }
  });

  let tickCount = 0;
  // Основной игровой цикл (тикер), запускается каждую секунду.
  setInterval(() => {
    if (gameStarted.value) {
      // 1. Обрабатываем события, происходящие с течением времени (игровой тик).
      const tickMessages = gameEngine.tick();
      if (tickMessages.length > 0) {
        gameMessages.value.push(...tickMessages);
      }

      // 2. Автосохранение каждые 30 секунд.
      tickCount++;
      if (tickCount >= 30) {
        // console.log('Autosaving...');
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

.input-container {
  position: relative;
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

.suggestions-box {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  background-color: #002a00;
  border: 1px solid #00ff00;
  border-bottom: none;
  max-height: 150px;
  overflow-y: auto;
  z-index: 10;
}

.suggestion-item {
  padding: 4px 10px;
  color: #00ff00;
  cursor: pointer;
  font-size: 13px;
  border-bottom: 1px solid #004400;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-item:hover, .suggestion-item.active {
  background-color: #00ff00;
  color: #000;
}

.suggestion-item .suggestion-type-command { color: #ffff00; }
.suggestion-item .suggestion-type-item { color: #ff00ff; }
.suggestion-item .suggestion-type-npc { color: #ff4444; }
.suggestion-item .suggestion-type-exit { color: #00ffff; }

.suggestion-item:hover .suggestion-type-command,
.suggestion-item.active .suggestion-type-command,
.suggestion-item:hover .suggestion-type-item,
.suggestion-item.active .suggestion-type-item,
.suggestion-item:hover .suggestion-type-npc,
.suggestion-item.active .suggestion-type-npc,
.suggestion-item:hover .suggestion-type-exit,
.suggestion-item.active .suggestion-type-exit {
  color: #000;
}

.suggestion-item span {
  display: inline-block;
  width: 1.5em;
  font-weight: bold;
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