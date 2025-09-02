
import { Player } from './classes/Player.js';
import { Room } from './classes/Room.js';
import { NPC } from './classes/NPC.js';
import { CommandParser } from './classes/CommandParser.js';
import { DamageParser } from './utils/damageParser.js';

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
    this.combatTarget = null; // Текущая цель в бою (глобальный ID)
    this.combatInterval = null; // Интервал для автоматического боя
    this.respawnQueue = []; // Очередь для возрождения НПС
    this.npcLocationMap = new Map(); // Карта <globalNpcId, globalRoomId>
    this.listeners = {}; // Объект для подписчиков на события { eventName: [callback, ...] }

    this.registerCommands();

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
   * Регистрирует все игровые команды
   */
  registerCommands() {
    this.commandParser.registerCommand('look', this.cmdLook.bind(this), 
      'осмотреться вокруг или изучить предмет/НПС', 
      ['л', 'смотреть', 'осмотреть']
    );
    
    this.commandParser.registerCommand('go', this.cmdGo.bind(this), 
      'идти в указанном направлении (север/юг/восток/запад)', 
      ['идти', 'иди', 'с', 'ю', 'в', 'з', 'север', 'юг', 'восток', 'запад']
    );
    
    this.commandParser.registerCommand('get', this.cmdGet.bind(this), 
      'взять предмет', 
      ['взять']
    );
    
    this.commandParser.registerCommand('drop', this.cmdDrop.bind(this), 
      'бросить предмет', 
      ['бросить']
    );
    
    this.commandParser.registerCommand('inventory', this.cmdInventory.bind(this), 
      'показать инвентарь', 
      ['inv', 'и', 'инвентарь']
    );
    
    this.commandParser.registerCommand('kill', this.cmdKill.bind(this), 
      'атаковать цель', 
      ['убить', 'атаковать']
    );
    
    this.commandParser.registerCommand('kick', this.cmdKick.bind(this),
      'пнуть противника',
      ['пнуть']
    );

    this.commandParser.registerCommand('say', this.cmdSay.bind(this), 
      'поговорить с НПС', 
      ['говорить', 'сказать']
    );
    
    this.commandParser.registerCommand('talk', this.cmdTalk.bind(this), 
      'поговорить с конкретным НПС', 
      ['поговорить']
    );
    
    this.commandParser.registerCommand('use', this.cmdUse.bind(this), 
      'использовать предмет', 
      ['использовать']
    );
    
    this.commandParser.registerCommand('stats', this.cmdStats.bind(this), 
      'показать характеристики игрока', 
      ['статы', 'характеристики']
    );
    
    this.commandParser.registerCommand('help', this.cmdHelp.bind(this), 
      'показать эту справку', 
      ['помощь', 'справка']
    );
    
    this.commandParser.registerCommand('save', this.cmdSave.bind(this), 
      'сохранить игру', 
      ['сохранить']
    );
    
    this.commandParser.registerCommand('load', this.cmdLoad.bind(this), 
      'загрузить игру', 
      ['загрузить']
    );
    
    this.commandParser.registerCommand('heal', this.cmdHeal.bind(this), 
      'исцелиться у жреца', 
      ['исцелить']
    );
    
    this.commandParser.registerCommand('equip', this.cmdEquip.bind(this), 
      'экипировать оружие или броню', 
      ['экипировать']
    );
    
    this.commandParser.registerCommand('unequip', this.cmdUnequip.bind(this), 
      'снять экипированный предмет', 
      ['снять']
    );
    
    this.commandParser.registerCommand('list', this.cmdList.bind(this), 
      'посмотреть товары торговца', 
      ['список']
    );
    
    this.commandParser.registerCommand('buy', this.cmdBuy.bind(this), 
      'купить товар у торговца', 
      ['купить']
    );
    
    this.commandParser.registerCommand('sell', this.cmdSell.bind(this), 
      'продать предмет торговцу', 
      ['продать']
    );

    this.commandParser.registerCommand('flee', this.cmdFlee.bind(this),
      'сбежать из боя',
      ['сбежать']
    );

    this.commandParser.registerCommand('respawn', this.cmdRespawn.bind(this),
      'возродиться после смерти',
      ['возродиться']
    );

    this.commandParser.registerCommand('consider', this.cmdConsider.bind(this),
      'оценить предмет или противника',
      ['con', 'consider']
    );

    this.commandParser.registerCommand('gain', this.cmdGain.bind(this),
      'увеличить характеристику для отладки (gain <стат> <число>)',
      ['получить']
    );
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
    if (this.player.state === 'fighting' && !allowedCombatCommands.includes(parsed.command)) {
      return 'Вы не можете сделать это в бою! Попробуйте `flee` (сбежать).';
    }

    const result = await this.commandParser.executeCommand(parsed, this);

    // После каждой команды оповещаем UI о возможном изменении состояния игрока
    this.emit('update');
    
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
   * Основной метод обновления, вызываемый в игровом цикле.
   * @returns {string[]} Массив сообщений, сгенерированных за один тик.
   */
  update() {
    const messages = this.checkRespawns();
    const wanderMessages = this.updateWanderingNpcs();
    return [...messages, ...wanderMessages];
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
              this.emit('update'); // Оповещаем UI об обновлении
          }
        }
        return false; // Удаляем из очереди
      }
      return true; // Оставляем в очереди
    });

    return messages;
  }

  /**
   * Обновляет положение блуждающих НПС.
   * @returns {string[]} Массив сообщений о перемещении NPC.
   */
  updateWanderingNpcs() {
    const messages = [];
    const WANDER_CHANCE = 0.05; // 5% шанс в секунду на перемещение

    for (const [globalNpcId, currentNpcRoomId] of this.npcLocationMap.entries()) {
      const npc = this.npcs.get(globalNpcId);
      // Проверяем, может ли NPC перемещаться и не находится ли он в бою
      if (npc && npc.canWander && npc.isAlive() && this.combatTarget !== globalNpcId && Math.random() < WANDER_CHANCE) {
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
                this.emit('update');
              } else if (this.player.currentRoom === targetRoomId) {
                messages.push(this.colorize(`${npc.name} приходит откуда-то.`, 'npc-neutral'));
                this.emit('update');
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
   * Команда: look - осмотр локации или предмета
   */
  cmdLook(cmd) {
    if (this.player.state === 'dead') {
      return this.colorize(
        'Вы бестелесный дух, парящий над своим телом.\nМир вокруг кажется серым и размытым. Вы можете только \'respawn\' (возродиться).',
        'player-dead-look'
      );
    }
    const currentRoom = this.getCurrentRoom();
    
    if (!cmd.target) {
      // Осматриваем локацию
      return currentRoom.getFullDescription(this);
    }
    
    // Осматриваем конкретный предмет или НПС
    const target = cmd.target.toLowerCase();
    
    // Ищем среди предметов в комнате
    const globalItemId = currentRoom.findItem(target, this);
    if (globalItemId) {
      const item = this.items.get(globalItemId);
      return item.description + (item.readText ? `\n\nНа ${this.colorize(item.name, 'item-name')} написано: "${item.readText}"` : '');
    }
    
    // Ищем среди предметов в инвентаре
    const inventoryItem = this.player.findItem(target, this);
    if (inventoryItem) {
      return inventoryItem.description;
    }
    
    // Ищем в товарах торговца
    const traderItem = this._findItemInTraderShop(target);
    if (traderItem) {
      // Используем ту же логику, что и для предмета в комнате
      return traderItem.description + (traderItem.readText ? `\n\nНа ${this.colorize(traderItem.name, 'item-name')} написано: "${traderItem.readText}"` : '');
    }

    // Ищем среди НПС
    const [currentAreaId, ] = this._parseGlobalId(this.player.currentRoom);
    const npcIdInRoom = currentRoom.findNpc(target, this, currentAreaId);
    if (npcIdInRoom) {
      const npc = this.getNpc(npcIdInRoom, currentAreaId);
      return npc.description + (npc.hitPoints <= 0 ? this.colorize(' (мертв)', 'npc-dead') : '');
    }
    
    return `Вы не видите "${cmd.target}" здесь.`;
  }

  /**
   * Команда: go - перемещение между локациями
   */
  async cmdGo(cmd) {
    if (!cmd.target) {
      return 'Куда вы хотите пойти? Используйте: go <направление>';
    }
    
    if (this.player.state === 'fighting') {
      return 'Вы не можете уйти во время боя!';
    }

    const currentRoom = this.getCurrentRoom();
    const direction = cmd.target.toLowerCase();
    const exit = currentRoom.getExit(direction);
    
    if (!exit) {
      return `Вы не можете пойти ${direction} отсюда.`;
    }

    let targetRoomId;

    if (typeof exit === 'string') {
      // Обычный переход внутри текущей зоны
      const [currentAreaId, ] = this._parseGlobalId(this.player.currentRoom);
      targetRoomId = this._getGlobalId(exit, currentAreaId);
    } else if (typeof exit === 'object') {
      // Межзоновый переход
      const targetAreaId = exit.area;
      const targetLocalRoomId = exit.room;

      // Загружаем зону, если она еще не была загружена
      if (!this.loadedAreaIds.has(targetAreaId)) {
        this.emit('message', `Загрузка новой зоны: ${targetAreaId}...`);
        await this.loadArea(targetAreaId);
      }
      targetRoomId = this._getGlobalId(targetLocalRoomId, targetAreaId);
    }
    
    this.player.currentRoom = targetRoomId;
    const newRoom = this.getCurrentRoom();
    this.emit('update');
    
    return `Вы идете ${direction}.\n\n${newRoom.getFullDescription(this)}`;
  }

  /**
   * Команда: get - взять предмет
   */
  cmdGet(cmd) {
    if (!cmd.target) {
      return 'Что вы хотите взять?';
    }
    
    const currentRoom = this.getCurrentRoom();
    const target = cmd.target.toLowerCase();
    
    // Ищем предмет в локации
    const globalItemId = currentRoom.findItem(target, this);
    if (!globalItemId) {
      return `Вы не видите "${cmd.target}" здесь.`;
    }
    
    const item = this.items.get(globalItemId);
    if (!item.canTake) {
      return `Вы не можете взять ${item.name}.`;
    }
    
    if (!this.player.canCarry(item)) {
      return `${item.name} слишком тяжелый для вас.`;
    }
    
    // Перемещаем предмет из локации в инвентарь
    currentRoom.removeItem(globalItemId);
    this.player.addItem({ ...item, globalId: globalItemId });
    
    return `Вы взяли ${this.colorize(item.name, 'item-name')}.`;
  }

  /**
   * Команда: drop - бросить предмет
   */
  cmdDrop(cmd) {
    if (!cmd.target) {
      return 'Что вы хотите бросить?';
    }
    
    const item = this.player.findItem(cmd.target, this);
    if (!item) {
      return `У вас нет "${cmd.target}".`;
    }
    
    const currentRoom = this.getCurrentRoom();
    this.player.removeItem(item.globalId);
    currentRoom.addItem(item.globalId); // В комнату добавляем глобальный ID
    
    return `Вы бросили ${this.colorize(item.name, 'item-name')}.`;
  }

  /**
   * Команда: inventory - показать инвентарь
   */
  cmdInventory() {
    if (this.player.inventory.length === 0) {
      return 'Ваш инвентарь пуст.';
    }
    
    let result = 'Ваш инвентарь:\n';
    let totalWeight = 0;
    
    this.player.inventory.forEach(item => {
      result += `  ${this.colorize(item.name, 'item-name')}`;
      if (item.weight) {
        result += ` (вес: ${item.weight})`;
        totalWeight += item.weight;
      }
      result += '\n';
    });
    
    result += `\nОбщий вес: ${totalWeight}/${this.player.strength * 10}`;
    return result;
  }

  /**
   * Команда: kill - атака
   */
  cmdKill(cmd) {
    if (this.player.state === 'fighting') {
      return 'Вы уже в бою!';
    }

    if (!cmd.target) {
      return 'Кого вы хотите атаковать?';
    }

    const [currentAreaId, ] = this._parseGlobalId(this.player.currentRoom);
    const currentRoom = this.getCurrentRoom();
    const target = cmd.target.toLowerCase();

    // Ищем НПС в локации
    const npcId = currentRoom.findNpc(target, this, currentAreaId);
    if (!npcId) {
      return `Здесь нет "${cmd.target}" для атаки.`;
    }
    const npc = this.getNpc(npcId, currentAreaId);
    
    if (npc.type === 'friendly') {
      return `${this.colorize(npc.name, `npc-name npc-${npc.type}`)} дружелюбен к вам. Вы не можете атаковать.`;
    }
    
    // Начинаем бой
    this.player.state = 'fighting';
    this.combatTarget = this._getGlobalId(npcId, currentAreaId);
    this.emit('update'); // Обновляем UI для отображения состояния боя
    
    // Запускаем боевой цикл
    const initialAttackMessage = `Вы атакуете ${this.colorize(npc.name, `npc-name npc-${npc.type}`)}!`;
    const firstRoundResult = this.performCombatRound();
    this.emit('message', `${initialAttackMessage}\n${firstRoundResult}`);

    // Если бой не закончился, запускаем интервал
    if (this.player.state === 'fighting') {
      this.combatInterval = setInterval(() => {
        const roundResult = this.performCombatRound();
        this.emit('message', roundResult);
      }, 2500); // 2.5 секунды
    }

    return ''; // Все сообщения теперь обрабатываются через события
  }

  cmdKick(cmd) {
    if (!this.player.hasSkill('kick')) {
      return "Вы не знаете этого умения.";
    }

    if (this.player.state !== 'fighting') {
      if (!cmd.target) {
        return 'Кого вы хотите пнуть?';
      }
      // Начать бой с пинка
      this.player.nextAttackIsSkill = 'kick';
      // cmdKill обработает начало боя
      return this.cmdKill(cmd);
    }

    // В бою
    if (this.player.skillUsedThisRound) {
      return "Вы уже использовали умение в этом раунде.";
    }

    this.player.nextAttackIsSkill = 'kick';
    this.player.skillUsedThisRound = true; // Умение будет использовано в следующем тике атаки игрока
    const npc = this.npcs.get(this.combatTarget);
    return `Вы готовитесь пнуть ${this.colorize(npc.name, `npc-name npc-${npc.type}`)}.`;
  }

  /**
   * Выполняет раунд боя
   * @returns {string} результат боевого раунда
   */
  performCombatRound() {
    const npc = this.npcs.get(this.combatTarget);
    if (!npc || !npc.isAlive()) {
      this.stopCombat();
      return 'Цель уже повержена.';
    }

    // Сбрасываем флаг использования умения в начале каждого раунда
    this.player.skillUsedThisRound = false;

    let result = '';

    // --- Ход игрока ---
    const usedSkillId = this.player.nextAttackIsSkill;
    const playerDamage = this.calculatePlayerDamage(usedSkillId);
    this.player.nextAttackIsSkill = null; // Сбрасываем умение после расчета урона

    let attackMessage = 'Вы наносите';
    if (usedSkillId) {
      const skillData = this.skillsData.get(usedSkillId);
      if (skillData) {
        attackMessage = `Вы используете "${skillData.name}" и наносите`;
      } else {
        console.warn(`Player has skill "${usedSkillId}" but it's not found in skillsData.`);
        attackMessage = `Вы пытаетесь использовать неизвестное умение и наносите`;
      }
    }
    const npcAlive = npc.takeDamage(playerDamage);
    result += ' \n' + this.colorize(`${attackMessage} ${playerDamage} урона ${this.colorize(npc.name, `npc-name npc-${npc.type}`)}.`, 'combat-player-attack');
    
    if (npcAlive) {
      const npcHealthPercent = Math.round((npc.hitPoints / npc.maxHitPoints) * 100);
      result += '\n' + this.colorize(`У ${this.colorize(npc.name, `npc-name npc-${npc.type}`)} осталось ${npcHealthPercent}% здоровья.`, 'combat-player-hp');
    }

    if (!npcAlive) {
      // НПС умер от атаки игрока
      result += '\n' + this.colorize(`${this.colorize(npc.name, `npc-name npc-${npc.type}`)} повержен!`, 'combat-npc-death');
      
      if (npc.experience > 0) {
        const levelUpMessage = this.player.addExperience(npc.experience);
        result += '\n' + this.colorize(`Вы получили ${npc.experience} опыта.`, 'combat-exp-gain');
        if (levelUpMessage) {
          result += '\n' + this.colorize(levelUpMessage.message, 'combat-exp-gain');
          const newSkillMessage = this.checkAndAwardSkills();
          if (newSkillMessage) {
            result += '\n' + this.colorize(newSkillMessage, 'combat-exp-gain');
          }
        }
      }
      
      const drops = npc.getDeathDrops();
      if (drops.length > 0) {
        const [npcAreaId, ] = this._parseGlobalId(this.combatTarget);
        const currentRoom = this.getCurrentRoom();
        drops.forEach(localItemId => {
        const globalItemId = this._getGlobalId(localItemId, npcAreaId);
        currentRoom.addItem(globalItemId);
        });
        result += `\n${this.colorize(npc.name, `npc-name npc-${npc.type}`)} что-то оставил.`;
      }
      
      const deadNpcGlobalId = this.combatTarget;
      const deadNpcRoomId = this.player.currentRoom;
      this.getCurrentRoom().removeNpc(npc.id); // Удаляем по локальному ID
      this.npcLocationMap.delete(deadNpcGlobalId);
      this.scheduleNpcRespawn(deadNpcGlobalId, deadNpcRoomId);

      this.stopCombat();
      return result;
    }

    // --- Ход НПС ---
    // 1. Проверка на бегство
    if (npc.fleesAtPercent > 0 && (npc.hitPoints / npc.maxHitPoints) <= npc.fleesAtPercent) {
      const currentRoom = this.getCurrentRoom();
      const exits = currentRoom.getExits();
      if (exits.length > 0) {
        const randomExitDirection = exits[Math.floor(Math.random() * exits.length)];
        const exit = currentRoom.getExit(randomExitDirection);
        if (typeof exit === 'string') { // Пока что NPC может сбежать только в комнату той же зоны
          const targetRoomId = this._getGlobalId(exit, currentRoom.area);
          const targetRoom = this.rooms.get(targetRoomId);
          currentRoom.removeNpc(npc.id);
          targetRoom.addNpc(npc.id); // Добавляем локальный ID
          result += '\n' + this.colorize(`${npc.name} в страхе сбегает!`, 'combat-npc-death');
          this.stopCombat();
          return result;
        }
      }
    }

    // 2. Проверка на спецспособности
    if (npc.specialAbilities && npc.specialAbilities.length > 0) {
      for (const ability of npc.specialAbilities) {
        if (Math.random() < ability.chance) {
          if (ability.name === 'bark') {
            result += '\n' + this.colorize(ability.message, 'combat-npc-attack');
            this.stopCombat(true); // Игрок сбегает
            return result;
          }
        }
      }
    }

    // 3. Обычная атака НПС
    const npcDamage = npc.rollDamage();
    this.player.takeDamage(npcDamage);
    result += '\n' + this.colorize(`${this.colorize(npc.name, `npc-name npc-${npc.type}`)} наносит вам ${npcDamage} урона.`, 'combat-npc-attack');
    result += '\n' + this.colorize(`У вас осталось ${this.player.hitPoints}/${this.player.maxHitPoints} HP.`, 'combat-player-hp');
    
    if (this.player.hitPoints <= 0) {
      result += '\n' + this.colorize('Вы умерли!', 'combat-player-death');
      this.stopCombat();
    }
    return result;
  }

  /**
   * Завершает бой
   * @param {boolean} playerFled - игрок сбежал?
   */
  stopCombat(playerFled = false) {
    if (this.combatInterval) {
      clearInterval(this.combatInterval);
      this.combatInterval = null;
    }
    if (this.player.state !== 'dead') {
      this.player.state = 'idle';
    }
    this.player.nextAttackIsSkill = null;
    this.player.skillUsedThisRound = false;
    this.combatTarget = null;
    this.emit('update');
  }

  /**
   * Вычисляет урон игрока
   * @param {string|null} skillId - ID используемого умения.
   * @returns {number} урон
   */
  calculatePlayerDamage(skillId = null) {
    let baseDamage;
    
    // Урон от оружия или кулаков (1d4)
    if (this.player.equippedWeapon) {
      baseDamage = this.player.rollWeaponDamage();
    } else {
      baseDamage = Math.floor(Math.random() * 4) + 1;
    }
    
    // Бонус от силы
    const strBonus = Math.floor((this.player.strength - 10) / 2);

    let finalDamage = baseDamage + strBonus;

    // Применяем модификатор от умения
    if (skillId) {
      const skillData = this.skillsData.get(skillId);
      if (skillData && skillData.damageMultiplier) {
        finalDamage *= skillData.damageMultiplier;
      }
    }

    return Math.max(1, Math.floor(finalDamage));
  }

  /**
   * Команда: say - разговор с НПС
   */
  cmdSay(cmd) {
    if (!cmd.target) {
      return 'Что вы хотите сказать?';
    }
    
    const currentRoom = this.getCurrentRoom();
    let result = this.colorize(`Вы говорите: "${cmd.target}"`, 'player-speech') + '\n\n';
    
    // Все НПС в локации реагируют
    const responses = [];
    const [currentAreaId, ] = this._parseGlobalId(this.player.currentRoom);
    currentRoom.npcs.forEach(localNpcId => {
      const npc = this.getNpc(localNpcId, currentAreaId);
      if (npc?.isAlive()) {
        responses.push(npc.speak(this, currentAreaId));
      }
    });
    
    if (responses.length > 0) {
      result += responses.join('\n');
    } else {
      result += 'Никто не отвечает.';
    }
    
    return result;
  }

  /**
   * Команда: talk - поговорить с НПС
   */
  cmdTalk(cmd) {
    if (!cmd.target) {
      return 'С кем вы хотите поговорить?';
    }

    const [currentAreaId, ] = this._parseGlobalId(this.player.currentRoom);
    const currentRoom = this.getCurrentRoom();
    const target = cmd.target.toLowerCase();

    const npcId = currentRoom.findNpc(target, this, currentAreaId);
    if (!npcId) {
      return `Здесь нет никого по имени "${cmd.target}".`;
    }
    const npc = this.getNpc(npcId, currentAreaId);
    return npc.speak(this);
  }

  /**
   * Команда: use - использование предмета
   */
  cmdUse(cmd) {
    if (!cmd.target) {
      return 'Что вы хотите использовать?';
    }
    
    const item = this.player.findItem(cmd.target, this);
    if (!item) {
      return `У вас нет "${cmd.target}".`;
    }
    
    // Обработка зелий
    if (item.type === 'potion' && item.healAmount) {
      const healed = this.player.heal(item.healAmount, this);
      this.player.removeItem(item.id);
      return `Вы выпили ${this.colorize(item.name, 'item-name')}. Восстановлено ${healed} HP.`;
    }
    
    return `Вы не знаете, как использовать ${item.name}.`;
  }

  /**
   * Команда: stats - показать характеристики игрока
   */
  cmdStats() {
    const p = this.player;
    return `=== Характеристики ===
Имя: ${p.name}
Уровень: ${p.level}
Опыт: ${p.experience}/${p.experienceToNext}
Здоровье: ${p.hitPoints}/${p.maxHitPoints}

Сила: ${p.strength}
Ловкость: ${p.dexterity}
Телосложение: ${p.constitution}
Интеллект: ${p.intelligence}
Мудрость: ${p.wisdom}
Харизма: ${p.charisma}

Состояние: ${p.state === 'fighting' ? 'в бою' : p.state === 'dead' ? 'мертв' : 'готов'}`;
  }

  /**
   * Команда: help - справка
   */
  cmdHelp() {
    return this.commandParser.generateHelp();
  }

  /**
   * Команда: save - сохранение игры
   */
  cmdSave() {
    try {
      this.saveGame();
      return 'Игра сохранена.';
    } catch (error) {
      return 'Ошибка сохранения игры.';
    }
  }

  /**
   * Команда: load - загрузка игры
   */
  async cmdLoad() {
    try {
      const loaded = await this.loadGame();
      if (loaded) {
        const currentRoom = this.getCurrentRoom();
        return `Игра загружена.\n\n${currentRoom.getFullDescription(this)}`;
      } else {
        return 'Сохранение не найдено.';
      }
    } catch (error) {
      console.error('Ошибка в cmdLoad:', error);
      return 'Ошибка загрузки игры.';
    }
  }

  /**
   * Команда: heal - исцеление у жреца
   */
  cmdHeal() {
    const currentRoom = this.getCurrentRoom();
    const [currentAreaId, ] = this._parseGlobalId(this.player.currentRoom);
    const priestId = currentRoom.npcs.find(localNpcId => {
      const npc = this.getNpc(localNpcId, currentAreaId);
      return npc && npc.canHeal;
    });
    const priest = this.getNpc(priestId, currentAreaId);
    if (!priest) {
      return 'Здесь нет никого, кто мог бы вас исцелить.';
    }
    
    if (this.player.hitPoints >= this.player.maxHitPoints) {
      return 'Вы полностью здоровы.';
    }
    
    this.player.hitPoints = this.player.maxHitPoints;
    return `${this.colorize(priest.name, 'npc-name npc-friendly')} исцелил ваши раны. Вы полностью здоровы.`;
  }

  /**
   * Команда: flee - сбежать из боя
   */
  cmdFlee(cmd) {
    if (this.player.state !== 'fighting') {
      return 'Вы не в бою.';
    }
    const npc = this.npcs.get(this.combatTarget);
    this.stopCombat(true); // playerFled = true
    return `Вы успешно сбежали от ${this.colorize(npc.name, `npc-name npc-${npc.type}`)}.`;
  }

  /**
   * Команда: respawn - возрождение игрока
   */
  cmdRespawn(cmd) {
    if (this.player.state !== 'dead') {
      return 'Вы и так живы.';
    }

    // Восстанавливаем состояние игрока
    this.player.hitPoints = this.player.maxHitPoints;
    this.player.state = 'idle';

    // Перемещаем в стартовую локацию или в место смерти
    let respawnRoomId;
    if ((cmd.target === 'here' || cmd.target === 'здесь') && this.player.deathRoom) {
      respawnRoomId = this.player.deathRoom;
    } else {
      respawnRoomId = 'midgard:center';
    }
    this.player.currentRoom = respawnRoomId;

    this.emit('update'); // Обновляем UI

    const respawnRoom = this.rooms.get(respawnRoomId);

    return this.colorize('Вы чувствуете, как жизнь возвращается в ваше тело. Мир вновь обретает краски.', 'player-respawn') + `\n\n` +
           respawnRoom.getFullDescription(this);
  }

  /**
   * Проверяет и выдает игроку новые умения при повышении уровня.
   * @returns {string} Сообщение о новых умениях.
   */
  checkAndAwardSkills() {
    let message = '';
    for (const [skillId, skillData] of this.skillsData.entries()) {
      if (this.player.level >= skillData.level && !this.player.hasSkill(skillId)) {
        this.player.skills.add(skillId);
        message += `\nВы изучили новое умение: ${this.colorize(skillData.name, 'combat-exp-gain')}!`;
      }
    }
    this.emit('update');
    return message.trim();
  }

  /**
   * Команда: consider - оценка предмета или NPC
   */
  cmdConsider(cmd) {
    if (!cmd.target) {
      return 'Что вы хотите оценить? (consider <предмет/нпс>)';
    }

    const target = cmd.target.toLowerCase();
    const currentRoom = this.getCurrentRoom();

    // 1. Проверяем предмет в инвентаре
    let item = this.player.findItem(target, this);
    if (item) {
      return this._getConsiderItemString(item);
    }

    // 2. Проверяем предмет в комнате
    const globalItemId = currentRoom.findItem(target, this);
    if (globalItemId) {
      item = this.items.get(globalItemId);
      return this._getConsiderItemString(item);
    }

    // 2.5. Проверяем предмет у торговца
    item = this._findItemInTraderShop(target);
    if (item) {
      return this._getConsiderItemString(item);
    }

    // 3. Проверяем NPC в комнате
    const [currentAreaId, ] = this._parseGlobalId(this.player.currentRoom);
    const npcId = currentRoom.findNpc(target, this, currentAreaId);
    if (npcId) {
      const npc = this.getNpc(npcId, currentAreaId);
      return this._getConsiderNpcString(npc);
    }

    return `Вы не видите "${cmd.target}" здесь.`;
  }

  /**
   * Команда: gain - для отладки, увеличивает характеристику
   */
  cmdGain(cmd) {
    if (!cmd.target) {
      return 'Использование: gain <характеристика> <число>';
    }

    const args = cmd.target.split(/\s+/);
    if (args.length < 2) {
      return 'Использование: gain <характеристика> <число>';
    }

    const statName = args[0].toLowerCase();
    const amount = parseInt(args[1], 10);

    if (isNaN(amount)) {
      return 'Неверное число.';
    }

    const statMap = {
      'сила': 'strength', 'str': 'strength',
      'ловкость': 'dexterity', 'dex': 'dexterity',
      'телосложение': 'constitution', 'con': 'constitution',
      'интеллект': 'intelligence', 'int': 'intelligence',
      'мудрость': 'wisdom', 'wis': 'wisdom',
      'харизма': 'charisma', 'cha': 'charisma',
      'здоровье': 'hitPoints', 'hp': 'hitPoints', 'хп': 'hitPoints',
      'максхп': 'maxHitPoints', 'maxhp': 'maxHitPoints',
      'уровень': 'level', 'lvl': 'level', 'лвл': 'level',
      'опыт': 'experience', 'exp': 'experience',
    };

    const propName = statMap[statName];

    if (!propName) {
      return `Неизвестная характеристика: "${statName}".\nДоступные: ${Object.keys(statMap).join(', ')}.`;
    }

    const p = this.player;
    let message = '';

    switch (propName) {
      case 'experience': {
        const levelUpMessage = p.addExperience(amount);
        message = `Вы получили ${amount} опыта.`;
        if (levelUpMessage) {
          message += `\n${levelUpMessage.message}`;
          const newSkillMessage = this.checkAndAwardSkills();
          if (newSkillMessage) {
            message += `\n${newSkillMessage}`;
          }
        }
        break;
      }
      case 'level': {
        if (amount > 0) {
          for (let i = 0; i < amount; i++) {
            const levelUpMessage = p.levelUp();
            message += (message ? '\n' : '') + levelUpMessage.message;
          }
          const newSkillMessage = this.checkAndAwardSkills();
          if (newSkillMessage) {
            message += `\n${newSkillMessage}`;
          }
        } else {
          p.level = Math.max(1, p.level + amount);
        }
        if (!message) message = `Уровень изменен на ${amount}.`;
        break;
      }
      case 'hitPoints': {
        const oldHp = p.hitPoints;
        p.hitPoints = Math.max(0, Math.min(p.maxHitPoints, p.hitPoints + amount));
        const change = p.hitPoints - oldHp;
        message = `Здоровье изменено на ${change >= 0 ? '+' : ''}${change}. Текущее здоровье: ${p.hitPoints}/${p.maxHitPoints}.`;
        break;
      }
      case 'maxHitPoints':
        p.maxHitPoints += amount;
        p.hitPoints = Math.min(p.hitPoints, p.maxHitPoints); // Don't exceed new max
        message = `Максимальное здоровье изменено на ${amount}. Текущее здоровье: ${p.hitPoints}/${p.maxHitPoints}.`;
        break;
      default:
        // For strength, dexterity, etc.
        p[propName] += amount;
        message = `${this.colorize(Object.keys(statMap).find(key => statMap[key] === propName), 'item-name')} увеличена на ${amount}. Новое значение: ${p[propName]}.`;
        break;
    }

    this.emit('update');
    return message;
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
   * Команда: equip - экипировка предмета
   */
  cmdEquip(cmd) {
    if (!cmd.target) {
      return 'Что вы хотите экипировать?';
    }

    const item = this.player.findItem(cmd.target, this);
    if (!item) {
      return `У вас нет "${cmd.target}".`;
    }

    if (item.type === 'weapon') {
      return this.player.equipWeapon(item);
    } else if (item.type === 'armor') {
      return this.player.equipArmor(item);
    } else {
      return `${item.name} нельзя экипировать.`;
    }
  }

  /**
   * Команда: unequip - снятие экипировки
   */
  cmdUnequip(cmd) {
    if (!cmd.target) {
      return 'Что вы хотите снять? (weapon/armor)';
    }

    const target = cmd.target.toLowerCase();
    if (target.includes('weapon') || target.includes('оружие')) {
      return this.player.unequipWeapon();
    } else if (target.includes('armor') || target.includes('броня')) {
      return this.player.unequipArmor();
    } else {
      return 'Укажите "weapon" или "armor" для снятия экипировки.';
    }
  }

  /**
   * Команда: list - просмотр товаров торговца
   */
  cmdList() {
    const npc = this._getTraderInCurrentRoom();
    if (!npc) {
      return 'Здесь нет торговцев.';
    }

    const shopItems = npc.getShopItems();
    
    if (shopItems.length === 0) {
      return `${this.colorize(npc.name, 'npc-name npc-friendly')} говорит: "Извините, товар закончился."`;
    }

    let result = `${this.colorize(npc.name, `npc-name npc-${npc.type}`)} предлагает:\n`;
    shopItems.forEach((localItemId, index) => {
      const item = this.getItem(localItemId, npc.area);
      if (item) {
        result += `${index + 1}. ${this.colorize(item.name, 'item-name')} - ${item.value || 'N/A'} золота\n`;
      }
    });

    result += '\nИспользуйте "buy <название>" для покупки.';
    return result;
  }

  /**
   * Команда: buy - покупка товара
   */
  cmdBuy(cmd) {
    if (!cmd.target) {
      return 'Что вы хотите купить?';
    }

    const npc = this._getTraderInCurrentRoom();
    if (!npc) {
      return 'Здесь нет торговцев.';
    }

    const shopItems = npc.getShopItems();
    const target = cmd.target.toLowerCase();

    // Ищем товар в магазине
    const localItemId = shopItems.find(id => {
      const item = this.getItem(id, npc.area);
      return item && item.name.toLowerCase().includes(target);
    });

    if (!localItemId) {
      return `${this.colorize(npc.name, `npc-name npc-${npc.type}`)} говорит: "У меня нет такого товара."`;
    }

    const item = this.getItem(localItemId, npc.area);
    
    // Проверяем, может ли игрок нести предмет
    if (!this.player.canCarry(item, this)) {
      return `${this.colorize(npc.name, 'npc-name npc-friendly')} говорит: "Этот товар слишком тяжел для вас."`;
    }

    // В упрощенной версии покупка бесплатная
    this.player.addItem({ ...item, globalId: this._getGlobalId(item.id, item.area) });
    return `${this.colorize(npc.name, 'npc-name npc-friendly')} говорит: "Вот ваш ${this.colorize(item.name, 'item-name')}. Пользуйтесь на здоровье!"`;
  }

  /**
   * Команда: sell - продажа предмета торговцу
   */
  cmdSell(cmd) {
    if (!cmd.target) {
      return 'Что вы хотите продать?';
    }

    const [currentAreaId, ] = this._parseGlobalId(this.player.currentRoom);
    const currentRoom = this.getCurrentRoom();
    const merchantId = currentRoom.npcs.find(localNpcId => {
      const npc = this.getNpc(localNpcId, currentAreaId);
      return npc && npc.canTrade && npc.canTrade();
    });

    if (!merchantId) {
      return 'Здесь нет торговцев.';
    }

    const item = this.player.findItem(cmd.target, this);
    if (!item) {
      return `У вас нет "${cmd.target}".`;
    }

    const npc = this.getNpc(merchantId, currentAreaId);
    this.player.removeItem(item.globalId);
    
    const sellPrice = Math.floor((item.value || 10) / 2);
    return `${this.colorize(npc.name, 'npc-name npc-friendly')} говорит: "Спасибо за ${this.colorize(item.name, 'item-name')}! Вот вам ${sellPrice} золота." (В этой версии золото пока не реализовано)`;
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
    this.combatTarget = null;
    if (this.combatInterval) {
      clearInterval(this.combatInterval);
      this.combatInterval = null;
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
    await this.initializeWorld();
    this.player = new Player(playerName);
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
   * @param {string} targetRoomId - ID целевой комнаты
   * @returns {Object} результат перехода
   */
  async moveToRoom(targetRoomId) {
    if (this.player.state === 'fighting') {
      return { success: false, message: 'Вы не можете уйти во время боя!' };
    }

    if (this.player.state === 'dead') {
      return { success: false, message: 'Вы мертвы и не можете двигаться.' };
    }

    const currentRoom = this.getCurrentRoom();
    const availableRooms = this.getAvailableRooms();
    
    if (!availableRooms.includes(targetRoomId)) {
      return { success: false, message: 'Эта комната недоступна отсюда.' };
    }

    const [targetAreaId] = this._parseGlobalId(targetRoomId);
    if (!this.loadedAreaIds.has(targetAreaId)) {
      this.emit('message', `Загрузка новой зоны: ${targetAreaId}...`);
      await this.loadArea(targetAreaId);
    }

    // Находим направление для перехода
    let direction = 'куда-то';
    for (const [dir, exit] of currentRoom.exits.entries()) {
      let exitGlobalId;
      if (typeof exit === 'string') {
        exitGlobalId = this._getGlobalId(exit, currentRoom.area);
      } else {
        exitGlobalId = this._getGlobalId(exit.room, exit.area);
      }
      if (exitGlobalId === targetRoomId) {
        direction = dir;
        break;
      }
    }

    this.player.currentRoom = targetRoomId;
    const newRoom = this.getCurrentRoom();
    
    this.emit('update');

    return { 
      success: true, 
      message: `Вы идете ${direction}.\n\n${newRoom.getFullDescription(this, targetAreaId)}` 
    };
  }
}
