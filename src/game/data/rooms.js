/**
 * Данные локаций игрового мира
 * Каждая локация содержит описание, выходы, предметы и НПС
 */
export const rooms = {
  center: {
    id: 'center',
    name: 'Центральная площадь Мидгарда',
    description: 'Большая мощеная площадь в центре города. Здесь всегда много народу. В центре площади стоит красивый фонтан.',
    exits: {
      'север': 'north_gate',
      'юг': 'south_gate',
      'восток': 'east_quarter',
      'запад': 'west_quarter',
      'с': 'north_gate',
      'ю': 'south_gate',
      'в': 'east_quarter',
      'з': 'west_quarter'
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
    description: 'Южный вход в город. Ворота украшены резьбой с изображениями древних героев.',
    exits: {
      'север': 'center',
      'юг': 'temple',
      'с': 'center',
      'ю': 'temple'
    },
    items: [],
    npcs: ['city_guard']
  },

  temple: {
    id: 'temple',
    name: 'Храм исцеления',
    description: 'Священное место с высокими сводами и мягким светом. Воздух наполнен умиротворением и запахом благовоний.',
    exits: {
      'север': 'south_gate',
      'с': 'south_gate'
    },
    items: ['healing_potion'],
    npcs: ['priest']
  },

  east_quarter: {
    id: 'east_quarter',
    name: 'Восточный квартал',
    description: 'Торговый район города с множеством лавок и мастерских. Здесь всегда что-то продают или покупают.',
    exits: {
      'запад': 'center',
      'з': 'center'
    },
    items: ['iron_sword'],
    npcs: ['merchant']
  },

  west_quarter: {
    id: 'west_quarter',
    name: 'Западный квартал',
    description: 'Тихий жилой район с небольшими домами горожан. Иногда здесь можно встретить бродячих собак или крыс.',
    exits: {
      'восток': 'center',
      'в': 'center'
    },
    items: [],
    npcs: ['rat']
  }
};