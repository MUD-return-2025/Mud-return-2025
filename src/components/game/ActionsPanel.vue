<script setup>
defineProps({
  groupedActions: {
    type: Array,
    required: true
  }
});

defineEmits(['command']);
</script>

<template>
  <div class="actions-panel">
    <h4>Действия</h4>
    <div class="actions-container">
      <div v-for="(group, groupIndex) in groupedActions" :key="groupIndex" class="action-group">
        <!-- Группа общих действий -->
        <div v-if="group.isGeneral" class="general-actions">
          <div class="action-buttons">
            <button
              v-for="action in group.actions"
              :key="action.command"
              class="action-btn"
              :class="{ danger: action.danger }"
              @click="$emit('command', action.command)"
            >
              {{ action.label }}
            </button>
          </div>
        </div>
        <!-- Группа действий с целью (NPC/предмет) -->
        <div v-else class="target-action-item">
          <div class="target-name" :class="group.target.type">{{ group.target.name }}</div>
          <div class="action-buttons">
            <button v-for="action in group.actions" :key="action.command" class="action-btn" :class="{ danger: action.danger }" @click="$emit('command', action.command)">
              {{ action.label }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.actions-panel {
  margin-top: 20px;
  border-top: 1px solid #00ff00;
  padding-top: 10px;
}

.actions-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.actions-panel h4, .target-action-item .target-name {
  color: #ffff00;
  margin: 0 0 10px 0;
  font-size: 12px;
  font-weight: bold;
}

.target-action-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 11px;
  border-bottom: 1px solid #003300;
}

.target-action-item:last-child {
  border-bottom: none;
}

.target-name {
  flex-shrink: 0;
  margin-right: 10px;
  color: #00ff00;
}

.target-name.item-name { color: #ff00ff; }
.target-name.npc-friendly { color: #55ff55; }
.target-name.npc-hostile { color: #ff4444; }
.target-name.npc-neutral { color: #aaaaaa; }

.general-actions {
  padding-bottom: 10px;
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  justify-content: flex-end;
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

.action-btn.danger:hover {
  background-color: #ff4444;
  color: #000;
}
</style>
