
import { Player } from './classes/Player.js';
import { Room } from './classes/Room.js';
import { NPC } from './classes/NPC.js';
import { CommandParser } from './classes/CommandParser.js';

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
    this.loadedAreaIds = new Set(); // Набор ID уже загруженных зон

    this.messageHistory = []; // История сообщений для вывода в терминал
    this.gameState = 'menu'; // Состояние игры: menu, playing, paused
    this.combatTarget = null; // Текущая цель в бою (глобальный ID)
    this.combatInterval = null; // Интервал для автоматического боя
    this.respawnQueue = []; // Очередь для возрождения НПС
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

      this.loadedAreaIds.add(areaId);
      console.log(`Зона ${areaId} успешно загружена.`);
      return true;
    } catch (error) {
      console.error(`Ошибка при загрузке зоны ${areaId}:`, error);
      return false;
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
    const allowedCombatCommands = ['flee', 'look', 'inventory', 'stats', 'use'];
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
        const room = this.rooms.get(entry.roomId);
        // Возрождаем, только если НПС еще не в комнате
        if (npc && room && !room.hasNpc(npcId)) {
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

    for (const [globalNpcId, npc] of this.npcs.entries()) {
      // НПС не должен перемещаться, если он в бою
      if (npc.canWander && npc.isAlive() && this.combatTarget !== globalNpcId && Math.random() < WANDER_CHANCE) {
        // Находим комнату, в которой находится НПС
        let currentNpcRoom = null;
        let currentNpcRoomId = null;
        for (const [roomId, room] of this.rooms.entries()) {
          if (room.hasNpc(npc.id)) { // room.npcs хранит локальные ID
            currentNpcRoom = room;
            currentNpcRoomId = roomId;
            break;
          }
        }

        if (currentNpcRoom) {
          const exits = currentNpcRoom.getExits();
          if (exits.length > 0) {
            // Перемещение между зонами сложно, поэтому пока NPC блуждают только внутри своей зоны.
            const randomExitDirection = exits[Math.floor(Math.random() * exits.length)];
            const exit = currentNpcRoom.getExit(randomExitDirection);

            if (typeof exit === 'string') { // Перемещаемся только внутри текущей зоны
              const targetRoomId = this._getGlobalId(exit, currentNpcRoom.area);
              const targetRoom = this.rooms.get(targetRoomId);
              currentNpcRoom.removeNpc(npc.id);
              targetRoom.addNpc(npc.id);

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
   * Команда: look - осмотр локации или предмета
   */
  cmdLook(cmd) {
    if (this.player.state === 'dead') {
      return this.colorize(
        'Вы бестелесный дух, парящий над своим телом.\nМир вокруг кажется серым и размытым. Вы можете только \'respawn\' (возродиться).',
        'player-dead-look'
      );
    }
    const [currentAreaId, ] = this._parseGlobalId(this.player.currentRoom);
    const currentRoom = this.getCurrentRoom();
    
    if (!cmd.target) {
      // Осматриваем локацию
      return currentRoom.getFullDescription(this, currentAreaId);
    }
    
    // Осматриваем конкретный предмет или НПС
    const target = cmd.target.toLowerCase();
    
    // Ищем среди предметов в комнате
    const roomItemId = currentRoom.findItem(target, this, currentAreaId);
    if (roomItemId) {
      const item = this.getItem(roomItemId, currentAreaId);
      return item.description + (item.readText ? `\n\nНа ${this.colorize(item.name, 'item-name')} написано: "${item.readText}"` : '');
    }
    
    // Ищем среди предметов в инвентаре
    const inventoryItem = this.player.findItem(target, this);
    if (inventoryItem) {
      return inventoryItem.description;
    }
    
    // Ищем среди НПС
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
    const [newAreaId, ] = this._parseGlobalId(targetRoomId);
    this.emit('update');
    
    return `Вы идете ${direction}.\n\n${newRoom.getFullDescription(this, newAreaId)}`;
  }

  /**
   * Команда: get - взять предмет
   */
  cmdGet(cmd) {
    if (!cmd.target) {
      return 'Что вы хотите взять?';
    }
    
    const [currentAreaId, ] = this._parseGlobalId(this.player.currentRoom);
    const currentRoom = this.getCurrentRoom();
    const target = cmd.target.toLowerCase();
    
    // Ищем предмет в локации
    const itemId = currentRoom.findItem(target, this, currentAreaId);
    if (!itemId) {
      return `Вы не видите "${cmd.target}" здесь.`;
    }
    
    const item = this.getItem(itemId, currentAreaId);
    if (!item.canTake) {
      return `Вы не можете взять ${item.name}.`;
    }
    
    if (!this.player.canCarry(item)) {
      return `${item.name} слишком тяжелый для вас.`;
    }
    
    // Перемещаем предмет из локации в инвентарь
    currentRoom.removeItem(itemId);
    this.player.addItem({ ...item, globalId: this._getGlobalId(item.id, item.area) });
    
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
    currentRoom.addItem(item.id); // В комнату добавляем локальный ID
    
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
    let result = '';

    // --- Ход игрока ---
    const playerDamage = this.calculatePlayerDamage();
    const npcAlive = npc.takeDamage(playerDamage);
    result += ' \n' + this.colorize(`Вы наносите ${playerDamage} урона ${this.colorize(npc.name, `npc-name npc-${npc.type}`)}.`, 'combat-player-attack');
    
    if (!npcAlive) {
      // НПС умер от атаки игрока
      result += '\n' + this.colorize(`${this.colorize(npc.name, `npc-name npc-${npc.type}`)} повержен!`, 'combat-npc-death');
      
      if (npc.experience > 0) {
        const levelUpMessage = this.player.addExperience(npc.experience);
        result += '\n' + this.colorize(`Вы получили ${npc.experience} опыта.`, 'combat-exp-gain');
        if (levelUpMessage) {
          result += '\n' + this.colorize(levelUpMessage.message, 'combat-exp-gain');
        }
      }
      
      const drops = npc.getDeathDrops();
      if (drops.length > 0) {
        const [npcAreaId, ] = this._parseGlobalId(this.combatTarget);
        const currentRoom = this.getCurrentRoom();
        drops.forEach(localItemId => {
          currentRoom.addItem(localItemId); // Добавляем локальный ID в комнату
        });
        result += `\n${this.colorize(npc.name, `npc-name npc-${npc.type}`)} что-то оставил.`;
      }
      
      const deadNpcGlobalId = this.combatTarget;
      const deadNpcRoomId = this.player.currentRoom;
      this.getCurrentRoom().removeNpc(npc.id); // Удаляем по локальному ID
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
    this.combatTarget = null;
    this.emit('update');
  }

  /**
   * Вычисляет урон игрока
   * @returns {number} урон
   */
  calculatePlayerDamage() {
    let baseDamage = Math.floor(Math.random() * 6) + 1; // 1d6
    
    // Бонус от силы
    const strBonus = Math.floor((this.player.strength - 10) / 2);
    baseDamage += strBonus;
    
    // Бонус от экипированного оружия
    const weaponBonus = this.player.getWeaponDamageBonus();
    baseDamage += weaponBonus;
    
    return Math.max(1, baseDamage);
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
      const loaded = this.loadGame();
      if (loaded) {
        const currentRoom = this.getCurrentRoom();
        return `Игра загружена.\n\n${currentRoom.getFullDescription(this)}`;
      } else {
        return 'Сохранение не найдено.';
      }
    } catch (error) {
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
  cmdRespawn() {
    if (this.player.state !== 'dead') {
      return 'Вы и так живы.';
    }

    // Восстанавливаем состояние игрока
    this.player.hitPoints = this.player.maxHitPoints;
    this.player.state = 'idle';

    // Перемещаем в стартовую локацию (хардкод для простоты)
    const respawnRoomId = 'midgard:center';
    this.player.currentRoom = respawnRoomId;

    this.emit('update'); // Обновляем UI

    const respawnRoom = this.rooms.get(respawnRoomId);
    const [areaId, ] = this._parseGlobalId(respawnRoomId);

    return this.colorize('Вы чувствуете, как жизнь возвращается в ваше тело. Мир вновь обретает краски.', 'player-respawn') + `\n\n` +
           respawnRoom.getFullDescription(this, areaId);
  }

  /**
   * Команда: consider - оценка предмета или NPC
   */
  cmdConsider(cmd) {
    if (!cmd.target) {
      return 'Что вы хотите оценить? (consider <предмет/нпс>)';
    }

    const target = cmd.target.toLowerCase();
    const [currentAreaId, ] = this._parseGlobalId(this.player.currentRoom);
    const currentRoom = this.getCurrentRoom();

    // 1. Проверяем предмет в инвентаре
    let item = this.player.findItem(target, this);
    if (item) {
      return this._getConsiderItemString(item);
    }

    // 2. Проверяем предмет в комнате
    const roomItemId = currentRoom.findItem(target, this, currentAreaId);
    if (roomItemId) {
      item = this.getItem(roomItemId, currentAreaId);
      return this._getConsiderItemString(item);
    }

    // 3. Проверяем NPC в комнате
    const npcId = currentRoom.findNpc(target, this, currentAreaId);
    if (npcId) {
      const npc = this.getNpc(npcId, currentAreaId);
      return this._getConsiderNpcString(npc);
    }

    return `Вы не видите "${cmd.target}" здесь.`;
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
      const newItemDamage = this._parseDamageString(newItem.damage).avg;
      const equippedItemDamage = this._parseDamageString(equippedItem.damage).avg;
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
    const [currentAreaId, ] = this._parseGlobalId(this.player.currentRoom);
    const currentRoom = this.getCurrentRoom();
    const merchantId = currentRoom.npcs.find(localNpcId => {
      const npc = this.getNpc(localNpcId, currentAreaId);
      return npc && npc.canTrade && npc.canTrade();
    });

    if (!merchantId) {
      return 'Здесь нет торговцев.';
    }

    const npc = this.getNpc(merchantId, currentAreaId);
    const shopItems = npc.getShopItems();
    
    if (shopItems.length === 0) {
      return `${this.colorize(npc.name, 'npc-name npc-friendly')} говорит: "Извините, товар закончился."`;
    }

    let result = `${this.colorize(npc.name, `npc-name npc-${npc.type}`)} предлагает:\n`;
    shopItems.forEach((localItemId, index) => {
      const item = this.getItem(localItemId, currentAreaId);
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

    const [currentAreaId, ] = this._parseGlobalId(this.player.currentRoom);
    const currentRoom = this.getCurrentRoom();
    const merchantId = currentRoom.npcs.find(localNpcId => {
      const npc = this.getNpc(localNpcId, currentAreaId);
      return npc && npc.canTrade && npc.canTrade();
    });

    if (!merchantId) {
      return 'Здесь нет торговцев.';
    }

    const npc = this.getNpc(merchantId, currentAreaId);
    const shopItems = npc.getShopItems();
    const target = cmd.target.toLowerCase();

    // Ищем товар в магазине
    const localItemId = shopItems.find(id => {
      const item = this.getItem(id, currentAreaId);
      return item && item.name.toLowerCase().includes(target);
    });

    if (!localItemId) {
      return `${this.colorize(npc.name, `npc-name npc-${npc.type}`)} говорит: "У меня нет такого товара."`;
    }

    const item = this.getItem(localItemId, currentAreaId);
    
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
    const npcAvgDamage = this._parseDamageString(npc.damage).avg;

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
      avgDamage = this._parseDamageString(this.player.equippedWeapon.damage).avg + strBonus;
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
   * Разбирает строку урона (например, "1d6+2") и возвращает среднее и максимальное значение.
   * @param {string} damageString - Строка урона.
   * @returns {{avg: number, max: number}}
   * @private
   */
  _parseDamageString(damageString) {
    if (!damageString) return { avg: 0, max: 0 };
    // Регулярное выражение для разбора строки: (количество кубиков)d(размер кубика)+/-(модификатор)
    const match = damageString.match(/(\d+)d(\d+)(?:([+-])(\d+))?/);
    if (!match) {
      return { avg: 1, max: 1 };
    }
    
    const [, diceCountStr, diceSizeStr, operator, modifierStr] = match;
    const diceCount = parseInt(diceCountStr);
    const diceSize = parseInt(diceSizeStr);
    const modifier = (operator && modifierStr) ? (operator === '+' ? parseInt(modifierStr) : -parseInt(modifierStr)) : 0;
    
    const avg = diceCount * (diceSize / 2 + 0.5) + modifier;
    const max = diceCount * diceSize + modifier;

    return { avg, max };
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
        ui_version: this.player.ui_version || 0
      },
      loadedAreaIds: Array.from(this.loadedAreaIds),
      // Состояние комнат и NPC (предметы на полу, здоровье NPC) пока не сохраняем для простоты.
      timestamp: Date.now()
    };
    
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
      
      // Загружаем все зоны, которые были активны в сохраненной игре
      for (const areaId of gameData.loadedAreaIds) {
        await this.loadArea(areaId);
      }

      // Загружаем данные игрока
      this.player.load(gameData.player);
      
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
    await this.initializeWorld();
    this.player = new Player(playerName);
    this.gameState = 'playing';
    
    // Начинаем в центре города
    this.player.currentRoom = 'midgard:center';
    const [startAreaId, ] = this._parseGlobalId(this.player.currentRoom);
    const welcomeMessage = `Добро пожаловать в Мидгард, ${playerName}!

${this.getCurrentRoom().getFullDescription(this, startAreaId)}

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
