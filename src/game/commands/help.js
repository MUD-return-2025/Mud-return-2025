export default {
  name: 'help',
  aliases: ['помощь', 'справка'],
  description: 'показать эту справку',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandParser').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    return game.commandParser.generateHelp();
  }
};