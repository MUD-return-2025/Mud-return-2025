
/**
 * Данные НПС и монстров
 * Типы: friendly, neutral, hostile
 */
export const npcs = {
  town_crier: {
    id: 'town_crier',
    name: 'городской глашатай',
    description: 'Пожилой мужчина в ярких одеждах, громко объявляющий новости города.',
    type: 'friendly',
    hitPoints: 15,
    maxHitPoints: 15,
    damage: '1d4',
    experience: 0,
    drops: [],
    dialogue: [
      'Слушайте, слушайте! Новости Мидгарда!',
      'В восточном квартале открылась новая лавка!',
      'Будьте осторожны в западном квартале - видели крыс!'
    ]
  },
  
  city_guard: {
    id: 'city_guard', 
    name: 'городской стражник',
    description: 'Сильный воин в кольчуге с мечом на поясе. Внимательно следит за порядком.',
    type: 'friendly',
    hitPoints: 25,
    maxHitPoints: 25,
    damage: '1d6+2',
    experience: 0,
    drops: [],
    dialogue: [
      'Добро пожаловать в Мидгард, путник.',
      'Соблюдайте порядок в городе.',
      'Если нужна помощь - обращайтесь к глашатаю на площади.'
    ]
  },
  
  priest: {
    id: 'priest',
    name: 'жрец храма',
    description: 'Добрый старик в белых одеждах. Его глаза излучают мудрость и сочувствие.',
    type: 'friendly', 
    hitPoints: 20,
    maxHitPoints: 20,
    damage: '1d4+1',
    experience: 0,
    drops: [],
    dialogue: [
      'Да благословят вас боги, дитя мое.',
      'Этот храм всегда открыт для нуждающихся в исцелении.',
      'Произнесите "heal me", если нужно восстановить здоровье.'
    ],
    canHeal: true
  },
  
  merchant: {
    id: 'merchant',
    name: 'торговец',
    description: 'Упитанный торговец с хитрой улыбкой. На его прилавке множество товаров.',
    type: 'neutral',
    hitPoints: 18,
    maxHitPoints: 18, 
    damage: '1d4',
    experience: 0,
    drops: [],
    dialogue: [
      'Добро пожаловать в мою лавку!',
      'У меня лучшие товары во всем Мидгарде!',
      'Что желаете купить?'
    ],
    shop: ['iron_sword', 'leather_armor', 'healing_potion']
  },
  
  rat: {
    id: 'rat',
    name: 'крыса',
    description: 'Большая серая крыса с красными глазами и острыми зубами.',
    type: 'hostile',
    hitPoints: 8,
    maxHitPoints: 8,
    damage: '1d4',
    experience: 10,
    drops: [],
    dialogue: [
      '*шипит*',
      '*скалит зубы*'
    ]
  }
};
