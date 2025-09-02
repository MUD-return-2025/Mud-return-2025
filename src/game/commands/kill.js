export default {
  name: 'kill',
  aliases: ['убить', 'атаковать'],
  description: 'атаковать цель',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandParser').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    if (game.player.state === 'fighting') {
      return 'Вы уже в бою!';
    }

    if (!cmd.target) {
      return 'Кого вы хотите атаковать?';
    }

    const [currentAreaId] = game._parseGlobalId(game.player.currentRoom);
    const currentRoom = game.getCurrentRoom();
    const target = cmd.target.toLowerCase();

    // Ищем НПС в локации
    const npcId = currentRoom.findNpc(target, game, currentAreaId);
    if (!npcId) {
      return `Здесь нет "${cmd.target}" для атаки.`;
    }
    const npc = game.getNpc(npcId, currentAreaId);

    if (npc.type === 'friendly') {
      return `${game.colorize(npc.name, `npc-name npc-${npc.type}`)} дружелюбен к вам. Вы не можете атаковать.`;
    }

    // Используем новый метод для начала боя
    game.startCombat(npc);

    return ''; // Все сообщения теперь обрабатываются через события
  }
};