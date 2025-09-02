export default {
  name: 'stats',
  aliases: ['статы', 'характеристики'],
  description: 'показать характеристики игрока',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandParser').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    const p = game.player;
    return `=== Характеристики ===
Имя: ${p.name}
Уровень: ${p.level}
Опыт: ${p.experience}/${p.experienceToNext}
Здоровье: ${p.hitPoints}/${p.maxHitPoints}

Сила: ${p.strength}
Ловкость: ${p.dexterity}
Телосложение: ${p.constitution}
Интеллект: ${p.intelligence}
Мудрость: ${p.wisdom}
Харизма: ${p.charisma}

Состояние: ${p.state === 'fighting' ? 'в бою' : p.state === 'dead' ? 'мертв' : 'готов'}`;
  }
};