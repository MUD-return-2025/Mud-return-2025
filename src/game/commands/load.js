export default {
  name: 'load',
  aliases: ['загрузить'],
  description: 'загрузить игру',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandParser').ParsedCommand} cmd
   * @returns {Promise<string>}
   */
  async execute(game, cmd) {
    try {
      const loaded = await game.loadGame();
      if (loaded) {
        const currentRoom = game.getCurrentRoom();
        return `Игра загружена.\n\n${currentRoom.getFullDescription(game)}`;
      } else {
        return 'Сохранение не найдено.';
      }
    } catch (error) {
      console.error('Ошибка в cmdLoad:', error);
      return 'Ошибка загрузки игры.';
    }
  }
};