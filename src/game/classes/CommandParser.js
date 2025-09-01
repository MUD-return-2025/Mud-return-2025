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
    this.initializeCommands();
  }

  /**
   * Инициализация базовых команд и их алиасов.
   * Этот метод заполняет карту `this.aliases` для быстрого доступа.
   */
  initializeCommands() {
    // Единый объект с алиасами для упрощения инициализации.
    const shortcuts = {
      'л': 'look',
      'смотреть': 'look',
      'осмотреть': 'look',
      'идти': 'go',
      'иди': 'go',
      'север': 'go north',
      'юг': 'go south',
      'восток': 'go east',
      'запад': 'go west',
      'взять': 'get',
      'бросить': 'drop',
      'инвентарь': 'inventory',
      'inv': 'inventory',
      'и': 'inventory',
      'убить': 'kill',
      'атаковать': 'kill',
      'говорить': 'say',
      'сказать': 'say',
      'использовать': 'use',
      'экипировать': 'equip',
      'снять': 'unequip',
      'купить': 'buy',
      'продать': 'sell',
      'список': 'list',
      'статы': 'stats',
      'характеристики': 'stats',
      'исцелить': 'heal',
      'сохранить': 'save',
      'загрузить': 'load',
      'помощь': 'help',
      'справка': 'help',
      // Добавлен алиас для побега из боя
      'сбежать': 'flee',
      'возродиться': 'respawn',
      'con': 'consider'
    };

    // Заполняем Map алиасов
    for (const [alias, command] of Object.entries(shortcuts)) {
      this.aliases.set(alias, command);
    }
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
   * @param {string} commandName - Название команды.
   * @param {Function} handler - Функция-обработчик, принимающая (parsedCommand, game).
   * @param {string} [description=''] - Описание команды для справки.
   * @param {string[]} [aliases=[]] - Массив алиасов для отображения в справке.
   */
  registerCommand(commandName, handler, description = '', aliases = []) {
    this.commands.set(commandName, {
      handler: handler,
      description: description,
      aliases: aliases
    });
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
  executeCommand(parsedCommand, game) {
    const commandData = this.commands.get(parsedCommand.command);

    if (commandData) {
      try {
        // Поддерживаем как старый формат (функция), так и новый (объект с полем handler).
        const handler = typeof commandData === 'function' ? commandData : commandData.handler;
        return handler(parsedCommand, game);
      } catch (error) {
        console.error('Ошибка выполнения команды:', error);
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
    // TODO: Этот список команд захардкожен. В идеале, его следует генерировать
    // динамически или использовать `generateHelp()` для более полного ответа.
    // Текущая реализация дана для простоты.
    const availableCommands = [
      'look (l, смотреть) - осмотреться',
      'go <направление> (идти) - идти в указанном направлении',
      'get <предмет> (взять) - взять предмет',
      'drop <предмет> (бросить) - бросить предмет',
      'inventory (inv, и) - показать инвентарь',
      'kill <цель> (убить) - атаковать цель',
      'say <сообщение> (говорить) - поговорить с НПС',
      'use <предмет> (использовать) - использовать предмет',
      'stats (статы) - показать характеристики',
      'help (помощь) - показать список команд'
    ];

    return `Неизвестная команда: "${command}"\n\nДоступные команды:\n${availableCommands.join('\n')}`;
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