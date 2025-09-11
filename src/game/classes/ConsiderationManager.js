import { DamageParser } from '../utils/damageParser.js';

/**
 * Конфигурация для оценки NPC. Пороги проверяются сверху вниз.
 */
const NPC_CONSIDER_THRESHOLDS = [
  { threshold: 2.5, text: 'Легкая победа.', color: 'combat-exp-gain' },
  { threshold: 1.5, text: 'Скорее всего, вы победите.', color: 'exit-name' },
  { threshold: 0.9, text: 'Тяжелый бой, шансы равны.', color: 'combat-player-attack' },
  { threshold: 0.6, text: 'Очень опасно, скорее всего, вы проиграете.', color: 'combat-npc-attack' },
  { threshold: 0, text: 'Бегите! У вас нет шансов.', color: 'combat-player-death' },
];

/**
 * Тексты и цвета для вердиктов сравнения экипировки.
 */
const EQUIPMENT_COMPARE_VERDICTS = {
  better: { text: 'лучше', color: 'combat-exp-gain' },
  worse: { text: 'хуже', color: 'combat-npc-death' },
  equal: { text: 'В целом, они примерно одинаковы.' },
};

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

    const foundTarget = this.game.findTargetByName(targetName);

    if (!foundTarget) {
      return `Вы не видите "${targetName}" здесь.`;
    }

    switch (foundTarget.type) {
      case 'item':
        return this._getConsiderItemString(foundTarget.entity);
      case 'npc':
        return this._getConsiderNpcString(foundTarget.entity);
      default:
        return `Вы не видите "${targetName}" здесь.`;
    }
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
    
    // Находим подходящий вердикт в конфигурации
    const verdict = NPC_CONSIDER_THRESHOLDS.find(v => ratio >= v.threshold) 
      || NPC_CONSIDER_THRESHOLDS[NPC_CONSIDER_THRESHOLDS.length - 1];

    lines.push(`\n${c('Вердикт:', 'exit-name')} ${c(verdict.text, verdict.color)}`);

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

    if (newItem.damage && equippedItem.damage) {
      const newItemDamage = new DamageParser(newItem.damage).avg();
      const equippedItemDamage = new DamageParser(equippedItem.damage).avg();
      comparison += compareStat('Средний урон', newItemDamage, equippedItemDamage);
    }
    if (newItem.armor != null && equippedItem.armor != null) {
      comparison += compareStat('Защита', newItem.armor || 0, equippedItem.armor || 0);
    }

    comparison += compareStat('Вес', newItem.weight || 0, equippedItem.weight || 0, true);
    comparison += `  Ценность: ${newItem.value || 0} (=)\n`;

    if (better > worse) {
      const { text, color } = EQUIPMENT_COMPARE_VERDICTS.better;
      comparison += `\n${c('Вердикт:', 'exit-name')} В целом, это ${c(text, color)}, чем то, что на вас надето.`;
    } else if (worse > better) {
      const { text, color } = EQUIPMENT_COMPARE_VERDICTS.worse;
      comparison += `\n${c('Вердикт:', 'exit-name')} В целом, это ${c(text, color)}, чем то, что на вас надето.`;
    } else {
      const { text } = EQUIPMENT_COMPARE_VERDICTS.equal;
      comparison += `\n${c('Вердикт:', 'exit-name')} ${text}`;
    }

    return comparison;
  }
}