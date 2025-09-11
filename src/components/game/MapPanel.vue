<script setup>
import { computed, defineEmits } from 'vue';
import { useGameStore } from '../../stores/game.js';
const gameStore = useGameStore();

// Определяем событие, которое компонент может генерировать
const emit = defineEmits(['action-performed']);

const currentRoomIds = computed(() => gameStore.currentRoomIds);
const currentAreaId = computed(() => gameStore.currentRoomIds[0]);
const currentLocalRoomId = computed(() => gameStore.currentRoomIds[1]);

/**
 * @description Вычисляемое свойство, возвращающее список комнат в текущей игровой зоне.
 * @type {import('vue').ComputedRef<import('../../game/classes/Room').Room[]>}
 */
const roomsInCurrentArea = computed(() => {
  if (!currentAreaId.value || !gameStore.engine.world.rooms.size) return [];
  
  const rooms = [];
  for (const room of gameStore.engine.world.rooms.values()) {
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
  if (!gameStore.currentRoom) return [];
  const exits = [];
  // Итерируемся по карте выходов текущей комнаты
  for (const [direction, exitData] of gameStore.currentRoom.exits.entries()) {
    // Межзоновый выход - это объект, а не строка
    if (typeof exitData === 'object' && exitData.area) {
      const area = gameStore.engine.world.areas.get(exitData.area);
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
  if (!gameStore.gameStarted) return false;
  // Для проверки доступности комнаты на карте мы предполагаем, что она находится в той же зоне.
  // Это ограничение текущей реализации карты.
  const globalRoomId = gameStore.engine.world.getGlobalId(localRoomId, currentAreaId.value);
  const availableRooms = gameStore.engine.getAvailableRooms();
  return availableRooms.includes(globalRoomId);
};

/**
 * Проверяет, можно ли кликнуть по комнате на карте для перемещения.
 * @param {string} localRoomId - Локальный ID комнаты.
 * @returns {boolean} true, если по комнате можно кликнуть.
 */
const isRoomClickable = (localRoomId) => {
  if (!gameStore.gameStarted) return false;
  if (gameStore.player.state === 'dead') return false;
  return localRoomId !== currentLocalRoomId.value && isRoomAvailable(localRoomId);
};

/**
 * Инициирует перемещение в указанную комнату.
 * @param {string} localRoomId - Локальный ID комнаты.
 */
const moveToRoom = async (localRoomId) => {
  if (!isRoomClickable(localRoomId)) return;

  const globalTargetRoomId = gameStore.engine.world.getGlobalId(localRoomId, currentAreaId.value);

  // Находим направление, которое ведет в целевую комнату, чтобы сформировать команду
  let direction = null;
  const currentRoom = gameStore.currentRoom;

  if (currentRoom && currentRoom.exits) {
    for (const [dir, exitData] of currentRoom.exits.entries()) {
      const exitGlobalId = (typeof exitData === 'object')
        ? gameStore.engine.world.getGlobalId(exitData.room, exitData.area)
        : gameStore.engine.world.getGlobalId(exitData, currentRoom.area);

      if (exitGlobalId === globalTargetRoomId) {
        direction = dir;
        break;
      }
    }
  }

  // Если нашли направление, выполняем команду "go", чтобы она отобразилась в терминале
  if (direction) {
    await gameStore.processCommand(`go ${direction}`);
  } else {
    // Этого не должно произойти, если isRoomClickable работает правильно,
    // но оставляем как запасной вариант прямого перемещения.
    console.warn(`Could not find direction for room ${globalTargetRoomId}. Moving directly.`);
    await gameStore.moveToRoom(globalTargetRoomId);
  }

  // Сообщаем родительскому компоненту, что действие выполнено, чтобы он мог вернуть фокус
  emit('action-performed');
};
</script>

<template>
  <div class="minimap-container">
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
        :title="isRoomClickable(room.id) ? `Перейти в: ${room.name}` : room.name"
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
          @click="gameStore.processCommand('go ' + exit.direction); emit('action-performed')"
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
</template>

<style scoped>
.minimap-container {
  display: flex;
  flex-direction: column;
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

.map-portals {
  margin-top: 15px;
  padding-top: 10px;
  border-top: 1px solid #004400;
}

.map-portals h4 {
  margin: 0 0 8px 0;
  color: #ffff00;
  font-size: 12px;
  text-align: center;
}

.portal-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  justify-content: center;
}

.portal-buttons button {
  background: transparent;
  border: 1px solid #00ff00;
  color: #00ff00;
  padding: 3px 6px;
  font-size: 10px;
  cursor: pointer;
  font-family: 'Courier New', monospace;
}

.portal-buttons button:hover {
  background-color: #00ff00;
  color: #000;
}

.map-legend {
  margin-top: 15px;
  padding: 10px;
  background-color: #001a00;
  border: 1px solid #004400;
  border-radius: 3px;
  font-size: 11px;
  display: flex;
  justify-content: space-around;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.legend-item {
  display: flex;
  align-items: center;
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
</style>