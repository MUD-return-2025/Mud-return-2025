
import { Player } from './classes/Player.js';
import { WorldManager } from './classes/WorldManager.js';
import { CombatManager } from './classes/CombatManager.js';
import { CommandManager } from './classes/CommandManager.js';
import { DamageParser } from './utils/damageParser.js';
import { TickManager } from './classes/TickManager.js';
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
   * Формирует строку с описанием и сравнением предмета.
   * @param {object} item - Предмет для оценки.
   * @returns {string}
   * @private
   */
  _getConsiderItemString(item) {
    const c = this.colorize;
    const header = c(`---[ Оценка: ${item.name} ]--------`, 'room-name');
    const footer = c('------------------------------------', 'room-name');

    const lines = [
      c(item.description, 'npc-neutral'),
      '',
      c('Характеристики:', 'exit-name')
    ];

    if (item.type) lines.push(`  Тип: ${c(item.type, 'item-name')}`);
    if (item.damage) lines.push(`  ⚔️ Урон: ${c(item.damage, 'combat-player-attack')}`);
    if (item.armor) lines.push(`  🛡️ Защита: ${c(item.armor, 'combat-exp-gain')}`);
    if (item.healAmount) lines.push(`  ❤️ Лечение: ${c(item.healAmount, 'combat-exp-gain')}`);
    if (item.weight) lines.push(`  ⚖️ Вес: ${c(item.weight, 'npc-neutral')}`);
    if (item.value) lines.push(`  💰 Ценность: ${c(item.value, 'exit-name')} золота`);

    let result = [header, ...lines].join('\n');
    
    // Логика сравнения
    if (item.type === 'weapon') {
      result += this._compareEquipment(item, this.player.equippedWeapon, 'Оружие');
    } else if (item.type === 'armor') {
      result += this._compareEquipment(item, this.player.equippedArmor, 'Броня');
    }
    
    result += `\n${footer}`;
    return result;
  }

  /**
   * Сравнивает два предмета экипировки.
   * @param {object} newItem - Новый предмет.
   * @param {object} equippedItem - Надетый предмет.
   * @param {string} itemTypeName - Название типа предмета (Оружие/Броня).
   * @returns {string}
   * @private
   */
  _compareEquipment(newItem, equippedItem, itemTypeName) {
    const c = this.colorize;
    if (!equippedItem) {
      return `\n\n${c('Сравнение:', 'exit-name')}\n  У вас не надето: ${itemTypeName}.`;
    }

    let comparison = `\n\n${c('Сравнение с надетым', 'exit-name')} (${c(equippedItem.name, 'item-name')}):\n`;
    let better = 0;
    let worse = 0;
    
    const compareStat = (name, newItemStat, equippedItemStat, lowerIsBetter = false) => {
      if (newItemStat === equippedItemStat) return `  ${name}: ${newItemStat.toFixed(1)} (=)\n`;
      
      const isBetter = lowerIsBetter ? newItemStat < equippedItemStat : newItemStat > equippedItemStat;
      const diff = newItemStat - equippedItemStat;
      const diffStr = diff > 0 ? `+${diff.toFixed(1)}` : `${diff.toFixed(1)}`;

      if (isBetter) {
        better++;
        return `  ${name}: ${newItemStat.toFixed(1)} (${c(diffStr, 'combat-exp-gain')})\n`;
      } else {
        worse++;
        return `  ${name}: ${newItemStat.toFixed(1)} (${c(diffStr, 'combat-npc-death')})\n`;
      }
    };

    if (newItem.type === 'weapon') {
      const newItemDamage = new DamageParser(newItem.damage).avg();
      const equippedItemDamage = new DamageParser(equippedItem.damage).avg();
      comparison += compareStat('Средний урон', newItemDamage, equippedItemDamage);
    }    
    if (newItem.type === 'armor') {
      comparison += compareStat('Защита', newItem.armor || 0, equippedItem.armor || 0);
    }

    comparison += compareStat('Вес', newItem.weight || 0, equippedItem.weight || 0, true);
    // Сравнение ценности не так важно, уберем его из общего вердикта
    comparison += `  Ценность: ${newItem.value || 0} (=)\n`;

    if (better > worse) {
      comparison += `\n${c('Вердикт:', 'exit-name')} В целом, это ${c('лучше', 'combat-exp-gain')}, чем то, что на вас надето.`;
    } else if (worse > better) {
      comparison += `\n${c('Вердикт:', 'exit-name')} В целом, это ${c('хуже', 'combat-npc-death')}, чем то, что на вас надето.`;
    } else {
      comparison += `\n${c('Вердикт:', 'exit-name')} В целом, они примерно одинаковы.`;
    }

    return comparison;
  }

  /**
   * Оценивает шансы на победу в бою с NPC.
   * @param {NPC} npc - Противник.
   * @returns {string}
   * @private
   */
  _getConsiderNpcString(npc) {
    const c = this.colorize;
    const header = c(`---[ Оценка: ${npc.name} ]--------`, 'room-name');
    const footer = c('------------------------------------', 'room-name');

    const lines = [
      c(npc.description, 'npc-neutral'),
      '',
      c('Оценка сил:', 'exit-name')
    ];

    const playerHp = this.player.hitPoints;
    const playerAvgDamage = this._calculateAvgPlayerDamage();
    const npcHp = npc.hitPoints;
    const npcAvgDamage = new DamageParser(npc.damage).avg();

    // Избегаем деления на ноль
    if (playerAvgDamage <= 0) {
      lines.push('  Вы не можете нанести урон.');
      return [header, ...lines, footer].join('\n');
    }
    if (npcAvgDamage <= 0) {
      lines.push(`  Противник не может нанести урон. ${c('Легкая победа', 'combat-exp-gain')}.`);
      return [header, ...lines, footer].join('\n');
    }

    const roundsToKillNpc = Math.ceil(npcHp / playerAvgDamage);
    const roundsToKillPlayer = Math.ceil(playerHp / npcAvgDamage);

    lines.push(`  Ваш урон/раунд (средний): ${c(playerAvgDamage.toFixed(1), 'combat-player-attack')}`);
    lines.push(`  Урон врага/раунд (средний): ${c(npcAvgDamage.toFixed(1), 'combat-npc-attack')}`);
    lines.push(`  Раундов до победы: ~${c(roundsToKillNpc, 'combat-player-attack')}`);
    lines.push(`  Раундов до поражения: ~${c(roundsToKillPlayer, 'combat-npc-attack')}`);

    let conclusion = '';
    let conclusionColor = 'npc-neutral';
    const ratio = roundsToKillPlayer / roundsToKillNpc;

    if (ratio > 2.5) {
      conclusion = 'Легкая победа.'; conclusionColor = 'combat-exp-gain';
    } else if (ratio > 1.5) {
      conclusion = 'Скорее всего, вы победите.'; conclusionColor = 'exit-name';
    } else if (ratio >= 0.9) {
      conclusion = 'Тяжелый бой, шансы равны.'; conclusionColor = 'combat-player-attack';
    } else if (ratio > 0.6) {
      conclusion = 'Очень опасно, скорее всего, вы проиграете.'; conclusionColor = 'combat-npc-attack';
    } else {
      conclusion = 'Бегите! У вас нет шансов.'; conclusionColor = 'combat-player-death';
    }
    lines.push(`\n${c('Вердикт:', 'exit-name')} ${c(conclusion, conclusionColor)}`);
    return [header, ...lines, footer].join('\n');
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
    return this.actionGenerator.getAvailableActions();
  }

  /**
   * Генерирует список подсказок для автодополнения команды.
   * @param {string} command - Введенная команда (e.g., 'get', 'kill').
   * @param {string} prefix - Частичный аргумент команды для фильтрации (e.g., 'меч').
   * @returns {Array<{text: string, type: 'command'|'item'|'npc'|'exit'}>} Массив объектов подсказок.
   */
  getCommandSuggestions(command, prefix = '') {
    const suggestions = [];
    const lowerPrefix = prefix.toLowerCase();
    const currentRoom = this.getCurrentRoom();

    if (!command) {
      // Если команда не введена, предлагаем базовые команды
      const allCommands = [...this.commandManager.commands.keys()];
      return allCommands
        .filter(cmd => cmd.startsWith(lowerPrefix))
        .map(cmd => ({ text: cmd, type: 'command' }));
    }

    const suggestFrom = (items, type) => { // `items` здесь - это массив объектов, а не ID
      if (!items) return;
      items
        .filter(item => item && item.name.toLowerCase().startsWith(lowerPrefix))
        .forEach(item => suggestions.push({ text: item.name, type }));
    };

    const itemsInRoom = currentRoom?.items.map(id => this.world.items.get(id)).filter(Boolean) || [];
    const npcsInRoom = currentRoom?.npcs.map(id => this.world.getNpc(id, currentRoom.area)).filter(npc => npc && npc.isAlive()) || [];
    const itemsInInventory = this.player.inventory;

    switch (command) {
      case 'go':
      case 'идти':
        return currentRoom.getExits()
          .filter(exit => exit.startsWith(lowerPrefix))
          .map(exit => ({ text: exit, type: 'exit' }));

      case 'get':
      case 'взять':
        suggestFrom(itemsInRoom, 'item');
        break;

      case 'drop':
      case 'выбросить':
      case 'equip':
      case 'надеть':
      case 'unequip':
      case 'снять':
      case 'use':
      case 'использовать':
        suggestFrom(itemsInInventory, 'item');
        break;

      case 'gain':
      case 'получить': {
        const statKeys = [
          'сила', 'str',
          'ловкость', 'dex',
          'телосложение', 'con',
          'интеллект', 'int',
          'мудрость', 'wis',
          'харизма', 'cha',
          'здоровье', 'hp', 'хп',
          'максхп', 'maxhp',
          'уровень', 'lvl', 'лвл',
          'опыт', 'exp'
        ];
        return statKeys
          .filter(key => key.startsWith(lowerPrefix))
          .map(key => ({ text: key, type: 'command' })); // Используем тип 'command' для желтого цвета
      }

      case 'kill':
      case 'убить':
      case 'talk':
      case 'kick':
      case 'пнуть':
      case 'поговорить':
        suggestFrom(npcsInRoom, 'npc');
        break;

      case 'look':
      case 'осмотреть':
      case 'consider':
      case 'оценить':
        suggestFrom(itemsInRoom, 'item');
        suggestFrom(npcsInRoom, 'npc');
        suggestFrom(itemsInInventory, 'item');
        break;
    }

    // Убираем дубликаты, если они есть
    return [...new Map(suggestions.map(item => [item.text, item])).values()];
  }
}
