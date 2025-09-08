export default {
  name: 'get',
  aliases: ['взять'],
  description: 'взять предмет',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandManager').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    if (!cmd.target) {
      return 'Что вы хотите взять?';
    }

    const currentRoom = game.getCurrentRoom();
    const target = cmd.target.toLowerCase();

    // Ищем предмет в локации
    const globalItemId = currentRoom.findItem(target, game);
    if (!globalItemId) {
      return `Вы не видите "${cmd.target}" здесь.`;
    }

    const item = game.world.items.get(globalItemId);
    if (!item.canTake) {
      return `Вы не можете взять ${item.name}.`;
    }

    if (!game.player.canCarry(item)) {
      return `${item.name} слишком тяжелый для вас.`;
    }

    // Перемещаем предмет из локации в инвентарь
    currentRoom.removeItem(globalItemId);
    game.player.addItem({ ...item, globalId: globalItemId });

    return `Вы взяли ${game.colorize(item.name, 'item-name')}.`;
  }
};