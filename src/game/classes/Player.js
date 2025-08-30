
/**
 * Класс игрока
 * Содержит все характеристики, инвентарь и методы игрока
 */
export class Player {
  constructor(name = 'Игрок') {
    this.name = name;
    this.level = 1;
    this.experience = 0;
    this.experienceToNext = 100;
    this.hitPoints = 20;
    this.maxHitPoints = 20;
    
    // Базовые характеристики
    this.strength = 10;
    this.dexterity = 10;
    this.constitution = 10;
    this.intelligence = 10;
    this.wisdom = 10;
    this.charisma = 10;
    
    this.inventory = [];
    this.currentRoom = 'center';
    this.state = 'idle'; // idle, fighting, dead
    this.target = null; // текущая цель в бою
  }

  /**
   * Добавляет опыт игроку и проверяет повышение уровня
   * @param {number} exp - количество опыта
   */
  addExperience(exp) {
    this.experience += exp;
    
    while (this.experience >= this.experienceToNext) {
      this.levelUp();
    }
  }

  /**
   * Повышение уровня игрока
   */
  levelUp() {
    this.level++;
    this.experience -= this.experienceToNext;
    this.experienceToNext = this.level * 100; // прогрессия опыта
    
    // Увеличиваем HP и случайную характеристику
    this.maxHitPoints += 5;
    this.hitPoints = this.maxHitPoints; // полное исцеление при левелапе
    
    // Случайное улучшение характеристики
    const stats = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
    const randomStat = stats[Math.floor(Math.random() * stats.length)];
    this[randomStat]++;
    
    return {
      message: `Поздравляем! Вы достигли ${this.level} уровня! ${randomStat} увеличена на 1.`,
      statIncreased: randomStat
    };
  }

  /**
   * Исцеляет игрока на указанное количество HP
   * @param {number} amount - количество HP для исцеления
   */
  heal(amount) {
    const oldHp = this.hitPoints;
    this.hitPoints = Math.min(this.maxHitPoints, this.hitPoints + amount);
    return this.hitPoints - oldHp; // возвращает фактически исцеленное количество
  }

  /**
   * Наносит урон игроку
   * @param {number} damage - количество урона
   */
  takeDamage(damage) {
    this.hitPoints = Math.max(0, this.hitPoints - damage);
    if (this.hitPoints === 0) {
      this.state = 'dead';
    }
    return this.hitPoints;
  }

  /**
   * Добавляет предмет в инвентарь
   * @param {Object} item - предмет для добавления
   */
  addItem(item) {
    this.inventory.push(item);
  }

  /**
   * Удаляет предмет из инвентаря
   * @param {string} itemId - ID предмета
   */
  removeItem(itemId) {
    const index = this.inventory.findIndex(item => item.id === itemId);
    if (index !== -1) {
      return this.inventory.splice(index, 1)[0];
    }
    return null;
  }

  /**
   * Находит предмет в инвентаре
   * @param {string} itemName - название предмета (может быть частичным)
   */
  findItem(itemName) {
    const searchName = itemName.toLowerCase();
    return this.inventory.find(item => 
      item.name.toLowerCase().includes(searchName) ||
      item.id.toLowerCase().includes(searchName)
    );
  }

  /**
   * Сохранение игрока в localStorage
   */
  save() {
    const playerData = {
      name: this.name,
      level: this.level,
      experience: this.experience,
      experienceToNext: this.experienceToNext,
      hitPoints: this.hitPoints,
      maxHitPoints: this.maxHitPoints,
      strength: this.strength,
      dexterity: this.dexterity,
      constitution: this.constitution,
      intelligence: this.intelligence,
      wisdom: this.wisdom,
      charisma: this.charisma,
      inventory: this.inventory,
      currentRoom: this.currentRoom,
      state: this.state
    };
    
    localStorage.setItem('mudgame_player', JSON.stringify(playerData));
  }

  /**
   * Загрузка игрока из localStorage
   * @param {Object} data - данные для загрузки
   */
  load(data) {
    Object.assign(this, data);
  }

  /**
   * Получает общий вес инвентаря
   */
  getTotalWeight() {
    return this.inventory.reduce((total, item) => total + (item.weight || 0), 0);
  }

  /**
   * Проверяет, может ли игрок нести еще один предмет
   * @param {Object} item - предмет для проверки
   */
  canCarry(item) {
    const maxWeight = this.strength * 10; // максимальный вес = сила * 10
    return this.getTotalWeight() + (item.weight || 0) <= maxWeight;
  }
}
