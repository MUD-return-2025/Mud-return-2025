export default {
  name: 'drop',
  aliases: ['бросить'],
  description: 'бросить предмет',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandParser').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    if (!cmd.target) {
      return 'Что вы хотите бросить?';
    }

    const item = game.player.findItem(cmd.target);
    if (!item) {
      return `У вас нет "${cmd.target}".`;
    }

    const currentRoom = game.getCurrentRoom();
    game.player.removeItem(item.globalId);
    currentRoom.addItem(item.globalId); // В комнату добавляем глобальный ID

    return `Вы бросили ${game.colorize(item.name, 'item-name')}.`;
  }
};