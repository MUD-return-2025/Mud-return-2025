/**
 * @class CommandManager
 * @description Управляет регистрацией, парсингом и выполнением игровых команд.
 */
export class CommandManager {
  /**
   * @param {import('../GameEngine.js').GameEngine} game - Экземпляр игрового движка.
   */
  constructor(game) {
    this.game = game;
    /** @type {Map<string, {handler: Function, description: string, aliases: string[]}>} */
    this.commands = new Map();
    /** @type {Map<string, string>} */
    this.aliases = new Map();
  }

  /**
   * Регистрирует команду.
   * @param {string} name - Название команды.
   * @param {Function} handler - Функция-обработчик.
   * @param {string} [description=''] - Описание.
   * @param {string[]} [aliases=[]] - Псевдонимы.
   */
  register(name, handler, description = '', aliases = []) {
    this.commands.set(name, { handler, description, aliases });
    if (aliases) {
      aliases.forEach(alias => this.aliases.set(alias, name));
    }
  }

  /**
   * Регистрирует специальный псевдоним.
   * @param {string} alias - Псевдоним.
   * @param {string} fullCommand - Полная команда.
   */
  registerAlias(alias, fullCommand) {
    this.aliases.set(alias, fullCommand);
  }

  /**
   * Парсит и выполняет команду.
   * @param {string} input - Ввод пользователя.
   * @returns {Promise<string>} Результат выполнения.
   */
  async execute(input) {
    const parsed = this._parse(input);

    // Проверки состояния игрока
    if (this.game.player.state === 'dead' && parsed.command !== 'respawn') {
      return 'Вы мертвы. Используйте команду "respawn" для возрождения.';
    }

    const allowedCombatCommands = ['flee', 'look', 'inventory', 'stats', 'use', 'kick'];
    if (this.game.combatManager && !allowedCombatCommands.includes(parsed.command)) {
      return 'Вы не можете сделать это в бою! Попробуйте `flee` (сбежать).';
    }

    const commandData = this.commands.get(parsed.command);
    if (commandData) {
      try {
        return await commandData.handler(this.game, parsed);
      } catch (error) {
        console.error(`Ошибка выполнения команды "${parsed.command}":`, error);
        return 'Произошла ошибка при выполнении команды.';
      }
    }

    return `Неизвестная команда: "${parsed.command}"`;
  }

  /**
   * Парсит строку ввода.
   * @param {string} input - Ввод пользователя.
   * @returns {{command: string, args: string[], target: string, original: string}}
   * @private
   */
  _parse(input) {
    if (!input || typeof input !== 'string') {
      return { command: '', args: [], target: '', original: '' };
    }

    const parts = input.trim().toLowerCase().split(/\s+/);
    let command = parts[0];
    const args = parts.slice(1);

    const alias = this.aliases.get(command);
    if (alias) {
      if (alias.includes(' ')) {
        const aliasParts = alias.split(' ');
        command = aliasParts[0];
        args.unshift(...aliasParts.slice(1));
      } else {
        command = alias;
      }
    }

    return {
      command,
      args,
      target: args.join(' '),
      original: input.trim()
    };
  }

  /**
   * Генерирует список подсказок для автодополнения.
   * @param {string|null} command - Текущая команда.
   * @param {string} prefix - Префикс для поиска.
   * @returns {Array<{text: string, type: string}>}
   */
  getCommandSuggestions(command, prefix = '') {
    // Эта логика осталась в GameEngine, так как она сильно завязана на состояние мира.
    // В идеале, ее тоже можно было бы перенести сюда, передавая нужные данные.
    // Но для текущего рефакторинга оставим ее в движке.
    return this.game.getCommandSuggestions(command, prefix);
  }

  /**
   * Генерирует текст справки по всем командам.
   * @returns {string}
   */
  generateHelp() {
    let helpText = 'Доступные команды:\n';
    const commandList = [];
    const c = this.game.colorize;
    // Для красоты выровняем все команды по левому краю
    const maxCmdLength = Math.max(...Array.from(this.commands.keys()).map(cmd => cmd.length));

    this.commands.forEach((cmd, name) => {
      const coloredName = c(name, 'exit-name');
      const padding = ' '.repeat(maxCmdLength - name.length);
      const aliases = cmd.aliases.length > 0 ? ` (${c('синонимы', 'item-name')}: ${cmd.aliases.join(', ')})` : '';
      commandList.push(`  ${coloredName}${padding} - ${cmd.description}${aliases}`);
    });

    return helpText + commandList.join('\n');
  }
}
