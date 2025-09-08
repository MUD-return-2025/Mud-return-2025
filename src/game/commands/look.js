export default {
  name: 'look',
  aliases: ['л', 'смотреть', 'осмотреть'],
  description: 'осмотреться вокруг или изучить предмет/НПС',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandManager').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    if (game.player.state === 'dead') {
      return game.colorize(
        'Вы бестелесный дух, парящий над своим телом.\nМир вокруг кажется серым и размытым. Вы можете только \'respawn\' (возродиться).',
        'player-dead-look'
      );
    }
    const currentRoom = game.getCurrentRoom();

    if (!cmd.target) {
      // Осматриваем локацию
      return currentRoom.getFullDescription(game);
    }

    // Осматриваем конкретный предмет или НПС
    const target = cmd.target.toLowerCase();

    // Ищем среди предметов в комнате
    const globalItemId = currentRoom.findItem(target, game);
    if (globalItemId) {
      const item = game.world.items.get(globalItemId);
      return item.description + (item.readText ? `\n\nНа ${game.colorize(item.name, 'item-name')} написано: "${item.readText}"` : '');
    }

    // Ищем среди предметов в инвентаре
    const inventoryItem = game.player.findItem(target);
    if (inventoryItem) {
      return inventoryItem.description;
    }

    // Ищем в товарах торговца
    const traderItem = game._findItemInTraderShop(target);
    if (traderItem) {
      return traderItem.description + (traderItem.readText ? `\n\nНа ${game.colorize(traderItem.name, 'item-name')} написано: "${traderItem.readText}"` : '');
    }

    // Ищем среди НПС
    const [currentAreaId] = game.world.parseGlobalId(game.player.currentRoom);
    const npcIdInRoom = currentRoom.findNpc(target, game, currentAreaId);
    if (npcIdInRoom) {
      const npc = game.getNpc(npcIdInRoom, currentAreaId);
      return npc.description + (npc.hitPoints <= 0 ? game.colorize(' (мертв)', 'npc-dead') : '');
    }

    return `Вы не видите "${cmd.target}" здесь.`;
  }
};
