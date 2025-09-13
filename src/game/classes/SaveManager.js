/**
 * @class SaveManager
 * @description Управляет логикой сохранения и загрузки состояния игры.
 */
export class SaveManager {
  /**
   * @param {import('../GameEngine.js').GameEngine} game - Экземпляр игрового движка.
   */
  constructor(game) {
    this.game = game;
    this.saveKey = 'mudgame_save';
  }

  /**
   * Сохранение игры в localStorage.
   * @returns {void}
   */
  saveGame() {
    const gameData = {
      player: {
        name: this.game.player.name,
        level: this.game.player.level,
        experience: this.game.player.experience,
        experienceToNext: this.game.player.experienceToNext,
        hitPoints: this.game.player.hitPoints,
        maxHitPoints: this.game.player.maxHitPoints,
        strength: this.game.player.strength,
        dexterity: this.game.player.dexterity,
        constitution: this.game.player.constitution,
        intelligence: this.game.player.intelligence,
        wisdom: this.game.player.wisdom,
        charisma: this.game.player.charisma,
        inventory: this.game.player.inventory,
        gold: this.game.player.gold,
        currentRoom: this.game.player.currentRoom,
        state: this.game.player.state,
        equippedWeapon: this.game.player.equippedWeapon,
        equippedArmor: this.game.player.equippedArmor,
        skills: Array.from(this.game.player.skills),
        deathRoom: this.game.player.deathRoom,
        ui_version: this.game.player.ui_version || 0
      },
      loadedAreaIds: Array.from(this.game.world.loadedAreaIds),
      worldState: {
        npcs: {},
        rooms: {},
        npcLocations: Array.from(this.game.world.npcLocationMap.entries()),
      },
      timestamp: Date.now()
    };

    // Сохраняем состояние каждого NPC (только то, что меняется)
    for (const [globalNpcId, npc] of this.game.world.npcs.entries()) {
      gameData.worldState.npcs[globalNpcId] = {
        hitPoints: npc.hitPoints,
      };
    }

    // Сохраняем состояние каждой комнаты (только то, что меняется)
    for (const [globalRoomId, room] of this.game.world.rooms.entries()) {
      gameData.worldState.rooms[globalRoomId] = {
        items: room.items,
      };
    }

    localStorage.setItem(this.saveKey, JSON.stringify(gameData));
  }

  /**
   * Загрузка игры из localStorage.
   * @returns {Promise<boolean>} `true` в случае успешной загрузки, иначе `false`.
   */
  async loadGame() {
    const saveData = localStorage.getItem(this.saveKey);
    if (!saveData) {
      return false;
    }

    try {
      const gameData = JSON.parse(saveData);

      this.game._resetWorldState();

      await this.game.initializeSkills();

      // Загружаем все зоны, которые были активны в сохраненной игре
      for (const areaId of gameData.loadedAreaIds) {
        await this.game.world.loadArea(areaId);
      }

      this.game.player.load(gameData.player);

      // Применяем сохраненное состояние мира поверх стандартного
      if (gameData.worldState) {
        // Восстанавливаем состояние NPC
        if (gameData.worldState.npcs) {
          for (const [globalNpcId, npcState] of Object.entries(gameData.worldState.npcs)) {
            const npc = this.game.world.npcs.get(globalNpcId);
            if (npc) {
              npc.hitPoints = npcState.hitPoints;
            }
          }
        }
        // Восстанавливаем состояние комнат (предметы на полу)
        if (gameData.worldState.rooms) {
          for (const [globalRoomId, roomState] of Object.entries(gameData.worldState.rooms)) {
            const room = this.game.world.rooms.get(globalRoomId);
            if (room) {
              room.items = roomState.items;
            }
          }
        }
        // Восстанавливаем карту расположения NPC
        this.game.world.npcLocationMap = new Map(gameData.worldState.npcLocations || []);
        this.game.world.syncRoomsFromNpcMap();
      }

      return true;
    } catch (error) {
      console.error('Ошибка загрузки:', error);
      return false;
    }
  }
}
