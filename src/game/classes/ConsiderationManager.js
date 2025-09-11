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
      return this.game.formatter.format('consider.general.prompt');
    }

    const foundTarget = this.game.findTargetByName(targetName);

    if (!foundTarget) {
      return this.game.formatter.format('consider.general.notFound', { targetName });
    }

    switch (foundTarget.type) {
      case 'item':
        return this._getConsiderItemString(foundTarget.entity, this.game.formatter);
      case 'npc':
        return this._getConsiderNpcString(foundTarget.entity);
      default:
        return `Вы не видите "${targetName}" здесь.`;
    }
  }

  /**
   * Формирует строку с описанием и сравнением предмета.
   * @param {object} item - Предмет для оценки.
   * @param {import('../utils/MessageFormatter').MessageFormatter} t - Экземпляр форматера.
   * @returns {string}
   * @private
   */
  _getConsiderItemString(item, t) {
    const header = t.format('consider.item.header', { name: item.name });
    const footer = t.format('consider.item.footer');

    const lines = [
      this.game.colorize(item.description, 'npc-neutral'),
      '',
      t.format('consider.item.statsHeader')
    ];

    if (item.type) lines.push(t.format('consider.item.type', { type: item.type }));
    if (item.damage) lines.push(t.format('consider.item.damage', { damage: item.damage }));
    if (item.armor) lines.push(t.format('consider.item.armor', { armor: item.armor }));
    if (item.healAmount) lines.push(t.format('consider.item.healAmount', { healAmount: item.healAmount }));
    if (item.weight) lines.push(t.format('consider.item.weight', { weight: item.weight }));
    if (item.value) lines.push(t.format('consider.item.value', { value: item.value }));

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
    const t = this.game.formatter;
    const header = t.format('consider.npc.header', { name: npc.name });
    const footer = t.format('consider.npc.footer');

    const lines = [
      this.game.colorize(npc.description, 'npc-neutral'),
      '',
      t.format('consider.npc.statsHeader')
    ];

    const playerHp = this.game.player.hitPoints;
    const playerAvgDamage = this.game._calculateAvgPlayerDamage();
    const npcHp = npc.hitPoints;
    const npcAvgDamage = new DamageParser(npc.damage).avg();

    if (playerAvgDamage <= 0) return [header, ...lines, t.format('consider.npc.cantDamage'), footer].join('\n');
    if (npcAvgDamage <= 0) return [header, ...lines, t.format('consider.npc.npcCantDamage'), footer].join('\n');

    const roundsToKillNpc = Math.ceil(npcHp / playerAvgDamage);
    const roundsToKillPlayer = Math.ceil(playerHp / npcAvgDamage);

    lines.push(t.format('consider.npc.playerDamage', { damage: playerAvgDamage.toFixed(1) }));
    lines.push(t.format('consider.npc.npcDamage', { damage: npcAvgDamage.toFixed(1) }));
    lines.push(t.format('consider.npc.roundsToWin', { rounds: roundsToKillNpc }));
    lines.push(t.format('consider.npc.roundsToLose', { rounds: roundsToKillPlayer }));

    const ratio = roundsToKillPlayer / roundsToKillNpc;
    
    // Находим подходящий вердикт в конфигурации
    const verdict = NPC_CONSIDER_THRESHOLDS.find(v => ratio >= v.threshold) 
      || NPC_CONSIDER_THRESHOLDS[NPC_CONSIDER_THRESHOLDS.length - 1];

    const verdictText = this.game.colorize(verdict.text, verdict.color);
    lines.push(t.format('consider.npc.verdict', { verdictText }));

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
    const t = this.game.formatter;
    if (!equippedItem) {
      return t.format('consider.compare.noEquipped', { itemTypeName });
    }

    let comparison = t.format('consider.compare.header', { equippedItemName: equippedItem.name });
    let better = 0;
    let worse = 0;
    
    const compareStat = (name, newItemStat, equippedItemStat, lowerIsBetter = false) => {
      if (newItemStat === equippedItemStat) return `  ${name}: ${newItemStat.toFixed(1)} (=)\n`;
      
      const isBetter = lowerIsBetter ? newItemStat < equippedItemStat : newItemStat > equippedItemStat;
      const diff = newItemStat - equippedItemStat;
      const diffStr = diff > 0 ? `+${diff.toFixed(1)}` : `${diff.toFixed(1)}`;

      if (isBetter) {
        better++;
        const coloredDiff = this.game.colorize(diffStr, 'combat-exp-gain');
        return t.format('consider.compare.statLine', { name, newItemStat: newItemStat.toFixed(1), diffStr: coloredDiff });
      } else {
        worse++;
        const coloredDiff = this.game.colorize(diffStr, 'combat-npc-death');
        return t.format('consider.compare.statLine', { name, newItemStat: newItemStat.toFixed(1), diffStr: coloredDiff });
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
    comparison += t.format('consider.compare.statLine', { name: 'Ценность', newItemStat: newItem.value || 0, diffStr: '=' });

    if (better > worse) {
      const text = t.format('consider.compare.verdictBetter');
      comparison += t.format('consider.compare.verdict', { text });
    } else if (worse > better) {
      const text = t.format('consider.compare.verdictWorse');
      comparison += t.format('consider.compare.verdict', { text });
    } else {
      const text = t.format('consider.compare.verdictEqual');
      comparison += t.format('consider.compare.verdict', { text });
    }

    return comparison;
  }
}
