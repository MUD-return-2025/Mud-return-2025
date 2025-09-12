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

    const allSkills = Array.from(game.skillsData.values()).sort((a, b) => a.level - b.level);
    const learnedSkills = allSkills.filter(skill => p.hasSkill(skill.id));
    const availableSkills = allSkills.filter(skill => !p.hasSkill(skill.id));

    // Изученные умения
    lines.push(c('Изученные умения:', 'exit-name'));
    if (learnedSkills.length === 0) {
      lines.push('  У вас пока нет изученных умений.');
    } else {
      learnedSkills.forEach(skill => {
        const cooldown = p.skillCooldowns[skill.id] > 0 
          ? c(` (перезарядка: ${p.skillCooldowns[skill.id]} сек)`, 'combat-npc-death') 
          : '';
        lines.push(`  - ${c(skill.name, 'item-name')}${cooldown}`);
        lines.push(`    ${c(skill.description, 'npc-neutral')}`);
      });
    }

    lines.push('');

    // Доступные для изучения умения
    lines.push(c('Доступные для изучения умения:', 'exit-name'));
    if (availableSkills.length > 0) {
      availableSkills.forEach(skill => {
        lines.push(`  - ${c(skill.name, 'player-speech')} (на ${c(skill.level, 'combat-exp-gain')} уровне)`);
        lines.push(`    ${c(skill.description, 'npc-neutral')}`);
      });
    } else {
      lines.push('  Вы изучили все доступные умения.');
    }

    return [header, ...lines, footer].join('\n');
  }
};