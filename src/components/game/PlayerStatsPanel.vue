
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
              :key="item.id"
              class="inventory-item"
              @click="selectItem(item)"
              :class="{ selected: selectedItem?.id === item.id }"
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
                @click="$emit('command', 'equip ' + selectedItem.name)"
                class="action-btn"
              >
                Экипировать
              </button>
              <button 
                v-if="selectedItem.type === 'armor'" 
                @click="$emit('command', 'equip ' + selectedItem.name)"
                class="action-btn"
              >
                Экипировать
              </button>
              <button 
                v-if="selectedItem.type === 'potion'" 
                @click="$emit('command', 'use ' + selectedItem.name)"
                class="action-btn"
              >
                Использовать
              </button>
              <button 
                @click="$emit('command', 'drop ' + selectedItem.name)"
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
        <div v-if="activeTab === 'map'" class="map-content">
          <div class="minimap">
            <div class="map-grid">
              <div class="map-row">
                <div class="map-cell empty"></div>
                <div 
                  class="map-cell room" 
                  :class="{ current: player.currentRoom === 'north_gate' }"
                  title="Северные ворота"
                >
                  С
                </div>
                <div class="map-cell empty"></div>
              </div>
              
              <div class="map-row">
                <div 
                  class="map-cell room" 
                  :class="{ current: player.currentRoom === 'west_quarter' }"
                  title="Западный квартал"
                >
                  З
                </div>
                <div 
                  class="map-cell room center" 
                  :class="{ current: player.currentRoom === 'center' }"
                  title="Центральная площадь"
                >
                  Ц
                </div>
                <div 
                  class="map-cell room" 
                  :class="{ current: player.currentRoom === 'east_quarter' }"
                  title="Восточный квартал"
                >
                  В
                </div>
              </div>
              
              <div class="map-row">
                <div class="map-cell empty"></div>
                <div 
                  class="map-cell room" 
                  :class="{ current: player.currentRoom === 'south_gate' }"
                  title="Южные ворота"
                >
                  Ю
                </div>
                <div class="map-cell empty"></div>
              </div>
              
              <div class="map-row">
                <div class="map-cell empty"></div>
                <div 
                  class="map-cell room" 
                  :class="{ current: player.currentRoom === 'temple' }"
                  title="Храм"
                >
                  Х
                </div>
                <div class="map-cell empty"></div>
              </div>
            </div>
          </div>
          
          <div class="map-legend">
            <div class="legend-item">
              <span class="legend-marker current">●</span>
              <span>Ваше местоположение</span>
            </div>
            <div class="legend-item">
              <span class="legend-marker room">○</span>
              <span>Доступная локация</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, defineProps, defineEmits } from 'vue';

const props = defineProps({
  player: Object,
  gameStarted: Boolean
});

const emit = defineEmits(['command']);

const isExpanded = ref(true);
const activeTab = ref('stats');
const selectedItem = ref(null);

const tabs = [
  { id: 'stats', name: 'Статистика' },
  { id: 'inventory', name: 'Инвентарь' },
  { id: 'equipment', name: 'Экипировка' },
  { id: 'map', name: 'Карта' }
];

const togglePanel = () => {
  isExpanded.value = !isExpanded.value;
};

const selectItem = (item) => {
  selectedItem.value = selectedItem.value?.id === item.id ? null : item;
};

const getTotalWeight = () => {
  return props.player.inventory.reduce((total, item) => total + (item.weight || 0), 0);
};

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

const getPlayerDefense = () => {
  let defense = 10 + Math.floor((props.player.dexterity - 10) / 2);
  
  if (props.player.equippedArmor) {
    defense += props.player.equippedArmor.armor || 0;
  }
  
  return defense;
};
</script>

<style scoped>
.stats-panel {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 320px;
  max-height: calc(100vh - 40px);
  background-color: #001100;
  border: 2px solid #00ff00;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  z-index: 1000;
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
.minimap {
  display: flex;
  justify-content: center;
  margin-bottom: 15px;
}

.map-grid {
  display: inline-block;
}

.map-row {
  display: flex;
}

.map-cell {
  width: 30px;
  height: 30px;
  margin: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
}

.map-cell.empty {
  background: transparent;
}

.map-cell.room {
  background-color: #003300;
  border: 1px solid #00ff00;
  color: #00ff00;
  cursor: pointer;
}

.map-cell.room.current {
  background-color: #ffff00;
  color: #000;
  animation: pulse 2s infinite;
}

.map-cell.room.center {
  border-color: #ffff00;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.map-cell:hover.room:not(.current) {
  background-color: #004400;
}

.map-legend {
  border-top: 1px solid #333;
  padding-top: 10px;
}

.legend-item {
  display: flex;
  align-items: center;
  margin: 3px 0;
  font-size: 10px;
}

.legend-marker {
  width: 12px;
  text-align: center;
  margin-right: 5px;
}

.legend-marker.current {
  color: #ffff00;
}

.legend-marker.room {
  color: #00ff00;
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
