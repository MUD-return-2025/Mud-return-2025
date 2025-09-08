<template>
  <div class="game-terminal" :class="{ fullscreen: isFullscreen }">
    <div class="terminal-output" ref="outputElement">
      <button @click="toggleFullscreen" class="fullscreen-btn" :title="isFullscreen ? 'Свернуть' : 'Во весь экран'">
        {{ isFullscreen ? '⤡' : '⛶' }}
      </button>
      <div v-if="!gameStore.gameStarted" class="welcome-message">
        <p>🏰 Добро пожаловать в Мидгард! 🏰</p>
        <p>Введите "new" для начала новой игры или "load" для загрузки сохранения.</p>
      </div>

      <div v-for="(message, index) in gameStore.messages" :key="index" class="message" v-html="message">
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
          :disabled="!isInitialized"
          autocomplete="off"
        />
      </div>

      <PlayerStatsPanel />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, watch } from 'vue';
import { useGameStore } from '../../stores/game.js';
import PlayerStatsPanel from './PlayerStatsPanel.vue';

/** @type {import('vue').Ref<string>} Текущий текст в поле ввода. */
const currentInput = ref('');
/** @type {import('vue').Ref<string[]>} История введенных команд. */
const commandHistory = ref([]);
/** @type {import('vue').Ref<number>} Текущий индекс в истории команд для навигации. */
const historyIndex = ref(0);
/** @type {string} Временное хранилище для текста в поле ввода при навигации по истории. */
let tempInputOnNavStart = '';
/** @type {import('vue').Ref<HTMLElement|null>} Ссылка на DOM-элемент вывода терминала. */
const outputElement = ref(null);
/** @type {import('vue').Ref<HTMLElement|null>} Ссылка на DOM-элемент поля ввода. */
const inputElement = ref(null);
/** @type {import('vue').Ref<boolean>} Флаг полноэкранного режима. */
const isFullscreen = ref(false);
/** @type {import('vue').Ref<Array<{text: string, type: string}>>} Массив подсказок для автодополнения. */
const suggestions = ref([]);
/** @type {import('vue').Ref<boolean>} Флаг, что движок и хранилище инициализированы. */
const isInitialized = ref(false);
/** @type {import('vue').Ref<number>} Индекс активной подсказки. */
const activeSuggestionIndex = ref(-1);

const gameStore = useGameStore();

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
  // Приоритет у подсказок
  if (suggestions.value.length > 0) {
    activeSuggestionIndex.value = activeSuggestionIndex.value <= 0
      ? suggestions.value.length - 1
      : activeSuggestionIndex.value - 1;
  } else {
    // Если подсказок нет, навигируемся по истории
    navigateHistory('up');
  }
};

const navigateSuggestionsDown = () => {
  // Приоритет у подсказок
  if (suggestions.value.length > 0) {
    if (activeSuggestionIndex.value < suggestions.value.length - 1) {
      activeSuggestionIndex.value++;
    } else {
      activeSuggestionIndex.value = 0;
    }
  } else {
    // Если подсказок нет, навигируемся по истории
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
watch(() => gameStore.messages, scrollToBottom, { deep: true });

// Отслеживаем изменения в поле ввода для генерации подсказок.
watch(currentInput, (newInput) => {
  if (!gameStore.gameStarted || !newInput.trim()) {
    suggestions.value = [];
    return;
  }

  const parts = newInput.split(' ');
  const command = parts[0].toLowerCase();
  const prefix = parts.length > 1 ? parts.slice(1).join(' ') : '';

  // Если вводится только первая команда, предлагаем сами команды
  if (parts.length === 1) {
    suggestions.value = gameStore.engine.getCommandSuggestions(null, command);
  } else {
    suggestions.value = gameStore.engine.getCommandSuggestions(command, prefix);
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

  await gameStore.processCommand(input);

  currentInput.value = '';
};

onMounted(async () => {
  // Фокусируемся на поле ввода при загрузке компонента.
  inputElement.value?.focus();
  historyIndex.value = commandHistory.value.length;

  // Инициализируем хранилище и движок
  if (!isInitialized.value) {
    await gameStore.initialize();
    isInitialized.value = true;
  }
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

.message :deep(.user-input) {
  color: #aaaaaa; /* Gray */
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