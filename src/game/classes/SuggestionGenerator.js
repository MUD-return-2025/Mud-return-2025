/**
 * @class SuggestionGenerator
 * @description Генерирует список подсказок для автодополнения команд.
 */
export class SuggestionGenerator {
  /**
   * @param {import('../GameEngine').GameEngine} game - Экземпляр игрового движка.
   */
  constructor(game) {
    this.game = game;
  }

  /**
   * Генерирует список подсказок для автодополнения команды.
   * @param {string|null} command - Введенная команда (e.g., 'get', 'kill').
   * @param {string} prefix - Частичный аргумент команды для фильтрации (e.g., 'меч').
   * @returns {Array<{text: string, type: 'command'|'item'|'npc'|'exit'}>} Массив объектов подсказок.
   */
  getSuggestions(command, prefix = '') {
    const suggestions = [];
    const lowerPrefix = prefix.toLowerCase();
    const currentRoom = this.game.getCurrentRoom();

    if (!command) {
      // Если команда не введена, предлагаем базовые команды
      const allCommands = [...this.game.commandManager.commands.keys()];
      return allCommands
        .filter(cmd => cmd.startsWith(lowerPrefix))
        .map(cmd => ({ text: cmd, type: 'command' }));
    }

    const suggestFrom = (items, type) => {
      if (!items) return;
      items
        .filter(item => item && item.name.toLowerCase().startsWith(lowerPrefix))
        .forEach(item => suggestions.push({ text: item.name, type }));
    };

    const itemsInRoom = currentRoom?.items.map(id => this.game.world.items.get(id)).filter(Boolean) || [];
    const npcsInRoom = currentRoom?.npcs.map(id => this.game.getNpc(id, currentRoom.area)).filter(npc => npc && npc.isAlive()) || [];
    const itemsInInventory = this.game.player.inventory;

    switch (command) {
      case 'go':
      case 'идти':
        return currentRoom.getExits()
          .filter(exit => exit.startsWith(lowerPrefix))
          .map(exit => ({ text: exit, type: 'exit' }));

      case 'get':
      case 'взять':
        suggestFrom(itemsInRoom, 'item');
        break;

      case 'drop':
      case 'выбросить':
      case 'equip':
      case 'надеть':
      case 'unequip':
      case 'снять':
      case 'use':
      case 'использовать':
        suggestFrom(itemsInInventory, 'item');
        break;

      case 'kill':
      case 'убить':
      case 'talk':
      case 'поговорить':
      case 'kick':
      case 'пнуть':
        suggestFrom(npcsInRoom, 'npc');
        break;

      case 'look':
      case 'осмотреть':
      case 'consider':
      case 'оценить':
        suggestFrom(itemsInRoom, 'item');
        suggestFrom(npcsInRoom, 'npc');
        suggestFrom(itemsInInventory, 'item');
        break;

      case 'gain':
      case 'получить': {
        const statNames = [
          'str', 'dex', 'con', 'int', 'wis', 'cha', 'hp', 'maxhp', 'lvl', 'exp'
        ];
        return statNames
          .filter(stat => stat.startsWith(lowerPrefix))
          .map(stat => ({ text: stat, type: 'command' }));
      }
    }

    // Убираем дубликаты, если они есть
    return [...new Map(suggestions.map(item => [item.text, item])).values()];
  }
}