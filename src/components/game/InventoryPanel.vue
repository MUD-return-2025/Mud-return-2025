<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  player: {
    type: Object,
    required: true
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

const emit = defineEmits(['command']);

const selectedItem = ref(null);

const selectItem = (item) => {
  selectedItem.value = selectedItem.value?.globalId === item.globalId ? null : item;
};

watch(
  () => props.player.inventory,
  (newInventory) => {
    if (selectedItem.value && !newInventory.some(item => item.globalId === selectedItem.value.globalId)) {
      selectedItem.value = null;
    }
  },
  { deep: true }
);

const handleItemAction = (command) => {
  emit('command', command);
};

const getTotalWeight = () => {
  return props.player.inventory.reduce((total, item) => total + (item.weight || 0), 0);
};

const currentRoom = computed(() => {
  if (!props.gameEngine.rooms.size || !props.player.currentRoom) return null;
  return props.gameEngine.rooms.get(props.player.currentRoom);
});

const hasTrader = computed(() => {
  // eslint-disable-next-line no-unused-expressions
  props.updateCounter;
  const room = currentRoom.value;
  if (!room) return false;
  return room.npcs.some(npcId => {
    const npc = props.gameEngine.getNpc(npcId, room.area);
    return npc && npc.isAlive() && npc.canTrade && npc.canTrade();
  });
});

const traderInRoom = computed(() => {
  // eslint-disable-next-line no-unused-expressions
  props.updateCounter;
  const room = currentRoom.value;
  if (!room) return null;
  const traderId = room.npcs.find(npcId => {
    const npc = props.gameEngine.getNpc(npcId, room.area);
    return npc && npc.isAlive() && npc.canTrade && npc.canTrade();
  });
  return traderId ? props.gameEngine.getNpc(traderId, room.area) : null;
});

const traderItems = computed(() => {
  if (!traderInRoom.value) return [];
  const areaId = currentRoom.value.area;
  const shopItemIds = traderInRoom.value.getShopItems();
  return shopItemIds
    .map(itemId => props.gameEngine.getItem(itemId, areaId))
    .filter(Boolean);
});

</script>

<template>
  <div class="inventory-content">
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
          v-if="selectedItem.type === 'weapon' || selectedItem.type === 'armor'"
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
          @click="handleItemAction('look ' + selectedItem.name)"
          class="action-btn"
        >
          Осмотреть
        </button>
        <button
          @click="handleItemAction('consider ' + selectedItem.name)"
          class="action-btn"
        >
          Оценить
        </button>
        <button v-if="hasTrader" @click="handleItemAction('sell ' + selectedItem.name)" class="action-btn">
          Продать
        </button>
        <button
          @click="handleItemAction('drop ' + selectedItem.name)"
          class="action-btn danger"
        >
          Бросить
        </button>
      </div>
    </div>

    <!-- Секция торговли -->
    <div v-if="hasTrader" class="trader-shop">
      <hr class="actions-divider" />
      <h4>Товары у {{ traderInRoom.name }}</h4>
      <div v-if="traderItems.length === 0" class="empty-inventory">
        Товар закончился.
      </div>
      <div v-else class="trader-item-list">
        <div v-for="item in traderItems" :key="item.id" class="trader-item">
          <div class="trader-item-info">
            <span class="item-name">{{ item.name }}</span>
            <span class="item-price">{{ item.value || 'N/A' }} з.</span>
          </div>
          <div class="item-actions">
            <button @click="handleItemAction('look ' + item.name)" class="action-btn">
              Осмотреть
            </button>
            <button @click="handleItemAction('consider ' + item.name)" class="action-btn">
              Оценить
            </button>
            <button @click="handleItemAction('buy ' + item.name)" class="action-btn">
              Купить
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.weight-info { color: #ffff00; margin-bottom: 10px; font-size: 11px; }
.empty-inventory { color: #888; text-align: center; padding: 20px; }
.inventory-list { max-height: 150px; overflow-y: auto; }
.inventory-item { display: flex; justify-content: space-between; padding: 5px; border: 1px solid #333; margin: 2px 0; cursor: pointer; transition: all 0.2s; }
.inventory-item:hover { border-color: #00ff00; background-color: #002200; }
.inventory-item.selected { border-color: #00ff00; background-color: #003300; }
.item-name { color: #00ff00; font-size: 11px; }
.item-weight { color: #888; font-size: 10px; }
.item-details { margin-top: 10px; padding: 10px; border: 1px solid #00ff00; background-color: #002200; }
.item-details h4 { margin: 0 0 5px 0; color: #ffff00; }
.item-details p { margin: 5px 0; font-size: 10px; color: #aaa; }
.item-actions { display: flex; gap: 5px; margin-top: 8px; flex-wrap: wrap; }
.action-btn { background: transparent; border: 1px solid #00ff00; color: #00ff00; padding: 3px 6px; font-size: 10px; cursor: pointer; font-family: 'Courier New', monospace; }
.action-btn:hover { background-color: #00ff00; color: #000; }
.action-btn.danger { border-color: #ff4444; color: #ff4444; }
.action-btn.danger:hover { background-color: #ff4444; color: #000; }
.actions-divider { width: 100%; border: 0; border-top: 1px solid #004400; margin: 10px 0; }
.trader-shop { margin-top: 15px; padding-top: 10px; }
.trader-shop h4 { margin: 0 0 10px 0; color: #ffff00; font-size: 12px; }
.trader-item-list { max-height: 180px; overflow-y: auto; }
.trader-item { padding: 8px 5px; border: 1px solid #333; margin: 3px 0; background-color: #001a00; }
.trader-item-info { display: flex; justify-content: space-between; margin-bottom: 8px; }
.item-price { color: #ffff00; font-size: 11px; }
.inventory-list::-webkit-scrollbar, .trader-item-list::-webkit-scrollbar { width: 6px; }
.inventory-list::-webkit-scrollbar-track, .trader-item-list::-webkit-scrollbar-track { background: #001100; }
.inventory-list::-webkit-scrollbar-thumb, .trader-item-list::-webkit-scrollbar-thumb { background: #00ff00; border-radius: 3px; }
</style>

