/**
 * Утилита для разбора строки урона (например, "1d6+2")
 * и выполнения операций с ней.
 */
export class DamageParser {
  /**
   * @param {string} damageString - Строка урона.
   */
  constructor(damageString) {
    this.diceCount = 0;
    this.diceSize = 0;
    this.modifier = 0;

    if (!damageString) return;

    const match = damageString.match(/(\d+)d(\d+)(?:([+-])(\d+))?/);
    if (match) {
      const [, diceCountStr, diceSizeStr, operator, modifierStr] = match;
      this.diceCount = parseInt(diceCountStr, 10);
      this.diceSize = parseInt(diceSizeStr, 10);
      this.modifier = (operator && modifierStr) ? (operator === '+' ? parseInt(modifierStr, 10) : -parseInt(modifierStr, 10)) : 0;
    } else {
      // Если не удалось распарсить, считаем это фиксированным уроном
      this.modifier = parseInt(damageString, 10) || 1;
    }
  }

  /**
   * Бросает кубики и возвращает итоговый урон.
   * @returns {number}
   */
  roll() {
    let total = 0;
    for (let i = 0; i < this.diceCount; i++) {
      total += Math.floor(Math.random() * this.diceSize) + 1;
    }
    return Math.max(1, total + this.modifier);
  }

  /**
   * Рассчитывает средний урон.
   * @returns {number}
   */
  avg() {
    const avgDiceRoll = this.diceCount * (this.diceSize / 2 + 0.5);
    return avgDiceRoll + this.modifier;
  }
}
