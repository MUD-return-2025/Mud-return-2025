import { templates } from '../data/templates.js';

/**
 * @class MessageFormatter
 * @description Форматирует сообщения, используя шаблоны и контекст.
 * Поддерживает плейсхолдеры {key} и теги стилизации {c:className}text{/c}.
 */
export class MessageFormatter {
  /**
   * @param {function(string, string): string} colorizeFn - Функция для стилизации текста (game.colorize).
   */
  constructor(colorizeFn) {
    this.colorize = colorizeFn;
  }

  /**
   * Форматирует сообщение по ключу шаблона.
   * @param {string} key - Ключ шаблона (e.g., 'consider.item.header').
   * @param {object} [context={}] - Объект с данными для подстановки.
   * @returns {string} Отформатированная строка.
   */
  format(key, context = {}) {
    const path = key.split('.');
    let template = templates;
    for (const part of path) {
      template = template?.[part];
    }

    if (typeof template !== 'string') {
      console.warn(`Шаблон не найден по ключу: ${key}`);
      return '';
    }

    // Заменяем плейсхолдеры {key} на значения из контекста
    let result = template.replace(/{(\w+)}/g, (match, key) => {
      return context[key] !== undefined ? context[key] : match;
    });

    // Применяем стилизацию {c:className}text{/c}
    return result.replace(/{c:([\w-]+)}(.*?)\{\/c}/g, (match, className, text) => {
      return this.colorize(text, className);
    });
  }
}
