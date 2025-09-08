export default {
  name: 'inventory',
  aliases: ['inv', 'и', 'инвентарь'],
  description: 'показать инвентарь',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandManager').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    if (game.player.inventory.length === 0) {
      return 'Ваш инвентарь пуст.';
    }

    let result = 'Ваш инвентарь:\n';
    let totalWeight = 0;

    game.player.inventory.forEach(item => {
      result += `  ${game.colorize(item.name, 'item-name')}`;
      if (item.weight) {
        result += ` (вес: ${item.weight})`;
        totalWeight += item.weight;
      }
      result += '\n';
    });

    result += `\nОбщий вес: ${totalWeight}/${game.player.strength * 10}\n`;
    result += `У вас ${game.colorize(game.player.gold, 'exit-name')} золота.`;
    return result;
  }
};