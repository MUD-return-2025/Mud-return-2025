<script setup>
// Компонент Vue для отображения панели статистики игрока, инвентаря, экипировки и карты.
import { ref, computed, watch } from 'vue';
import EquipmentPanel from './EquipmentPanel.vue';
import InventoryPanel from './InventoryPanel.vue';
import ActionsPanel from './ActionsPanel.vue';
import MapPanel from './MapPanel.vue';

/**
 * @property {Object} player - Объект с данными игрока.
 * @property {Boolean} gameStarted - Флаг, указывающий, началась ли игра.
 * @property {Object} gameEngine - Экземпляр игрового движка.
 * @property {Number} updateCounter - Счетчик обновлений для принудительной перерисовки.
 */
const props = defineProps({
  player: {
    type: Object,
    required: true
  },
  gameStarted: {
    type: Boolean,
    default: false
  },
  gameEngine: {
    type: Object,
    required: true
  },
  updateCounter: {
    type: Number,
    required: true
  }
});

/**
 * @emits command - Событие для отправки команды в игровой движок.
 * @emits move - Событие для перемещения игрока.
 */
const emit = defineEmits(['command', 'move']);

/**
 * Отслеживает изменение состояния игрока.
 * Если игрок вступает в бой, автоматически открывает вкладку "Статистика".
 */
watch(() => props.player.state, (newState) => {
  if (newState === 'fighting') {
    activeTab.value = 'stats';
  }
});

/** @type {import('vue').Ref<boolean>} Состояние панели (свернута/развернута) */
const isExpanded = ref(true);
/** @type {import('vue').Ref<string>} Активная вкладка */
const activeTab = ref('stats');

/** @type {Array<{id: string, name: string}>} Массив вкладок панели */
const tabs = [
  { id: 'stats', name: 'Статистика' },
  { id: 'inventory', name: 'Инвентарь' },
  { id: 'equipment', name: 'Экипировка' },
  { id: 'map', name: 'Карта' }
];

/**
 * Переключает состояние панели (свернута/развернута).
 */
const togglePanel = () => {
  isExpanded.value = !isExpanded.value;
};

/**
 * @description Вычисляемое свойство для получения текущей комнаты игрока.
 * Реагирует на изменение `props.player.currentRoom`.
 * @type {import('vue').ComputedRef<import('../../game/classes/Room').Room | null>}
 */
const currentRoom = computed(() => {
  if (!props.gameStarted || !props.player.currentRoom) return null;
  return props.gameEngine.rooms.get(props.player.currentRoom);
});

/** @description Вычисляемое свойство, возвращающее список доступных действий. */
const availableActionGroups = computed(() => {
  // eslint-disable-next-line no-unused-expressions
  props.updateCounter;
  return props.gameEngine.getAvailableActions ? props.gameEngine.getAvailableActions() : [];
});

/** @description Вычисляемое свойство, возвращающее список изученных умений. */
const learnedSkills = computed(() => {
  if (!props.gameEngine.skillsData.size) return [];
  return Array.from(props.player.skills)
    .map(skillId => {
      const skill = props.gameEngine.skillsData.get(skillId);
      return skill ? { ...skill, id: skillId } : null;
    })
    .filter(Boolean);
});

/** @description Вычисляемое свойство, возвращающее список враждебных NPC в комнате. */
const hostileNpcsInRoom = computed(() => {
  // eslint-disable-next-line no-unused-expressions
  props.updateCounter;
  if (!currentRoom.value) return [];
  return currentRoom.value.npcs
    .map(npcId => props.gameEngine.getNpc(npcId, currentRoom.value.area))
    .filter(npc => npc && npc.isAlive() && npc.type === 'hostile');
});

/** @description Вычисляемое свойство, находящее первое зелье лечения в инвентаре. */
const healingPotion = computed(() => {
  if (!props.player || !props.player.inventory) return null;
  return props.player.inventory.find(item => item.type === 'potion' && item.healAmount);
});

/** @description Вычисляемое свойство, возвращающее текущего противника в бою. */
const currentEnemy = computed(() => {
  // eslint-disable-next-line no-unused-expressions
  props.updateCounter;
  return props.gameEngine.combatManager?.npc;
});
</script>

<template>
  <div class="stats-panel" v-if="gameStarted">
    <div class="panel-header">
      <h3>📊 {{ player.name }}</h3>
      <button @click="togglePanel" class="toggle-btn">
        {{ isExpanded ? '−' : '+' }}
      </button>
    </div>

    <div v-if="isExpanded" class="panel-content">
      <div class="tabs">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          @click="activeTab = tab.id"
          :class="['tab', { active: activeTab === tab.id }]"
        >
          {{ tab.name }}
        </button>
      </div>

      <div class="tab-content">
        <!-- Вкладка "Статистика" -->
        <div v-if="activeTab === 'stats'" class="stats-content">
          <div class="stat-group">
            <h4>💗 Здоровье</h4>
            <div class="health-bar">
              <div 
                class="health-fill" 
                :style="{ width: (player.hitPoints / player.maxHitPoints * 100) + '%' }"
              ></div>
              <span class="health-text">{{ player.hitPoints }}/{{ player.maxHitPoints }}</span>
            </div>
          </div>

          <div v-if="currentEnemy" class="stat-group">
            <h4>💀 Здоровье врага</h4>
            <div class="health-bar enemy-health-bar">
              <div
                class="health-fill enemy-health-fill"
                :style="{ width: (currentEnemy.hitPoints / currentEnemy.maxHitPoints * 100) + '%' }"
              ></div>
              <span class="health-text">
                {{ currentEnemy.name }}: {{ currentEnemy.hitPoints }}/{{ currentEnemy.maxHitPoints }}
              </span>
            </div>
          </div>


          <div class="stat-group">
            <h4>⭐ Прогресс</h4>
            <div class="stat-line">Уровень: {{ player.level }}</div>
            <div class="exp-bar">
              <div 
                class="exp-fill" 
                :style="{ width: (player.experience / player.experienceToNext * 100) + '%' }"
              ></div>
              <span class="exp-text">{{ player.experience }}/{{ player.experienceToNext }}</span>
            </div>
          </div>

          <div class="stat-group">
            <h4>📈 Характеристики</h4>
            <div class="stat-line">💪 Сила: {{ player.strength }}</div>
            <div class="stat-line">⚡ Ловкость: {{ player.dexterity }}</div>
            <div class="stat-line">🛡️ Телосложение: {{ player.constitution }}</div>
            <div class="stat-line">🧠 Интеллект: {{ player.intelligence }}</div>
            <div class="stat-line">🔮 Мудрость: {{ player.wisdom }}</div>
            <div class="stat-line">😊 Харизма: {{ player.charisma }}</div>
          </div>

          <div v-if="learnedSkills.length > 0" class="stat-group">
            <h4>📚 Умения</h4>
            <div v-for="skill in learnedSkills" :key="skill.id" class="skill-item" :title="skill.description">
              <div class="skill-name">{{ skill.name }}</div>
              <div class="skill-actions">
                <button class="action-btn" @click="$emit('command', skill.id)">
                  Использовать
                </button>
                <button
                  v-for="npc in hostileNpcsInRoom"
                  :key="npc.id"
                  class="action-btn"
                  @click="$emit('command', `${skill.id} ${npc.name}`)"
                  :title="`Применить '${skill.name}' к ${npc.name}`"
                >
                  → {{ npc.name }}
                </button>
              </div>
            </div>
          </div>

          <div v-if="healingPotion" class="stat-group">
            <h4>⚡ Быстрые действия</h4>
            <div class="quick-actions">
              <button
                class="action-btn"
                @click="$emit('command', `use ${healingPotion.name}`)"
                :disabled="player.hitPoints >= player.maxHitPoints"
                :title="player.hitPoints >= player.maxHitPoints ? 'Вы полностью здоровы' : `Использовать ${healingPotion.name}`"
              >
                💖 Лечиться ({{ healingPotion.name }})
              </button>
            </div>
          </div>

          <div v-if="player.state === 'fighting'" class="stat-group">
            <h4>⚔️ Действия в бою</h4>
            <div class="combat-actions">
                <button class="action-btn danger" @click="$emit('command', 'flee')">
                  Сбежать
                </button>
            </div>
          </div>
        </div>

        <!-- Вкладка "Инвентарь" -->
        <div v-if="activeTab === 'inventory'">
          <InventoryPanel
            :player="player"
            :game-engine="gameEngine"
            :update-counter="updateCounter"
            @command="$emit('command', $event)"
          />
        </div>

        <!-- Вкладка "Экипировка" -->
        <div v-if="activeTab === 'equipment'">
          <EquipmentPanel
            :player="player"
            @command="$emit('command', $event)"
          />
        </div>

        <!-- Вкладка "Мини-карта" -->
        <div v-if="activeTab === 'map'" class="map-tab-content">
          <MapPanel
            :game-engine="gameEngine"
            :player="player"
            :game-started="gameStarted"
            :update-counter="updateCounter"
            :current-room="currentRoom"
            @command="$emit('command', $event)"
            @move="$emit('move', $event)"
          />

          <ActionsPanel
            :action-groups="availableActionGroups"
            @command="$emit('command', $event)"
          />

        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-panel {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 400px;
  max-height: calc(100vh - 40px);
  background-color: #001100;
  border: 2px solid #00ff00;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  z-index: 2001;
  border-radius: 4px;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #002200;
  padding: 10px;
  border-bottom: 1px solid #00ff00;
}

.panel-header h3 {
  margin: 0;
  color: #00ff00;
  font-size: 14px;
}

.toggle-btn {
  background: transparent;
  border: 1px solid #00ff00;
  color: #00ff00;
  width: 25px;
  height: 25px;
  cursor: pointer;
  font-family: 'Courier New', monospace;
  font-size: 14px;
}

.toggle-btn:hover {
  background-color: #00ff00;
  color: #000;
}

.panel-content {
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}

.tabs {
  display: flex;
  background-color: #002200;
  border-bottom: 1px solid #00ff00;
}

.tab {
  flex: 1;
  background: transparent;
  border: none;
  color: #888;
  padding: 8px 4px;
  cursor: pointer;
  font-family: 'Courier New', monospace;
  font-size: 10px;
  border-right: 1px solid #00ff00;
}

.tab:last-child {
  border-right: none;
}

.tab.active {
  color: #00ff00;
  background-color: #001100;
}

.tab:hover:not(.active) {
  color: #00aa00;
  background-color: #001a00;
}

.tab-content {
  padding: 10px;
  color: #00ff00;
  min-height: 200px;
}

/* Статистика */
.stats-content .stat-group {
  margin-bottom: 15px;
}

.stats-content h4 {
  margin: 0 0 5px 0;
  color: #ffff00;
  font-size: 12px;
}

.stat-line {
  margin: 3px 0;
  font-size: 11px;
}

.health-bar, .exp-bar {
  position: relative;
  height: 16px;
  background-color: #003300;
  border: 1px solid #00ff00;
  margin: 5px 0;
}

.health-fill {
  height: 100%;
  background-color: #ff0000;
  transition: width 0.3s ease;
}

.enemy-health-fill {
  background-color: #990000; /* Более темный красный для врага */
  height: 100%;
  transition: width 0.3s ease;
}

.exp-fill {
  height: 100%;
  background-color: #0000ff;
  transition: width 0.3s ease;
}

.health-text, .exp-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #fff;
  font-size: 10px;
  text-shadow: 1px 1px 2px #000;
}

.action-btn {
  background: transparent;
  border: 1px solid #00ff00;
  color: #00ff00;
  padding: 3px 6px;
  font-size: 10px;
  cursor: pointer;
  font-family: 'Courier New', monospace;
}

.action-btn:hover {
  background-color: #00ff00;
  color: #000;
}

.action-btn.danger {
  border-color: #ff4444;
  color: #ff4444;
}

.action-btn:disabled,
.action-btn:disabled:hover {
  border-color: #555;
  color: #555;
  background-color: transparent;
  cursor: not-allowed;
}

.action-btn.danger:hover {
  background-color: #ff4444;
  color: #000;
}

.skill-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 11px;
}

.skill-name {
  color: #00ff00;
  font-weight: bold;
}

.skill-actions {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.combat-actions {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.quick-actions {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}


/* Экипировка */
.equipment-slot {
  margin-bottom: 15px;
  padding: 8px;
  border: 1px solid #333;
  background-color: #001a00;
}

.slot-label {
  color: #ffff00;
  margin-bottom: 5px;
  font-weight: bold;
}

.equipped-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.equipped-item .item-name {
  color: #00ff00;
}

.unequip-btn {
  background: transparent;
  border: 1px solid #ff4444;
  color: #ff4444;
  padding: 2px 6px;
  font-size: 9px;
  cursor: pointer;
  font-family: 'Courier New', monospace;
}

.unequip-btn:hover {
  background-color: #ff4444;
  color: #fff;
}

.empty-slot {
  color: #666;
  font-style: italic;
}

.combat-stats {
  margin-top: 15px;
  padding-top: 10px;
  border-top: 1px solid #333;
}

.combat-stats h4 {
  margin: 0 0 8px 0;
  color: #ffff00;
}

.map-tab-content {
  padding: 10px;
}
.actions-divider {
  width: 100%;
  border-color: #004400;
}

/* Прокрутка */
.panel-content::-webkit-scrollbar,
.inventory-list::-webkit-scrollbar,
.trader-item-list::-webkit-scrollbar {
  width: 6px;
}

.panel-content::-webkit-scrollbar-track,
.inventory-list::-webkit-scrollbar-track,
.trader-item-list::-webkit-scrollbar-track {
  background: #001100;
}

.panel-content::-webkit-scrollbar-thumb,
.inventory-list::-webkit-scrollbar-thumb,
.trader-item-list::-webkit-scrollbar-thumb {
  background: #00ff00;
  border-radius: 3px;
}

</style>