
/**
 * Представляет неигрового персонажа (NPC), который может быть дружелюбным,
 * нейтральным или враждебным. Управляет его состоянием, диалогами и действиями.
 */
export class NPC {
  /**
   * Создает экземпляр NPC.
   * @param {object} npcData - Данные для создания NPC, обычно из JSON-файла зоны.
   * @property {string} id - Локальный ID в пределах зоны.
   * @property {string} area - ID зоны, к которой принадлежит NPC.
   * @property {string} name - Имя NPC.
   * @property {string} description - Описание NPC.
   * @property {'friendly'|'neutral'|'hostile'} type - Тип поведения.
   * @property {number} hitPoints - Текущее здоровье.
   * @property {number} maxHitPoints - Максимальное здоровье.
   * @property {string} damage - Строка урона (например, "1d6+2").
   * @property {number} experience - Опыт за убийство.
   * @property {string[]} drops - Массив ID предметов, которые могут выпасть после смерти.
   * @property {string[]} dialogue - Массив реплик для диалога.
   * @property {boolean} canHeal - Может ли NPC лечить игрока.
   * @property {string[]} shop - Массив ID товаров для продажи.
   * @property {boolean} canWander - Может ли NPC перемещаться по карте.
   * @property {number} fleesAtPercent - Процент здоровья, при котором NPC пытается сбежать.
   * @property {object[]} specialAbilities - Массив специальных способностей.
   */
  constructor(npcData) {
    this.id = npcData.id;
    this.area = npcData.area;
    this.name = npcData.name;
    this.description = npcData.description;
    this.type = npcData.type; // Тип: friendly, neutral, hostile
    this.hitPoints = npcData.hitPoints;
    this.maxHitPoints = npcData.maxHitPoints;
    this.damage = npcData.damage; // Строка урона, например "1d6+2"
    this.experience = npcData.experience || 0; // Опыт за убийство
    this.drops = [...(npcData.drops || [])]; // Предметы, которые выпадают после смерти
    this.dialogue = [...(npcData.dialogue || [])]; // Реплики NPC
    this.canHeal = npcData.canHeal || false; // Может ли лечить игрока
    this.shop = [...(npcData.shop || [])]; // Товары для продажи
    this.canWander = npcData.canWander || false; // Может ли перемещаться по карте
    this.fleesAtPercent = npcData.fleesAtPercent || 0; // Процент здоровья для побега
    this.specialAbilities = [...(npcData.specialAbilities || [])];
    this.currentDialogue = 0; // Индекс текущей реплики в диалоге
  }

  /**
   * Возвращает следующую реплику NPC из его диалогового списка.
   * @param {import('../GameEngine').GameEngine} [game] - Экземпляр игрового движка для доступа к вспомогательным методам (например, для стилизации текста).
   * @returns {string} Отформатированная реплика.
   */
  speak(game) {
    if (this.dialogue.length === 0) {
      const name = game ? game.colorize(this.name, `npc-name npc-${this.type}`) : this.name;
      return `${name} молчит.`;
    }
    
    const message = this.dialogue[this.currentDialogue];
    // Переключаемся на следующую реплику, зацикливая диалог
    this.currentDialogue = (this.currentDialogue + 1) % this.dialogue.length;
    const name = game ? game.colorize(this.name, `npc-name npc-${this.type}`) : this.name;
    const coloredMessage = game ? game.colorize(`"${message}"`, 'npc-speech') : `"${message}"`;
    return `${name} говорит: ${coloredMessage}`;
  }

  /**
   * Уменьшает здоровье NPC на указанное количество урона.
   * @param {number} damage - Количество урона.
   * @returns {boolean} `true`, если NPC остался жив, иначе `false`.
   */
  takeDamage(damage) {
    this.hitPoints = Math.max(0, this.hitPoints - damage);
    return this.hitPoints > 0;
  }

  /**
   * Восстанавливает здоровье NPC.
   * @param {number} amount - Количество восстанавливаемого здоровья.
   */
  heal(amount) {
    this.hitPoints = Math.min(this.maxHitPoints, this.hitPoints + amount);
  }

  /**
   * Вычисляет урон, наносимый НПС
   * @returns {number} Количество урона.
   */
  rollDamage() {
    return this.parseDamageString(this.damage);
  }

  /**
   * Разбирает строку урона (например, "1d6+2") и возвращает случайное значение.
   * @param {string} damageString - Строка урона.
   * @returns {number} Итоговый урон.
   */
  parseDamageString(damageString) {
    // Регулярное выражение для разбора строки: (количество кубиков)d(размер кубика)+/-
    const match = damageString?.match(/(\d+)d(\d+)(?:([+-])(\d+))?/);
    if (!match) {
      return 1; // базовый урон если не удалось распарсить
    }
    
    const [, diceCount, diceSize, operator, modifier] = match;
    
    // Бросаем кубики
    let total = 0;
    for (let i = 0; i < parseInt(diceCount); i++) {
      total += Math.floor(Math.random() * parseInt(diceSize)) + 1;
    }
    
    // Применяем модификатор
    if (operator && modifier) {
      const mod = parseInt(modifier);
      total += operator === '+' ? mod : -mod;
    }
    
    return Math.max(1, total); // минимум 1 урона
  }

  /**
   * Проверяет, является ли NPC враждебным.
   * @returns {boolean} `true`, если NPC враждебен.
   */
  isHostile() {
    return this.type === 'hostile';
  }

  /**
   * Проверяет, может ли NPC торговать (есть ли у него товары).
   * @returns {boolean} `true`, если NPC может торговать.
   */
  canTrade() {
    return this.shop.length > 0;
  }

  /**
   * Возвращает список товаров для продажи.
   * @returns {string[]} Массив ID предметов.
   */
  getShopItems() {
    return [...this.shop];
  }

  /**
   * Проверяет, жив ли NPC.
   * @returns {boolean} `true`, если здоровье больше 0.
   */
  isAlive() {
    return this.hitPoints > 0;
  }

  /**
   * Возвращает предметы, которые выпадают после смерти NPC.
   * @returns {string[]} Массив ID предметов.
   */
  getDeathDrops() {
    // В простой реализации возвращаем все дропы
    // В более сложной можно добавить вероятности
    return [...this.drops];
  }

  /**
   * Сбрасывает состояние NPC к изначальному (используется при возрождении).
   */
  respawn() {
    this.hitPoints = this.maxHitPoints;
    this.currentDialogue = 0;
  }
}
