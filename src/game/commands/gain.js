export default {
  name: 'gain',
  aliases: ['получить'],
  description: 'увеличить характеристику для отладки (gain <стат> <число>)',

  /**
   * @param {import('../GameEngine').GameEngine} game
   * @param {import('../classes/CommandParser').ParsedCommand} cmd
   * @returns {string}
   */
  execute(game, cmd) {
    if (!cmd.target) {
      return 'Использование: gain <характеристика> <число>';
    }

    const args = cmd.target.split(/\s+/);
    if (args.length < 2) {
      return 'Использование: gain <характеристика> <число>';
    }

    const statName = args[0].toLowerCase();
    const amount = parseInt(args[1], 10);

    if (isNaN(amount)) {
      return 'Неверное число.';
    }

    const statMap = {
      'сила': 'strength', 'str': 'strength',
      'ловкость': 'dexterity', 'dex': 'dexterity',
      'телосложение': 'constitution', 'con': 'constitution',
      'интеллект': 'intelligence', 'int': 'intelligence',
      'мудрость': 'wisdom', 'wis': 'wisdom',
      'харизма': 'charisma', 'cha': 'charisma',
      'здоровье': 'hitPoints', 'hp': 'hitPoints', 'хп': 'hitPoints',
      'максхп': 'maxHitPoints', 'maxhp': 'maxHitPoints',
      'уровень': 'level', 'lvl': 'level', 'лвл': 'level',
      'опыт': 'experience', 'exp': 'experience',
    };

    const propName = statMap[statName];

    if (!propName) {
      return `Неизвестная характеристика: "${statName}".\nДоступные: ${Object.keys(statMap).join(', ')}.`;
    }

    const p = game.player;
    let message = '';

    switch (propName) {
      case 'experience': {
        const levelUpMessage = p.addExperience(amount);
        message = `Вы получили ${amount} опыта.`;
        if (levelUpMessage) {
          message += `\n${levelUpMessage.message}`;
          const newSkillMessage = game.checkAndAwardSkills();
          if (newSkillMessage) {
            message += `\n${newSkillMessage}`;
          }
        }
        break;
      }
      case 'level': {
        if (amount > 0) {
          for (let i = 0; i < amount; i++) {
            const levelUpMessage = p.levelUp();
            message += (message ? '\n' : '') + levelUpMessage.message;
          }
          const newSkillMessage = game.checkAndAwardSkills();
          if (newSkillMessage) {
            message += `\n${newSkillMessage}`;
          }
        } else {
          p.level = Math.max(1, p.level + amount);
        }
        if (!message) message = `Уровень изменен на ${amount}.`;
        break;
      }
      case 'hitPoints': {
        const oldHp = p.hitPoints;
        p.hitPoints = Math.max(0, Math.min(p.maxHitPoints, p.hitPoints + amount));
        const change = p.hitPoints - oldHp;
        message = `Здоровье изменено на ${change >= 0 ? '+' : ''}${change}. Текущее здоровье: ${p.hitPoints}/${p.maxHitPoints}.`;
        break;
      }
      case 'maxHitPoints':
        p.maxHitPoints += amount;
        p.hitPoints = Math.min(p.hitPoints, p.maxHitPoints); // Don't exceed new max
        message = `Максимальное здоровье изменено на ${amount}. Текущее здоровье: ${p.hitPoints}/${p.maxHitPoints}.`;
        break;
      default:
        // For strength, dexterity, etc.
        p[propName] += amount;
        message = `${game.colorize(Object.keys(statMap).find(key => statMap[key] === propName), 'item-name')} увеличена на ${amount}. Новое значение: ${p[propName]}.`;
        break;
    }

    return message;
  }
};
