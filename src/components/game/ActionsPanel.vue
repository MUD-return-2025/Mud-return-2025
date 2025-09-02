<script setup>
defineProps({
  actionGroups: {
    type: Array,
    required: true
  }
});

defineEmits(['command']);
</script>

<template>
  <div class="actions-panel">
    <h4>Действия</h4>
    <div class="action-buttons-container">
      <template v-for="(group, groupIndex) in actionGroups" :key="groupIndex">
        <hr v-if="groupIndex > 0 && group.length > 0" class="actions-divider" />
        <div class="action-buttons">
          <button
            v-for="action in group"
            :key="action.command"
            class="action-btn"
            :class="{ danger: action.danger }"
            @click="$emit('command', action.command)"
          >
            {{ action.label }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.actions-panel {
  margin-top: 20px;
  border-top: 1px solid #00ff00;
  padding-top: 10px;
}

.actions-panel h4 {
  color: #ffff00;
  margin: 0 0 10px 0;
  font-size: 12px;
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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

.actions-divider {
  width: 100%;
  border: 0;
  border-top: 1px solid #004400;
  margin: 10px 0;
}
</style>
