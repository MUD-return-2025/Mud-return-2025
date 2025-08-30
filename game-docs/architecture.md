
# Архитектура игры Circle MUD Clone

## Общая архитектура

### Паттерны проектирования

1. **Model-View-ViewModel (MVVM)** - Vue.js компоненты как View, реактивные данные как ViewModel
2. **Command Pattern** - для обработки игровых команд
3. **State Pattern** - для состояний игрока (idle, fighting, dead)
4. **Factory Pattern** - для создания предметов и NPC

### Основные модули

#### 1. GameEngine (Игровой движок)
```javascript
class GameEngine {
  - player: Player
  - rooms: Map<string, Room>
  - npcs: Map<string, NPC>
  - commandParser: CommandParser
  - combatTarget: NPC | null
  - messageHistory: Array<string>
  - gameState: string
  
  + processCommand(input: string): string
  + saveGame(): void
  + loadGame(): void
}
```

#### 2. Player (Игрок)
```javascript
class Player {
  - name: string
  - level: number
  - experience: number
  - hitPoints: number
  - maxHitPoints: number
  - inventory: Array<Object> // Массив объектов предметов
  - state: 'idle' | 'fighting' | 'dead'
  - equippedWeapon: Item | null
  - equippedArmor: Item | null
  - currentRoom: string
}
```

#### 3. Room (Локация)
```javascript
class Room {
  - id: string
  - name: string
  - description: string
  - exits: Map<string, string>
  - items: Array<Item>
  - npcs: Array<NPC>
  
  + getExits(): Array<string>
  + addItem(item: Item): void
  + removeItem(itemId: string): Item
}
```

#### 4. CommandParser (Парсер команд)
```javascript
class CommandParser {
  - commands: Map<string, Function>
  
  + parseCommand(input: string): Command
  + executeCommand(command: Command): string
  + registerCommand(name: string, handler: Function): void
}
```

## Поток данных

1. **Пользователь вводит команду** → GameInput.vue
2. **GameTerminal.vue вызывает `gameEngine.processCommand()`**
3. **GameEngine использует CommandParser** для разбора и выполнения команды
4. **Команда изменяет состояние** (объекты Player, Room, NPC) внутри GameEngine
5. **GameTerminal.vue обновляет реактивный объект `player`**, что вызывает перерисовку UI (включая PlayerStatsPanel)

## Управление состоянием
Основной компонент `GameTerminal.vue` владеет единственным экземпляром `GameEngine`. Состояние игрока (`player`) является реактивным объектом (`reactive`) и передается в дочерний компонент `PlayerStatsPanel.vue` через props. `PlayerStatsPanel` отправляет команды обратно в `GameTerminal` через emit-события (`@command`, `@move`), которые затем обрабатываются `GameEngine`. Это обеспечивает однонаправленный поток данных.

## Система команд

### Базовые команды
- **look** [target] - осмотреть локацию или предмет
- **go** <direction> - идти в направлении
- **get** <item> - взять предмет
- **drop** <item> - бросить предмет
- **inventory** - показать инвентарь
- **stats** - показать статистику
- **help** - помощь

### Боевые команды
- **kill** <target> - атаковать цель

### Команды взаимодействия
- **use** <item> - использовать предмет
- **say** <message> - сказать что-то
- **equip** <item> - экипировать предмет
- **unequip** <weapon|armor> - снять предмет
- **list** - посмотреть товары
- **buy** <item> - купить предмет
- **sell** <item> - продать предмет
- **heal** - исцелиться
