<template>
  <div class="radar-panel">
    <div class="panel-title">Радар</div>
    <div v-if="radarData.length === 0" class="no-hostiles">
      Поблизости нет врагов.
    </div>
    <ul v-else class="hostile-list">
      <li v-for="entry in radarData" :key="entry.direction">
        <span class="direction">{{ entry.direction }}:</span>
        <span class="hostiles">
          <span v-for="(hostile, index) in entry.hostiles" :key="hostile.name" class="hostile-entry">
            <span class="npc-hostile">{{ hostile.name }}</span>
            <span v-if="hostile.count > 1" class="hostile-count"> (x{{ hostile.count }})</span>
            <span v-if="index < entry.hostiles.length - 1">, </span>
          </span>
        </span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { useGameStore } from '../../stores/game';
import { computed } from 'vue';

const gameStore = useGameStore();
const radarData = computed(() => gameStore.radarData);
</script>

<style scoped>
.radar-panel {
  padding: 10px;
  border-top: 1px solid #00ff00;
}

.panel-title {
  color: #ffff00;
  font-weight: bold;
  margin-bottom: 8px;
  text-align: center;
}

.no-hostiles {
  color: #888;
  font-style: italic;
}

.hostile-list {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 13px;
}

.hostile-list li {
  margin-bottom: 4px;
}

.direction {
  color: #00ffff;
  text-transform: capitalize;
  margin-right: 5px;
}

.hostiles {
  color: #ccc;
}

.npc-hostile {
  color: #ff4444;
  font-weight: bold;
}

.hostile-count {
  color: #ff9999;
}
</style>