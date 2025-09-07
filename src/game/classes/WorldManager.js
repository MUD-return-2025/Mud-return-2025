import { Room } from './Room.js';
import { NPC } from './NPC.js';

/**
 * @class WorldManager
 * @description Управляет состоянием игрового мира: зонами, комнатами, предметами и NPC.
 */
export class WorldManager {
  /**
   * @param {import('../GameEngine.js').GameEngine} game - Экземпляр игрового движка.
   */
  constructor(game) {
    this.game = game; // Ссылка на основной движок
    this.reset();
  }

  /**
   * Сбрасывает состояние мира до начального.
   */
  reset() {
    this.rooms = new Map(); // Карта комнат, ключ - глобальный ID
    this.items = new Map(); // Карта предметов, ключ - глобальный ID
    this.npcs = new Map(); // Карта NPC, ключ - глобальный ID
    this.areas = new Map(); // Карта метаданных загруженных зон
    this.loadedAreaIds = new Set(); // Набор ID уже загруженных зон
    this.npcLocationMap = new Map(); // Карта <globalNpcId, globalRoomId>
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
          const globalNpcId = this.getGlobalId(localNpcId, areaId);
          this.npcLocationMap.set(globalNpcId, globalRoomId);
        }
      }
    }
  }

  /**
   * Синхронизирует массивы `npcs` во всех комнатах на основе `npcLocationMap`.
   * Необходимо вызывать после загрузки состояния, чтобы комнаты "знали", какие NPC в них находятся.
   */
  syncRoomsFromNpcMap() {
    // 1. Очищаем всех NPC из всех комнат
    for (const room of this.rooms.values()) {
      room.npcs = [];
    }
    // 2. Заполняем комнаты NPC на основе карты их местоположений
    for (const [globalNpcId, globalRoomId] of this.npcLocationMap.entries()) {
      const room = this.rooms.get(globalRoomId);
      const [, localNpcId] = this.parseGlobalId(globalNpcId);
      if (room) room.addNpc(localNpcId);
    }
  }

  /**
   * Получает предмет по ID
   * @param {string} localId - Локальный ID предмета
   * @param {string} areaId - ID зоны, в которой находится предмет
   * @returns {Object|null} данные предмета
   */
  getItem(localId, areaId) {
    return this.items.get(this.getGlobalId(localId, areaId)) || null;
  }

  /**
   * Получает НПС по ID
   * @param {string} localId - Локальный ID НПС
   * @param {string} areaId - ID зоны, в которой находится НПС
   * @returns {NPC|null} объект НПС
   */
  getNpc(localId, areaId) {
    return this.npcs.get(this.getGlobalId(localId, areaId)) || null;
  }

  /**
   * Собирает глобальный ID из локального ID и ID зоны.
   * @param {string} localId 
   * @param {string} areaId 
   * @returns {string} Глобальный ID (например, 'midgard:center')
   */
  getGlobalId(localId, areaId) {
    return `${areaId}:${localId}`;
  }

  /**
   * Разбирает глобальный ID на ID зоны и локальный ID.
   * @param {string} globalId 
   * @returns {[string, string]} [areaId, localId]
   */
  parseGlobalId(globalId) {
    const parts = globalId.split(':');
    return [parts[0], parts.slice(1).join(':')];
  }
}