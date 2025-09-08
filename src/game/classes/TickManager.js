/**
 * @class TickManager
 * @description Управляет событиями, происходящими с течением времени (ресawn, wander, cooldowns).
 */
export class TickManager {
  /**
   * @param {import('../GameEngine.js').GameEngine} game - Экземпляр игрового движка.
   */
  constructor(game) {
    this.game = game;
    this.respawnQueue = []; // Очередь для возрождения НПС
  }

  /**
   * Сбрасывает состояние менеджера.
   */
  reset() {
    this.respawnQueue = [];
  }

  /**
   * Выполняет один игровой тик.
   * @returns {string[]} Массив сообщений, сгенерированных за тик.
   */
  tick() {
    const messages = this._checkRespawns();
    this._tickCooldowns();
    const wanderMessages = this._updateWanderingNpcs();
    return [...messages, ...wanderMessages];
  }

  /**
   * Планирует возрождение НПС.
   * @param {string} globalNpcId - Глобальный ID НПС для возрождения.
   * @param {string} roomId - ID комнаты, где НПС должен возродиться.
   */
  scheduleNpcRespawn(globalNpcId, roomId) {
    const npc = this.game.world.npcs.get(globalNpcId);
    if (!npc || npc.type !== 'hostile') {
      return;
    }

    const RESPAWN_TIME = 30000; // 30 секунд
    this.respawnQueue.push({
      globalNpcId,
      roomId,
      respawnTime: Date.now() + RESPAWN_TIME
    });
  }

  /**
   * Проверяет очередь возрождения и возрождает НПС.
   * @private
   * @returns {string[]} Массив сообщений о возрождении.
   */
  _checkRespawns() {
    const messages = [];
    const now = Date.now();

    this.respawnQueue = this.respawnQueue.filter(entry => {
      if (now >= entry.respawnTime) {
        const [areaId, npcId] = this.game.world.parseGlobalId(entry.globalNpcId);
        const npc = this.game.getNpc(npcId, areaId);
        const room = this.game.world.rooms.get(entry.roomId);
        if (npc && room && !room.hasNpc(npcId)) {
          this.game.world.npcLocationMap.set(entry.globalNpcId, entry.roomId);
          npc.respawn(this.game);
          room.addNpc(npc.id);
          if (this.game.player.currentRoom === entry.roomId) {
            messages.push(this.game.colorize(`${npc.name} появляется из тени!`, 'combat-npc-death'));
          }
        }
        return false;
      }
      return true;
    });

    return messages;
  }

  /**
   * Уменьшает время перезарядки умений игрока.
   * @private
   */
  _tickCooldowns() {
    for (const skillId in this.game.player.skillCooldowns) {
      if (this.game.player.skillCooldowns[skillId] > 0) {
        this.game.player.skillCooldowns[skillId]--;
        if (this.game.player.skillCooldowns[skillId] === 0) {
          delete this.game.player.skillCooldowns[skillId];
          const skillData = this.game.skillsData.get(skillId);
          if (skillData && this.game.onMessage) {
            this.game.onMessage(this.game.colorize(`Умение "${skillData.name}" готово к использованию.`, 'combat-exp-gain'));
          }
        }
      }
    }
  }

  /**
   * Обновляет положение блуждающих НПС.
   * @private
   * @returns {string[]} Массив сообщений о перемещении NPC.
   */
  _updateWanderingNpcs() {
    const messages = [];
    const WANDER_CHANCE = 0.05;
    const combatNpcGlobalId = this.game.combatManager ? this.game.world.getGlobalId(this.game.combatManager.npc.id, this.game.combatManager.npc.area) : null;

    for (const [globalNpcId, currentNpcRoomId] of this.game.world.npcLocationMap.entries()) {
      const npc = this.game.world.npcs.get(globalNpcId);
      if (npc && npc.canWander && npc.isAlive() && globalNpcId !== combatNpcGlobalId && Math.random() < WANDER_CHANCE) {
        const wanderMessage = this.game.world.wanderNpc(globalNpcId, currentNpcRoomId);
        if (wanderMessage) {
          messages.push(wanderMessage);
        }
      }
    }
    return messages;
  }
}
