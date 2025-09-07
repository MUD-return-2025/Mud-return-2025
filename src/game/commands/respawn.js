export default {
  name: 'respawn',
  aliases: ['возродиться'],
  description: 'возродиться после смерти',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandParser').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    if (game.player.state !== 'dead') {
      return 'Вы и так живы.';
    }

    // Восстанавливаем состояние игрока
    game.player.hitPoints = game.player.maxHitPoints;
    game.player.state = 'idle';

    // Перемещаем в стартовую локацию или в место смерти
    let respawnRoomId;
    if ((cmd.target === 'here' || cmd.target === 'здесь') && game.player.deathRoom) {
      respawnRoomId = game.player.deathRoom;
    } else {
      respawnRoomId = 'midgard:center';
    }
    game.player.currentRoom = respawnRoomId;

    const respawnRoom = game.world.rooms.get(respawnRoomId);

    return game.colorize('Вы чувствуете, как жизнь возвращается в ваше тело. Мир вновь обретает краски.', 'player-respawn') + `\n\n` +
           respawnRoom.getFullDescription(game);
  }
};