export default {
  name: 'consider',
  aliases: ['con'],
  description: 'оценить предмет или противника',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandManager').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    return game.considerationManager.consider(cmd.target);
  }
};