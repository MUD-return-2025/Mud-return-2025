export default {
  name: 'recall',
  aliases: ['возврат'],
  description: 'мгновенно вернуться в центр Мидгарда (умение)',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandManager').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    const skillId = 'recall';
    if (!game.player.hasSkill(skillId)) {
      return "Вы не знаете этого умения.";
    }

    const skillData = game.skillsData.get(skillId);
    if (!skillData) {
      return "Информация об умении не найдена.";
    }

    // Проверка состояния игрока
    if (game.player.state === 'fighting') {
      return 'Вы не можете сделать это во время боя!';
    }
    if (game.player.state === 'dead') {
      return 'Вы мертвы и не можете использовать эту команду.';
    }
    
    // Проверка перезарядки
    if (game.player.skillCooldowns[skillId] > 0) {
      return `Умение "${skillData.name}" еще перезаряжается. Осталось: ${game.player.skillCooldowns[skillId]} сек.`;
    }

    // Проверка стоимости
    if (game.player.stamina < skillData.cost) {
      return `Недостаточно выносливости для "${skillData.name}". Нужно: ${skillData.cost}, у вас: ${game.player.stamina}.`;
    }

    game.player.stamina -= skillData.cost;
    game.player.skillCooldowns[skillId] = skillData.cooldown;

    const targetRoomId = 'midgard:center';
    game.player.currentRoom = targetRoomId;
    const recallRoom = game.world.rooms.get(targetRoomId);

    return game.colorize(`Вы концентрируетесь и произносите слова возврата. Мир вокруг вас расплывается... (потрачено ${skillData.cost} выносливости)`, 'combat-exp-gain') + `\n\n` + recallRoom.getFullDescription(game);
  }
};