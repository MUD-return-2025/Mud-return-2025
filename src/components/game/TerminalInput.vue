<template>
  <div class="input-container">
    <div v-if="isHistoryVisible" class="history-box">
      <div v-if="reversedCommandHistory.length === 0" class="history-empty">История команд пуста</div>
      <div
        v-for="(command, index) in reversedCommandHistory"
        :key="index"
        class="history-item"
        @click="selectFromHistory(command)"
        :title="command"
      >{{ command }}</div>
    </div>
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
        @keyup.enter="onEnter"
        @keydown.esc.prevent="handleEsc"
        @keydown.up.prevent="navigateUp"
        @keydown.down.prevent="navigateDown"
        @keydown.tab.prevent="applyActiveSuggestion"
        ref="inputElement"
        placeholder="Введите команду..."
        :disabled="!isInitialized"
        autocomplete="off"
      />
      <div class="input-actions">
        <button @click="handleEsc" class="input-action-btn" title="Очистить (ESC)">×</button>
        <button @click="toggleHistoryPanel" class="input-action-btn" title="История команд">◷</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, nextTick } from 'vue';
import { useGameStore } from '../../stores/game.js';

const props = defineProps({
  commandHistory: {
    type: Array,
    required: true,
  },
  isInitialized: {
    type: Boolean,
    required: true,
  }
});

const emit = defineEmits(['process-command']);

const gameStore = useGameStore();

const currentInput = ref('');
const inputElement = ref(null);

// --- Suggestions Logic ---
const suggestions = ref([]);
const activeSuggestionIndex = ref(-1);

// --- History Logic ---
const isHistoryVisible = ref(false);
const historyIndex = ref(-1);
let tempInput = '';

const reversedCommandHistory = computed(() => [...props.commandHistory].reverse());

const refocusInput = () => {
  inputElement.value?.focus();
};

const handleEsc = () => {
  if (isHistoryVisible.value) isHistoryVisible.value = false;
  else if (suggestions.value.length > 0) suggestions.value = [];
  else if (currentInput.value) currentInput.value = '';
  refocusInput();
};

const toggleHistoryPanel = () => {
  isHistoryVisible.value = !isHistoryVisible.value;
  if (isHistoryVisible.value) suggestions.value = [];
};

const selectFromHistory = (command) => {
  currentInput.value = command;
  isHistoryVisible.value = false;
  refocusInput();
};

const onEnter = () => {
  if (suggestions.value.length > 0 && activeSuggestionIndex.value !== -1) {
    applySuggestion(suggestions.value[activeSuggestionIndex.value]);
  } else {
    emit('process-command', currentInput.value);
    currentInput.value = '';
    historyIndex.value = -1; // Reset history navigation
    tempInput = '';
  }
};

watch(currentInput, (newInput) => {
  if (!gameStore.gameStarted || !newInput.trim()) {
    suggestions.value = [];
    return;
  }

  // Do not show suggestions when navigating history
  if (historyIndex.value !== -1) return;

  const parts = newInput.split(' ');
  const command = parts[0].toLowerCase();
  const prefix = parts.length > 1 ? parts.slice(1).join(' ') : '';

  if (parts.length === 1) {
    suggestions.value = gameStore.engine.getCommandSuggestions(null, command);
  } else {
    suggestions.value = gameStore.engine.getCommandSuggestions(command, prefix);
  }
  activeSuggestionIndex.value = -1;
});

const applySuggestion = (suggestion) => {
  const parts = currentInput.value.split(' ');
  parts[parts.length - 1] = suggestion.text;
  currentInput.value = parts.join(' ') + ' ';
  suggestions.value = [];
  nextTick(refocusInput);
};

const applyActiveSuggestion = () => {
  if (suggestions.value.length === 0) return;
  const suggestionToApply = activeSuggestionIndex.value !== -1
    ? suggestions.value[activeSuggestionIndex.value]
    : suggestions.value[0];
  applySuggestion(suggestionToApply);
};

const navigateUp = () => {
  if (suggestions.value.length > 0) {
    activeSuggestionIndex.value = activeSuggestionIndex.value <= 0
      ? suggestions.value.length - 1
      : activeSuggestionIndex.value - 1;
  } else {
    navigateHistory('up');
  }
};

const navigateDown = () => {
  if (suggestions.value.length > 0) {
    activeSuggestionIndex.value = (activeSuggestionIndex.value + 1) % suggestions.value.length;
  } else {
    navigateHistory('down');
  }
};

const navigateHistory = (direction) => {
  if (props.commandHistory.length === 0) return;

  // Entering history navigation mode
  if (historyIndex.value === -1) {
    tempInput = currentInput.value;
  }

  if (direction === 'up') {
    historyIndex.value = Math.min(historyIndex.value + 1, props.commandHistory.length - 1);
  } else { // down
    historyIndex.value = Math.max(historyIndex.value - 1, -1);
  }

  if (historyIndex.value === -1) {
    currentInput.value = tempInput;
  } else {
    currentInput.value = reversedCommandHistory.value[historyIndex.value];
  }
};

onMounted(refocusInput);

defineExpose({ refocusInput });
</script>

<style scoped>
.input-container {
  position: relative;
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

.input-actions {
  display: flex;
  align-items: center;
}

.input-action-btn {
  background: transparent;
  border: none;
  color: #00ff00;
  font-size: 20px;
  cursor: pointer;
  padding: 0 8px;
  line-height: 1;
  font-family: 'Courier New', monospace;
}

.input-action-btn:hover {
  color: #ffff00;
}

input::placeholder {
  color: #006600;
}

.history-box, .suggestions-box {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  background-color: #002a00;
  border: 1px solid #00ff00;
  border-bottom: none;
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
}

.history-item, .suggestion-item {
  padding: 5px 10px;
  color: #00ff00;
  cursor: pointer;
  font-size: 13px;
  border-bottom: 1px solid #004400;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-item:last-child, .suggestion-item:last-child {
  border-bottom: none;
}

.history-item:hover, .suggestion-item:hover, .suggestion-item.active {
  background-color: #00ff00;
  color: #000;
}

.history-empty {
  padding: 10px;
  color: #888;
  text-align: center;
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
</style>