export default {
  name: 'buy',
  aliases: ['купить'],
  description: 'купить товар у торговца',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandManager').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    if (!cmd.target) {
      return 'Что вы хотите купить?';
    }

    const currentRoom = game.getCurrentRoom();
    const npc = game._getTraderInCurrentRoom(); // Используем существующий метод в GameEngine
    if (!npc) {
      return 'Здесь нет торговцев.';
    }

    const target = cmd.target.toLowerCase();

    // Ищем товар в магазине
    // Используем хелпер из движка для поиска предмета в магазине
    const itemToBuy = game._findItemInTraderShop(target);

    if (!itemToBuy) {
      return `${game.colorize(npc.name, `npc-name npc-${npc.type}`)} говорит: "У меня нет такого товара."`;
    }

    // Создаем новый экземпляр предмета, чтобы не было проблем с мутацией оригинала
    const item = { ...itemToBuy, globalId: game.world.getGlobalId(itemToBuy.id, itemToBuy.area) };

    // Проверяем, может ли игрок нести предмет
    if (!game.player.canCarry(item)) {
      return `${game.colorize(npc.name, 'npc-name npc-friendly')} говорит: "Этот товар слишком тяжел для вас."`;
    }

    // В упрощенной версии покупка бесплатная
    game.player.addItem(item);
    return `${game.colorize(npc.name, 'npc-name npc-friendly')} говорит: "Вот ваш ${game.colorize(item.name, 'item-name')}. Пользуйтесь на здоровье!"`;
  }
};