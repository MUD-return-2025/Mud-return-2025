
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
    /** @type {{x: number, y: number}} Координаты комнаты на карте. */
    this.map = roomData.map; // Координаты комнаты на карте {x, y}
    /** @type {Map<string, string|object>} Карта выходов, где ключ - направление, а значение - ID комнаты или объект перехода. */
    this.exits = new Map(Object.entries(roomData.exits || {}));
    // Преобразуем локальные ID предметов в глобальные при создании комнаты
    /** @type {string[]} Массив глобальных ID предметов в комнате. */
    this.items = (roomData.items || []).map(localId => `${roomData.area}:${localId}`);
    /** @type {string[]} Массив локальных ID NPC в комнате. */
    this.npcs = [...(roomData.npcs || [])]; // NPC остаются с локальными ID, т.к. они не перемещаются между зонами (пока)
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
   * @param {string} globalItemId - Глобальный ID предмета.
   */
  addItem(globalItemId) {
    if (!this.items.includes(globalItemId)) {
      this.items.push(globalItemId);
    }
  }

  /**
   * Удаляет предмет из комнаты.
   * @param {string} globalItemId - Глобальный ID предмета.
   * @returns {boolean} `true`, если предмет был успешно удален.
   */
  removeItem(globalItemId) {
    const index = this.items.indexOf(globalItemId);
    if (index !== -1) {
      this.items.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Проверяет, есть ли предмет в комнате.
   * @param {string} globalItemId - Глобальный ID предмета.
   * @returns {boolean} `true`, если предмет найден.
   */
  hasItem(globalItemId) {
    return this.items.includes(globalItemId);
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
   * @param {import('../GameEngine.js').GameEngine} game - Ссылка на игровой движок для получения данных о предметах/NPC.
   * @returns {string} HTML-отформатированное описание комнаты.
   */
  getFullDescription(game) {
    // Вспомогательная функция для оборачивания текста в span с классом для стилизации
    const colorize = (text, className) => `<span class="${className}">${text}</span>`;

    /**
     * Разбивает текст на строки по 80 символов, не разрывая слова.
     * @param {string} text - Исходный текст.
     * @param {number} [width=80] - Максимальная ширина строки.
     * @returns {string} - Отформатированный текст.
     */
    const wordWrap = (text, width = 80) => {
      if (!text) return '';
      const words = text.split(' ');
      let currentLine = '';
      const lines = [];
      for (const word of words) {
        if ((currentLine + ' ' + word).length > width && currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine += (currentLine ? ' ' : '') + word;
        }
      }
      lines.push(currentLine);
      return lines.join('\n');
    };

    let desc = `${colorize(this.name, 'room-name')}\n${wordWrap(this.description)}\n`;
    
    // Добавляем информацию о выходах
    if (this.exits.size > 0) {
      const exitNames = this.getExits().map(exit => {
        const exitData = this.getExit(exit);
        if (typeof exitData === 'object') {
          // Если выход - это объект, значит это межзоновый переход
          const area = game.world.areas.get(exitData.area);
          return colorize(`${exit} (в ${area?.name || exitData.area})`, 'exit-name');
        }
        return colorize(exit, 'exit-name');
      });
      desc += `\n${colorize('Выходы:', 'info-label')} ${exitNames.join(', ')}\n`;
    }
    
    // Добавляем информацию о предметах
    if (this.items.length > 0) {
      desc += `\n${colorize('Вы видите:', 'info-label')}\n`;
      this.items.forEach(globalId => { 
        const item = game.world.items.get(globalId); 
        if (item) desc += `  ${colorize(item.name, 'item-name')}\n`; 
      });
    }
    
    // Добавляем информацию о НПС
    if (this.npcs.length > 0) {
      desc += `\n${colorize('Здесь находятся:', 'info-label')}\n`;
      this.npcs.forEach(npcId => { const npc = game.getNpc(npcId, this.area); if (npc) desc += `  ${colorize(npc.name, `npc-name npc-${npc.type}`)}${npc.hitPoints <= 0 ? colorize(' (мертв)', 'npc-dead') : ''}\n`; });
    }
    
    return desc;
  }

  /**
   * Находит глобальный ID предмета в комнате по его имени или ID.
   * @param {string} targetName - Имя или ID для поиска (может быть частичным).
   * @param {import('../GameEngine.js').GameEngine} game - Экземпляр движка для получения данных о предмете.
   * @returns {string|null} Глобальный ID предмета или null, если не найден.
   */
  findItem(targetName, game) {
    return this.items.find(globalId => {
      const item = game.world.items.get(globalId);
      return item && (item.name.toLowerCase().includes(targetName) || item.id.toLowerCase().includes(targetName));
    });
  }

  /**
   * Находит локальный ID живого NPC в комнате по его имени или ID.
   * @param {string} targetName - Имя или ID для поиска (может быть частичным).
   * @param {import('../GameEngine.js').GameEngine} game - Экземпляр движка для получения данных о NPC.
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
