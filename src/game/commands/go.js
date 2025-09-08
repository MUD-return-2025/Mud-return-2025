export default {
  name: 'go',
  aliases: ['идти', 'иди'],
  description: 'идти в указанном направлении (север/юг/восток/запад)',
  // Специальные алиасы, которые преобразуются в команду с аргументом
  shortcuts: {
    'с': 'север',
    'ю': 'юг',
    'в': 'восток',
    'з': 'запад',
    'север': 'север',
    'юг': 'юг',
    'восток': 'восток',
    'запад': 'запад',
  },

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandManager').ParsedCommand} cmd
   * @returns {Promise<string>}
   */
  async execute(game, cmd) {
    if (!cmd.target) {
      return 'Куда вы хотите пойти? Используйте: go <направление>';
    }

    const currentRoom = game.getCurrentRoom();
    const direction = cmd.target.toLowerCase();
    const exit = currentRoom.getExit(direction);

    if (!exit) {
      return `Вы не можете пойти ${direction} отсюда.`;
    }

    const targetRoomId = (typeof exit === 'object')
      ? game.world.getGlobalId(exit.room, exit.area)
      : game.world.getGlobalId(exit, currentRoom.area);

    const result = await game.moveToRoom(targetRoomId, direction);

    return result.message;
  }
};