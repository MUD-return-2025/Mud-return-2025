export default {
  name: 'buy',
  aliases: ['купить'],
  description: 'купить товар у торговца',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandParser').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    if (!cmd.target) {
      return 'Что вы хотите купить?';
    }

    const npc = game._getTraderInCurrentRoom();
    if (!npc) {
      return 'Здесь нет торговцев.';
    }

    const shopItems = npc.getShopItems();
    const target = cmd.target.toLowerCase();

    // Ищем товар в магазине
    const localItemId = shopItems.find(id => {
      const item = game.getItem(id, npc.area);
      return item && item.name.toLowerCase().includes(target);
    });

    if (!localItemId) {
      return `${game.colorize(npc.name, `npc-name npc-${npc.type}`)} говорит: "У меня нет такого товара."`;
    }

    const item = game.getItem(localItemId, npc.area);

    // Проверяем, может ли игрок нести предмет
    if (!game.player.canCarry(item)) {
      return `${game.colorize(npc.name, 'npc-name npc-friendly')} говорит: "Этот товар слишком тяжел для вас."`;
    }

    // В упрощенной версии покупка бесплатная
    game.player.addItem({ ...item, globalId: game._getGlobalId(item.id, item.area) });
    return `${game.colorize(npc.name, 'npc-name npc-friendly')} говорит: "Вот ваш ${game.colorize(item.name, 'item-name')}. Пользуйтесь на здоровье!"`;
  }
};