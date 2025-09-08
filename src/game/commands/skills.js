export default {
  name: 'skills',
  aliases: ['умения', 'способности'],
  description: 'показать изученные и будущие умения',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandManager').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    const p = game.player;
    const c = game.colorize;

    const header = c(`---[ Умения: ${p.name} ]--------`, 'room-name');
    const footer = c('------------------------------------', 'room-name');
    const lines = [];

    // Изученные умения
    lines.push(c('Изученные умения:', 'exit-name'));
    if (p.skills.length === 0) {
      lines.push('  У вас пока нет изученных умений.');
    } else {
      p.skills.forEach(skillId => {
        const skillData = game.skillsData.get(skillId);
        if (skillData) {
          const cooldown = p.skillCooldowns[skillId] > 0 ? c(` (перезарядка: ${p.skillCooldowns[skillId]})`, 'combat-npc-death') : '';
          lines.push(`  - ${c(skillData.name, 'item-name')}${cooldown}`);
        }
      });
    }

    lines.push('');

    // Следующее умение для изучения
    let nextSkill = null;
    let minLevel = Infinity;

    for (const skillData of game.skillsData.values()) {
      if (skillData.level > p.level && skillData.level < minLevel) {
        minLevel = skillData.level;
        nextSkill = skillData;
      }
    }

    lines.push(c('Ближайшее умение:', 'exit-name'));
    if (nextSkill) {
      lines.push(`  - ${c(nextSkill.name, 'item-name')} (на ${c(nextSkill.level, 'combat-exp-gain')} уровне)`);
    } else {
      lines.push('  Вы изучили все доступные умения.');
    }

    return [header, ...lines, footer].join('\n');
  }
};