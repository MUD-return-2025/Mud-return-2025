export default {
  name: 'list',
  aliases: ['список'],
  description: 'посмотреть товары торговца',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandManager').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    const npc = game._getTraderInCurrentRoom();
    if (!npc) {
      return 'Здесь нет торговцев.';
    }

    const shopItems = npc.getShopItems();

    if (shopItems.length === 0) {
      return `${game.colorize(npc.name, 'npc-name npc-friendly')} говорит: "Извините, товар закончился."`;
    }

    let result = `${game.colorize(npc.name, `npc-name npc-${npc.type}`)} предлагает:\n`;
    shopItems.forEach((localItemId, index) => {
      const item = game.getItem(localItemId, npc.area);
      if (item) {
        result += `${index + 1}. ${game.colorize(item.name, 'item-name')} - ${item.value || 'N/A'} золота\n`;
      }
    });

    result += '\nИспользуйте "buy <название>" для покупки.';
    return result;
  }
};