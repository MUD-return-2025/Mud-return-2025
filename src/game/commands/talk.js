export default {
  name: 'talk',
  aliases: ['поговорить'],
  description: 'поговорить с конкретным НПС',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandManager').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    if (!cmd.target) {
      return 'С кем вы хотите поговорить?';
    }

    const [currentAreaId] = game.world.parseGlobalId(game.player.currentRoom);
    const currentRoom = game.getCurrentRoom();
    const target = cmd.target.toLowerCase();

    const npcId = currentRoom.findNpc(target, game, currentAreaId);
    if (!npcId) {
      return `Здесь нет никого по имени "${cmd.target}".`;
    }
    const npc = game.getNpc(npcId, currentAreaId);
    return npc.speak(game);
  }
};