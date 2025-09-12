<script setup>
// Компонент Vue для отображения панели статистики игрока, инвентаря, экипировки и карты.
import { ref, watch, defineEmits, onUnmounted, computed } from 'vue';
import { useGameStore } from '../../stores/game.js';
import EquipmentPanel from './EquipmentPanel.vue';
import InventoryPanel from './InventoryPanel.vue';
import ActionsPanel from './ActionsPanel.vue';
import MapPanel from './MapPanel.vue';
import RadarPanel from './RadarPanel.vue';

const gameStore = useGameStore();

/**
 * @description Вычисляемое свойство для получения списка умений, требующих цели.
 */
const targetedSkills = computed(() => 
  gameStore.learnedSkills.filter(skill => skill.target && skill.target !== 'none')
);

/**
 * @description Вычисляемое свойство для получения списка умений, не требующих цели.
 */
const generalSkills = computed(() => 
  gameStore.learnedSkills.filter(skill => !skill.target || skill.target === 'none')
);

// Определяем событие, которое компонент может генерировать
const emit = defineEmits(['action-performed', 'position-changed']);

/**
 * Отслеживает изменение состояния игрока.
 * Если игрок вступает в бой, автоматически открывает вкладку "Статистика".
 */
watch(() => gameStore.player.state, (newState) => {
  if (newState === 'fighting') {
    activeTab.value = 'stats';
  }
});

/** @type {import('vue').Ref<boolean>} Состояние панели (свернута/развернута) */
const isExpanded = ref(true);
/** @type {import('vue').Ref<string>} Активная вкладка */
const activeTab = ref('stats');
/** @type {import('vue').Ref<number>} Ширина панели в пикселях */
const panelWidth = ref(400);
/** @type {import('vue').Ref<'left' | 'right'>} Позиция панели */
const panelSide = ref('left');

/**
 * Начинает процесс изменения размера панели.
 * @param {MouseEvent} event
 */
const startResize = (event) => {
  // Предотвращаем стандартное поведение, например, выделение текста
  event.preventDefault();
  // Меняем курсор для всего документа для лучшего UX
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  // Добавляем глобальные слушатели
  window.addEventListener('mousemove', resizePanel);
  window.addEventListener('mouseup', stopResize);
};

/**
 * Изменяет ширину панели в ответ на движение мыши.
 * @param {MouseEvent} event
 */
const resizePanel = (event) => {
  const newWidth = panelSide.value === 'left'
    ? event.clientX
    : window.innerWidth - event.clientX;
  // Ограничиваем минимальную и максимальную ширину
  panelWidth.value = Math.max(300, Math.min(newWidth, 800));
};

/**
 * Завершает процесс изменения размера панели и очищает слушатели.
 */
const stopResize = () => {
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  window.removeEventListener('mousemove', resizePanel);
  window.removeEventListener('mouseup', stopResize);
};

/** @type {Array<{id: string, name: string}>} Массив вкладок панели */
const tabs = [
  { id: 'stats', name: 'Статистика' },
  { id: 'inventory', name: 'Инвентарь' },
  { id: 'equipment', name: 'Экипировка' },
  { id: 'map', name: 'Карта' }
];

/**
 * Обрабатывает команду и сообщает родительскому компоненту о выполненном действии.
 * @param {string} command - Команда для выполнения.
 */
const handleCommand = (command) => {
  if (command === 'list') {
    activeTab.value = 'inventory';
  }
  gameStore.processCommand(command);
  emit('action-performed');
};

/**
 * Переключает сторону расположения панели.
 */
const toggleSide = () => {
  panelSide.value = panelSide.value === 'left' ? 'right' : 'left';
  emit('position-changed', panelSide.value);
};

/**
 * Переключает состояние панели (свернута/развернута).
 */
const togglePanel = () => {
  isExpanded.value = !isExpanded.value;
};

/**
 * Очистка глобальных слушателей при размонтировании компонента,
 * чтобы избежать утечек памяти.
 */
onUnmounted(() => {
  stopResize();
});
</script>

<template>
  <div class="stats-panel" v-if="gameStore.gameStarted" :style="{ width: panelWidth + 'px' }">
    <div class="resizer" :class="`resizer-${panelSide}`" @mousedown.prevent="startResize"></div>
    <div class="panel-header">
      <h3>📊 {{ gameStore.player.name }}</h3>
      <div class="panel-controls">
        <button @click="toggleSide" class="toggle-btn" title="Сменить положение панели">↔</button>
        <button @click="togglePanel" class="toggle-btn" :title="isExpanded ? 'Свернуть' : 'Развернуть'">
          {{ isExpanded ? '−' : '+' }}
        </button>
      </div>
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
                :style="{ width: (gameStore.player.hitPoints / gameStore.player.maxHitPoints * 100) + '%' }"
              ></div>
              <span class="health-text">{{ gameStore.player.hitPoints }}/{{ gameStore.player.maxHitPoints }}</span>
            </div>
          </div>

          <div class="stat-group">
            <h4>🏃 Выносливость</h4>
            <div class="stamina-bar">
              <div
                class="stamina-fill"
                :style="{ width: (gameStore.player.stamina / gameStore.player.maxStamina * 100) + '%' }"
              ></div>
              <span class="stamina-text">{{ gameStore.player.stamina }}/{{ gameStore.player.maxStamina }}</span>
            </div>
          </div>

          <div v-if="gameStore.currentEnemy" class="stat-group">
            <h4>💀 Здоровье врага</h4>
            <div class="health-bar enemy-health-bar">
              <div
                class="health-fill enemy-health-fill"
                :style="{ width: (gameStore.currentEnemy.hitPoints / gameStore.currentEnemy.maxHitPoints * 100) + '%' }"
              ></div>
              <span class="health-text">
                {{ gameStore.currentEnemy.name }}: {{ gameStore.currentEnemy.hitPoints }}/{{ gameStore.currentEnemy.maxHitPoints }}
              </span>
            </div>
          </div>


          <div class="stat-group">
            <h4>⭐ Прогресс</h4>
            <div class="stat-line">Уровень: {{ gameStore.player.level }}</div>
            <div class="exp-bar">
              <div 
                class="exp-fill" 
                :style="{ width: (gameStore.player.experience / gameStore.player.experienceToNext * 100) + '%' }"
              ></div>
              <span class="exp-text">{{ gameStore.player.experience }}/{{ gameStore.player.experienceToNext }}</span>
            </div>
          </div>

          <div class="stat-group">
            <h4>📈 Характеристики</h4>
            <div class="stat-line">💪 Сила: {{ gameStore.player.strength }}</div>
            <div class="stat-line">⚡ Ловкость: {{ gameStore.player.dexterity }}</div>
            <div class="stat-line">🛡️ Телосложение: {{ gameStore.player.constitution }}</div>
            <div class="stat-line">🧠 Интеллект: {{ gameStore.player.intelligence }}</div>
            <div class="stat-line">🔮 Мудрость: {{ gameStore.player.wisdom }}</div>
            <div class="stat-line">😊 Харизма: {{ gameStore.player.charisma }}</div>
          </div>

          <div v-if="targetedSkills.length > 0" class="stat-group">
            <h4>📚 Умения</h4>
            <div v-for="skill in targetedSkills" :key="skill.id" class="skill-item" :title="skill.description">
              <div class="skill-name">{{ skill.name }}</div>
              <div class="skill-actions">
                <button
                  :class="['action-btn', { 'is-on-cooldown': gameStore.player.skillCooldowns && gameStore.player.skillCooldowns[skill.id] > 0 }]"
                  @click="handleCommand(skill.id)"
                  :disabled="gameStore.player.stamina < skill.cost || (gameStore.player.skillCooldowns && gameStore.player.skillCooldowns[skill.id] > 0)"
                  :title="gameStore.player.stamina < skill.cost ? `Нужно выносливости: ${skill.cost}` : (gameStore.player.skillCooldowns && gameStore.player.skillCooldowns[skill.id] > 0) ? `Перезарядка: ${gameStore.player.skillCooldowns[skill.id]}` : skill.description"
                >
                  Использовать
                  <span v-if="gameStore.player.skillCooldowns && gameStore.player.skillCooldowns[skill.id] > 0">
                    ({{ gameStore.player.skillCooldowns[skill.id] }})
                  </span>
                </button>
                <button
                  v-for="npc in gameStore.hostileNpcsInRoom"
                  :key="npc.id"
                  :class="['action-btn', { 'is-on-cooldown': gameStore.player.skillCooldowns && gameStore.player.skillCooldowns[skill.id] > 0 }]"
                  @click="handleCommand(`${skill.id} ${npc.name}`)"
                  :disabled="gameStore.player.stamina < skill.cost || (gameStore.player.skillCooldowns && gameStore.player.skillCooldowns[skill.id] > 0)"
                  :title="gameStore.player.stamina < skill.cost ? `Нужно выносливости: ${skill.cost}` : (gameStore.player.skillCooldowns && gameStore.player.skillCooldowns[skill.id] > 0) ? `Перезарядка: ${gameStore.player.skillCooldowns[skill.id]}` : `Применить '${skill.name}' к ${npc.name}`"
                >
                  → {{ npc.name }}
                  <span v-if="gameStore.player.skillCooldowns && gameStore.player.skillCooldowns[skill.id] > 0">
                    ({{ gameStore.player.skillCooldowns[skill.id] }})
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div v-if="gameStore.healingPotion || generalSkills.length > 0" class="stat-group">
            <h4>⚡ Быстрые действия</h4>
            <div class="quick-actions">
              <button v-if="gameStore.healingPotion"
                class="action-btn"
                @click="handleCommand(`use ${gameStore.healingPotion.name}`)"
                :disabled="gameStore.player.hitPoints >= gameStore.player.maxHitPoints"
                :title="gameStore.player.hitPoints >= gameStore.player.maxHitPoints ? 'Вы полностью здоровы' : `Использовать ${gameStore.healingPotion.name}`"
              >
                💖 Лечиться ({{ gameStore.healingPotion.name }})
              </button>
              <button
                v-for="skill in generalSkills"
                :key="skill.id"
                :class="['action-btn', { 'is-on-cooldown': gameStore.player.skillCooldowns && gameStore.player.skillCooldowns[skill.id] > 0 }]"
                @click="handleCommand(skill.id)"
                :disabled="gameStore.player.stamina < skill.cost || (gameStore.player.skillCooldowns && gameStore.player.skillCooldowns[skill.id] > 0)"
                :title="gameStore.player.stamina < skill.cost ? `Нужно выносливости: ${skill.cost}` : (gameStore.player.skillCooldowns && gameStore.player.skillCooldowns[skill.id] > 0) ? `Перезарядка: ${gameStore.player.skillCooldowns[skill.id]}` : skill.description"
              >
                {{ skill.name }}
                <span v-if="gameStore.player.skillCooldowns && gameStore.player.skillCooldowns[skill.id] > 0"> ({{ gameStore.player.skillCooldowns[skill.id] }})</span>
              </button>
            </div>
          </div>

          <div v-if="gameStore.player.state === 'fighting'" class="stat-group">
            <h4>⚔️ Действия в бою</h4>
            <div class="combat-actions">
                <button class="action-btn danger" @click="handleCommand('flee')">
                  Сбежать
                </button>
            </div>
          </div>
        </div>

        <!-- Вкладка "Инвентарь" -->
        <div v-if="activeTab === 'inventory'">
          <InventoryPanel 
            :player="gameStore.player" 
            :game-engine="gameStore.engine"
            @command="handleCommand($event)"
          />
        </div>

        <!-- Вкладка "Экипировка" -->
        <div v-if="activeTab === 'equipment'">
          <EquipmentPanel 
            :player="gameStore.player"
            @command="handleCommand($event)"
          />
        </div>

        <!-- Вкладка "Мини-карта" -->
        <div v-if="activeTab === 'map'" class="map-tab-content">
          <MapPanel @action-performed="emit('action-performed')" />

          <ActionsPanel
            :grouped-actions="gameStore.groupedActions"
            @command="handleCommand($event)"
          />

        </div>
      </div>
    </div>
    
    <RadarPanel />
  </div>
</template>

<style scoped>
.stats-panel {
  max-height: calc(100vh - 40px);
  background-color: #001100;
  border: 2px solid #00ff00;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  position: relative; /* Для resizer */
  flex-shrink: 0; /* Не сжиматься */
  border-radius: 4px;
  overflow: hidden;
}

.resizer {
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 10;
  position: absolute;
}

.resizer-left {
  right: -3px;
}

.resizer-right {
  left: -3px;
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

.panel-controls {
  display: flex;
  gap: 5px;
}

.toggle-btn {
  background: transparent;
  border: 1px solid #00ff00;
  color: #00ff00;
  width: 25px;
  height: 25px;
  display: flex;
  align-items: center;
  justify-content: center;
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

.stamina-bar {
  position: relative;
  height: 16px;
  background-color: #1a1a00;
  border: 1px solid #ffff00;
  margin: 5px 0;
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

.stamina-fill {
  height: 100%;
  background-color: #006400; /* DarkGreen */
  transition: width 0.3s ease;
}

.stamina-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #fff;
  font-size: 10px;
  text-shadow: 1px 1px 2px #000;
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