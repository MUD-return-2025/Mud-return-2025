import { DamageParser } from '../utils/damageParser.js';

/**
 * @class ConsiderationManager
 * @description Управляет логикой оценки предметов и NPC.
 */
export class ConsiderationManager {
  /**
   * @param {import('../GameEngine').GameEngine} game - Экземпляр игрового движка.
   */
  constructor(game) {
    this.game = game;
  }

  /**
   * Оценивает предмет или NPC по имени.
   * @param {string} targetName - Имя цели.
   * @returns {string} Результат оценки.
   */
  consider(targetName) {
    if (!targetName) {
      return 'Что вы хотите оценить? (consider <предмет/нпс>)';
    }

    const target = targetName.toLowerCase();
    const currentRoom = this.game.getCurrentRoom();

    // 1. Проверяем предмет в инвентаре
    let item = this.game.player.findItem(target);
    if (item) return this._getConsiderItemString(item);

    // 2. Проверяем предмет в комнате
    const globalItemId = currentRoom.findItem(target, this.game);
    if (globalItemId) {
      item = this.game.world.items.get(globalItemId);
      return this._getConsiderItemString(item);
    }

    // 3. Проверяем предмет у торговца
    item = this.game._findItemInTraderShop(target);
    if (item) return this._getConsiderItemString(item);

    // 4. Проверяем NPC в комнате
    const [currentAreaId] = this.game.world.parseGlobalId(this.game.player.currentRoom);
    const npcId = currentRoom.findNpc(target, this.game, currentAreaId);
    if (npcId) {
      const npc = this.game.getNpc(npcId, currentAreaId);
      return this._getConsiderNpcString(npc);
    }

    return `Вы не видите "${targetName}" здесь.`;
  }

  /**
   * Формирует строку с описанием и сравнением предмета.
   * @param {object} item - Предмет для оценки.
   * @returns {string}
   * @private
   */
  _getConsiderItemString(item) {
    const c = this.game.colorize;
    const header = c(`---[ Оценка: ${item.name} ]--------`, 'room-name');
    const footer = c('------------------------------------', 'room-name');

    const lines = [
      c(item.description, 'npc-neutral'),
      '',
      c('Характеристики:', 'exit-name')
    ];

    if (item.type) lines.push(`  Тип: ${c(item.type, 'item-name')}`);
    if (item.damage) lines.push(`  ⚔️ Урон: ${c(item.damage, 'combat-player-attack')}`);
    if (item.armor) lines.push(`  🛡️ Защита: ${c(item.armor, 'combat-exp-gain')}`);
    if (item.healAmount) lines.push(`  ❤️ Лечение: ${c(item.healAmount, 'combat-exp-gain')}`);
    if (item.weight) lines.push(`  ⚖️ Вес: ${c(item.weight, 'npc-neutral')}`);
    if (item.value) lines.push(`  💰 Ценность: ${c(item.value, 'exit-name')} золота`);

    let result = [header, ...lines].join('\n');
    
    if (item.type === 'weapon') {
      result += this.game._compareEquipment(item, this.game.player.equippedWeapon, 'Оружие');
    } else if (item.type === 'armor') {
      result += this.game._compareEquipment(item, this.game.player.equippedArmor, 'Броня');
    }
    
    result += `\n${footer}`;
    return result;
  }

  /**
   * Оценивает шансы на победу в бою с NPC.
   * @param {import('./NPC').NPC} npc - Противник.
   * @returns {string}
   * @private
   */
  _getConsiderNpcString(npc) {
    const c = this.game.colorize;
    const header = c(`---[ Оценка: ${npc.name} ]--------`, 'room-name');
    const footer = c('------------------------------------', 'room-name');

    const lines = [
      c(npc.description, 'npc-neutral'),
      '',
      c('Оценка сил:', 'exit-name')
    ];

    const playerHp = this.game.player.hitPoints;
    const playerAvgDamage = this.game._calculateAvgPlayerDamage();
    const npcHp = npc.hitPoints;
    const npcAvgDamage = new DamageParser(npc.damage).avg();

    if (playerAvgDamage <= 0) return [header, ...lines, '  Вы не можете нанести урон.', footer].join('\n');
    if (npcAvgDamage <= 0) return [header, ...lines, `  Противник не может нанести урон. ${c('Легкая победа', 'combat-exp-gain')}.`, footer].join('\n');

    const roundsToKillNpc = Math.ceil(npcHp / playerAvgDamage);
    const roundsToKillPlayer = Math.ceil(playerHp / npcAvgDamage);

    lines.push(`  Ваш урон/раунд (средний): ${c(playerAvgDamage.toFixed(1), 'combat-player-attack')}`);
    lines.push(`  Урон врага/раунд (средний): ${c(npcAvgDamage.toFixed(1), 'combat-npc-attack')}`);
    lines.push(`  Раундов до победы: ~${c(roundsToKillNpc, 'combat-player-attack')}`);
    lines.push(`  Раундов до поражения: ~${c(roundsToKillPlayer, 'combat-npc-attack')}`);

    const ratio = roundsToKillPlayer / roundsToKillNpc;
    let conclusion = '';
    let conclusionColor = 'npc-neutral';

    if (ratio > 2.5) { conclusion = 'Легкая победа.'; conclusionColor = 'combat-exp-gain'; }
    else if (ratio > 1.5) { conclusion = 'Скорее всего, вы победите.'; conclusionColor = 'exit-name'; }
    else if (ratio >= 0.9) { conclusion = 'Тяжелый бой, шансы равны.'; conclusionColor = 'combat-player-attack'; }
    else if (ratio > 0.6) { conclusion = 'Очень опасно, скорее всего, вы проиграете.'; conclusionColor = 'combat-npc-attack'; }
    else { conclusion = 'Бегите! У вас нет шансов.'; conclusionColor = 'combat-player-death'; }

    lines.push(`\n${c('Вердикт:', 'exit-name')} ${c(conclusion, conclusionColor)}`);
    return [header, ...lines, footer].join('\n');
  }
}