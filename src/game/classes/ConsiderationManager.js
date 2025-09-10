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
      result += this._compareEquipment(item, this.game.player.equippedWeapon, 'Оружие');
    } else if (item.type === 'armor') {
      result += this._compareEquipment(item, this.game.player.equippedArmor, 'Броня');
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

  /**
   * Сравнивает два предмета экипировки.
   * @param {object} newItem - Новый предмет.
   * @param {object} equippedItem - Надетый предмет.
   * @param {string} itemTypeName - Название типа предмета (Оружие/Броня).
   * @returns {string}
   * @private
   */
  _compareEquipment(newItem, equippedItem, itemTypeName) {
    const c = this.game.colorize;
    if (!equippedItem) {
      return `\n\n${c('Сравнение:', 'exit-name')}\n  У вас не надето: ${itemTypeName}.`;
    }

    let comparison = `\n\n${c('Сравнение с надетым', 'exit-name')} (${c(equippedItem.name, 'item-name')}):\n`;
    let better = 0;
    let worse = 0;
    
    const compareStat = (name, newItemStat, equippedItemStat, lowerIsBetter = false) => {
      if (newItemStat === equippedItemStat) return `  ${name}: ${newItemStat.toFixed(1)} (=)\n`;
      
      const isBetter = lowerIsBetter ? newItemStat < equippedItemStat : newItemStat > equippedItemStat;
      const diff = newItemStat - equippedItemStat;
      const diffStr = diff > 0 ? `+${diff.toFixed(1)}` : `${diff.toFixed(1)}`;

      if (isBetter) {
        better++;
        return `  ${name}: ${newItemStat.toFixed(1)} (${c(diffStr, 'combat-exp-gain')})\n`;
      } else {
        worse++;
        return `  ${name}: ${newItemStat.toFixed(1)} (${c(diffStr, 'combat-npc-death')})\n`;
      }
    };

    if (newItem.type === 'weapon') {
      const newItemDamage = new DamageParser(newItem.damage).avg();
      const equippedItemDamage = new DamageParser(equippedItem.damage).avg();
      comparison += compareStat('Средний урон', newItemDamage, equippedItemDamage);
    }    
    if (newItem.type === 'armor') {
      comparison += compareStat('Защита', newItem.armor || 0, equippedItem.armor || 0);
    }

    comparison += compareStat('Вес', newItem.weight || 0, equippedItem.weight || 0, true);
    comparison += `  Ценность: ${newItem.value || 0} (=)\n`;

    if (better > worse) {
      comparison += `\n${c('Вердикт:', 'exit-name')} В целом, это ${c('лучше', 'combat-exp-gain')}, чем то, что на вас надето.`;
    } else if (worse > better) {
      comparison += `\n${c('Вердикт:', 'exit-name')} В целом, это ${c('хуже', 'combat-npc-death')}, чем то, что на вас надето.`;
    } else {
      comparison += `\n${c('Вердикт:', 'exit-name')} В целом, они примерно одинаковы.`;
    }

    return comparison;
  }
}