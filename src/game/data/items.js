
/**
 * Данные предметов игрового мира
 * Типы: weapon, armor, potion, misc
 */
export const items = {
  iron_sword: {
    id: 'iron_sword',
    name: 'железный меч',
    description: 'Хорошо сбалансированный железный меч с острым лезвием.',
    type: 'weapon',
    damage: '1d6+1', // кубик 1-6 + 1 бонус
    weight: 3,
    value: 50,
    canTake: true
  },
  
  healing_potion: {
    id: 'healing_potion',
    name: 'зелье лечения',
    description: 'Маленькая бутылочка с красной жидкостью, излучающей слабое свечение.',
    type: 'potion',
    healAmount: 10,
    weight: 1,
    value: 25,
    canTake: true
  },
  
  info_board: {
    id: 'info_board',
    name: 'информационная доска',
    description: 'Деревянная доска с объявлениями и правилами города.',
    type: 'misc',
    weight: 50,
    value: 0,
    canTake: false,
    readText: 'Добро пожаловать в Мидгард! Основные команды: look, go <направление>, get <предмет>, drop <предмет>, inventory, kill <цель>'
  },
  
  leather_armor: {
    id: 'leather_armor',
    name: 'кожаная броня',
    description: 'Прочная кожаная броня, обеспечивающая базовую защиту.',
    type: 'armor',
    armor: 2,
    weight: 5,
    value: 30,
    canTake: true
  }
};
