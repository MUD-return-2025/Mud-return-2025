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
    // Регистрируем алиасы для удобства игрока
    this.aliases.set('l', 'look');
    this.aliases.set('смотреть', 'look');
    this.aliases.set('осмотреть', 'look');
    this.aliases.set('идти', 'go');
    this.aliases.set('север', 'go north');
    this.aliases.set('юг', 'go south');
    this.aliases.set('восток', 'go east');
    this.aliases.set('запад', 'go west');
    this.aliases.set('с', 'go north');
    this.aliases.set('ю', 'go south');
    this.aliases.set('в', 'go east');
    this.aliases.set('з', 'go west');
    this.aliases.set('взять', 'get');
    this.aliases.set('бросить', 'drop');
    this.aliases.set('инвентарь', 'inventory');
    this.aliases.set('inv', 'inventory');
    this.aliases.set('и', 'inventory');
    this.aliases.set('убить', 'kill');
    this.aliases.set('атаковать', 'kill');
    this.aliases.set('говорить', 'say');
    this.aliases.set('использовать', 'use');
    this.aliases.set('статы', 'stats');
    this.aliases.set('характеристики', 'stats');
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

    // Обработка сокращений команд
    const shortcuts = {
      'л': 'look',
      'идти': 'go',
      'иди': 'go',
      'инв': 'inventory',
      'взять': 'get',
      'бросить': 'drop',
      'убить': 'kill',
      'сказать': 'say',
      'использовать': 'use',
      'экипировать': 'equip',
      'снять': 'unequip',
      'купить': 'buy',
      'продать': 'sell',
      'список': 'list',
      'характеристики': 'stats',
      'исцелить': 'heal',
      'сохранить': 'save',
      'загрузить': 'load',
      'помощь': 'help',
      'справка': 'help'
    };

    if (shortcuts[command]) {
      command = shortcuts[command];
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