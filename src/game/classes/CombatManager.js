import { DamageParser } from '../utils/damageParser.js';

/**
 * @class CombatManager
 * @description Управляет логикой одного боевого столкновения.
 */
export class CombatManager {
  /**
   * @param {import('../GameEngine').GameEngine} game - Экземпляр игрового движка.
   * @param {import('./Player').Player} player - Экземпляр игрока.
   * @param {import('./NPC').NPC} npc - NPC, с которым идет бой.
   */
  constructor(game, player, npc) {
    this.game = game;
    this.player = player;
    this.npc = npc;
    this.combatTimeout = null;
    this.isOver = false;
  }

  /**
   * Начинает бой.
   */
  start() {
    this.player.state = 'fighting';
    const initialAttackMessage = `Вы атакуете ${this.game.colorize(this.npc.name, `npc-name npc-${this.npc.type}`)}!`;
    this.game.emit('message', initialAttackMessage);
    this._loop();
  }

  /**
   * Завершает бой.
   */
  stop() {
    if (this.isOver) return;
    this.isOver = true;

    if (this.combatTimeout) {
      clearTimeout(this.combatTimeout);
      this.combatTimeout = null;
    }

    if (this.player.isAlive()) {
      this.player.state = 'idle';
    }

    this.player.nextAttackIsSkill = null;
    this.player.skillUsedThisRound = false;

    // Сообщаем движку, что бой окончен
    this.game.stopCombat();
  }

  /**
   * Внутренний цикл боя.
   * @private
   */
  async _loop() {
    if (this.isOver) return;

    const roundResult = await this.performCombatRound();
    this.game.emit('message', roundResult);

    if (!this.isOver) {
      this.combatTimeout = setTimeout(() => this._loop(), 2500);
    }
  }

  /**
   * Выполняет один раунд боя.
   * @returns {Promise<string>} - Сообщение с результатом раунда.
   */
  async performCombatRound() {
    if (!this.npc.isAlive()) {
      this.stop();
      return 'Цель уже повержена.';
    }

    this.player.skillUsedThisRound = false;
    let result = '';

    // --- Ход игрока ---
    const usedSkillId = this.player.nextAttackIsSkill;
    const playerDamage = this._calculatePlayerDamage(usedSkillId);
    this.player.nextAttackIsSkill = null;

    let attackMessage = 'Вы наносите';
    if (usedSkillId) {
      const skillData = this.game.skillsData.get(usedSkillId);
      attackMessage = skillData
        ? `Вы используете "${skillData.name}" и наносите`
        : `Вы пытаетесь использовать неизвестное умение и наносите`;
    }

    const npcAlive = this.npc.takeDamage(playerDamage);
    result += ' \n' + this.game.colorize(`${attackMessage} ${playerDamage} урона ${this.game.colorize(this.npc.name, `npc-name npc-${this.npc.type}`)}.`, 'combat-player-attack');

    if (npcAlive) {
      const npcHealthPercent = Math.round((this.npc.hitPoints / this.npc.maxHitPoints) * 100);
      result += '\n' + this.game.colorize(`У ${this.game.colorize(this.npc.name, `npc-name npc-${this.npc.type}`)} осталось ${npcHealthPercent}% здоровья.`, 'combat-player-hp');
    } else {
      // НПС умер
      result += '\n' + this.game.colorize(`${this.game.colorize(this.npc.name, `npc-name npc-${this.npc.type}`)} повержен!`, 'combat-npc-death');

      if (this.npc.experience > 0) {
        const levelUpMessage = this.player.addExperience(this.npc.experience);
        result += '\n' + this.game.colorize(`Вы получили ${this.npc.experience} опыта.`, 'combat-exp-gain');
        if (levelUpMessage) {
          result += '\n' + this.game.colorize(levelUpMessage.message, 'combat-exp-gain');
          const newSkillMessage = this.game.checkAndAwardSkills();
          if (newSkillMessage) {
            result += '\n' + this.game.colorize(newSkillMessage, 'combat-exp-gain');
          }
        }
      }

      const drops = this.npc.getDeathDrops();
      if (drops.length > 0) {
        const currentRoom = this.game.getCurrentRoom();
        drops.forEach(localItemId => { 
          const globalItemId = this.game.world.getGlobalId(localItemId, this.npc.area);
          currentRoom.addItem(globalItemId);
        });
        result += `\n${this.game.colorize(this.npc.name, `npc-name npc-${this.npc.type}`)} что-то оставил.`;
      }

      const deadNpcGlobalId = this.game.world.getGlobalId(this.npc.id, this.npc.area);
      const deadNpcRoomId = this.player.currentRoom;
      this.game.getCurrentRoom().removeNpc(this.npc.id);
      this.game.world.npcLocationMap.delete(deadNpcGlobalId);
      this.game.scheduleNpcRespawn(deadNpcGlobalId, deadNpcRoomId);

      this.stop();
      return result;
    }

    // --- Ход НПС ---
    // 1. Проверка на бегство
    if (this.npc.fleesAtPercent > 0 && (this.npc.hitPoints / this.npc.maxHitPoints) <= this.npc.fleesAtPercent) {
      const currentRoom = this.game.getCurrentRoom();
      const exits = currentRoom.getExits();
      if (exits.length > 0) {
        const randomExitDirection = exits[Math.floor(Math.random() * exits.length)];
        const exit = currentRoom.getExit(randomExitDirection);
        if (typeof exit === 'string') {
          const targetRoomId = this.game.world.getGlobalId(exit, currentRoom.area);
          const targetRoom = this.game.world.rooms.get(targetRoomId);
          currentRoom.removeNpc(this.npc.id);
          targetRoom.addNpc(this.npc.id);
          result += '\n' + this.game.colorize(`${this.npc.name} в страхе сбегает!`, 'combat-npc-death');
          this.stop();
          return result;
        }
      }
    }

    // 2. Проверка на спецспособности
    if (this.npc.specialAbilities && this.npc.specialAbilities.length > 0) {
      for (const ability of this.npc.specialAbilities) {
        if (Math.random() < ability.chance) {
          if (ability.name === 'bark') {
            const currentRoom = this.game.getCurrentRoom();
            const exits = currentRoom.getExits();
            if (exits.length === 0) continue;

            const randomExitDirection = exits[Math.floor(Math.random() * exits.length)];
            const exit = currentRoom.getExit(randomExitDirection);
            const targetRoomId = (typeof exit === 'object')
              ? this.game.world.getGlobalId(exit.room, exit.area)
              : this.game.world.getGlobalId(exit, currentRoom.area);

            result += '\n' + this.game.colorize(ability.message, 'combat-npc-attack');
            this.stop(); // Останавливаем бой
            const moveResult = await this.game.moveToRoom(targetRoomId, randomExitDirection);
            result += `\n\n${moveResult.message}`;
            return result;
          }
        }
      }
    }

    // 3. Обычная атака НПС
    const npcDamage = this.npc.rollDamage();
    this.player.takeDamage(npcDamage);
    result += '\n' + this.game.colorize(`${this.game.colorize(this.npc.name, `npc-name npc-${this.npc.type}`)} наносит вам ${npcDamage} урона.`, 'combat-npc-attack');
    result += '\n' + this.game.colorize(`У вас осталось ${this.player.hitPoints}/${this.player.maxHitPoints} HP.`, 'combat-player-hp');

    if (this.player.hitPoints <= 0) {
      result += '\n' + this.game.colorize('Вы умерли!', 'combat-player-death');
      this.stop();
    }
    return result;
  }

  /**
   * Вычисляет урон игрока.
   * @param {string|null} skillId - ID используемого умения.
   * @returns {number} урон
   */
  _calculatePlayerDamage(skillId = null) {
    let baseDamage;

    if (this.player.equippedWeapon) {
      baseDamage = this.player.rollWeaponDamage();
    } else {
      baseDamage = Math.floor(Math.random() * 4) + 1;
    }

    const strBonus = Math.floor((this.player.strength - 10) / 2);
    let finalDamage = baseDamage + strBonus;

    if (skillId) {
      const skillData = this.game.skillsData.get(skillId);
      if (skillData && skillData.damageMultiplier) {
        finalDamage *= skillData.damageMultiplier;
      }
    }

    return Math.max(1, Math.floor(finalDamage));
  }
}