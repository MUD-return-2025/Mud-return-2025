
/**
 * Класс НПС (неигровых персонажей)
 * Включает дружелюбных НПС, нейтральных и враждебных монстров
 */
export class NPC {
  constructor(npcData) {
    this.id = npcData.id;
    this.name = npcData.name;
    this.description = npcData.description;
    this.type = npcData.type; // friendly, neutral, hostile
    this.hitPoints = npcData.hitPoints;
    this.maxHitPoints = npcData.maxHitPoints;
    this.damage = npcData.damage; // строка типа "1d6+2"
    this.experience = npcData.experience || 0; // опыт за убийство
    this.drops = [...(npcData.drops || [])]; // предметы, которые выпадают
    this.dialogue = [...(npcData.dialogue || [])]; // реплики НПС
    this.canHeal = npcData.canHeal || false; // может ли лечить игрока
    this.shop = [...(npcData.shop || [])]; // товары для продажи
    this.currentDialogue = 0; // индекс текущей реплики
  }

  /**
   * Получает следующую реплику НПС
   * @returns {string} реплика
   */
  speak() {
    if (this.dialogue.length === 0) {
      return `${this.name} молчит.`;
    }
    
    const message = this.dialogue[this.currentDialogue];
    this.currentDialogue = (this.currentDialogue + 1) % this.dialogue.length;
    return `${this.name} говорит: "${message}"`;
  }

  /**
   * Наносит урон НПС
   * @param {number} damage - количество урона
   * @returns {boolean} жив ли НПС после урона
   */
  takeDamage(damage) {
    this.hitPoints = Math.max(0, this.hitPoints - damage);
    return this.hitPoints > 0;
  }

  /**
   * Исцеляет НПС
   * @param {number} amount - количество HP
   */
  heal(amount) {
    this.hitPoints = Math.min(this.maxHitPoints, this.hitPoints + amount);
  }

  /**
   * Вычисляет урон, наносимый НПС
   * @returns {number} количество урона
   */
  rollDamage() {
    return this.parseDamageString(this.damage);
  }

  /**
   * Парсит строку урона типа "1d6+2" и возвращает случайное значение
   * @param {string} damageString - строка урона
   * @returns {number} итоговый урон
   */
  parseDamageString(damageString) {
    // Парсим строку типа "1d6+2"
    const match = damageString.match(/(\d+)d(\d+)(?:([+-])(\d+))?/);
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
   * Проверяет, враждебен ли НПС
   * @returns {boolean}
   */
  isHostile() {
    return this.type === 'hostile';
  }

  /**
   * Проверяет, может ли НПС торговать
   * @returns {boolean}
   */
  canTrade() {
    return this.shop.length > 0;
  }

  /**
   * Возвращает товары для продажи
   * @returns {Array<string>} массив ID предметов
   */
  getShopItems() {
    return [...this.shop];
  }

  /**
   * Проверяет, жив ли НПС
   * @returns {boolean}
   */
  isAlive() {
    return this.hitPoints > 0;
  }

  /**
   * Получает дропы при смерти НПС
   * @returns {Array<string>} массив ID предметов
   */
  getDeathDrops() {
    // В простой реализации возвращаем все дропы
    // В более сложной можно добавить вероятности
    return [...this.drops];
  }

  /**
   * Сброс НПС к изначальному состоянию (респавн)
   */
  respawn() {
    this.hitPoints = this.maxHitPoints;
    this.currentDialogue = 0;
  }
}
