
/**
 * Представляет игрока, управляя его состоянием, характеристиками,
 * инвентарем и действиями в игровом мире.
 */
export class Player {
  /**
   * Создает экземпляр игрока.
   * @param {string} [name='Игрок'] - Имя игрока.
   */
  constructor(name = 'Игрок') {
    /** @type {string} Имя игрока. */
    this.name = name;
    /** @type {number} Текущий уровень. */
    this.level = 1;
    /** @type {number} Текущее количество опыта. */
    this.experience = 0;
    /** @type {number} Опыта до следующего уровня. */
    this.experienceToNext = 100;
    /** @type {number} Текущее здоровье. */
    this.hitPoints = 20;
    /** @type {number} Максимальное здоровье. */
    this.maxHitPoints = 20;
    
    // Базовые характеристики
    this.strength = 10;
    this.dexterity = 10;
    this.constitution = 10;
    this.intelligence = 10;
    this.wisdom = 10;
    this.charisma = 10;
    
    /** @type {object[]} Инвентарь игрока. */
    this.inventory = [];
    /** @type {string} Глобальный ID текущей комнаты. */
    this.currentRoom = 'center';
    /** @type {'idle'|'fighting'|'dead'} Текущее состояние игрока. */
    this.state = 'idle';
    /** @type {object|null} Экипированное оружие. */
    this.equippedWeapon = null;
    /** @type {object|null} Экипированная броня. */
    this.equippedArmor = null;
  }

  /**
   * Добавляет опыт игроку и проверяет, достиг ли он нового уровня.
   * @param {number} exp - Количество получаемого опыта.
   * @returns {{message: string, statIncreased: string}|null} Объект с сообщением о повышении уровня или null.
   */
  addExperience(exp) {
    this.experience += exp;
    let levelUpInfo = null;
    
    while (this.experience >= this.experienceToNext) {
      levelUpInfo = this.levelUp(); // Capture the last level up info
      // Сохраняем информацию о последнем повышении уровня, если их было несколько за раз.
    }
    return levelUpInfo;
  }

  /**
   * Повышает уровень игрока, обновляя его характеристики и здоровье.
   * @returns {{message: string, statIncreased: string}} Объект с информацией о повышении уровня.
   */
  levelUp() {
    this.level++;
    this.experience -= this.experienceToNext;
    this.experienceToNext = this.level * 100; // прогрессия опыта
    
    // Увеличиваем HP и случайную характеристику
    this.maxHitPoints += 5; // Бонус к здоровью за уровень
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
   * Восстанавливает здоровье игрока.
   * @param {number} amount - Количество HP для восстановления.
   * @returns {number} Фактически восстановленное количество здоровья.
   */
  heal(amount) {
    const oldHp = this.hitPoints;
    this.hitPoints = Math.min(this.maxHitPoints, this.hitPoints + amount);
    return this.hitPoints - oldHp; // возвращает фактически исцеленное количество
  }

  /**
   * Уменьшает здоровье игрока на указанное количество урона.
   * @param {number} damage - Количество получаемого урона.
   * @returns {number} Оставшееся здоровье.
   */
  takeDamage(damage) {
    this.hitPoints = Math.max(0, this.hitPoints - damage);
    if (this.hitPoints === 0) {
      this.state = 'dead';
    }
    return this.hitPoints;
  }

  /**
   * Добавляет предмет в инвентарь игрока.
   * @param {object} item - Объект предмета для добавления.
   */
  addItem(item) {
    this.inventory.push(item);
  }

  /**
   * Удаляет предмет из инвентаря по его глобальному ID.
   * @param {string} globalId - Глобальный ID предмета.
   * @returns {object|null} Удаленный предмет или null, если предмет не найден.
   */
  removeItem(globalId) {
    const index = this.inventory.findIndex(item => item.globalId === globalId);
    if (index !== -1) {
      return this.inventory.splice(index, 1)[0];
    }
    return null;
  }

  /**
   * Находит предмет в инвентаре по его имени или ID.
   * @param {string} itemName - Название или ID предмета для поиска (может быть частичным).
   * @returns {object|undefined} Найденный предмет или undefined.
   */
  findItem(itemName) {
    const searchName = itemName.toLowerCase();
    return this.inventory.find(item => 
      item.name.toLowerCase().includes(searchName) ||
      (item.globalId && item.globalId.toLowerCase().includes(searchName))
    );
  }

  /**
   * Сохраняет состояние игрока.
   * @deprecated Этот метод не используется, так как сохранение управляется `GameEngine`.
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
   * Загружает состояние игрока из предоставленного объекта данных.
   * @param {object} data - Данные для загрузки.
   */
  load(data) {
    Object.assign(this, data);
  }

  /**
   * Рассчитывает общий вес всех предметов в инвентаре.
   * @returns {number} Общий вес.
   */
  getTotalWeight() {
    return this.inventory.reduce((total, item) => total + (item.weight || 0), 0);
  }

  /**
   * Проверяет, может ли игрок взять еще один предмет, не превысив максимальный вес.
   * @param {object} item - Предмет для проверки.
   * @returns {boolean} `true`, если игрок может нести предмет.
   */
  canCarry(item) {
    const maxWeight = this.strength * 10; // Максимальный вес = сила * 10
    return this.getTotalWeight() + (item.weight || 0) <= maxWeight;
  }

  /**
   * Экипирует оружие
   * @param {Object} weapon - оружие для экипировки
   * @returns {string} результат экипировки
   */
  equipWeapon(weapon) {
    if (weapon.type !== 'weapon') {
      return `${weapon.name} не является оружием.`;
    }

    // Проверяем, достаточно ли места для старого оружия, если оно есть
    if (this.equippedWeapon && !this.canCarry(this.equippedWeapon)) {
      return `Вы не можете экипировать ${weapon.name}, так как в инвентаре не хватит места для ${this.equippedWeapon.name}.`;
    }

    // Если уже есть экипированное оружие, возвращаем его в инвентарь.
    let result = '';
    if (this.equippedWeapon) {
      this.addItem(this.equippedWeapon);
      result += `Вы сняли ${this.equippedWeapon.name}. `;
    }

    this.equippedWeapon = weapon;
    // Удаляем новое оружие из инвентаря, так как оно теперь экипировано.
    this.removeItem(weapon.globalId);
    result += `Вы экипировали ${weapon.name}.`;
    return result;
  }

  /**
   * Экипирует броню
   * @param {Object} armor - броня для экипировки
   * @returns {string} результат экипировки
   */
  equipArmor(armor) {
    if (armor.type !== 'armor') {
      return `${armor.name} не является броней.`;
    }

    // Проверяем, достаточно ли места для старой брони, если она есть
    if (this.equippedArmor && !this.canCarry(this.equippedArmor)) {
      return `Вы не можете экипировать ${armor.name}, так как в инвентаре не хватит места для ${this.equippedArmor.name}.`;
    }

    // Аналогично оружию, возвращаем старую броню в инвентарь.
    let result = '';
    if (this.equippedArmor) {
      this.addItem(this.equippedArmor);
      result += `Вы сняли ${this.equippedArmor.name}. `;
    }

    this.equippedArmor = armor;
    this.removeItem(armor.globalId);
    result += `Вы экипировали ${armor.name}.`;
    return result;
  }

  /**
   * Снимает экипированное оружие и возвращает его в инвентарь.
   * @returns {string} Сообщение о результате.
   */
  unequipWeapon() {
    if (!this.equippedWeapon) {
      return 'У вас нет экипированного оружия.';
    }

    if (!this.canCarry(this.equippedWeapon)) {
      return `Вы не можете снять ${this.equippedWeapon.name}, в инвентаре нет места.`;
    }

    this.addItem(this.equippedWeapon);
    const weaponName = this.equippedWeapon.name;
    this.equippedWeapon = null;
    return `Вы сняли ${weaponName}.`;
  }

  /**
   * Снимает экипированную броню и возвращает ее в инвентарь.
   * @returns {string} Сообщение о результате.
   */
  unequipArmor() {
    if (!this.equippedArmor) {
      return 'У вас нет экипированной брони.';
    }

    if (!this.canCarry(this.equippedArmor)) {
      return `Вы не можете снять ${this.equippedArmor.name}, в инвентаре нет места.`;
    }

    this.addItem(this.equippedArmor);
    const armorName = this.equippedArmor.name;
    this.equippedArmor = null;
    return `Вы сняли ${armorName}.`;
  }

  /**
   * Рассчитывает и возвращает урон от экипированного оружия.
   * Примечание: этот метод возвращает полный урон оружия, а не только бонус.
   * @returns {number} Итоговый урон от оружия.
   */
  rollWeaponDamage() {
    if (!this.equippedWeapon) {
      return 0;
    }
    
    // Парсим урон оружия (например "1d6+1")
    const match = this.equippedWeapon.damage?.match(/(\d+)d(\d+)(?:([+-])(\d+))?/);
    if (!match) {
      return 1; // Базовый урон, если не указан.
    }
    
    const [, diceCount, diceSize, operator, modifier] = match;
    let weaponDamage = 0;
    
    // Бросаем кубики оружия
    for (let i = 0; i < parseInt(diceCount); i++) {
      weaponDamage += Math.floor(Math.random() * parseInt(diceSize)) + 1;
    }
    
    // Применяем модификатор
    if (operator && modifier) {
      const mod = parseInt(modifier);
      weaponDamage += operator === '+' ? mod : -mod;
    }
    
    return Math.max(1, weaponDamage);
  }

  /**
   * Возвращает бонус к защите от экипированной брони.
   * @returns {number} Бонус к защите.
   */
  getArmorDefenseBonus() {
    return this.equippedArmor ? (this.equippedArmor.armor || 0) : 0;
  }
}
