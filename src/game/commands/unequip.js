export default {
  name: 'unequip',
  aliases: ['снять'],
  description: 'снять экипированный предмет',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandManager').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    if (!cmd.target) {
      return 'Что вы хотите снять? (weapon/armor)';
    }

    const target = cmd.target.toLowerCase();
    if (target.includes('weapon') || target.includes('оружие')) {
      return game.player.unequipWeapon();
    } else if (target.includes('armor') || target.includes('броня')) {
      return game.player.unequipArmor();
    } else {
      return 'Укажите "weapon" или "armor" для снятия экипировки.';
    }
  }
};