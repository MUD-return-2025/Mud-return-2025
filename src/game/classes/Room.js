
/**
 * Класс локации (комнаты)
 * Управляет предметами, НПС и переходами между локациями
 */
export class Room {
  constructor(roomData) {
    this.id = roomData.id;
    this.name = roomData.name;
    this.description = roomData.description;
    this.exits = new Map(Object.entries(roomData.exits || {}));
    this.items = [...(roomData.items || [])]; // копия массива предметов
    this.npcs = [...(roomData.npcs || [])]; // копия массива НПС
  }

  /**
   * Получает список доступных выходов
   * @returns {Array<string>} массив направлений
   */
  getExits() {
    return Array.from(this.exits.keys());
  }

  /**
   * Получает ID локации по направлению
   * @param {string} direction - направление
   * @returns {string|null} ID локации или null
   */
  getExit(direction) {
    return this.exits.get(direction.toLowerCase()) || null;
  }

  /**
   * Добавляет предмет в локацию
   * @param {string} itemId - ID предмета
   */
  addItem(itemId) {
    if (!this.items.includes(itemId)) {
      this.items.push(itemId);
    }
  }

  /**
   * Удаляет предмет из локации
   * @param {string} itemId - ID предмета
   * @returns {boolean} успешно ли удален предмет
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
   * Проверяет наличие предмета в локации
   * @param {string} itemId - ID предмета
   * @returns {boolean}
   */
  hasItem(itemId) {
    return this.items.includes(itemId);
  }

  /**
   * Добавляет НПС в локацию
   * @param {string} npcId - ID НПС
   */
  addNpc(npcId) {
    if (!this.npcs.includes(npcId)) {
      this.npcs.push(npcId);
    }
  }

  /**
   * Удаляет НПС из локации (например, после смерти)
   * @param {string} npcId - ID НПС
   * @returns {boolean} успешно ли удален НПС
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
   * Проверяет наличие НПС в локации
   * @param {string} npcId - ID НПС
   * @returns {boolean}
   */
  hasNpc(npcId) {
    return this.npcs.includes(npcId);
  }

  /**
   * Генерирует полное описание локации для команды look
   * @param {Object} game - ссылка на игровой движок для получения данных предметов/НПС
   * @returns {string} описание локации
   */
  getFullDescription(game) {
    let desc = `${this.name}\n${this.description}\n`;
    
    // Добавляем информацию о выходах
    if (this.exits.size > 0) {
      desc += `\nВыходы: ${this.getExits().join(', ')}\n`;
    }
    
    // Добавляем информацию о предметах
    if (this.items.length > 0) {
      desc += '\nВы видите:\n';
      this.items.forEach(itemId => {
        const item = game.getItem(itemId);
        if (item) {
          desc += `  ${item.name}\n`;
        }
      });
    }
    
    // Добавляем информацию о НПС
    if (this.npcs.length > 0) {
      desc += '\nЗдесь находятся:\n';
      this.npcs.forEach(npcId => {
        const npc = game.getNpc(npcId);
        if (npc) {
          desc += `  ${npc.name}`;
          if (npc.hitPoints <= 0) {
            desc += ' (мертв)';
          }
          desc += '\n';
        }
      });
    }
    
    return desc;
  }
}
