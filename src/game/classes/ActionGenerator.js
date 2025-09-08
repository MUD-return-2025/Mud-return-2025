/**
 * @class ActionGenerator
 * @description Генерирует список доступных действий для игрока в текущей комнате.
 */
export class ActionGenerator {
  /**
   * @param {import('../GameEngine.js').GameEngine} game - Экземпляр игрового движка.
   */
  constructor(game) {
    this.game = game;
  }

  /**
   * Генерирует сгруппированный список действий.
   * @returns {Array<{
   *   isGeneral?: boolean,
   *   target?: { name: string, type: string },
   *   actions: Array<{label: string, command: string, danger?: boolean}>
   * }>}
   */
  getAvailableActions() {
    const groupedActions = [];
    const currentRoom = this.game.getCurrentRoom();
    if (!currentRoom) return [];

    // --- Группа: Базовые действия ---
    const baseActions = [
      { label: '👁️ Осмотреться', command: 'look' },
      { label: '💾 Сохранить', command: 'save' },
      { label: '❓ Помощь', command: 'help' }
    ];
    groupedActions.push({ isGeneral: true, actions: baseActions });

    // --- Действия, которые не привязаны к конкретному NPC, но зависят от их наличия ---
    const generalNpcActions = [];
    const npcsInRoom = currentRoom.npcs
      .map(npcId => this.game.getNpc(npcId, currentRoom.area))
      .filter(npc => npc && npc.isAlive());

    if (npcsInRoom.some(npc => npc.canTrade && npc.canTrade())) {
      generalNpcActions.push({ label: '💰 Торговать', command: 'list' });
    }
    if (npcsInRoom.some(npc => npc.canHeal)) {
      generalNpcActions.push({ label: '✨ Исцелиться', command: 'heal' });
    }
    if (generalNpcActions.length > 0) {
      groupedActions.push({ isGeneral: true, actions: generalNpcActions });
    }

    // --- Группировка действий по каждому предмету ---
    currentRoom.items
      .map(globalItemId => this.game.world.items.get(globalItemId))
      .filter(Boolean)
      .forEach(item => {
        groupedActions.push({
          target: { name: item.name, type: 'item-name' },
          actions: [
            { label: `👁️ Осмотреть`, command: `look ${item.name}` },
            { label: `🤔 Оценить`, command: `consider ${item.name}` },
            { label: `✋ Взять`, command: `get ${item.name}` }
          ]
        });
      });

    // --- Группировка действий по каждому NPC ---
    for (const npc of npcsInRoom) {
      const specificNpcActions = [];
      specificNpcActions.push({ label: `👁️ Осмотреть`, command: `look ${npc.name}` });
      specificNpcActions.push({ label: `🤔 Оценить`, command: `consider ${npc.name}` });
      if (npc.dialogue && npc.dialogue.length > 0) {
        specificNpcActions.push({ label: `💬 Поговорить`, command: `talk ${npc.name}` });
      }
      if (npc.type === 'hostile') {
        specificNpcActions.push({ label: `⚔️ Убить`, command: `kill ${npc.name}`, danger: true });
      }
      groupedActions.push({
        target: { name: npc.name, type: `npc-${npc.type}` },
        actions: specificNpcActions
      });
    }

    return groupedActions;
  }
}
