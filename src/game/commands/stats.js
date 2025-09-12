export default {
  name: 'stats',
  aliases: ['статы', 'характеристики'],
  description: 'показать характеристики игрока',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandManager').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    const p = game.player;
    const c = game.colorize;

    const stateText = p.state === 'fighting' 
      ? c('в бою', 'combat-npc-death') 
      : p.state === 'dead' 
        ? c('мертв', 'player-dead-look') 
        : c('готов', 'combat-exp-gain');

    const hpPercentage = p.maxHitPoints > 0 ? p.hitPoints / p.maxHitPoints : 0;
    const hpFullLength = Math.round(10 * hpPercentage);
    const hpEmptyLength = 10 - hpFullLength;
    const hpBar = `${c('█', 'combat-npc-death').repeat(hpFullLength)}${c('░', 'npc-dead').repeat(hpEmptyLength)}`;

    const expPercentage = p.experienceToNext > 0 ? p.experience / p.experienceToNext : 0;
    const expFullLength = Math.round(10 * expPercentage);
    const expEmptyLength = 10 - expFullLength;
    const expBar = `${c('█', 'room-name').repeat(expFullLength)}${c('░', 'npc-dead').repeat(expEmptyLength)}`;

    const staminaPercentage = p.maxStamina > 0 ? p.stamina / p.maxStamina : 0;
    const staminaFullLength = Math.round(10 * staminaPercentage);
    const staminaEmptyLength = 10 - staminaFullLength;
    const staminaBar = `${c('█', 'exit-name').repeat(staminaFullLength)}${c('░', 'npc-dead').repeat(staminaEmptyLength)}`;

    const header = c(`---[ Характеристики: ${p.name} ]--------`, 'room-name');
    const footer = c('------------------------------------', 'room-name');

    const lines = [
      `  ${c('Уровень:'.padEnd(15), 'info-label')} ${p.level}`,
      `  ${c('Опыт:'.padEnd(15), 'info-label')} [${expBar}] ${p.experience}/${p.experienceToNext}`,
      `  ${c('Здоровье:'.padEnd(15), 'info-label')} [${hpBar}] ${p.hitPoints}/${p.maxHitPoints}`,
      `  ${c('Выносливость:'.padEnd(15), 'info-label')} [${staminaBar}] ${p.stamina}/${p.maxStamina}`,
      ``,
      `  💪 ${c('Сила:'.padEnd(13), 'info-label')} ${p.strength}`,
      `  ⚡ ${c('Ловкость:'.padEnd(13), 'info-label')} ${p.dexterity}`,
      `  🛡️ ${c('Телосложение:'.padEnd(13), 'info-label')} ${p.constitution}`,
      `  🧠 ${c('Интеллект:'.padEnd(13), 'info-label')} ${p.intelligence}`,
      `  🔮 ${c('Мудрость:'.padEnd(13), 'info-label')} ${p.wisdom}`,
      `  😊 ${c('Харизма:'.padEnd(13), 'info-label')} ${p.charisma}`,
      ``,
      `  💰 ${c('Золото:'.padEnd(14), 'info-label')} ${p.gold}`,
      ``,
      `  Состояние: ${stateText}`
    ];

    return [header, ...lines, footer].join('\n');
  }
};