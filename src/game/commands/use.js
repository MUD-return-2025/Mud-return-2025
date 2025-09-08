export default {
  name: 'use',
  aliases: ['использовать'],
  description: 'использовать предмет из инвентаря',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandManager').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    if (!cmd.target) {
      return 'Что вы хотите использовать?';
    }

    const item = game.player.findItem(cmd.target);
    if (!item) {
      return `У вас нет "${cmd.target}".`;
    }

    // Обработка зелий
    if (item.type === 'potion' && item.healAmount) {
      const healed = game.player.heal(item.healAmount);
      game.player.removeItem(item.globalId);
      return `Вы выпили ${game.colorize(item.name, 'item-name')}. Восстановлено ${healed} HP.`;
    }

    return `Вы не знаете, как использовать ${game.colorize(item.name, 'item-name')}.`;
  }
};