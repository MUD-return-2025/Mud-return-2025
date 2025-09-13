import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../GameEngine.js';

// Интеграционные тесты для проверки полного цикла выполнения команд
describe('Интеграционные тесты команд', () => {
  let game;

  // Перед каждым тестом создаем новый экземпляр движка и начинаем новую игру.
  // Это гарантирует, что каждый тест выполняется в чистом, предсказуемом состоянии.
  beforeEach(async () => {
    game = new GameEngine();
    // startNewGame загружает мир и устанавливает игрока в начальную комнату
    await game.startNewGame('Тестировщик');
  });

  describe('Команды передвижения', () => {
    it('должен перемещать игрока в новую комнату по команде "go <направление>"', async () => {
      const initialRoomId = game.player.currentRoom;
      expect(initialRoomId).toBe('midgard:center');

      // Выполняем команду
      const result = await game.processCommand('go север');

      // Проверяем, что игрок переместился
      expect(game.player.currentRoom).toBe('midgard:north_gate');
      expect(game.player.currentRoom).not.toBe(initialRoomId);

      // Проверяем, что сообщение содержит описание новой комнаты
      expect(result).toContain('Вы идете север.');
      expect(result).toContain('Северные ворота');
    });

    it('должен использовать псевдонимы для передвижения (например, "с")', async () => {
      await game.processCommand('с'); // псевдоним для "go север"
      expect(game.player.currentRoom).toBe('midgard:north_gate');
    });

    it('должен возвращать ошибку при попытке пойти в несуществующем направлении', async () => {
      const result = await game.processCommand('go вверх');
      expect(result).toBe('Вы не можете пойти вверх отсюда.');
      expect(game.player.currentRoom).toBe('midgard:center'); // Игрок остался на месте
    });
  });

  describe('Команды взаимодействия с предметами', () => {
    it('полный цикл: осмотреть, взять, проверить инвентарь, бросить', async () => {
      // 1. Переходим в комнату с предметом
      await game.processCommand('go восток');
      expect(game.player.currentRoom).toBe('midgard:east_quarter');

      // 2. Осматриваем предмет
      let result = await game.processCommand('look меч');
      expect(result).toContain('Хорошо сбалансированный железный меч');

      // 3. Берем предмет
      result = await game.processCommand('get железный меч');
      expect(result).toBe('Вы взяли <span class="item-name">железный меч</span>.');
      expect(game.player.inventory.length).toBe(1);
      expect(game.player.inventory[0].name).toBe('железный меч');
      expect(game.getCurrentRoom().hasItem('midgard:iron_sword')).toBe(false);

      // 4. Проверяем инвентарь
      result = await game.processCommand('inventory');
      expect(result).toContain('железный меч');

      // 5. Бросаем предмет
      result = await game.processCommand('drop меч');
      expect(result).toBe('Вы бросили <span class="item-name">железный меч</span>.');
      expect(game.player.inventory.length).toBe(0);
      expect(game.getCurrentRoom().hasItem('midgard:iron_sword')).toBe(true);
    });

    it('должен экипировать и снимать предмет', async () => {
      // Переходим в комнату и берем меч
      await game.processCommand('go восток');
      await game.processCommand('get меч');
      expect(game.player.equippedWeapon).toBeNull();

      // Экипируем
      let result = await game.processCommand('equip меч');
      expect(result).toBe('Вы экипировали железный меч.');
      expect(game.player.equippedWeapon).not.toBeNull();
      expect(game.player.equippedWeapon.id).toBe('iron_sword');
      expect(game.player.inventory.length).toBe(0); // Предмет переместился из инвентаря в слот

      // Снимаем
      result = await game.processCommand('unequip weapon');
      expect(result).toBe('Вы сняли железный меч.');
      expect(game.player.equippedWeapon).toBeNull();
      expect(game.player.inventory.length).toBe(1);
    });
  });

  describe('Информационные команды', () => {
    it('должен показывать характеристики игрока по команде "stats"', async () => {
      const result = await game.processCommand('stats');

      expect(result).toContain('Характеристики: Тестировщик');
      expect(result).toContain('Уровень:'.padEnd(15));
      expect(result).toContain('Сила:'.padEnd(13));
      expect(result).toContain('Золото:'.padEnd(14));
    });

    it('должен показывать описание комнаты по команде "look"', async () => {
      const result = await game.processCommand('look');

      // Проверяем ключевые элементы описания стартовой комнаты
      expect(result).toContain('Центральная площадь Мидгарда');
      expect(result).toContain('Выходы:');
      expect(result).toContain('север');
      expect(result).toContain('Здесь находятся:');
      expect(result).toMatch(/городской глашатай/i);
    });
  });

  describe('Команды боя', () => {
    it('должен начинать бой по команде "kill"', async () => {
      // Переходим в комнату с врагом
      await game.processCommand('go запад');
      expect(game.player.currentRoom).toBe('midgard:west_quarter');

      // Убеждаемся, что боя нет
      expect(game.player.state).toBe('idle');
      expect(game.combatManager).toBeNull();

      // Атакуем
      await game.processCommand('kill крыса');

      // Проверяем, что состояние изменилось и бой начался
      // Примечание: processCommand не вернет результат, т.к. kill асинхронная
      // и работает через onMessage. Мы проверяем состояние движка.
      expect(game.player.state).toBe('fighting');
      expect(game.combatManager).not.toBeNull();
      expect(game.combatManager.npc.name).toContain('крыса');

      // Завершаем бой, чтобы не влиять на другие тесты
      game.combatManager.stop();
    });
  });
});