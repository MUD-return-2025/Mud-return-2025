/**
 * Парсер и обработчик игровых команд.
 * Преобразует текстовый ввод в игровые действия, поддерживает алиасы.
 */
export class CommandParser {
  /**
   * Создает экземпляр CommandParser.
   */
  constructor() {
    /**
     * @type {Map<string, {handler: Function, description: string, aliases: string[]}>}
     * @description Карта зарегистрированных команд.
     * Ключ - название команды, значение - объект с обработчиком, описанием и алиасами.
     */
    this.commands = new Map();
    /**
     * @type {Map<string, string>}
     * @description Карта алиасов для команд.
     * Ключ - алиас, значение - полная команда (например, 'л' -> 'look').
     */
    this.aliases = new Map();
    // Регистрация команд теперь происходит в GameEngine
  }

  /**
   * Парсит текстовую команду, преобразуя ее в структурированный объект.
   * Учитывает алиасы, в том числе составные (например, "идти север").
   * @param {string} input - Ввод пользователя.
   * @returns {{command: string, args: string[], target: string, original: string}} Объект команды.
   */
  parseCommand(input) {
    if (!input || typeof input !== 'string') {
      return { command: '', args: [], target: '', original: '' };
    }

    const parts = input.trim().toLowerCase().split(/\s+/);
    let command = parts[0];
    const args = parts.slice(1);

    // Проверяем, является ли введенная команда алиасом.
    const alias = this.aliases.get(command);
    if (alias) {
      // Если алиас содержит пробел (например, "go north"), разбираем его на команду и аргументы.
      if (alias.includes(' ')) {
        const aliasParts = alias.split(' ');
        command = aliasParts[0];
        // Добавляем аргументы из алиаса в начало списка аргументов.
        args.unshift(...aliasParts.slice(1));
      } else {
        command = alias;
      }
    }

    return {
      command,
      args,
      // Объединяем аргументы в одну строку для удобной работы с многословными целями.
      target: args.join(' '),
      original: input.trim()
    };
  }

  /**
   * Регистрирует обработчик команды с описанием и алиасами.
   * @param {string} name - Название команды.
   * @param {Function} handler - Функция-обработчик, принимающая (game, parsedCommand).
   * @param {string} [description=''] - Описание команды для справки.
   * @param {string[]} [aliases=[]] - Массив алиасов для отображения в справке.
   */
  registerCommand(name, handler, description = '', aliases = []) {
    this.commands.set(name, {
      handler: handler,
      description: description,
      aliases: aliases
    });
    // Регистрируем алиасы, чтобы они указывали на основное имя команды
    if (aliases) {
      aliases.forEach(alias => this.aliases.set(alias, name));
    }
  }

  /**
   * Генерирует текст справки на основе зарегистрированных команд.
   * @returns {string} Отформатированный текст справки.
   */
  generateHelp() {
    let helpText = '=== СПРАВКА ===\n';
    
    // Сортируем команды по алфавиту для стабильного и удобного вывода.
    const sortedCommands = Array.from(this.commands.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    
    for (const [commandName, commandData] of sortedCommands) {
      if (commandData.description) {
        let line = `• ${commandName}`;
        
        // Добавляем алиасы, если они есть, для полноты информации.
        if (commandData.aliases && commandData.aliases.length > 0) {
          line += ` (${commandData.aliases.join(', ')})`;
        }
        
        line += ` - ${commandData.description}`;
        helpText += line + '\n';
      }
    }
    
    return helpText;
  }

  /**
   * Выполняет распарсенную команду, вызывая соответствующий обработчик.
   * @param {Object} parsedCommand - Результат `parseCommand`.
   * @param {import('../GameEngine').GameEngine} game - Ссылка на игровой движок для передачи в обработчик.
   * @returns {string} Результат выполнения команды.
   */
  async executeCommand(parsedCommand, game) {
    const commandData = this.commands.get(parsedCommand.command);

    if (commandData) {
      try {
        const handler = commandData.handler;
        return await handler(game, parsedCommand);
      } catch (error) {
        console.error(`Ошибка выполнения команды "${parsedCommand.command}":`, error);
        return 'Произошла ошибка при выполнении команды.';
      }
    }

    return this.getUnknownCommandMessage(parsedCommand.command);
  }

  /**
   * Возвращает сообщение о неизвестной команде с подсказками.
   * @param {string} command - Неизвестная команда.
   * @returns {string} Сообщение с подсказками.
   */
  getUnknownCommandMessage(command) {
    const helpText = this.generateHelp().replace('=== СПРАВКА ===', 'Доступные команды:');
    return `Неизвестная команда: "${command}"\n${helpText}`;
  }

  /**
   * Проверяет, является ли введенная строка валидной командой (или ее алиасом).
   * @param {string} input - Ввод игрока.
   * @returns {boolean} `true`, если команда существует.
   */
  isValidCommand(input) {
    const parsed = this.parseCommand(input);
    return this.commands.has(parsed.command);
  }
}
