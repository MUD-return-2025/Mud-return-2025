
import { Player } from './classes/Player.js';
import { Room } from './classes/Room.js';
import { NPC } from './classes/NPC.js';
import { CombatManager } from './classes/CombatManager.js';
import { CommandParser } from './classes/CommandParser.js';
import { DamageParser } from './utils/damageParser.js';
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
    this.commandParser = new CommandParser();

    // Глобальные хранилища для всех загруженных данных
    this.rooms = new Map(); // Карта комнат, ключ - глобальный ID
    this.items = new Map(); // Карта предметов, ключ - глобальный ID
    this.npcs = new Map(); // Карта NPC, ключ - глобальный ID
    this.areas = new Map(); // Карта метаданных загруженных зон
    this.skillsData = new Map(); // Карта умений, ключ - ID умения
    this.loadedAreaIds = new Set(); // Набор ID уже загруженных зон

    this.messageHistory = []; // История сообщений для вывода в терминал
    this.gameState = 'menu'; // Состояние игры: menu, playing, paused
    this.combatManager = null; // Менеджер текущего боя
    this.respawnQueue = []; // Очередь для возрождения НПС
    this.npcLocationMap = new Map(); // Карта <globalNpcId, globalRoomId>
    this.listeners = {}; // Объект для подписчиков на события { eventName: [callback, ...] }

    this._loadCommands();

    // Основной игровой цикл (тикер) для обработки асинхronных событий, таких как возрождение.
    // Управление вызовом `update()` передано в компонент GameTerminal.vue.
  }

  /**
   * Подписывается на событие
   * @param {string} eventName 
   * @param {Function} callback 
   */
  on(eventName, callback) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push(callback);
  }

  /**
   * Вызывает событие
   * @param {string} eventName 
   * @param  {...any} args 
   */
  emit(eventName, ...args) {
    if (this.listeners[eventName]) {
      this.listeners[eventName].forEach(callback => callback(...args));
    }
  }

  /**
   * Инициализация игрового мира. Загружает стартовую зону.
   * Должен вызываться асинхронно после создания экземпляра.
   */
  async initializeWorld() {
    await this.loadArea('midgard');
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
   * Загружает игровую зону (area) из JSON файла.
   * @param {string} areaId - ID зоны для загрузки (например, 'midgard').
   */
  async loadArea(areaId) {
    if (this.loadedAreaIds.has(areaId)) {
      console.log(`Зона ${areaId} уже загружена.`);
      return true;
    }

    try {
      const response = await fetch(`/src/game/data/areas/${areaId}.json`);
      if (!response.ok) {
        throw new Error(`Не удалось загрузить зону: ${areaId}`);
      }
      const areaData = await response.json();

      // Сохраняем метаданные зоны
      this.areas.set(areaId, {
        id: areaData.id,
        name: areaData.name,
        description: areaData.description,
      });

      // Загружаем предметы с глобальными ID
      for (const [localId, itemData] of Object.entries(areaData.items)) {
        this.items.set(`${areaId}:${localId}`, { id: localId, area: areaId, ...itemData });
      }

      // Загружаем NPC с глобальными ID
      for (const [localId, npcData] of Object.entries(areaData.npcs)) {
        this.npcs.set(`${areaId}:${localId}`, new NPC({ id: localId, area: areaId, ...npcData }));
      }

      // Загружаем комнаты с глобальными ID
      for (const [localId, roomData] of Object.entries(areaData.rooms)) {
        this.rooms.set(`${areaId}:${localId}`, new Room({ id: localId, area: areaId, ...roomData }));
      }

      this._buildNpcLocationMapForArea(areaId);

      this.loadedAreaIds.add(areaId);
      console.log(`Зона ${areaId} успешно загружена.`);
      return true;
    } catch (error) {
      console.error(`Ошибка при загрузке зоны ${areaId}:`, error);
      return false;
    }
  }

  /**
   * Индексирует начальное положение всех NPC в указанной зоне.
   * @param {string} areaId
   * @private
   */
  _buildNpcLocationMapForArea(areaId) {
    for (const [globalRoomId, room] of this.rooms.entries()) {
      if (room.area === areaId) {
        for (const localNpcId of room.npcs) {
          const globalNpcId = this._getGlobalId(localNpcId, areaId);
          this.npcLocationMap.set(globalNpcId, globalRoomId);
        }
      }
    }
  }

  /**
   * Загружает и регистрирует все команды из папки commands.
   * @private
   */
  _loadCommands() {
    for (const command of commands) {
      this.commandParser.registerCommand(
        command.name,
        command.execute,
        command.description,
        command.aliases
      );
      // Регистрируем специальные алиасы (например, 'север' -> 'go север')
      if (command.shortcuts) {
        for (const [shortcut, target] of Object.entries(command.shortcuts)) {
          this.commandParser.aliases.set(shortcut, `${command.name} ${target}`);
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
    const parsed = this.commandParser.parseCommand(input);
    // Если игрок мертв, разрешаем только команду 'respawn'
    if (this.player.state === 'dead' && parsed.command !== 'respawn') {
      return 'Вы мертвы. Используйте команду "respawn" для возрождения.';
    }

    // Проверка на доступные команды во время боя
    const allowedCombatCommands = ['flee', 'look', 'inventory', 'stats', 'use', 'kick'];
    if (this.combatManager && !allowedCombatCommands.includes(parsed.command)) {
      return 'Вы не можете сделать это в бою! Попробуйте `flee` (сбежать).';
    }

    const result = await this.commandParser.executeCommand(parsed, this);
    
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
    const messages = this.checkRespawns();
    const cooldownMessages = this._tickCooldowns();
    const wanderMessages = this.updateWanderingNpcs();
    return [...messages, ...cooldownMessages, ...wanderMessages];
  }

  /**
   * Проверяет очередь возрождения и возрождает НПС, если пришло время.
   * @returns {string[]} Массив сообщений о возрождении.
   */
  checkRespawns() {
    const messages = [];
    const now = Date.now();

    this.respawnQueue = this.respawnQueue.filter(entry => {
      if (now >= entry.respawnTime) {
        const [areaId, npcId] = this._parseGlobalId(entry.globalNpcId);
        const npc = this.getNpc(npcId, areaId);
        const room = this.rooms.get(entry.roomId); // entry.roomId - это globalRoomId
        // Возрождаем, только если НПС еще не в комнате
        if (npc && room && !room.hasNpc(npcId)) {
          this.npcLocationMap.set(entry.globalNpcId, entry.roomId);
          npc.respawn(this);
          room.addNpc(npc.id); // Используем локальный ID
          if (this.player.currentRoom === entry.roomId) {
              // Если игрок в комнате, сообщаем ему о возрождении
              messages.push(this.colorize(`${npc.name} появляется из тени!`, 'combat-npc-death'));
          }
        }
        return false; // Удаляем из очереди
      }
      return true; // Оставляем в очереди
    });

    return messages;
  }

  /**
   * Уменьшает время перезарядки умений игрока на 1 каждую секунду.
   * @private
   * @returns {string[]} Массив сообщений о готовности умений.
   */
  _tickCooldowns() {
    const messages = [];
    for (const skillId in this.player.skillCooldowns) {
      if (this.player.skillCooldowns[skillId] > 0) {
        this.player.skillCooldowns[skillId]--;
        if (this.player.skillCooldowns[skillId] === 0) {
          delete this.player.skillCooldowns[skillId];
          const skillData = this.skillsData.get(skillId);
          if (skillData) {
            // Сообщение отправляется через emit, чтобы появиться в терминале
            this.emit('message', this.colorize(`Умение "${skillData.name}" готово к использованию.`, 'combat-exp-gain'));
          }
        }
      }
    }
    return messages; // Возвращаем пустой массив, т.к. сообщения идут через emit
  }

  /**
   * Обновляет положение блуждающих НПС.
   * @returns {string[]} Массив сообщений о перемещении NPC.
   */
  updateWanderingNpcs() {
    const messages = [];
    const WANDER_CHANCE = 0.05; // 5% шанс в секунду на перемещение
    const combatNpcGlobalId = this.combatManager
      ? this._getGlobalId(this.combatManager.npc.id, this.combatManager.npc.area)
      : null;
    for (const [globalNpcId, currentNpcRoomId] of this.npcLocationMap.entries()) {
      const npc = this.npcs.get(globalNpcId);
      // Проверяем, может ли NPC перемещаться и не находится ли он в бою
      if (npc && npc.canWander && npc.isAlive() && globalNpcId !== combatNpcGlobalId && Math.random() < WANDER_CHANCE) {
        const currentNpcRoom = this.rooms.get(currentNpcRoomId);

        if (currentNpcRoom) {
          const exits = currentNpcRoom.getExits();
          if (exits.length > 0) {
            const randomExitDirection = exits[Math.floor(Math.random() * exits.length)];
            const exit = currentNpcRoom.getExit(randomExitDirection);

            // Перемещаемся только внутри текущей зоны для простоты
            if (typeof exit === 'string') {
              const targetRoomId = this._getGlobalId(exit, currentNpcRoom.area);
              const targetRoom = this.rooms.get(targetRoomId);
              currentNpcRoom.removeNpc(npc.id);
              targetRoom.addNpc(npc.id);
              this.npcLocationMap.set(globalNpcId, targetRoomId); // Обновляем карту

              // Если игрок в одной из комнат, оповещаем его
              if (this.player.currentRoom === currentNpcRoomId) {
                messages.push(this.colorize(`${npc.name} уходит в сторону (${randomExitDirection}).`, 'npc-neutral'));
              } else if (this.player.currentRoom === targetRoomId) {
                messages.push(this.colorize(`${npc.name} приходит откуда-то.`, 'npc-neutral'));
              }
            }
          }
        }
      }
    }
    return messages;
  }

  /**
   * Планирует возрождение НПС.
   * @param {string} globalNpcId - Глобальный ID НПС для возрождения.
   * @param {string} roomId - ID комнаты, где НПС должен возродиться.
   */
  scheduleNpcRespawn(globalNpcId, roomId) {
    const npc = this.npcs.get(globalNpcId);
    // Возрождаем только враждебных НПС (например, крыс)
    if (!npc || npc.type !== 'hostile') {
      return;
    }

    const RESPAWN_TIME = 30000; // 30 секунд
    this.respawnQueue.push({
      globalNpcId,
      roomId,
      respawnTime: Date.now() + RESPAWN_TIME
    });
  }

  /**
   * Находит NPC-торговца в текущей комнате.
   * @returns {import('./classes/NPC.js').NPC|null}
   * @private
   */
  _getTraderInCurrentRoom() {
    const currentRoom = this.getCurrentRoom();
    if (!currentRoom) return null;

    const [currentAreaId, ] = this._parseGlobalId(this.player.currentRoom);
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
      this.emit('message', 'Вы уже в бою!');
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
    let result = `Вы рассматриваете ${this.colorize(item.name, 'item-name')}.\n`;
    result += `${item.description}\n\n`;
    result += `Характеристики:\n`;
    if (item.type) result += `  Тип: ${item.type}\n`;
    if (item.damage) result += `  Урон: ${item.damage}\n`;
    if (item.armor) result += `  Защита: ${item.armor}\n`;
    if (item.healAmount) result += `  Лечение: ${item.healAmount}\n`;
    if (item.weight) result += `  Вес: ${item.weight}\n`;
    if (item.value) result += `  Ценность: ${item.value} золота\n`;

    // Логика сравнения
    if (item.type === 'weapon') {
      result += this._compareEquipment(item, this.player.equippedWeapon, 'Оружие');
    } else if (item.type === 'armor') {
      result += this._compareEquipment(item, this.player.equippedArmor, 'Броня');
    }

    return result.trim();
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
    if (!equippedItem) {
      return `\nУ вас не надето: ${itemTypeName}.`;
    }

    let comparison = `\nСравнение с надетым (${this.colorize(equippedItem.name, 'item-name')}):\n`;
    let better = 0;
    let worse = 0;
    
    const compareStat = (name, newItemStat, equippedItemStat, lowerIsBetter = false) => {
      if (newItemStat === equippedItemStat) return `  ${name}: ${newItemStat.toFixed(1)} (=)\n`;
      
      const isBetter = lowerIsBetter ? newItemStat < equippedItemStat : newItemStat > equippedItemStat;
      const diff = newItemStat - equippedItemStat;
      const diffStr = diff > 0 ? `+${diff.toFixed(1)}` : `${diff.toFixed(1)}`;

      if (isBetter) {
        better++;
        return `  ${name}: ${newItemStat.toFixed(1)} (${this.colorize(diffStr, 'combat-exp-gain')})\n`;
      } else {
        worse++;
        return `  ${name}: ${newItemStat.toFixed(1)} (${this.colorize(diffStr, 'combat-npc-death')})\n`;
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
    comparison += compareStat('Ценность', newItem.value || 0, equippedItem.value || 0);

    if (better > worse) {
      comparison += `\nВ целом, это ${this.colorize('лучше', 'combat-exp-gain')}, чем то, что на вас надето.`;
    } else if (worse > better) {
      comparison += `\nВ целом, это ${this.colorize('хуже', 'combat-npc-death')}, чем то, что на вас надето.`;
    } else {
      comparison += `\nВ целом, они примерно одинаковы.`;
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
    let result = `Вы оцениваете ${this.colorize(npc.name, `npc-name npc-${npc.type}`)}.\n`;
    result += `${npc.description}\n\n`;

    const playerHp = this.player.hitPoints;
    const playerAvgDamage = this._calculateAvgPlayerDamage();
    
    const npcHp = npc.hitPoints;
    const npcAvgDamage = new DamageParser(npc.damage).avg();

    // Избегаем деления на ноль
    if (playerAvgDamage <= 0) {
        return result + `Оценка сил: Вы не можете нанести урон.`;
    }
    if (npcAvgDamage <= 0) {
        return result + `Оценка сил: Противник не может нанести урон. Легкая победа.`;
    }

    const roundsToKillNpc = Math.ceil(npcHp / playerAvgDamage);
    const roundsToKillPlayer = Math.ceil(playerHp / npcAvgDamage);

    let conclusion = '';
    const ratio = roundsToKillPlayer / roundsToKillNpc;

    if (ratio > 2.5) {
      conclusion = 'Это будет легкая победа.';
    } else if (ratio > 1.5) {
      conclusion = 'Вы, скорее всего, победите, но можете получить урон.';
    } else if (ratio >= 0.9) {
      conclusion = 'Бой будет очень тяжелым. Шансы примерно равны.';
    } else if (ratio > 0.6) {
      conclusion = 'Это очень опасный противник. Скорее всего, вы проиграете.';
    } else {
      conclusion = 'Бегите! У вас нет шансов.';
    }

    result += `Оценка сил: ${this.colorize(conclusion, 'combat-player-attack')}`;
    return result;
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

  // Вспомогательные методы

  /**
   * Получает текущую локацию игрока
   * @returns {Room} объект локации
   */
  getCurrentRoom() {
    return this.rooms.get(this.player.currentRoom);
  }

  /**
   * Получает предмет по ID
   * @param {string} localId - Локальный ID предмета
   * @param {string} areaId - ID зоны, в которой находится предмет
   * @returns {Object|null} данные предмета
   */
  getItem(localId, areaId) {
    return this.items.get(this._getGlobalId(localId, areaId)) || null;
  }

  /**
   * Получает НПС по ID
   * @param {string} localId - Локальный ID НПС
   * @param {string} areaId - ID зоны, в которой находится НПС
   * @returns {NPC|null} объект НПС
   */
  getNpc(localId, areaId) {
    return this.npcs.get(this._getGlobalId(localId, areaId)) || null;
  }

  /**
   * Собирает глобальный ID из локального ID и ID зоны.
   * @param {string} localId 
   * @param {string} areaId 
   * @returns {string} Глобальный ID (например, 'midgard:center')
   */
  _getGlobalId(localId, areaId) {
    return `${areaId}:${localId}`;
  }

  /**
   * Разбирает глобальный ID на ID зоны и локальный ID.
   * @param {string} globalId 
   * @returns {[string, string]} [areaId, localId]
   */
  _parseGlobalId(globalId) {
    const parts = globalId.split(':');
    return [parts[0], parts.slice(1).join(':')];
  }
  /**
   * Сбрасывает состояние игрового мира до начального.
   * Используется перед началом новой игры или загрузкой.
   * @private
   */
  _resetWorldState() {
    // Очищаем состояние мира, которое загружается из файлов зон
    this.rooms.clear();
    this.items.clear();
    this.npcs.clear();
    this.areas.clear();
    this.loadedAreaIds.clear();
    this.npcLocationMap.clear();

    // Очищаем временное состояние игры
    if (this.combatManager) {
      this.combatManager.stop();
    }
    this.respawnQueue = [];
    this.gameState = 'menu';
  }

  /**
   * Синхронизирует массивы `npcs` во всех комнатах на основе `npcLocationMap`.
   * Необходимо вызывать после загрузки состояния, чтобы комнаты "знали", какие NPC в них находятся.
   * @private
   */
  _syncRoomsFromNpcMap() {
    // 1. Очищаем всех NPC из всех комнат
    for (const room of this.rooms.values()) {
      room.npcs = [];
    }
    // 2. Заполняем комнаты NPC на основе карты их местоположений
    for (const [globalNpcId, globalRoomId] of this.npcLocationMap.entries()) {
      const room = this.rooms.get(globalRoomId);
      const [, localNpcId] = this._parseGlobalId(globalNpcId);
      if (room) room.addNpc(localNpcId);
    }
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
        currentRoom: this.player.currentRoom,
        state: this.player.state,
        equippedWeapon: this.player.equippedWeapon,
        equippedArmor: this.player.equippedArmor,
        skills: Array.from(this.player.skills),
        deathRoom: this.player.deathRoom,
        ui_version: this.player.ui_version || 0
      },
      loadedAreaIds: Array.from(this.loadedAreaIds),
      worldState: {
        npcs: {},
        rooms: {},
        npcLocations: Array.from(this.npcLocationMap.entries()),
      },
      timestamp: Date.now()
    };
    
    // Сохраняем состояние каждого NPC (только то, что меняется)
    for (const [globalNpcId, npc] of this.npcs.entries()) {
      gameData.worldState.npcs[globalNpcId] = {
        hitPoints: npc.hitPoints,
      };
    }

    // Сохраняем состояние каждой комнаты (только то, что меняется)
    for (const [globalRoomId, room] of this.rooms.entries()) {
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
        await this.loadArea(areaId);
      }

      this.player.load(gameData.player);
      
      // Применяем сохраненное состояние мира поверх стандартного
      if (gameData.worldState) {
        // Восстанавливаем состояние NPC
        if (gameData.worldState.npcs) {
          for (const [globalNpcId, npcState] of Object.entries(gameData.worldState.npcs)) {
            const npc = this.npcs.get(globalNpcId);
            if (npc) {
              npc.hitPoints = npcState.hitPoints;
            }
          }
        }
        // Восстанавливаем состояние комнат (предметы на полу)
        if (gameData.worldState.rooms) {
          for (const [globalRoomId, roomState] of Object.entries(gameData.worldState.rooms)) {
            const room = this.rooms.get(globalRoomId);
            if (room) {
              room.items = roomState.items;
            }
          }
        }
        // Восстанавливаем карту расположения NPC
        this.npcLocationMap = new Map(gameData.worldState.npcLocations || []);
        this._syncRoomsFromNpcMap();
      }

      // Сбрасываем временные состояния игрока, которые не должны сохраняться
      if (this.player.state === 'fighting') {
        this.player.state = 'idle';
      }
      
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

    const [currentAreaId, ] = this._parseGlobalId(this.player.currentRoom);

    return Array.from(currentRoom.exits.values()).map(exit => (typeof exit === 'string' ? this._getGlobalId(exit, currentAreaId) : this._getGlobalId(exit.room, exit.area)));
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

    const [targetAreaId] = this._parseGlobalId(targetRoomId);
    if (!this.loadedAreaIds.has(targetAreaId)) {
      this.emit('message', `Загрузка новой зоны: ${targetAreaId}...`);
      await this.loadArea(targetAreaId);
    }

    // Если направление не было передано (например, при клике на карту), пробуем найти его.
    if (direction === 'куда-то') {
      const currentRoom = this.getCurrentRoom();
      for (const [dir, exit] of currentRoom.exits.entries()) {
        const exitGlobalId = (typeof exit === 'object')
          ? this._getGlobalId(exit.room, exit.area)
          : this._getGlobalId(exit, currentRoom.area);
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
    const groupedActions = [];
    const currentRoom = this.getCurrentRoom();
    if (!currentRoom) return [];

    // --- Группа: Базовые действия ---
    const baseActions = [
      { label: '👁️ Осмотреться', command: 'look' },
      { label: '💾 Сохранить', command: 'save' },
      { label: '❓ Помощь', command: 'help' }
    ];
    groupedActions.push({ isGeneral: true, actions: baseActions });

    // --- Действия, которые не привязаны к конкретному NPC, но зависят от их наличия ---
    const generalNpcActions = [];
    const npcsInRoom = currentRoom.npcs
      .map(npcId => this.getNpc(npcId, currentRoom.area))
      .filter(npc => npc && npc.isAlive());

    if (npcsInRoom.some(npc => npc.canTrade && npc.canTrade())) {
      generalNpcActions.push({ label: '💰 Торговать', command: 'list' });
    }
    if (npcsInRoom.some(npc => npc.canHeal)) {
      generalNpcActions.push({ label: '✨ Исцелиться', command: 'heal' });
    }
    if (generalNpcActions.length > 0) {
      groupedActions.push({ isGeneral: true, actions: generalNpcActions });
    }

    // --- Группировка действий по каждому предмету ---
    currentRoom.items
      .map(globalItemId => this.items.get(globalItemId))
      .filter(Boolean)
      .forEach(item => {
        groupedActions.push({
          target: { name: item.name, type: 'item-name' },
          actions: [
            { label: `👁️ Осмотреть`, command: `look ${item.name}` },
            { label: `🤔 Оценить`, command: `consider ${item.name}` },
            { label: `✋ Взять`, command: `get ${item.name}` }
          ]
        });
      });

    // --- Группировка действий по каждому NPC ---
    for (const npc of npcsInRoom) {
      const specificNpcActions = [];
      specificNpcActions.push({ label: `👁️ Осмотреть`, command: `look ${npc.name}` });
      specificNpcActions.push({ label: `🤔 Оценить`, command: `consider ${npc.name}` });
      if (npc.dialogue && npc.dialogue.length > 0) {
        specificNpcActions.push({ label: `💬 Поговорить`, command: `talk ${npc.name}` });
      }
      if (npc.type === 'hostile') {
        specificNpcActions.push({ label: `⚔️ Убить`, command: `kill ${npc.name}`, danger: true });
      }
      groupedActions.push({
        target: { name: npc.name, type: `npc-${npc.type}` },
        actions: specificNpcActions
      });
    }

    return groupedActions;
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
      const allCommands = [...this.commandParser.commands.keys()];
      return allCommands
        .filter(cmd => cmd.startsWith(lowerPrefix))
        .map(cmd => ({ text: cmd, type: 'command' }));
    }

    const suggestFrom = (items, type) => {
      if (!items) return;
      items
        .filter(item => item && item.name.toLowerCase().startsWith(lowerPrefix))
        .forEach(item => suggestions.push({ text: item.name, type }));
    };

    const itemsInRoom = currentRoom?.items.map(id => this.items.get(id)).filter(Boolean) || [];
    const npcsInRoom = currentRoom?.npcs.map(id => this.getNpc(id, currentRoom.area)).filter(npc => npc && npc.isAlive()) || [];
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
