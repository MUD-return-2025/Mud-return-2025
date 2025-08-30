
/**
 * Данные локаций города Мидгард
 * Структура карты:
 *      [north_gate]
 *           |
 * [west] - [center] - [east]
 *           |
 *    [south_gate]
 *           |
 *        [temple]
 */
export const rooms = {
  center: {
    id: 'center',
    name: 'Центральная площадь Мидгарда',
    description: 'Большая мощеная площадь в центре города. Здесь всегда много народу. На севере виднеются массивные ворота, а на юге - тропинка ведет к храму.',
    exits: {
      'север': 'north_gate',
      'юг': 'south_gate', 
      'восток': 'east',
      'запад': 'west',
      'north': 'north_gate',
      'south': 'south_gate',
      'east': 'east',
      'west': 'west'
    },
    items: ['info_board'],
    npcs: ['town_crier']
  },
  
  north_gate: {
    id: 'north_gate',
    name: 'Северные ворота',
    description: 'Массивные каменные ворота, ведущие на север из города. Стражники внимательно следят за всеми проходящими.',
    exits: {
      'юг': 'center',
      'south': 'center'
    },
    items: [],
    npcs: ['city_guard']
  },
  
  south_gate: {
    id: 'south_gate', 
    name: 'Южные ворота',
    description: 'Менее массивные ворота на юге города. Отсюда дорога ведет к храму и дальше в поля.',
    exits: {
      'север': 'center',
      'юг': 'temple',
      'north': 'center',
      'south': 'temple'
    },
    items: [],
    npcs: []
  },
  
  temple: {
    id: 'temple',
    name: 'Храм исцеления',
    description: 'Белокаменный храм, посвященный богам исцеления. Здесь можно восстановить здоровье и найти покой.',
    exits: {
      'север': 'south_gate',
      'north': 'south_gate'
    },
    items: ['healing_potion'],
    npcs: ['priest']
  },
  
  east: {
    id: 'east',
    name: 'Восточный квартал',
    description: 'Торговый квартал города. Здесь расположены лавки и мастерские ремесленников.',
    exits: {
      'запад': 'center',
      'west': 'center'
    },
    items: ['iron_sword'],
    npcs: ['merchant']
  },
  
  west: {
    id: 'west',
    name: 'Западный квартал', 
    description: 'Жилой квартал города. Тихие улочки с небольшими домиками горожан.',
    exits: {
      'восток': 'center',
      'east': 'center'
    },
    items: [],
    npcs: ['rat']
  }
};
