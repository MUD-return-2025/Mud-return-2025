/**
 * Парсер и обработчик игровых команд
 * Преобразует текстовый ввод в игровые действия
 */
export class CommandParser {
  constructor() {
    this.commands = new Map();
    this.aliases = new Map(); // алиасы команд для удобства
    this.initializeCommands();
  }

  /**
   * Инициализация базовых команд и их алиасов
   */
  initializeCommands() {
    // Единый объект с алиасами
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
      'с': 'go north',
      'ю': 'go south',
      'в': 'go east',
      'з': 'go west',
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
      'справка': 'help'
    };

    // Заполняем Map алиасов
    for (const [alias, command] of Object.entries(shortcuts)) {
      this.aliases.set(alias, command);
    }
  }

  /**
   * Парсит текстовую команду
   * @param {string} input - ввод пользователя
   * @returns {Object} объект команды {command, args, target, original}
   */
  parseCommand(input) {
    if (!input || typeof input !== 'string') {
      return { command: '', args: [], target: '', original: '' };
    }

    const parts = input.trim().toLowerCase().split(/\s+/);
    let command = parts[0];
    const args = parts.slice(1);

    // Проверяем алиасы
    const alias = this.aliases.get(command);
    if (alias) {
      // Если алиас содержит пробел (например, "go north"), разбираем его
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
      target: args.join(' '), // объединяем аргументы для многословных целей
      original: input.trim()
    };
  }

  /**
   * Регистрирует обработчик команды
   * @param {string} commandName - название команды
   * @param {Function} handler - функция-обработчик
   */
  registerCommand(commandName, handler) {
    this.commands.set(commandName, handler);
  }

  /**
   * Выполняет распарсенную команду
   * @param {Object} parsedCommand - результат parseCommand
   * @param {Object} game - ссылка на игровой движок
   * @returns {string} результат выполнения команды
   */
  executeCommand(parsedCommand, game) {
    const handler = this.commands.get(parsedCommand.command);

    if (handler) {
      try {
        return handler(parsedCommand, game);
      } catch (error) {
        console.error('Ошибка выполнения команды:', error);
        return 'Произошла ошибка при выполнении команды.';
      }
    }

    return this.getUnknownCommandMessage(parsedCommand.command);
  }

  /**
   * Возвращает сообщение о неизвестной команде с подсказками
   * @param {string} command - неизвестная команда
   * @returns {string} сообщение с подсказками
   */
  getUnknownCommandMessage(command) {
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
   * Проверяет, является ли строка командой
   * @param {string} input - ввод игрока
   * @returns {boolean}
   */
  isValidCommand(input) {
    const parsed = this.parseCommand(input);
    return this.commands.has(parsed.command);
  }
}