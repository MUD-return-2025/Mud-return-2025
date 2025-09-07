export default {
  name: 'consider',
  aliases: ['con'],
  description: 'оценить предмет или противника',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandParser').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    if (!cmd.target) {
      return 'Что вы хотите оценить? (consider <предмет/нпс>)';
    }

    const target = cmd.target.toLowerCase();
    const currentRoom = game.getCurrentRoom();

    // 1. Проверяем предмет в инвентаре
    let item = game.player.findItem(target);
    if (item) {
      return game._getConsiderItemString(item);
    }

    // 2. Проверяем предмет в комнате
    const globalItemId = currentRoom.findItem(target, game);
    if (globalItemId) {
      item = game.world.items.get(globalItemId);
      return game._getConsiderItemString(item);
    }

    // 3. Проверяем предмет у торговца
    item = game._findItemInTraderShop(target);
    if (item) {
      return game._getConsiderItemString(item);
    }

    // 4. Проверяем NPC в комнате
    const [currentAreaId] = game.world.parseGlobalId(game.player.currentRoom);
    const npcId = currentRoom.findNpc(target, game, currentAreaId);
    if (npcId) {
      const npc = game.getNpc(npcId, currentAreaId);
      return game._getConsiderNpcString(npc);
    }

    return `Вы не видите "${cmd.target}" здесь.`;
  }
};