
import { DamageParser } from "../utils/damageParser.js";
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
    this.reset(name);
  }

  /**
   * Сбрасывает состояние игрока до начального.
   * @param {string} [name='Игрок'] - Имя игрока.
   */
  reset(name = 'Игрок') {
    this.name = name;
    this.level = 1;
    this.experience = 0;
    this.experienceToNext = 100;
    this.hitPoints = 20;
    this.maxHitPoints = 20;
    this.stamina = 100;
    this.maxStamina = 100;
    this.strength = 10;
    this.dexterity = 10;
    this.constitution = 10;
    this.intelligence = 10;
    this.wisdom = 10;
    this.charisma = 10;
    this.inventory = [];
    this.currentRoom = 'midgard:center';
    this.state = 'idle';
    this.equippedWeapon = null;
    this.equippedArmor = null;
    this.skills = []; // Используем массив вместо Set
    this.gold = 100; // Стартовое золото
    this.skillCooldowns = {};
    this.nextAttackIsSkill = null;
    this.skillUsedThisRound = false;
    this.deathRoom = null;
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
    // Если опыта для повышения уровня не хватало (например, при вызове через gain lvl),
    // то просто сбрасываем его в 0, иначе вычитаем стоимость уровня.
    if (this.experience < this.experienceToNext) {
      this.experience = 0;
    } else {
      this.experience -= this.experienceToNext;
    }
    this.experienceToNext = this.level * 100; // прогрессия опыта
    
    // Увеличиваем HP, выносливость и случайную характеристику
    this.maxHitPoints += 5; // Бонус к здоровью за уровень
    this.maxStamina += 10; // Бонус к выносливости за уровень
    this.stamina = this.maxStamina; // Полное восстановление выносливости
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
      this.deathRoom = this.currentRoom;
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
   * Проверяет, изучено ли умение.
   * @param {string} skillId - ID умения.
   * @returns {boolean}
   */
  hasSkill(skillId) {
    return this.skills.includes(skillId);
  }

  /**
   * Проверяет, жив ли игрок.
   * @returns {boolean}
   */
  isAlive() {
    return this.hitPoints > 0;
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
   * Загружает состояние игрока из предоставленного объекта данных.
   * @param {object} data - Данные для загрузки.
   */
  load(data) {
    // Сначала применяем все данные из сохранения
    Object.assign(this, data);

    this.gold = data.gold || 0;
    // Затем убеждаемся, что новые или отсутствующие в сохранении поля
    // имеют значения по умолчанию, чтобы избежать NaN и undefined.
    this.stamina = data.stamina ?? this.maxStamina ?? 100;
    this.maxStamina = data.maxStamina ?? 100;
    this.skills = Array.isArray(data.skills) ? data.skills : []; // Убедимся, что это массив
    this.skillCooldowns = data.skillCooldowns || {};
    this.nextAttackIsSkill = null; // Сбрасываем, чтобы не зациклилось умение после загрузки
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
   * Экипирует предмет в соответствующий слот.
   * @param {object} item - Предмет для экипировки.
   * @returns {string} Результат действия.
   */
  equip(item) {
    const slotMapping = {
      weapon: { name: 'Оружие', slot: 'equippedWeapon' },
      armor: { name: 'Броня', slot: 'equippedArmor' },
      // Сюда можно будет добавить другие слоты, например:
      // shield: { name: 'Щит', slot: 'equippedShield' },
    };

    const mapping = slotMapping[item.type];
    if (!mapping) {
      return `${item.name} нельзя экипировать.`;
    }

    const equippedItem = this[mapping.slot];

    // Проверяем, достаточно ли места для старого предмета, если он есть
    if (equippedItem && !this.canCarry(equippedItem)) {
      return `Вы не можете экипировать ${item.name}, так как в инвентаре не хватит места для ${equippedItem.name}.`;
    }

    // Если в слоте уже есть предмет, возвращаем его в инвентарь.
    let result = '';
    if (equippedItem) {
      this.addItem(equippedItem);
      result += `Вы сняли ${equippedItem.name}. `;
    }

    this[mapping.slot] = item;
    // Удаляем новый предмет из инвентаря, так как он теперь экипирован.
    this.removeItem(item.globalId);
    result += `Вы экипировали ${item.name}.`;
    return result;
  }

  /**
   * Снимает предмет из указанного слота и возвращает его в инвентарь.
   * @param {'weapon' | 'armor'} slotType - Тип слота для снятия.
   * @returns {string} Сообщение о результате.
   */
  unequip(slotType) {
    const slotMapping = {
      weapon: { name: 'оружия', slot: 'equippedWeapon' },
      armor: { name: 'брони', slot: 'equippedArmor' },
    };

    const mapping = slotMapping[slotType];
    if (!mapping) return `Неизвестный тип экипировки: ${slotType}.`;

    const equippedItem = this[mapping.slot];
    if (!equippedItem) {
      return `У вас нет экипированной ${mapping.name}.`;
    }

    if (!this.canCarry(equippedItem)) {
      return `Вы не можете снять ${equippedItem.name}, в инвентаре нет места.`;
    }

    this.addItem(equippedItem);
    const itemName = equippedItem.name;
    this[mapping.slot] = null;
    return `Вы сняли ${itemName}.`;
  }

  /**
   * Рассчитывает и возвращает урон от экипированного оружия.
   * Примечание: этот метод возвращает полный урон оружия, а не только бонус.
   * @returns {number} Итоговый урон от оружия.
   */
  rollWeaponDamage() {
    if (!this.equippedWeapon || !this.equippedWeapon.damage) {
      return 0; // Возвращаем 0, если оружия нет, бонус от силы добавится позже
    }
    return new DamageParser(this.equippedWeapon.damage).roll();
  }

  /**
   * Возвращает бонус к защите от экипированной брони.
   * @returns {number} Бонус к защите.
   */
  getArmorDefenseBonus() {
    return this.equippedArmor ? (this.equippedArmor.armor || 0) : 0;
  }

  /**
   * Рассчитывает и возвращает общую защиту игрока.
   * @returns {number}
   */
  getTotalDefense() {
    const dexBonus = Math.floor((this.dexterity - 10) / 2);
    const armorBonus = this.getArmorDefenseBonus();
    return 10 + dexBonus + armorBonus;
  }

  /**
   * Рассчитывает средний урон игрока для оценки.
   * @returns {number}
   */
  getAverageDamage() {
    // Базовый урон 1d4 без оружия
    let avgDamage = 2.5;
    
    // Бонус от силы
    const strBonus = Math.floor((this.strength - 10) / 2);
    
    // Бонус от оружия
    if (this.equippedWeapon && this.equippedWeapon.damage) {
      avgDamage = new DamageParser(this.equippedWeapon.damage).avg() + strBonus;
    } else {
      avgDamage += strBonus;
    }
    
    return Math.max(1, avgDamage);
  }
}
