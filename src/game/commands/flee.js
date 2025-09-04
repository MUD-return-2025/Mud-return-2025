export default {
  name: 'flee',
  aliases: ['сбежать'],
  description: 'сбежать из боя',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandParser').ParsedCommand} cmd
   * @returns {string}
   */
  async execute(game, cmd) {
    if (!game.combatManager) {
      return 'Вы не в бою.';
    }

    const currentRoom = game.getCurrentRoom();
    const exits = currentRoom.getExits();
    if (exits.length === 0) {
      return 'Некуда бежать!';
    }

    const npc = game.combatManager.npc;
    const fleeMessage = `Вы в панике сбегаете от ${game.colorize(npc.name, `npc-name npc-${npc.type}`)}.`;

    // Завершаем бой с флагом, что игрок сбежал
    game.combatManager.stop(true);

    // Выполняем перемещение в случайном направлении
    const randomExitDirection = exits[Math.floor(Math.random() * exits.length)];
    const exit = currentRoom.getExit(randomExitDirection);
    const targetRoomId = (typeof exit === 'object')
      ? game._getGlobalId(exit.room, exit.area)
      : game._getGlobalId(exit, currentRoom.area);

    const moveResult = await game.moveToRoom(targetRoomId, randomExitDirection);
    return `${fleeMessage}\n\n${moveResult.message}`;
  }
};