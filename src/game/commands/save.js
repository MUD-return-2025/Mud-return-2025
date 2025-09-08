export default {
  name: 'save',
  aliases: ['сохранить'],
  description: 'сохранить игру',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandManager').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    try {
      game.saveGame();
      return 'Игра сохранена.';
    } catch (error) {
      console.error('Ошибка сохранения игры:', error);
      return 'Ошибка сохранения игры.';
    }
  }
};