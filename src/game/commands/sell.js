export default {
  name: 'sell',
  aliases: ['продать'],
  description: 'продать предмет торговцу',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandParser').ParsedCommand} cmd
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

    const sellPrice = Math.floor((item.value || 10) / 2);
    // В будущей реализации здесь будет добавлено золото игроку
    return `${game.colorize(npc.name, 'npc-name npc-friendly')} говорит: "Спасибо за ${game.colorize(item.name, 'item-name')}! Вот вам ${sellPrice} золота." (В этой версии золото пока не реализовано)`;
  }
};