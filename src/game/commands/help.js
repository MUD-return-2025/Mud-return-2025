export default {
  name: 'help',
  aliases: ['помощь', 'справка'],
  description: 'показать эту справку',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandManager').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    return game.commandManager.generateHelp();
  }
};