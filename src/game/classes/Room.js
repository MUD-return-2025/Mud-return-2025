
/**
 * Представляет игровую локацию (комнату).
 * Управляет информацией о комнате, включая выходы, предметы и NPC.
 */
export class Room {
  /**
   * Создает экземпляр комнаты.
   * @param {object} roomData - Данные для создания комнаты, обычно из JSON-файла зоны.
   * @property {string} id - Локальный ID комнаты в пределах зоны.
   * @property {string} area - ID зоны, к которой принадлежит комната.
   * @property {string} name - Название комнаты.
   * @property {string} description - Описание комнаты.
   * @property {object} exits - Объект с выходами.
   * @property {string[]} items - Массив локальных ID предметов в комнате.
   * @property {string[]} npcs - Массив локальных ID NPC в комнате.
   */
  constructor(roomData) {
    this.id = roomData.id;
    this.area = roomData.area;
    this.name = roomData.name;
    this.description = roomData.description;
    this.exits = new Map(Object.entries(roomData.exits || {}));
    // Создаем изменяемые копии массивов, чтобы не мутировать исходные данные из JSON
    this.items = [...(roomData.items || [])];
    this.npcs = [...(roomData.npcs || [])];
  }

  /**
   * Возвращает список доступных направлений для выхода.
   * @returns {string[]} Массив названий выходов (направлений).
   */
  getExits() {
    return Array.from(this.exits.keys());
  }

  /**
   * Возвращает данные о выходе по указанному направлению.
   * @param {string} direction - Направление (например, "север").
   * @returns {string|object|null} ID комнаты (для перехода внутри зоны), объект перехода (для межзонового перехода) или null, если выход не найден.
   */
  getExit(direction) {
    return this.exits.get(direction.toLowerCase()) || null;
  }

  /**
   * Добавляет предмет в комнату.
   * @param {string} itemId - Локальный ID предмета.
   */
  addItem(itemId) {
    if (!this.items.includes(itemId)) {
      this.items.push(itemId);
    }
  }

  /**
   * Удаляет предмет из комнаты.
   * @param {string} itemId - Локальный ID предмета.
   * @returns {boolean} `true`, если предмет был успешно удален.
   */
  removeItem(itemId) {
    const index = this.items.indexOf(itemId);
    if (index !== -1) {
      this.items.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Проверяет, есть ли предмет в комнате.
   * @param {string} itemId - Локальный ID предмета.
   * @returns {boolean} `true`, если предмет найден.
   */
  hasItem(itemId) {
    return this.items.includes(itemId);
  }

  /**
   * Добавляет NPC в комнату.
   * @param {string} npcId - Локальный ID NPC.
   */
  addNpc(npcId) {
    if (!this.npcs.includes(npcId)) {
      this.npcs.push(npcId);
    }
  }

  /**
   * Удаляет NPC из комнаты (например, после смерти).
   * @param {string} npcId - Локальный ID NPC.
   * @returns {boolean} `true`, если NPC был успешно удален.
   */
  removeNpc(npcId) {
    const index = this.npcs.indexOf(npcId);
    if (index !== -1) {
      this.npcs.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Проверяет, есть ли NPC в комнате.
   * @param {string} npcId - Локальный ID NPC.
   * @returns {boolean} `true`, если NPC найден.
   */
  hasNpc(npcId) {
    return this.npcs.includes(npcId);
  }

  /**
   * Генерирует полное, отформатированное описание комнаты для команды 'look'.
   * @param {import('../GameEngine').GameEngine} game - Ссылка на игровой движок для получения данных о предметах/NPC.
   * @param {string} areaId - ID текущей зоны, в которой находится комната.
   * @returns {string} HTML-отформатированное описание комнаты.
   */
  getFullDescription(game, areaId) {
    // Вспомогательная функция для оборачивания текста в span с классом для стилизации
    const colorize = (text, className) => `<span class="${className}">${text}</span>`;

    let desc = `${colorize(this.name, 'room-name')}\n${this.description}\n`;
    
    // Добавляем информацию о выходах
    if (this.exits.size > 0) {
      const exitNames = this.getExits().map(exit => {
        const exitData = this.getExit(exit);
        if (typeof exitData === 'object') {
          // Если выход - это объект, значит это межзоновый переход
          const area = game.areas.get(exitData.area);
          return colorize(`${exit} (в ${area?.name || exitData.area})`, 'exit-name');
        }
        return colorize(exit, 'exit-name');
      });
      desc += `\nВыходы: ${exitNames.join(', ')}\n`;
    }
    
    // Добавляем информацию о предметах
    if (this.items.length > 0) {
      desc += '\nВы видите:\n';
      this.items.forEach(itemId => { const item = game.getItem(itemId, areaId); if (item) desc += `  ${colorize(item.name, 'item-name')}\n`; });
    }
    
    // Добавляем информацию о НПС
    if (this.npcs.length > 0) {
      desc += '\nЗдесь находятся:\n';
      this.npcs.forEach(npcId => { const npc = game.getNpc(npcId, areaId); if (npc) desc += `  ${colorize(npc.name, `npc-name npc-${npc.type}`)}${npc.hitPoints <= 0 ? colorize(' (мертв)', 'npc-dead') : ''}\n`; });
    }
    
    return desc;
  }

  /**
   * Находит локальный ID предмета в комнате по его имени или ID.
   * @param {string} targetName - Имя или ID для поиска (может быть частичным).
   * @param {import('../GameEngine').GameEngine} game - Экземпляр движка для получения данных о предмете.
   * @param {string} areaId - ID текущей зоны.
   * @returns {string|null} Локальный ID предмета или null, если не найден.
   */
  findItem(targetName, game, areaId) {
    return this.items.find(localId => {
      const item = game.getItem(localId, areaId);
      return item && (item.name.toLowerCase().includes(targetName) || item.id.toLowerCase().includes(targetName));
    });
  }

  /**
   * Находит локальный ID живого NPC в комнате по его имени или ID.
   * @param {string} targetName - Имя или ID для поиска (может быть частичным).
   * @param {import('../GameEngine').GameEngine} game - Экземпляр движка для получения данных о NPC.
   * @param {string} areaId - ID текущей зоны.
   * @returns {string|null} Локальный ID NPC или null, если не найден.
   */
  findNpc(targetName, game, areaId) {
    return this.npcs.find(localId => {
      const npc = game.getNpc(localId, areaId);
      return npc && npc.isAlive() && (npc.name.toLowerCase().includes(targetName) || npc.id.toLowerCase().includes(targetName));
    });
  }
}
