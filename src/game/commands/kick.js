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
    const skillId = 'kick';
    if (!game.player.hasSkill(skillId)) {
      return "Вы не знаете этого умения.";
    }

    const skillData = game.skillsData.get(skillId);
    if (!skillData) {
      return "Информация об умении не найдена.";
    }

    // Проверка перезарядки
    if (game.player.skillCooldowns[skillId] > 0) {
      return `Умение "${skillData.name}" еще перезаряжается. Осталось: ${game.player.skillCooldowns[skillId]} раунд(а).`;
    }

    // Проверка стоимости
    if (game.player.stamina < skillData.cost) {
      return `Недостаточно выносливости для "${skillData.name}". Нужно: ${skillData.cost}, у вас: ${game.player.stamina}.`;
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

      game.player.stamina -= skillData.cost;
      game.player.skillCooldowns[skillId] = skillData.cooldown;

      // Устанавливаем, что первая атака будет умением
      game.player.nextAttackIsSkill = skillId;

      // Начинаем бой
      game.startCombat(npc);

      return ''; // Сообщения обрабатываются через emit
    }

    // Если уже в бою, используем умение в следующем раунде
    if (game.player.skillUsedThisRound) {
      return "Вы уже использовали умение в этом раунде.";
    }

    game.player.stamina -= skillData.cost;
    game.player.skillCooldowns[skillId] = skillData.cooldown;
    game.player.nextAttackIsSkill = skillId;
    game.player.skillUsedThisRound = true;
    const npc = game.combatManager.npc;
    return `Вы готовитесь пнуть ${game.colorize(npc.name, `npc-name npc-${npc.type}`)}.`;
  }
};