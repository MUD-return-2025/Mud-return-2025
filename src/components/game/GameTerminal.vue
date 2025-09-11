<template>
  <div class="game-terminal" :class="{ fullscreen: isFullscreen }" @click="handlePanelClick">
    <div class="side-panels">
      <PlayerStatsPanel @action-performed="refocusInput" />
    </div>
    <button @click.stop="toggleFullscreen" class="fullscreen-btn" :title="isFullscreen ? 'Свернуть' : 'Во весь экран'" tabindex="-1">
      {{ isFullscreen ? '⤡' : '⛶' }}
    </button>
    <div class="terminal-output" ref="outputElement" @click="handleOutputClick">
      <div v-if="!gameStore.gameStarted" class="welcome-message">
        <p>🏰 Добро пожаловать в Мидгард! 🏰</p>
        <p>Введите "new" для начала новой игры или "load" для загрузки сохранения.</p>
      </div>
      <div v-for="(message, index) in gameStore.messages" :key="index" class="message" v-html="message">
      </div>
    </div>

    <TerminalInput
      ref="terminalInputRef"
      :command-history="commandHistory"
      :is-initialized="isInitialized"
      @process-command="processCommand"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, watch } from 'vue';
import { useGameStore } from '../../stores/game.js';
import PlayerStatsPanel from './PlayerStatsPanel.vue';
import TerminalInput from './TerminalInput.vue';

/** @type {import('vue').Ref<string[]>} История введенных команд. */
const commandHistory = ref([]);
/** @type {import('vue').Ref<HTMLElement|null>} Ссылка на DOM-элемент вывода терминала. */
const outputElement = ref(null);
/** @type {import('vue').Ref<InstanceType<typeof TerminalInput>|null>} Ссылка на компонент ввода. */
const terminalInputRef = ref(null);
/** @type {import('vue').Ref<boolean>} Флаг полноэкранного режима. */
const isFullscreen = ref(false);
/** @type {import('vue').Ref<boolean>} Флаг, что движок и хранилище инициализированы. */
const isInitialized = ref(false);

const gameStore = useGameStore();

/**
 * Обрабатывает клик по области вывода.
 * Возвращает фокус, только если нет выделенного текста.
 */
const handleOutputClick = () => {
  if (window.getSelection().toString().length === 0) {
    refocusInput();
  }
};

/**
 * Возвращает фокус на поле ввода.
 */
const refocusInput = () => {
  terminalInputRef.value?.refocusInput();
};

/**
 * Переключает полноэкранный режим терминала.
 */
const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value;
  // Возвращаем фокус на поле ввода после изменения DOM
  nextTick(refocusInput);
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

/**
 * Обрабатывает ввод и выполнение команды.
 */
const processCommand = async (input) => {
  if (!input) return;

  // Добавляем команду в историю, если она не дублирует последнюю.
  if (commandHistory.value.length === 0 || commandHistory.value[commandHistory.value.length - 1] !== input) {
    commandHistory.value.push(input);
  }

  await gameStore.processCommand(input);
  refocusInput();
};

onMounted(async () => {
  // Фокусируемся на поле ввода при загрузке компонента.
  refocusInput();

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

.side-panels {
  /* Этот блок теперь позиционируется относительно .game-terminal */
}

.game-terminal.fullscreen .terminal-output {
  height: calc(100% - 42px); /* Full height minus input bar */
}

.terminal-output {
  flex: 1;
  padding: 10px;
  overflow-y: auto;
  background-color: #001100;
  cursor: default; /* Чтобы показать, что сюда можно кликать для фокуса */
  color: #00ff00;
  font-size: 14px;
  line-height: 1.4;
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