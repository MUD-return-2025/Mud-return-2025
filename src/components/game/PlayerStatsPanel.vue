<script setup>
// Компонент Vue для отображения панели статистики игрока, инвентаря, экипировки и карты.
import { ref, computed, inject, watch } from 'vue';

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

/** @type {import('vue').Ref<boolean>} Состояние панели (свернута/развернута) */
const isExpanded = ref(true);
/** @type {import('vue').Ref<string>} Активная вкладка */
const activeTab = ref('stats');
/** @type {import('vue').Ref<Object|null>} Выбранный предмет в инвентаре */
const selectedItem = ref(null);

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
 * Выбирает или снимает выбор с предмета в инвентаре.
 * @param {Object} item - Объект предмета.
 */
const selectItem = (item) => {
  selectedItem.value = selectedItem.value?.globalId === item.globalId ? null : item;
};

/**
 * Отслеживает изменения в инвентаре игрока.
 * Если выбранный предмет был удален из инвентаря (например, использован или выброшен),
 * то выбор сбрасывается.
 */
watch(
  () => props.player,
  (newPlayer) => {
    if (selectedItem.value && !newPlayer.inventory.some(item => item.globalId === selectedItem.value.globalId)) {
      selectedItem.value = null;
    }
  },
  { deep: true }
);

/**
 * Обрабатывает действие с предметом (использование, выбрасывание, экипировка)
 * @param {string} command - Команда для отправки в игровой движок.
 */
const handleItemAction = (command) => {
  emit('command', command);
};

/**
 * Рассчитывает общий вес предметов в инвентаре.
 * @returns {number} Общий вес.
 */
const getTotalWeight = () => {
  return props.player.inventory.reduce((total, item) => total + (item.weight || 0), 0);
};

/**
 * Рассчитывает урон игрока.
 * @returns {string} Строка, представляющая урон (например, "1d6+2").
 */
const getPlayerDamage = () => {
  let baseDamage = '1d6';
  const strBonus = Math.floor((props.player.strength - 10) / 2);

  if (props.player.equippedWeapon) {
    baseDamage = props.player.equippedWeapon.damage || '1d6';
  }

  if (strBonus > 0) {
    return `${baseDamage}+${strBonus}`;
  } else if (strBonus < 0) {
    return `${baseDamage}${strBonus}`;
  }

  return baseDamage;
};

/**
 * Рассчитывает защиту игрока.
 * @returns {number} Значение защиты.
 */
const getPlayerDefense = () => {
  let defense = 10 + Math.floor((props.player.dexterity - 10) / 2);

  if (props.player.equippedArmor) {
    defense += props.player.equippedArmor.armor || 0;
  }

  return defense;
};

/**
 * @description Вычисляемые свойства для определения текущей зоны и комнаты.
 * Возвращают массив `[areaId, localRoomId]`.
 */
const currentRoomIds = computed(() => {
  if (!props.gameStarted || !props.player.currentRoom) return [null, null];
  return props.gameEngine._parseGlobalId(props.player.currentRoom);
});
const currentAreaId = computed(() => currentRoomIds.value[0]);
const currentLocalRoomId = computed(() => currentRoomIds.value[1]);

/**
 * @description Вычисляемое свойство, возвращающее список комнат в текущей игровой зоне.
 * @type {import('vue').ComputedRef<import('../../game/classes/Room').Room[]>}
 */
const roomsInCurrentArea = computed(() => {
  if (!currentAreaId.value || !props.gameEngine.rooms.size) return [];
  
  const rooms = [];
  for (const room of props.gameEngine.rooms.values()) {
    if (room.area === currentAreaId.value && room.map) {
      rooms.push(room);
    }
  }
  return rooms;
});

/**
 * @description Вычисляет размеры сетки для миникарты на основе координат комнат.
 */
const mapDimensions = computed(() => {
  if (roomsInCurrentArea.value.length === 0) return { cols: 1, rows: 1 };
  const rooms = roomsInCurrentArea.value;
  const maxX = Math.max(0, ...rooms.map(r => r.map.x));
  const maxY = Math.max(0, ...rooms.map(r => r.map.y));
  return { cols: maxX + 1, rows: maxY + 1 };
});

/**
 * @description Вычисляемое свойство для получения списка выходов в другие зоны.
 * @returns {Array<{direction: string, targetAreaName: string}>}
 */
const interZoneExits = computed(() => {
  if (!currentRoom.value) return [];
  const exits = [];
  // Итерируемся по карте выходов текущей комнаты
  for (const [direction, exitData] of currentRoom.value.exits.entries()) {
    // Межзоновый выход - это объект, а не строка
    if (typeof exitData === 'object' && exitData.area) {
      const area = props.gameEngine.areas.get(exitData.area);
      exits.push({
        direction,
        targetAreaName: area ? area.name : exitData.area,
      });
    }
  }
  return exits;
});

/**
 * Проверяет, доступна ли комната для посещения из текущей.
 * @param {string} localRoomId - Локальный ID комнаты.
 * @returns {boolean} true, если комната доступна.
 */
const isRoomAvailable = (localRoomId) => {
  if (!props.gameStarted) return false;
  // Для проверки доступности комнаты на карте мы предполагаем, что она находится в той же зоне.
  // Это ограничение текущей реализации карты.
  const globalRoomId = props.gameEngine._getGlobalId(localRoomId, currentAreaId.value);
  const availableRooms = props.gameEngine.getAvailableRooms();
  return availableRooms.includes(globalRoomId);
};

/**
 * Проверяет, можно ли кликнуть по комнате на карте для перемещения.
 * @param {string} localRoomId - Локальный ID комнаты.
 * @returns {boolean} true, если по комнате можно кликнуть.
 */
const isRoomClickable = (localRoomId) => {
  if (!props.gameStarted) return false;
  if (props.player.state === 'dead') return false;
  return localRoomId !== currentLocalRoomId.value && isRoomAvailable(localRoomId);
};

/**
 * Инициирует перемещение в указанную комнату.
 * @param {string} localRoomId - Локальный ID комнаты.
 */
const moveToRoom = async (localRoomId) => {
  if (!isRoomClickable(localRoomId)) return;
  const globalRoomId = props.gameEngine._getGlobalId(localRoomId, currentAreaId.value);

  const result = await props.gameEngine.moveToRoom(globalRoomId);
  if (result.success) {
    emit('move', result.message);
  } else {
    emit('command', `Ошибка: ${result.message}`);
  }
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

/**
 * @description Вычисляемое свойство, возвращающее список живых NPC в текущей комнате.
 * Зависит от `props.updateCounter`, чтобы принудительно пересчитываться,
 * когда движок сообщает об изменениях (например, смерть NPC).
 * @type {import('vue').ComputedRef<import('../../game/classes/NPC').NPC[]>}
 */
const npcsInRoom = computed(() => {
  if (!currentRoom.value) return [];
  // eslint-disable-next-line no-unused-expressions
  props.updateCounter; // Принудительная реактивность при обновлении из движка
  const areaId = currentRoom.value.area;
  return currentRoom.value.npcs
    .map(npcId => props.gameEngine.getNpc(npcId, areaId))
    .filter(npc => npc && npc.isAlive());
});

/**
 * @description Вычисляемое свойство, возвращающее список предметов в текущей комнате.
 * Зависит от `props.updateCounter` для принудительной перерисовки.
 * @type {import('vue').ComputedRef<Object[]>}
 */
const itemsInRoom = computed(() => {
  if (!currentRoom.value) return [];
  // eslint-disable-next-line no-unused-expressions
  props.updateCounter; // Принудительная реактивность при обновлении из движка
  const areaId = currentRoom.value.area;
  return currentRoom.value.items
    .map(itemId => props.gameEngine.getItem(itemId, areaId))
    .filter(Boolean);
});

/** @description Вычисляемое свойство, проверяющее, есть ли торговец в комнате. */
const hasTrader = computed(() => npcsInRoom.value.some(npc => npc.canTrade && npc.canTrade()));
/** @description Вычисляемое свойство, проверяющее, есть ли целитель в комнате. */
const hasHealer = computed(() => npcsInRoom.value.some(npc => npc.canHeal));
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
        </div>

        <!-- Вкладка "Инвентарь" -->
        <div v-if="activeTab === 'inventory'" class="inventory-content">
          <div class="weight-info">
            Вес: {{ getTotalWeight() }}/{{ player.strength * 10 }}
          </div>

          <div v-if="player.inventory.length === 0" class="empty-inventory">
            Инвентарь пуст
          </div>

          <div v-else class="inventory-list">
            <div 
              v-for="item in player.inventory" 
              :key="item.globalId"
              class="inventory-item"
              @click="selectItem(item)"
              :class="{ selected: selectedItem?.globalId === item.globalId }"
            >
              <span class="item-name">{{ item.name }}</span>
              <span class="item-weight">{{ item.weight || 0 }}кг</span>
            </div>
          </div>

          <div v-if="selectedItem" class="item-details">
            <h4>{{ selectedItem.name }}</h4>
            <p>{{ selectedItem.description }}</p>
            <div class="item-actions">
              <button 
                v-if="selectedItem.type === 'weapon'" 
                @click="handleItemAction('equip ' + selectedItem.name)"
                class="action-btn"
              >
                Экипировать
              </button>
              <button 
                v-if="selectedItem.type === 'armor'" 
                @click="handleItemAction('equip ' + selectedItem.name)"
                class="action-btn"
              >
                Экипировать
              </button>
              <button 
                v-if="selectedItem.type === 'potion'" 
                @click="handleItemAction('use ' + selectedItem.name)"
                class="action-btn"
              >
                Использовать
              </button>
              <button 
                @click="handleItemAction('drop ' + selectedItem.name)"
                class="action-btn danger"
              >
                Бросить
              </button>
            </div>
          </div>
        </div>

        <!-- Вкладка "Экипировка" -->
        <div v-if="activeTab === 'equipment'" class="equipment-content">
          <div class="equipment-slot">
            <div class="slot-label">⚔️ Оружие:</div>
            <div v-if="player.equippedWeapon" class="equipped-item">
              <span class="item-name">{{ player.equippedWeapon.name }}</span>
              <button 
                @click="$emit('command', 'unequip weapon')"
                class="unequip-btn"
              >
                Снять
              </button>
            </div>
            <div v-else class="empty-slot">Не экипировано</div>
          </div>

          <div class="equipment-slot">
            <div class="slot-label">🛡️ Броня:</div>
            <div v-if="player.equippedArmor" class="equipped-item">
              <span class="item-name">{{ player.equippedArmor.name }}</span>
              <button 
                @click="$emit('command', 'unequip armor')"
                class="unequip-btn"
              >
                Снять
              </button>
            </div>
            <div v-else class="empty-slot">Не экипировано</div>
          </div>

          <div class="combat-stats">
            <h4>⚔️ Боевые характеристики</h4>
            <div class="stat-line">Урон: {{ getPlayerDamage() }}</div>
            <div class="stat-line">Защита: {{ getPlayerDefense() }}</div>
          </div>
        </div>

        <!-- Вкладка "Мини-карта" -->
        <div v-if="activeTab === 'map'" class="map-tab-content">
          <div class="minimap">
            <div 
              class="minimap-grid"
              :style="{ 
                'grid-template-columns': `repeat(${mapDimensions.cols}, 1fr)`,
                'grid-template-rows': `repeat(${mapDimensions.rows}, auto)`
              }"
            >
              <!-- Динамическая генерация комнат -->
              <div 
                v-for="room in roomsInCurrentArea"
                :key="room.id"
                class="map-room" 
                :class="{ 
                  active: currentLocalRoomId === room.id,
                  available: isRoomAvailable(room.id),
                  clickable: isRoomClickable(room.id)
                }" 
                :style="{ 'grid-column': room.map.x + 1, 'grid-row': room.map.y + 1 }"
                @click="moveToRoom(room.id)"
              >
                <div class="room-name">{{ room.name }}</div>
              </div>
            </div>

            <!-- Блок для межзоновых переходов -->
            <div v-if="interZoneExits.length > 0" class="map-portals">
              <h4>Порталы в другие зоны</h4>
              <div class="portal-buttons">
                <button 
                  v-for="exit in interZoneExits" 
                  :key="exit.direction"
                  @click="$emit('command', 'go ' + exit.direction)"
                >
                  {{ exit.direction }} (в {{ exit.targetAreaName }})
                </button>
              </div>
            </div>

            <div class="map-legend">
              <div class="legend-item">
                <span class="legend-color current"></span>
                <span>Текущая локация</span>
              </div>
              <div class="legend-item">
                <span class="legend-color available"></span>
                <span>Доступна для перехода</span>
              </div>
              <div class="legend-item">
                <span class="legend-color unavailable"></span>
                <span>Недоступна</span>
              </div>
            </div>
          </div>

          <div class="map-actions">
            <h4>Действия</h4>
            <div class="action-buttons">
              <button @click="$emit('command', 'look')">👁️ Осмотреться</button>
              <button @click="$emit('command', 'save')">💾 Сохранить</button>
              <button @click="$emit('command', 'help')">❓ Помощь</button>
              
              <hr v-if="hasTrader || hasHealer || npcsInRoom.length || itemsInRoom.length" class="actions-divider" />

              <button v-if="hasTrader" @click="$emit('command', 'list')">💰 Торговать</button>
              <button v-if="hasHealer" @click="$emit('command', 'heal')">✨ Исцелиться</button>
              
              <template v-for="npc in npcsInRoom" :key="npc.id">
                <button @click="$emit('command', 'look ' + npc.name)">
                  👁️ Осмотреть {{ npc.name }}
                </button>
                <button @click="$emit('command', 'consider ' + npc.name)">
                  🤔 Оценить {{ npc.name }}
                </button>
                <button @click="$emit('command', 'talk ' + npc.name)">
                  💬 Поговорить с {{ npc.name }}
                </button>
                <button v-if="npc.type === 'hostile'" @click="$emit('command', 'kill ' + npc.name)">
                  ⚔️ Убить {{ npc.name }}
                </button>
              </template>

              <template v-for="item in itemsInRoom" :key="item.id">
                <button @click="$emit('command', 'look ' + item.name)">
                  👁️ Осмотреть {{ item.name }}
                </button>
                <button @click="$emit('command', 'consider ' + item.name)">
                  🤔 Оценить {{ item.name }}
                </button>
                <button @click="$emit('command', 'get ' + item.name)">
                  ✋ Взять {{ item.name }}
                </button>
              </template>
            </div>
          </div>
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

/* Инвентарь */
.weight-info {
  color: #ffff00;
  margin-bottom: 10px;
  font-size: 11px;
}

.empty-inventory {
  color: #888;
  text-align: center;
  padding: 20px;
}

.inventory-list {
  max-height: 150px;
  overflow-y: auto;
}

.inventory-item {
  display: flex;
  justify-content: space-between;
  padding: 5px;
  border: 1px solid #333;
  margin: 2px 0;
  cursor: pointer;
  transition: all 0.2s;
}

.inventory-item:hover {
  border-color: #00ff00;
  background-color: #002200;
}

.inventory-item.selected {
  border-color: #00ff00;
  background-color: #003300;
}

.item-name {
  color: #00ff00;
  font-size: 11px;
}

.item-weight {
  color: #888;
  font-size: 10px;
}

.item-details {
  margin-top: 10px;
  padding: 10px;
  border: 1px solid #00ff00;
  background-color: #002200;
}

.item-details h4 {
  margin: 0 0 5px 0;
  color: #ffff00;
}

.item-details p {
  margin: 5px 0;
  font-size: 10px;
  color: #aaa;
}

.item-actions {
  display: flex;
  gap: 5px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.action-btn {
  background: transparent;
  border: 1px solid #00ff00;
  color: #00ff00;
  padding: 3px 6px;
  font-size: 9px;
  cursor: pointer;
  font-family: 'Courier New', monospace;
}

.action-btn:hover {
  background-color: #00ff00;
  color: #000;
}

.action-btn.danger {
  border-color: #ff0000;
  color: #ff0000;
}

.action-btn.danger:hover {
  background-color: #ff0000;
  color: #fff;
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

/* Мини-карта */
.map-tab-content {
  padding: 10px;
}

.minimap {
  display: flex;
  justify-content: center;
  margin-bottom: 15px;
}

.minimap-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(4, 1fr);
  gap: 2px;
}

.map-room {
  background-color: #333;
  border: 1px solid #555;
  padding: 8px;
  text-align: center;
  font-size: 10px;
  border-radius: 3px;
  transition: all 0.2s ease;
}

.map-room.active {
  background-color: #00ff00;
  color: #000;
  border-color: #00ff00;
  box-shadow: 0 0 10px #00ff00;
}

.map-room.available {
  background-color: #004400;
  border-color: #00aa00;
}

.map-room.clickable {
  cursor: pointer;
  background-color: #006600;
}

.map-room.clickable:hover {
  background-color: #008800;
  border-color: #00ff00;
  transform: scale(1.05);
}

.room-name {
  font-weight: bold;
}

.map-legend {
  margin-top: 15px;
  padding: 10px;
  background-color: #1a1a1a;
  border-radius: 5px;
  font-size: 11px;
}

.legend-item {
  display: flex;
  align-items: center;
  margin-bottom: 5px;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  margin-right: 8px;
  border: 1px solid #555;
}

.legend-color.current {
  background-color: #00ff00;
}

.legend-color.available {
  background-color: #006600;
}

.legend-color.unavailable {
  background-color: #333;
}

.map-actions {
  margin-top: 20px;
  border-top: 1px solid #00ff00;
  padding-top: 10px;
}

.map-actions h4 {
  color: #ffff00;
  margin: 0 0 10px 0;
  font-size: 12px;
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.action-buttons button {
  font-size: 11px;
}

.actions-divider {
  width: 100%;
  border-color: #004400;
}

/* Прокрутка */
.panel-content::-webkit-scrollbar,
.inventory-list::-webkit-scrollbar {
  width: 6px;
}

.panel-content::-webkit-scrollbar-track,
.inventory-list::-webkit-scrollbar-track {
  background: #001100;
}

.panel-content::-webkit-scrollbar-thumb,
.inventory-list::-webkit-scrollbar-thumb {
  background: #00ff00;
  border-radius: 3px;
}
</style>