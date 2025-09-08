export default {
  name: 'sell',
  aliases: ['продать'],
  description: 'продать предмет торговцу',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandManager').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    if (!cmd.target) {
      return 'Что вы хотите продать?';
    }

    const npc = game._getTraderInCurrentRoom();
    if (!npc) {
      return 'Здесь нет торговцев.';
    }

    const item = game.player.findItem(cmd.target);
    if (!item) {
      return `У вас нет "${cmd.target}".`;
    }

    // Нельзя продать надетый предмет
    if (game.player.equippedWeapon?.globalId === item.globalId || game.player.equippedArmor?.globalId === item.globalId) {
      return `Вы не можете продать экипированный предмет. Сначала снимите его.`;
    }

    game.player.removeItem(item.globalId);

    const sellPrice = Math.floor((item.value || 0) / 2);
    game.player.gold += sellPrice;

    return `${game.colorize(npc.name, 'npc-name npc-friendly')} говорит: "Спасибо за ${game.colorize(item.name, 'item-name')}! Вот вам ${sellPrice} золота."`;
  }
};