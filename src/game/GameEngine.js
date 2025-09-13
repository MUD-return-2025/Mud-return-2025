
import { Player } from './classes/Player.js';
import { WorldManager } from './classes/WorldManager.js';
import { CombatManager } from './classes/CombatManager.js';
import { CommandManager } from './classes/CommandManager.js';
import { TickManager } from './classes/TickManager.js';
import { ConsiderationManager } from './classes/ConsiderationManager.js';
import { SuggestionGenerator } from './classes/SuggestionGenerator.js';
import { SaveManager } from './classes/SaveManager.js';
import { MessageFormatter } from './utils/MessageFormatter.js';
import { ActionGenerator } from './classes/ActionGenerator.js';
import skillsJson from './data/skills.json';
import commands from './commands/index.js';

/**
 * Основной игровой движок.
 * Управляет состоянием игры, обработкой команд и всей игровой логикой. Является центральным координатором для всех менеджеров.
 */
export class GameEngine {
  /**
   * Вспомогательная функция для оборачивания текста в span с классом для стилизации.
   * @param {string} text - Текст для стилизации.
   * @param {string} className - CSS-класс.
   * @returns {string} HTML-строка.
   */
  colorize = (text, className) => `<span class="${className}">${text}</span>`;

  constructor() {
    /** @type {Player} Экземпляр класса игрока. */
    this.player = new Player();
    /** @type {WorldManager} Менеджер, управляющий игровым миром. */
    this.world = new WorldManager(this);
    /** @type {CommandManager} Менеджер для обработки команд. */
    this.commandManager = new CommandManager(this);
    /** @type {TickManager} Менеджер для обработки событий, происходящих с течением времени. */
    this.tickManager = new TickManager(this);
    /** @type {ConsiderationManager} Менеджер для оценки целей. */
    this.considerationManager = new ConsiderationManager(this);
    /** @type {SuggestionGenerator} Генератор подсказок для ввода команд. */
    this.suggestionGenerator = new SuggestionGenerator(this);
    /** @type {MessageFormatter} Форматировщик сообщений для вывода в терминал. */
    this.formatter = new MessageFormatter(this.colorize);
    /** @type {SaveManager} Менеджер для сохранения и загрузки игры. */
    this.saveManager = new SaveManager(this);
    /** @type {ActionGenerator} Генератор доступных действий для UI. */
    this.actionGenerator = new ActionGenerator(this);

    /** @type {Map<string, object>} Карта данных об умениях, где ключ - ID умения. */
    this.skillsData = new Map(); // Карта умений, ключ - ID умения

    /** @type {string[]} История сообщений для вывода в терминал. */
    this.messageHistory = []; // История сообщений для вывода в терминал
    /** @type {'menu'|'playing'|'paused'} Текущее состояние игры. */
    this.gameState = 'menu'; // Состояние игры: menu, playing, paused
    /** @type {CombatManager|null} Менеджер текущего боя. Null, если боя нет. */
    this.combatManager = null; // Менеджер текущего боя
    /** @type {((message: string) => void)|null} Колбэк для отправки асинхронных сообщений в UI (например, во время боя). */
    this.onMessage = null; // Колбэк для отправки асинхронных сообщений (бой и т.д.)

    this._loadCommands();
  }

  /**
   * Инициализация игрового мира. Загружает стартовую зону.
   * Должен вызываться асинхронно после создания экземпляра.
   */
  async initializeWorld() {
    await this.world.initialize(); // Предзагружаем все зоны
    await this.world.loadArea('midgard'); // Загружаем стартовую зону
    await this.initializeSkills();
  }

  /**
   * Загружает данные об умениях из JSON файла.
   */
  async initializeSkills() {
    try {
      for (const [id, data] of Object.entries(skillsJson)) {
        this.skillsData.set(id, { id, ...data });
      }
    } catch (error) {
      console.error('Ошибка при загрузке умений:', error);
    }
  }

  /**
   * Загружает и регистрирует все команды из папки commands.
   * @private
   */
  _loadCommands() {
    for (const command of commands) {
      this.commandManager.register(
        command.name,
        command.execute,
        command.description,
        command.aliases
      );
      // Регистрируем специальные алиасы (например, 'север' -> 'go север')
      if (command.shortcuts) {
        for (const [shortcut, target] of Object.entries(command.shortcuts)) {
          this.commandManager.registerAlias(shortcut, `${command.name} ${target}`);
        }
      }
    }
  }

  /**
   * Обрабатывает команду игрока
   * @param {string} input - Текстовая строка, введенная игроком.
   * @returns {Promise<string|null>} Результат выполнения команды в виде HTML-форматированной строки или null.
   */
  async processCommand(input) {
    const result = await this.commandManager.execute(input);
    
    // Добавляем команду и результат в историю
    this.messageHistory.push(`> ${input}`);
    if (result) { // Не добавляем пустые ответы (например, от асинхронных команд, которые работают через emit)
      this.messageHistory.push(result);
    }
    
    // Ограничиваем историю сообщений
    if (this.messageHistory.length > 100) {
      this.messageHistory = this.messageHistory.slice(-50);
    }
    
    return result;
  }

  /**
   * Обрабатывает события, происходящие с течением времени (игровой тик).
   * @returns {string[]} Массив сообщений, сгенерированных за один тик.
   */
  tick() {
    // Делегируем логику тика в TickManager
    return this.tickManager.tick();
  }

  /**
   * Находит NPC-торговца в текущей комнате.
   * @returns {import('./classes/NPC.js').NPC|null}
   * @private
   */
  _getTraderInCurrentRoom() {
    const currentRoom = this.getCurrentRoom();
    if (!currentRoom) return null;

    const [currentAreaId, ] = this.world.parseGlobalId(this.player.currentRoom);
    const merchantId = currentRoom.npcs.find(localNpcId => {
      const npc = this.getNpc(localNpcId, currentAreaId);
      return npc && npc.isAlive() && npc.canTrade && npc.canTrade();
    });

    return merchantId ? this.getNpc(merchantId, currentAreaId) : null;
  }

  /**
   * Находит предмет в магазине торговца в текущей комнате.
   * @param {string} targetName - Имя предмета для поиска.
   * @returns {object|null}
   * @private
   */
  _findItemInTraderShop(targetName) {
    const trader = this._getTraderInCurrentRoom();
    if (!trader) return null;

    const traderAreaId = trader.area;
    const shopItems = trader.getShopItems(); // Это локальные ID
    const target = targetName.toLowerCase();

    const localItemId = shopItems.find(id => {
      const item = this.getItem(id, traderAreaId);
      return item && (item.name.toLowerCase().includes(target) || item.id.toLowerCase().includes(target));
    });

    return localItemId ? this.getItem(localItemId, traderAreaId) : null;
  }

  /**
   * Начинает бой с указанным NPC.
   * @param {import('./classes/NPC').NPC} npc - Цель для атаки.
   * @returns {void}
   */
  startCombat(npc) {
    if (this.combatManager) {
      if (this.onMessage) this.onMessage('Вы уже в бою!');
      return;
    }
    this.combatManager = new CombatManager(this, this.player, npc);
    this.combatManager.start();
  }

  /**
   * Завершает бой
   * @returns {void}
   */
  stopCombat() {
    this.combatManager = null;
  }

  /**
   * Проверяет и выдает игроку новые умения при повышении уровня.
   * @returns {string} Сообщение о новых умениях.
   */
  checkAndAwardSkills() {
    let message = '';
    for (const [skillId, skillData] of this.skillsData.entries()) {
      if (this.player.level >= skillData.level && !this.player.hasSkill(skillId)) {
        this.player.skills.push(skillId); // Используем push вместо add
        message += `\nВы изучили новое умение: ${this.colorize(skillData.name, 'combat-exp-gain')}!`;
      }
    }
    return message.trim();
  }

  /**
   * Сканирует соседние комнаты на наличие враждебных существ.
   * @returns {Array<{direction: string, hostiles: Array<{name: string, count: number}>}>}
   */
  scanForHostiles() {
    const currentRoom = this.getCurrentRoom();
    if (!currentRoom) return [];

    const hostilesByDirection = [];

    for (const [direction, exit] of currentRoom.exits.entries()) {
      const targetRoomId = (typeof exit === 'object')
        ? this.world.getGlobalId(exit.room, exit.area)
        : this.world.getGlobalId(exit, currentRoom.area);

      const targetRoom = this.world.rooms.get(targetRoomId);
      if (!targetRoom) continue;

      const hostilesInRoom = new Map();
      targetRoom.npcs.forEach(localNpcId => {
        const npc = this.getNpc(localNpcId, targetRoom.area);
        if (npc && npc.isAlive() && npc.type === 'hostile') {
          hostilesInRoom.set(npc.name, (hostilesInRoom.get(npc.name) || 0) + 1);
        }
      });

      if (hostilesInRoom.size > 0) {
        hostilesByDirection.push({
          direction,
          hostiles: Array.from(hostilesInRoom.entries()).map(([name, count]) => ({ name, count }))
        });
      }
    }

    return hostilesByDirection;
  }

  // Вспомогательные методы

  /**
   * Универсальный метод для поиска предмета или NPC по имени в различных локациях.
   * Поиск производится в следующем порядке: инвентарь игрока, предметы в текущей комнате,
   * предметы у торговца в текущей комнате, NPC в текущей комнате.
   * @param {string} targetName - Имя цели для поиска.
   * @returns {{type: 'item'|'npc', entity: object}|null} Объект с типом и найденной сущностью, или null если не найдено.
   */
  findTargetByName(targetName) {
    if (!targetName) return null;

    const lowerTargetName = targetName.toLowerCase();
    const currentRoom = this.getCurrentRoom();
    const [currentAreaId] = this.world.parseGlobalId(this.player.currentRoom);

    // 1. Ищем предмет в инвентаре игрока
    let item = this.player.findItem(lowerTargetName);
    if (item) {
      return { type: 'item', entity: item };
    }

    // 2. Ищем предмет в текущей комнате
    const globalItemId = currentRoom.findItem(lowerTargetName, this);
    if (globalItemId) {
      item = this.world.items.get(globalItemId);
      if (item) return { type: 'item', entity: item };
    }

    // 3. Ищем предмет у торговца в текущей комнате
    item = this._findItemInTraderShop(lowerTargetName);
    if (item) {
      return { type: 'item', entity: item };
    }

    // 4. Ищем NPC в текущей комнате
    const npcId = currentRoom.findNpc(lowerTargetName, this, currentAreaId);
    if (npcId) {
      const npc = this.getNpc(npcId, currentAreaId);
      if (npc) return { type: 'npc', entity: npc };
    }

    return null; // Цель не найдена
  }

  /**
   * Получает текущую локацию игрока
   * @returns {import('./classes/Room.js').Room|undefined} Объект текущей локации или undefined, если не найден.
   */
  getCurrentRoom() {
    return this.world.rooms.get(this.player.currentRoom);
  }

  /**
   * Получает предмет по ID
   * @param {string} localId - Локальный ID предмета
   * @param {string} areaId - ID зоны, в которой находится предмет
   * @returns {object|null} Данные предмета или null, если не найден.
   */
  getItem(localId, areaId) {
    return this.world.getItem(localId, areaId);
  }

  /**
   * Получает НПС по ID
   * @param {string} localId - Локальный ID НПС
   * @param {string} areaId - ID зоны, в которой находится НПС
   * @returns {import('./classes/NPC.js').NPC|null} Объект НПС или null, если не найден.
   */
  getNpc(localId, areaId) {
    return this.world.getNpc(localId, areaId);
  }

  /**
   * Сбрасывает состояние игрового мира до начального.
   * Используется перед началом новой игры или загрузкой.
   * @private
   */
  _resetWorldState() {
    this.world.reset();

    // Очищаем временное состояние игры
    if (this.combatManager) {
      this.combatManager.stop();
    }
    this.tickManager.reset();
  }
  /**
   * Сохранение игры в localStorage
   * @returns {void}
   */
  saveGame() {
    this.saveManager.saveGame();
  }

  /**
   * Загрузка игры из localStorage
   * @returns {Promise<boolean>} `true` в случае успешной загрузки, иначе `false`.
   */
  async loadGame() {
    const loaded = await this.saveManager.loadGame();
    if (loaded) {
      // Сбрасываем временные состояния игрока, которые не должны сохраняться
      if (this.player.state === 'fighting') {
        this.player.state = 'idle';
      }

      this.gameState = 'menu';
      this.gameState = 'playing';
    }
    return loaded;
  }

  /**
   * Начинает новую игру
   * @param {string} [playerName='Игрок'] - Имя игрока.
   * @returns {Promise<string>} Приветственное сообщение.
   */
  async startNewGame(playerName = 'Игрок') {
    this._resetWorldState();
    this.gameState = 'menu';
    this.messageHistory = [];
    this.player.reset(playerName);
    await this.initializeWorld(); // Мир загружается после сброса игрока
    this.checkAndAwardSkills(); // Проверяем умения на 1 уровне
    this.gameState = 'playing';
    
    // Начинаем в центре города
    this.player.currentRoom = 'midgard:center';
    const welcomeMessage = `Добро пожаловать в Мидгард, ${playerName}!

${this.getCurrentRoom().getFullDescription(this)}

Введите 'help' для получения списка команд.`;

    this.messageHistory = [welcomeMessage];
    return welcomeMessage;
  }

  /**
   * Получает последние сообщения
   * @param {number} [count=10] - Количество запрашиваемых сообщений.
   * @returns {string[]} Массив сообщений.
   */
  getRecentMessages(count = 10) {
    return this.messageHistory.slice(-count);
  }

  /**
   * Получает список доступных для перехода комнат из текущей локации
   * @returns {string[]} Массив глобальных ID комнат.
   */
  getAvailableRooms() {
    const currentRoom = this.getCurrentRoom();
    if (!currentRoom) return [];

    const [currentAreaId, ] = this.world.parseGlobalId(this.player.currentRoom);

    return Array.from(currentRoom.exits.values()).map(exit => (typeof exit === 'string' ? this.world.getGlobalId(exit, currentAreaId) : this.world.getGlobalId(exit.room, exit.area)));
  }

  /**
   * Переходит в указанную комнату, если это возможно
   * @param {string} targetRoomId - Глобальный ID целевой комнаты.
   * @param {string} [direction='куда-то'] - Направление, для вывода сообщения.
   * @returns {Promise<{success: boolean, message: string}>} Результат перехода.
   */
  async moveToRoom(targetRoomId, direction = 'куда-то') {
    if (this.player.state === 'fighting') {
      return { success: false, message: 'Вы не можете уйти во время боя!' };
    }
    if (this.player.state === 'dead') {
      return { success: false, message: 'Вы мертвы и не можете двигаться.' };
    }

    const [targetAreaId] = this.world.parseGlobalId(targetRoomId);
    if (!this.world.loadedAreaIds.has(targetAreaId)) {
      if (this.onMessage) this.onMessage(`Загрузка новой зоны: ${targetAreaId}...`);
      await this.world.loadArea(targetAreaId);
    }

    // Если направление не было передано (например, при клике на карту), пробуем найти его.
    if (direction === 'куда-то') {
      const currentRoom = this.getCurrentRoom();
      for (const [dir, exit] of currentRoom.exits.entries()) {
        const exitGlobalId = (typeof exit === 'object')
          ? this.world.getGlobalId(exit.room, exit.area)
          : this.world.getGlobalId(exit, currentRoom.area);
        if (exitGlobalId === targetRoomId) {
          direction = dir;
          break;
        }
      }
    }

    this.player.currentRoom = targetRoomId;
    const newRoom = this.getCurrentRoom();
    return { success: true, message: `${this.colorize(`Вы идете ${direction}.`, 'info-label')}\n\n${newRoom.getFullDescription(this)}` };
  }

  /**
   * Генерирует сгруппированный список доступных действий для игрока в текущей комнате.
   * @returns {Array<{
   *   isGeneral?: boolean,
   *   target?: { name: string, type: string },
   *   actions: Array<{label: string, command: string, danger?: boolean}>
   * }>}
   */
  getAvailableActions() {
    return this.actionGenerator.getAvailableActions(); // Делегируем вызов
  }

  /**
   * Генерирует подсказки для команд.
   * @param {string|null} command - Текущая команда.
   * @param {string} prefix - Текущий префикс для поиска.
   * @returns {Array<{text: string, type: string}>}
   */
  getCommandSuggestions(command, prefix) {
    // Делегируем вызов SuggestionGenerator
    return this.suggestionGenerator.getSuggestions(command, prefix);
  }
}
