/**
 * Хранилище текстовых шаблонов для вывода сообщений в игре.
 * Использует синтаксис:
 * - {placeholder} для подстановки данных из контекста.
 * - {c:class-name}текст{/c} для стилизации.
 */
export const templates = {
  consider: {
    item: {
      header: '{c:room-name}---[ Оценка: {name} ]--------{/c}',
      footer: '{c:room-name}------------------------------------{/c}',
      statsHeader: '{c:exit-name}Характеристики:{/c}',
      type: '  Тип: {c:item-name}{type}{/c}',
      damage: '  ⚔️ Урон: {c:combat-player-attack}{damage}{/c}',
      armor: '  🛡️ Защита: {c:combat-exp-gain}{armor}{/c}',
      healAmount: '  ❤️ Лечение: {c:combat-exp-gain}{healAmount}{/c}',
      weight: '  ⚖️ Вес: {c:npc-neutral}{weight}{/c}',
      value: '  💰 Ценность: {c:exit-name}{value}{/c} золота',
    },
    npc: {
      header: '{c:room-name}---[ Оценка: {name} ]--------{/c}',
      footer: '{c:room-name}------------------------------------{/c}',
      statsHeader: '{c:exit-name}Оценка сил:{/c}',
      playerDamage: '  Ваш урон/раунд (средний): {c:combat-player-attack}{damage}{/c}',
      npcDamage: '  Урон врага/раунд (средний): {c:combat-npc-attack}{damage}{/c}',
      roundsToWin: '  Раундов до победы: ~{c:combat-player-attack}{rounds}{/c}',
      roundsToLose: '  Раундов до поражения: ~{c:combat-npc-attack}{rounds}{/c}',
      verdict: '\n{c:exit-name}Вердикт:{/c} {verdictText}',
      cantDamage: '  Вы не можете нанести урон.',
      npcCantDamage: '  Противник не может нанести урон. {c:combat-exp-gain}Легкая победа{/c}.',
    },
    compare: {
      header: '\n\n{c:exit-name}Сравнение с надетым{/c} ({c:item-name}{equippedItemName}{/c}):\n',
      noEquipped: '\n\n{c:exit-name}Сравнение:{/c}\n  У вас не надето: {itemTypeName}.',
      statLine: '  {name}: {newItemStat} ({diffStr})\n',
      verdict: '\n{c:exit-name}Вердикт:{/c} {text}',
      verdictBetter: 'В целом, это {c:combat-exp-gain}лучше{/c}, чем то, что на вас надето.',
      verdictWorse: 'В целом, это {c:combat-npc-death}хуже{/c}, чем то, что на вас надето.',
      verdictEqual: 'В целом, они примерно одинаковы.',
    },
    general: {
      prompt: 'Что вы хотите оценить? (consider <предмет/нпс>)',
      notFound: 'Вы не видите "{targetName}" здесь.',
    }
  }
};
