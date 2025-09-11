export default {
  name: 'equip',
  aliases: ['экипировать'],
  description: 'экипировать оружие или броню',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandManager').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    if (!cmd.target) {
      return 'Что вы хотите экипировать?';
    }

    const item = game.player.findItem(cmd.target);
    if (!item) {
      return `У вас нет "${cmd.target}".`;
    }

    // Новый универсальный метод сам проверяет тип предмета
    return game.player.equip(item);
  }
};