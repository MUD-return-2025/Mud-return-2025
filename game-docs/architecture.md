
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
  - currentPlayer: Player
  - currentRoom: Room
  - gameState: 'playing' | 'paused' | 'menu'
  - messageHistory: Array<string>
  
  + processCommand(command: string): void
  + updateGame(): void
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
  - inventory: Array<Item>
  - currentRoom: string
  
  + move(direction: string): boolean
  + attack(target: NPC): void
  + useItem(item: Item): void
  + levelUp(): void
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
2. **Команда передается в GameEngine** → processCommand()
3. **Парсер обрабатывает команду** → CommandParser.parseCommand()
4. **Выполняется игровая логика** → различные методы классов
5. **Обновляется состояние игры** → реактивные данные Vue
6. **Интерфейс автоматически перерисовывается** → Vue reactivity

## Управление состоянием

### Глобальное состояние (composables)
```javascript
// useGameState.js
export function useGameState() {
  const player = ref(new Player())
  const currentRoom = ref(null)
  const gameMessages = ref([])
  const gameState = ref('menu')
  
  return {
    player,
    currentRoom,
    gameMessages,
    gameState,
    // методы для изменения состояния
  }
}
```

### Локальное состояние компонентов
- Состояние UI (открытые панели, фокус ввода)
- Временные данные (анимации, переходы)

## Система команд

### Базовые команды
- **look** [target] - осмотреть локацию или предмет
- **go** <direction> - идти в направлении
- **get** <item> - взять предмет
- **drop** <item> - бросить предмет
- **inventory** - показать инвентарь
- **score** - показать статистику
- **help** - помощь

### Боевые команды
- **kill** <target> - атаковать цель
- **flee** - убежать из боя

### Продвинутые команды
- **use** <item> - использовать предмет
- **examine** <target> - детальный осмотр
- **say** <message> - сказать что-то
