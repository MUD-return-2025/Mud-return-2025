export default {
  name: 'heal',
  aliases: ['исцелить'],
  description: 'исцелиться у жреца',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandManager').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    const currentRoom = game.getCurrentRoom();
    const [currentAreaId] = game.world.parseGlobalId(game.player.currentRoom);

    const priestId = currentRoom.npcs.find(localNpcId => {
      const npc = game.getNpc(localNpcId, currentAreaId);
      return npc && npc.isAlive() && npc.canHeal;
    });

    if (!priestId) {
      return 'Здесь нет никого, кто мог бы вас исцелить.';
    }

    const priest = game.getNpc(priestId, currentAreaId);

    if (game.player.hitPoints >= game.player.maxHitPoints) {
      return `${game.colorize(priest.name, 'npc-name npc-friendly')} говорит: "Вы и так полностью здоровы."`;
    }

    game.player.heal(game.player.maxHitPoints); // Полное исцеление
    return `${game.colorize(priest.name, 'npc-name npc-friendly')} исцелил ваши раны. Вы полностью здоровы.`;
  }
};