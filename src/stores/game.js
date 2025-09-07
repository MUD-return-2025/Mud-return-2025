import { defineStore } from 'pinia';
import { reactive, computed, ref } from 'vue';
import { GameEngine } from '../game/GameEngine.js';

export const useGameStore = defineStore('game', () => {
  // --- State ---

  /** @type {GameEngine} */
  const engine = reactive(new GameEngine());

  const player = reactive(engine.player);
  const messages = reactive([]);
  const gameStarted = ref(false);
  const currentEnemy = ref(null);

  let tickInterval = null;
  let autosaveInterval = null;

  // --- Getters (Computed) ---

  const currentRoom = computed(() => {
    if (!gameStarted.value || !player.currentRoom) return null;
    return engine.world.rooms.get(player.currentRoom);
  });

  const hostileNpcsInRoom = computed(() => {
    if (!currentRoom.value) return [];
    return currentRoom.value.npcs
      .map(npcId => engine.getNpc(npcId, currentRoom.value.area))
      .filter(npc => npc && npc.isAlive() && npc.type === 'hostile');
  });

  const healingPotion = computed(() => {
    if (!player || !player.inventory) return null;
    return player.inventory.find(item => item.type === 'potion' && item.healAmount);
  });

  const learnedSkills = computed(() => {
    if (!engine.skillsData.size) return [];
    return Array.from(player.skills)
      .map(skillId => {
        const skill = engine.skillsData.get(skillId);
        return skill ? { ...skill, id: skillId } : null;
      })
      .filter(Boolean);
  });

  const groupedActions = computed(() => {
    return engine.getAvailableActions ? engine.getAvailableActions() : [];
  });

  // --- Actions ---

  /**
   * Обновляет реактивное состояние из движка.
   * @private
   */
  function _updateReactiveState() {
    Object.assign(player, engine.player);
    currentEnemy.value = engine.combatManager?.npc || null;
  }

  /**
   * Добавляет сообщение или массив сообщений в лог.
   * @param {string|string[]} newMessages
   */
  function _addMessages(newMessages) {
    if (!newMessages) return;
    const messagesToAdd = Array.isArray(newMessages) ? newMessages : newMessages.split('\n');
    messages.push(...messagesToAdd);
  }

  /**
   * Запускает основной игровой цикл.
   * @private
   */
  function _startIntervals() {
    if (tickInterval) clearInterval(tickInterval);
    if (autosaveInterval) clearInterval(autosaveInterval);

    tickInterval = setInterval(() => {
      if (gameStarted.value) {
        const tickMessages = engine.tick();
        _addMessages(tickMessages);
        _updateReactiveState();
      }
    }, 1000);

    autosaveInterval = setInterval(() => {
      if (gameStarted.value) {
        engine.saveGame();
      }
    }, 30000);
  }

  /**
   * Обрабатывает команду, введенную игроком.
   * @param {string} input
   */
  async function processCommand(input) {
    if (!input) return;

    _addMessages(`> ${input}`);

    if (!gameStarted.value) {
      const [command, ...args] = input.split(/\s+/);
      if (command.toLowerCase() === 'new') {
        const playerName = args.length > 0 ? args.join(' ') : undefined;
        const welcomeMsg = await engine.startNewGame(playerName);
        messages.splice(0, messages.length, ...welcomeMsg.split('\n')); // Очищаем и заполняем
        gameStarted.value = true;
      } else if (command.toLowerCase() === 'load') {
        const loaded = await engine.loadGame();
        if (loaded) {
          const roomDesc = engine.getCurrentRoom().getFullDescription(engine);
          messages.splice(0, messages.length, 'Игра загружена!', '', ...roomDesc.split('\n'));
          gameStarted.value = true;
        } else {
          _addMessages('Сохранение не найдено. Используйте "new" для новой игры.');
        }
      } else {
        _addMessages('Используйте "new" для новой игры или "load" для загрузки.');
      }
    } else {
      // Обработка игровых команд
      const result = await engine.processCommand(input);
      _addMessages(result);
    }

    _updateReactiveState();

    if (gameStarted.value && !tickInterval) {
      _startIntervals();
    }
  }

  /**
   * Перемещает игрока в другую комнату.
   * @param {string} targetRoomId
   */
  async function moveToRoom(targetRoomId) {
    const result = await engine.moveToRoom(targetRoomId);
    _addMessages(result.message);
    _updateReactiveState();
  }

  /**
   * Инициализация хранилища.
   */
  async function initialize() {
    // Подписываемся на асинхронные сообщения от движка (например, раунды боя).
    engine.onMessage = (message) => {
      if (message) {
        _addMessages(message);
        _updateReactiveState();
      }
    };
    await engine.initializeWorld();
  }

  return {
    // State
    player,
    messages,
    gameStarted,
    currentEnemy,
    engine, // Экспортируем для доступа к skillsData и т.п.

    // Getters
    currentRoom,
    hostileNpcsInRoom,
    healingPotion,
    learnedSkills,
    groupedActions,

    // Actions
    initialize,
    processCommand,
    moveToRoom,
  };
});