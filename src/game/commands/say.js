export default {
  name: 'say',
  aliases: ['говорить', 'сказать'],
  description: 'сказать что-либо вслух',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandParser').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    if (!cmd.target) {
      return 'Что вы хотите сказать?';
    }

    const currentRoom = game.getCurrentRoom();
    let result = game.colorize(`Вы говорите: "${cmd.target}"`, 'player-speech') + '\n\n';

    // Все НПС в локации реагируют
    const responses = [];
    const [currentAreaId] = game.world.parseGlobalId(game.player.currentRoom);
    currentRoom.npcs.forEach(localNpcId => {
      const npc = game.getNpc(localNpcId, currentAreaId);
      if (npc?.isAlive()) {
        responses.push(npc.speak(game));
      }
    });

    if (responses.length > 0) {
      result += responses.join('\n');
    } else {
      result += 'Никто не отвечает.';
    }

    return result;
  }
};