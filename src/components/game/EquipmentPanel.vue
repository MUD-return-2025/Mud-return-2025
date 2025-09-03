<script setup>
const props = defineProps({
  player: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['command']);

const getPlayerDamage = () => {
  let baseDamage = '1d4'; // Урон кулаками по умолчанию, как в GameEngine
  const strBonus = Math.floor((props.player.strength - 10) / 2);

  if (props.player.equippedWeapon) {
    baseDamage = props.player.equippedWeapon.damage || '1d4';
  }

  if (strBonus > 0) {
    return `${baseDamage}+${strBonus}`;
  } else if (strBonus < 0) {
    return `${baseDamage}${strBonus}`;
  }

  return baseDamage;
};

const getPlayerDefense = () => {
  return props.player.getTotalDefense ? props.player.getTotalDefense() : 10;
};
</script>

<template>
  <div class="equipment-content">
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
</template>

<style scoped>
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

.stat-line {
  margin: 3px 0;
  font-size: 11px;
}
</style>

