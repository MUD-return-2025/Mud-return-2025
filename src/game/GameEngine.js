
import { Player } from './classes/Player.js';
import { WorldManager } from './classes/WorldManager.js';
import { CombatManager } from './classes/CombatManager.js';
import { CommandManager } from './classes/CommandManager.js';
import { DamageParser } from './utils/damageParser.js';
import { TickManager } from './classes/TickManager.js';
import { ConsiderationManager } from './classes/ConsiderationManager.js';
import { SuggestionGenerator } from './classes/SuggestionGenerator.js';
import { ActionGenerator } from './classes/ActionGenerator.js';
import commands from './commands/index.js';

/**
 * Основной игровой движок
 * Управляет состоянием игры, обработкой команд и игровой логикой
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
    this.player = new Player();
    this.world = new WorldManager(this);
    this.commandManager = new CommandManager(this);
    this.tickManager = new TickManager(this);
    this.considerationManager = new ConsiderationManager(this);
    this.suggestionGenerator = new SuggestionGenerator(this);
    this.actionGenerator = new ActionGenerator(this);

    this.skillsData = new Map(); // Карта умений, ключ - ID умения

    this.messageHistory = []; // История сообщений для вывода в терминал
    this.gameState = 'menu'; // Состояние игры: menu, playing, paused
    this.combatManager = null; // Менеджер текущего боя
    this.onMessage = null; // Колбэк для отправки асинхронных сообщений (бой и т.д.)

    this._loadCommands();
  }

  /**
   * Инициализация игрового мира. Загружает стартовую зону.
   * Должен вызываться асинхронно после создания экземпляра.
   */
  async initializeWorld() {
    await this.world.loadArea('midgard');
    await this.initializeSkills();
  }

  /**
   * Загружает данные об умениях из JSON файла.
   */
  async initializeSkills() {
    try {
      const response = await fetch(`/src/game/data/skills.json`);
      if (!response.ok) {
        throw new Error(`Не удалось загрузить умения.`);
      }
      const skillsData = await response.json();
      for (const [id, data] of Object.entries(skillsData)) {
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
   * @param {string} input - текстовый ввод
   * @returns {string} результат выполнения
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
   * @param {boolean} playerFled - игрок сбежал?
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
   * Рассчитывает средний урон игрока.
   * @returns {number}
   * @private
   */
  _calculateAvgPlayerDamage() {
    // Базовый урон 1d6 без оружия
    let avgDamage = 3.5;
    
    // Бонус от силы
    const strBonus = Math.floor((this.player.strength - 10) / 2);
    
    // Бонус от оружия
    if (this.player.equippedWeapon && this.player.equippedWeapon.damage) {
      avgDamage = new DamageParser(this.player.equippedWeapon.damage).avg() + strBonus;
    } else {
      avgDamage += strBonus;
    }
    
    return Math.max(1, avgDamage);
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
   * Получает текущую локацию игрока
   * @returns {Room} объект локации
   */
  getCurrentRoom() {
    return this.world.rooms.get(this.player.currentRoom);
  }

  /**
   * Получает предмет по ID
   * @param {string} localId - Локальный ID предмета
   * @param {string} areaId - ID зоны, в которой находится предмет
   * @returns {Object|null} данные предмета
   */
  getItem(localId, areaId) {
    return this.world.getItem(localId, areaId);
  }

  /**
   * Получает НПС по ID
   * @param {string} localId - Локальный ID НПС
   * @param {string} areaId - ID зоны, в которой находится НПС
   * @returns {NPC|null} объект НПС
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
   */
  saveGame() {
    const gameData = {
      player: {
        name: this.player.name,
        level: this.player.level,
        experience: this.player.experience,
        experienceToNext: this.player.experienceToNext,
        hitPoints: this.player.hitPoints,
        maxHitPoints: this.player.maxHitPoints,
        strength: this.player.strength,
        dexterity: this.player.dexterity,
        constitution: this.player.constitution,
        intelligence: this.player.intelligence,
        wisdom: this.player.wisdom,
        charisma: this.player.charisma,
        inventory: this.player.inventory,
        gold: this.player.gold,
        currentRoom: this.player.currentRoom,
        state: this.player.state,
        equippedWeapon: this.player.equippedWeapon,
        equippedArmor: this.player.equippedArmor,
        skills: Array.from(this.player.skills),
        deathRoom: this.player.deathRoom,
        ui_version: this.player.ui_version || 0
      },
      loadedAreaIds: Array.from(this.world.loadedAreaIds),
      worldState: {
        npcs: {},
        rooms: {},
        npcLocations: Array.from(this.world.npcLocationMap.entries()),
      },
      timestamp: Date.now()
    };
    
    // Сохраняем состояние каждого NPC (только то, что меняется)
    for (const [globalNpcId, npc] of this.world.npcs.entries()) {
      gameData.worldState.npcs[globalNpcId] = {
        hitPoints: npc.hitPoints,
      };
    }

    // Сохраняем состояние каждой комнаты (только то, что меняется)
    for (const [globalRoomId, room] of this.world.rooms.entries()) {
      gameData.worldState.rooms[globalRoomId] = {
        items: room.items,
      };
    }

    localStorage.setItem('mudgame_save', JSON.stringify(gameData));
  }

  /**
   * Загрузка игры из localStorage
   * @returns {boolean} успешна ли загрузка
   */
  async loadGame() {
    const saveData = localStorage.getItem('mudgame_save');
    if (!saveData) {
      return false;
    }
    
    try {
      const gameData = JSON.parse(saveData);
      
      this._resetWorldState();

      await this.initializeSkills();

      // Загружаем все зоны, которые были активны в сохраненной игре
      for (const areaId of gameData.loadedAreaIds) {
        await this.world.loadArea(areaId);
      }

      this.player.load(gameData.player);
      
      // Применяем сохраненное состояние мира поверх стандартного
      if (gameData.worldState) {
        // Восстанавливаем состояние NPC
        if (gameData.worldState.npcs) {
          for (const [globalNpcId, npcState] of Object.entries(gameData.worldState.npcs)) {
            const npc = this.world.npcs.get(globalNpcId);
            if (npc) {
              npc.hitPoints = npcState.hitPoints;
            }
          }
        }
        // Восстанавливаем состояние комнат (предметы на полу)
        if (gameData.worldState.rooms) {
          for (const [globalRoomId, roomState] of Object.entries(gameData.worldState.rooms)) {
            const room = this.world.rooms.get(globalRoomId);
            if (room) {
              room.items = roomState.items;
            }
          }
        }
        // Восстанавливаем карту расположения NPC
        this.world.npcLocationMap = new Map(gameData.worldState.npcLocations || []);
        this.world.syncRoomsFromNpcMap();
      }

      // Сбрасываем временные состояния игрока, которые не должны сохраняться
      if (this.player.state === 'fighting') {
        this.player.state = 'idle';
      }
      
      this.gameState = 'menu';
      this.gameState = 'playing';

      return true;
    } catch (error) {
      console.error('Ошибка загрузки:', error);
      return false;
    }
  }

  /**
   * Начинает новую игру
   * @param {string} [playerName='Игрок'] - Имя игрока.
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
   * @param {number} count - количество сообщений
   * @returns {Array<string>} массив сообщений
   */
  getRecentMessages(count = 10) {
    return this.messageHistory.slice(-count);
  }

  /**
   * Получает список доступных для перехода комнат из текущей локации
   * @returns {Array<string>} массив ID комнат
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
   * @param {string} direction - Направление, для вывода сообщения
   * @returns {Promise<{success: boolean, message: string}>} результат перехода
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
    return { success: true, message: `Вы идете ${direction}.\n\n${newRoom.getFullDescription(this)}` };
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
