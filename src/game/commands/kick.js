export default {
  name: 'kick',
  aliases: ['пнуть'],
  description: 'пнуть противника',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandParser').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    if (!game.player.hasSkill('kick')) {
      return "Вы не знаете этого умения.";
    }

    // Если не в бою, начинаем бой с пинка
    if (game.player.state !== 'fighting') {
      if (!cmd.target) {
        return 'Кого вы хотите пнуть?';
      }

      const [currentAreaId] = game._parseGlobalId(game.player.currentRoom);
      const currentRoom = game.getCurrentRoom();
      const target = cmd.target.toLowerCase();

      const npcId = currentRoom.findNpc(target, game, currentAreaId);
      if (!npcId) {
        return `Здесь нет "${cmd.target}" для атаки.`;
      }
      const npc = game.getNpc(npcId, currentAreaId);

      if (npc.type === 'friendly') {
        return `${game.colorize(npc.name, `npc-name npc-${npc.type}`)} дружелюбен к вам. Вы не можете атаковать.`;
      }
      
      // Устанавливаем, что первая атака будет умением
      game.player.nextAttackIsSkill = 'kick';
      
      // Начинаем бой
      game.startCombat(npc);
      
      return ''; // Сообщения обрабатываются через emit
    }

    // Если уже в бою, используем умение в следующем раунде
    if (game.player.skillUsedThisRound) {
      return "Вы уже использовали умение в этом раунде.";
    }

    game.player.nextAttackIsSkill = 'kick';
    game.player.skillUsedThisRound = true;
    const npc = game.npcs.get(game.combatTarget);
    return `Вы готовитесь пнуть ${game.colorize(npc.name, `npc-name npc-${npc.type}`)}.`;
  }
};