
import { Player } from './classes/Player.js';
import { Room } from './classes/Room.js';
import { NPC } from './classes/NPC.js';
import { CommandParser } from './classes/CommandParser.js';
import { rooms } from './data/rooms.js';
import { items } from './data/items.js';
import { npcs } from './data/npcs.js';

/**
 * Основной игровой движок
 * Управляет состоянием игры, обработкой команд и игровой логикой
 */
export class GameEngine {
  // Helper to wrap text in a span with a class for colorization
  colorize = (text, className) => `<span class="${className}">${text}</span>`;

  constructor() {
    this.player = new Player();
    this.rooms = new Map();
    this.npcs = new Map();
    this.commandParser = new CommandParser();
    this.messageHistory = [];
    this.gameState = 'menu'; // menu, playing, paused
    this.combatTarget = null; // текущая цель в бою
    this.combatInterval = null; // интервал для автоматического боя
    this.respawnQueue = []; // очередь для возрождения НПС
    this.listeners = {}; // { eventName: [callback, ...] }
    
    this.initializeWorld();
    this.registerCommands();

    // Основной игровой цикл для обработки асинхронных событий, таких как возрождение
    // this.gameLoopInterval = setInterval(() => this.update(), 1000); // Управление циклом передано в GameTerminal.vue
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
   * Инициализация игрового мира
   * Создает объекты локаций и НПС из статических данных
   */
  initializeWorld() {
    // Создаем локации
    for (let [roomId, roomData] of Object.entries(rooms)) {
      this.rooms.set(roomId, new Room(roomData));
    }
    
    // Создаем НПС
    for (let [npcId, npcData] of Object.entries(npcs)) {
      this.npcs.set(npcId, new NPC(npcData));
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
  }

  /**
   * Обрабатывает команду игрока
   * @param {string} input - текстовый ввод
   * @returns {string} результат выполнения
   */
  processCommand(input) {
    if (this.player.state === 'dead') {
      return 'Вы мертвы. Используйте команду "respawn" для возрождения.';
    }

    const parsed = this.commandParser.parseCommand(input);

    // NEW: Check for commands during combat
    const allowedCombatCommands = ['flee', 'look', 'inventory', 'stats', 'use'];
    if (this.player.state === 'fighting' && !allowedCombatCommands.includes(parsed.command)) {
      return 'Вы не можете сделать это в бою! Попробуйте `flee` (сбежать).';
    }

    const result = this.commandParser.executeCommand(parsed, this);

    // После каждой команды оповещаем UI о возможном изменении состояния
    this.emit('update');
    
    // Добавляем команду и результат в историю
    this.messageHistory.push(`> ${input}`);
    if (result) { // Не добавляем пустые ответы (например, от асинхронных команд)
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
   */
  update() {
    const messages = this.checkRespawns();
    const wanderMessages = this.updateWanderingNpcs();
    return [...messages, ...wanderMessages];
  }

  /**
   * Проверяет очередь возрождения и возрождает НПС, если пришло время.
   */
  checkRespawns() {
    const messages = [];
    const now = Date.now();

    this.respawnQueue = this.respawnQueue.filter(entry => {
      if (now >= entry.respawnTime) {
        const npc = this.getNpc(entry.npcId);
        const room = this.rooms.get(entry.roomId);
        // Возрождаем, только если НПС еще не в комнате
        if (npc && room && !room.hasNpc(entry.npcId)) {
          npc.respawn();
          room.addNpc(entry.npcId);
          // NEW: Check if player is in the room and add a message
          if (this.player.currentRoom === entry.roomId) {
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
   */
  updateWanderingNpcs() {
    const messages = [];
    const WANDER_CHANCE = 0.05; // 5% шанс в секунду на перемещение

    for (const npc of this.npcs.values()) {
      // НПС не должен перемещаться, если он в бою
      if (npc.canWander && npc.isAlive() && this.combatTarget !== npc.id && Math.random() < WANDER_CHANCE) {
        // Находим комнату, в которой находится НПС
        let currentNpcRoom = null;
        let currentNpcRoomId = null;
        for (const [roomId, room] of this.rooms.entries()) {
          if (room.hasNpc(npc.id)) {
            currentNpcRoom = room;
            currentNpcRoomId = roomId;
            break;
          }
        }

        if (currentNpcRoom) {
          const exits = currentNpcRoom.getExits();
          if (exits.length > 0) {
            const randomExitDirection = exits[Math.floor(Math.random() * exits.length)];
            const targetRoomId = currentNpcRoom.getExit(randomExitDirection);
            const targetRoom = this.rooms.get(targetRoomId);

            if (targetRoom) {
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
   * @param {string} npcId - ID НПС для возрождения.
   * @param {string} roomId - ID комнаты, где НПС должен возродиться.
   */
  scheduleNpcRespawn(npcId, roomId) {
    const npc = this.getNpc(npcId);
    // Возрождаем только враждебных НПС (например, крыс)
    if (!npc || npc.type !== 'hostile') {
      return;
    }

    const RESPAWN_TIME = 30000; // 30 секунд
    this.respawnQueue.push({
      npcId,
      roomId,
      respawnTime: Date.now() + RESPAWN_TIME
    });
  }

  /**
   * Команда: look - осмотр локации или предмета
   */
  cmdLook(cmd) {
    const currentRoom = this.getCurrentRoom();
    
    if (!cmd.target) {
      // Осматриваем локацию
      return currentRoom.getFullDescription(this);
    }
    
    // Осматриваем конкретный предмет или НПС
    const target = cmd.target.toLowerCase();
    
    // Ищем среди предметов в комнате
    const roomItem = currentRoom.items.find(itemId => {
      const item = this.getItem(itemId);
      return item && (item.name.toLowerCase().includes(target) || item.id.toLowerCase().includes(target));
    });
    
    if (roomItem) {
      const item = this.getItem(roomItem);
      return item.description + (item.readText ? `\n\nНа ${this.colorize(item.name, 'item-name')} написано: "${item.readText}"` : '');
    }
    
    // Ищем среди предметов в инвентаре
    const inventoryItem = this.player.findItem(target);
    if (inventoryItem && inventoryItem.name.toLowerCase().includes(target)) {
      return inventoryItem.description;
    }
    
    // Ищем среди НПС
    const npcInRoom = currentRoom.npcs.find(npcId => {
      const npc = this.getNpc(npcId);
      return npc && (npc.name.toLowerCase().includes(target) || npc.id.toLowerCase().includes(target));
    });
    
    if (npcInRoom) {
      const npc = this.getNpc(npcInRoom);
      return npc.description + (npc.hitPoints <= 0 ? this.colorize(' (мертв)', 'npc-dead') : '');
    }
    
    return `Вы не видите "${cmd.target}" здесь.`;
  }

  /**
   * Команда: go - перемещение между локациями
   */
  cmdGo(cmd) {
    if (!cmd.target) {
      return 'Куда вы хотите пойти? Используйте: go <направление>';
    }
    
    const currentRoom = this.getCurrentRoom();
    const direction = cmd.target.toLowerCase();
    const exitRoomId = currentRoom.getExit(direction);
    
    if (!exitRoomId) {
      return `Вы не можете пойти ${direction} отсюда.`;
    }
    
    if (this.player.state === 'fighting') {
      return 'Вы не можете уйти во время боя!';
    }
    
    this.player.currentRoom = exitRoomId;
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
    const itemId = currentRoom.items.find(itemId => {
      const item = this.getItem(itemId);
      return item && item.name.toLowerCase().includes(target);
    });
    
    if (!itemId) {
      return `Вы не видите "${cmd.target}" здесь.`;
    }
    
    const item = this.getItem(itemId);
    
    if (!item.canTake) {
      return `Вы не можете взять ${item.name}.`;
    }
    
    if (!this.player.canCarry(item)) {
      return `${item.name} слишком тяжелый для вас.`;
    }
    
    // Перемещаем предмет из локации в инвентарь
    currentRoom.removeItem(itemId);
    this.player.addItem(item);
    
    return `Вы взяли ${this.colorize(item.name, 'item-name')}.`;
  }

  /**
   * Команда: drop - бросить предмет
   */
  cmdDrop(cmd) {
    if (!cmd.target) {
      return 'Что вы хотите бросить?';
    }
    
    const item = this.player.findItem(cmd.target);
    if (!item) {
      return `У вас нет "${cmd.target}".`;
    }
    
    const currentRoom = this.getCurrentRoom();
    this.player.removeItem(item.id);
    currentRoom.addItem(item.id);
    
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

    const currentRoom = this.getCurrentRoom();
    const target = cmd.target.toLowerCase();

    // Ищем НПС в локации
    const npcId = currentRoom.npcs.find(npcId => {
      const npc = this.getNpc(npcId);
      return npc && npc.name.toLowerCase().includes(target) && npc.isAlive();
    });
    
    if (!npcId) {
      return `Здесь нет "${cmd.target}" для атаки.`;
    }
    
    const npc = this.getNpc(npcId);
    
    if (npc.type === 'friendly') {
      return `${this.colorize(npc.name, `npc-name npc-${npc.type}`)} дружелюбен к вам. Вы не можете атаковать.`;
    }
    
    // Начинаем бой
    this.player.state = 'fighting';
    this.combatTarget = npcId;
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
    const npc = this.getNpc(this.combatTarget);
    if (!npc || !npc.isAlive()) {
      this.stopCombat();
      return 'Цель уже повержена.';
    }
    let result = '';

    // --- Ход игрока ---
    const playerDamage = this.calculatePlayerDamage();
    const npcAlive = npc.takeDamage(playerDamage);
    result += this.colorize(`Вы наносите ${playerDamage} урона ${this.colorize(npc.name, `npc-name npc-${npc.type}`)}.`, 'combat-player-attack');
    
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
        const currentRoom = this.getCurrentRoom();
        drops.forEach(itemId => currentRoom.addItem(itemId));
        result += `\n${this.colorize(npc.name, `npc-name npc-${npc.type}`)} что-то оставил.`;
      }
      
      const deadNpcId = this.combatTarget;
      const deadNpcRoomId = this.player.currentRoom;
      this.getCurrentRoom().removeNpc(deadNpcId);
      this.scheduleNpcRespawn(deadNpcId, deadNpcRoomId);

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
        const targetRoomId = currentRoom.getExit(randomExitDirection);
        const targetRoom = this.rooms.get(targetRoomId);
        if (targetRoom) {
          currentRoom.removeNpc(npc.id);
          targetRoom.addNpc(npc.id);
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
    currentRoom.npcs.forEach(npcId => {
      const npc = this.getNpc(npcId);
      if (npc?.isAlive()) {
        responses.push(npc.speak(this));
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

    const currentRoom = this.getCurrentRoom();
    const target = cmd.target.toLowerCase();

    const npcId = currentRoom.npcs.find(npcId => {
      const npc = this.getNpc(npcId);
      return npc && npc.name.toLowerCase().includes(target) && npc.isAlive();
    });

    if (!npcId) {
      return `Здесь нет никого по имени "${cmd.target}".`;
    }

    const npc = this.getNpc(npcId);
    return npc.speak(this);
  }

  /**
   * Команда: use - использование предмета
   */
  cmdUse(cmd) {
    if (!cmd.target) {
      return 'Что вы хотите использовать?';
    }
    
    const item = this.player.findItem(cmd.target);
    if (!item) {
      return `У вас нет "${cmd.target}".`;
    }
    
    // Обработка зелий
    if (item.type === 'potion' && item.healAmount) {
      const healed = this.player.heal(item.healAmount);
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
  cmdLoad() {
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
    const priest = currentRoom.npcs.find(npcId => {
      const npc = this.getNpc(npcId);
      return npc && npc.canHeal;
    });
    
    if (!priest) {
      return 'Здесь нет никого, кто мог бы вас исцелить.';
    }
    
    if (this.player.hitPoints >= this.player.maxHitPoints) {
      return 'Вы полностью здоровы.';
    }
    
    this.player.hitPoints = this.player.maxHitPoints;
    return `${this.colorize(this.getNpc(priest).name, 'npc-name npc-friendly')} исцелил ваши раны. Вы полностью здоровы.`;
  }

  /**
   * Команда: flee - сбежать из боя
   */
  cmdFlee(cmd) {
    if (this.player.state !== 'fighting') {
      return 'Вы не в бою.';
    }
    const npc = this.getNpc(this.combatTarget);
    this.stopCombat(true); // playerFled = true
    return `Вы успешно сбежали от ${this.colorize(npc.name, `npc-name npc-${npc.type}`)}.`;
  }


  /**
   * Команда: equip - экипировка предмета
   */
  cmdEquip(cmd) {
    if (!cmd.target) {
      return 'Что вы хотите экипировать?';
    }

    const item = this.player.findItem(cmd.target);
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
    const currentRoom = this.getCurrentRoom();
    const merchant = currentRoom.npcs.find(npcId => {
      const npc = this.getNpc(npcId);
      return npc && npc.canTrade && npc.canTrade();
    });

    if (!merchant) {
      return 'Здесь нет торговцев.';
    }

    const npc = this.getNpc(merchant);
    const shopItems = npc.getShopItems();
    
    if (shopItems.length === 0) {
      return `${this.colorize(npc.name, 'npc-name npc-friendly')} говорит: "Извините, товар закончился."`;
    }

    let result = `${this.colorize(npc.name, 'npc-name npc-friendly')} предлагает:\n`;
    shopItems.forEach((itemId, index) => {
      const item = this.getItem(itemId);
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

    const currentRoom = this.getCurrentRoom();
    const merchant = currentRoom.npcs.find(npcId => {
      const npc = this.getNpc(npcId);
      return npc && npc.canTrade && npc.canTrade();
    });

    if (!merchant) {
      return 'Здесь нет торговцев.';
    }

    const npc = this.getNpc(merchant);
    const shopItems = npc.getShopItems();
    const target = cmd.target.toLowerCase();

    // Ищем товар в магазине
    const itemId = shopItems.find(itemId => {
      const item = this.getItem(itemId);
      return item && item.name.toLowerCase().includes(target);
    });

    if (!itemId) {
      return `${this.colorize(npc.name, 'npc-name npc-friendly')} говорит: "У меня нет такого товара."`;
    }

    const item = this.getItem(itemId);
    
    // Проверяем, может ли игрок нести предмет
    if (!this.player.canCarry(item)) {
      return `${this.colorize(npc.name, 'npc-name npc-friendly')} говорит: "Этот товар слишком тяжел для вас."`;
    }

    // В упрощенной версии покупка бесплатная
    this.player.addItem(item);
    return `${this.colorize(npc.name, 'npc-name npc-friendly')} говорит: "Вот ваш ${this.colorize(item.name, 'item-name')}. Пользуйтесь на здоровье!"`;
  }

  /**
   * Команда: sell - продажа предмета торговцу
   */
  cmdSell(cmd) {
    if (!cmd.target) {
      return 'Что вы хотите продать?';
    }

    const currentRoom = this.getCurrentRoom();
    const merchant = currentRoom.npcs.find(npcId => {
      const npc = this.getNpc(npcId);
      return npc && npc.canTrade && npc.canTrade();
    });

    if (!merchant) {
      return 'Здесь нет торговцев.';
    }

    const item = this.player.findItem(cmd.target);
    if (!item) {
      return `У вас нет "${cmd.target}".`;
    }

    const npc = this.getNpc(merchant);
    this.player.removeItem(item.id);
    
    const sellPrice = Math.floor((item.value || 10) / 2);
    return `${this.colorize(npc.name, 'npc-name npc-friendly')} говорит: "Спасибо за ${this.colorize(item.name, 'item-name')}! Вот вам ${sellPrice} золота." (В этой версии золото пока не реализовано)`;
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
   * @param {string} itemId - ID предмета
   * @returns {Object|null} данные предмета
   */
  getItem(itemId) {
    return items[itemId] || null;
  }

  /**
   * Получает НПС по ID
   * @param {string} npcId - ID НПС
   * @returns {NPC|null} объект НПС
   */
  getNpc(npcId) {
    return this.npcs.get(npcId) || null;
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
      rooms: Object.fromEntries(this.rooms),
      npcs: Object.fromEntries(this.npcs),
      timestamp: Date.now()
    };
    
    localStorage.setItem('mudgame_save', JSON.stringify(gameData));
  }

  /**
   * Загрузка игры из localStorage
   * @returns {boolean} успешна ли загрузка
   */
  loadGame() {
    const saveData = localStorage.getItem('mudgame_save');
    if (!saveData) {
      return false;
    }
    
    try {
      const gameData = JSON.parse(saveData);
      
      // Загружаем данные игрока
      this.player.load(gameData.player);
      
      // Восстанавливаем состояние локаций и НПС (если есть изменения)
      // В простой реализации можем пропустить, но для полноты добавим базовую поддержку
      
      return true;
    } catch (error) {
      console.error('Ошибка загрузки:', error);
      return false;
    }
  }

  /**
   * Начинает новую игру
   */
  startNewGame(playerName = 'Игрок') {
    this.player = new Player(playerName);
    this.gameState = 'playing';
    
    // Начинаем в центре города
    this.player.currentRoom = 'center';
    
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
    return Array.from(currentRoom.exits.values());
  }

  /**
   * Переходит в указанную комнату, если это возможно
   * @param {string} targetRoomId - ID целевой комнаты
   * @returns {Object} результат перехода
   */
  moveToRoom(targetRoomId) {
    if (this.player.state === 'fighting') {
      return { success: false, message: 'Вы не можете уйти во время боя!' };
    }

    const currentRoom = this.getCurrentRoom();
    const availableRooms = this.getAvailableRooms();
    
    if (!availableRooms.includes(targetRoomId)) {
      return { success: false, message: 'Эта комната недоступна отсюда.' };
    }

    // Находим направление для перехода
    const direction = Array.from(currentRoom.exits.entries())
      .find(([dir, roomId]) => roomId === targetRoomId)?.[0];

    this.player.currentRoom = targetRoomId;
    const newRoom = this.getCurrentRoom();
    
    this.emit('update');

    return { 
      success: true, 
      message: `Вы идете ${direction}.\n\n${newRoom.getFullDescription(this)}` 
    };
  }
}
