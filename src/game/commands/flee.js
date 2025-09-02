export default {
  name: 'flee',
  aliases: ['сбежать'],
  description: 'сбежать из боя',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandParser').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    if (game.player.state !== 'fighting') {
      return 'Вы не в бою.';
    }
    const npc = game.npcs.get(game.combatTarget);
    game.stopCombat(true); // playerFled = true
    return `Вы успешно сбежали от ${game.colorize(npc.name, `npc-name npc-${npc.type}`)}.`;
  }
};