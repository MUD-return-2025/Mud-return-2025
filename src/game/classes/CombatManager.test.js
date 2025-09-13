import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CombatManager } from './CombatManager.js';
import { Player } from './Player.js';
import { NPC } from './NPC.js';

describe('CombatManager', () => {
  let player;
  let npc;
  let mockGame;
  let combatManager;

  beforeEach(() => {
    // 1. Создаем реальные экземпляры Player и NPC для теста
    player = new Player('Боец');
    npc = new NPC({
      id: 'test_rat',
      name: 'пещерная крыса',
      type: 'hostile',
      hitPoints: 15,
      maxHitPoints: 15,
      damage: '1d4',
      experience: 10,
    });

    // 2. Создаем "мок" (mock) игрового движка
    // Нам не нужен настоящий GameEngine, а только объект с методами,
    // которые вызывает CombatManager.
    mockGame = {
      player: player, // Передаем реального игрока
      onMessage: vi.fn(), // vi.fn() создает пустую функцию-шпиона
      colorize: (text) => text, // Простая функция-заглушка
      stopCombat: vi.fn(),
      checkAndAwardSkills: vi.fn(),
      world: {
        getGlobalId: (localId, areaId) => `${areaId}:${localId}`,
        npcLocationMap: {
          delete: vi.fn(),
        },
      },
      getCurrentRoom: () => ({
        removeNpc: vi.fn(),
        addItem: vi.fn(),
      }),
      tickManager: {
        scheduleNpcRespawn: vi.fn(),
      },
    };

    // 3. Инициализируем CombatManager с реальными и моковыми объектами
    combatManager = new CombatManager(mockGame, player, npc);
  });

  it('должен начинать бой и устанавливать состояние игрока в "fighting"', () => {
    // `vi.spyOn` позволяет "шпионить" за вызовами методов
    const loopSpy = vi.spyOn(combatManager, '_loop').mockImplementation(() => {});

    combatManager.start();

    expect(player.state).toBe('fighting');
    // Проверяем, что в UI было отправлено сообщение о начале боя
    expect(mockGame.onMessage).toHaveBeenCalledWith('Вы атакуете пещерная крыса!');
    // Проверяем, что основной цикл боя был запущен
    expect(loopSpy).toHaveBeenCalled();
  });

  it('должен выполнять один раунд боя: игрок атакует, NPC отвечает', async () => {
    // Задаем фиксированный урон, чтобы тест был предсказуемым
    vi.spyOn(combatManager, '_calculatePlayerDamage').mockReturnValue(5); // Мокаем сам метод расчета урона
    vi.spyOn(npc, 'rollDamage').mockReturnValue(3); // Урон от NPC

    const result = await combatManager.performCombatRound();

    // Проверяем урон по NPC
    expect(npc.hitPoints).toBe(10); // 15 - 5
    // Проверяем урон по игроку
    expect(player.hitPoints).toBe(17); // 20 - 3

    // Проверяем, что сгенерировалось правильное сообщение
    expect(result).toContain('Вы наносите 5 урона пещерная крыса.');
    expect(result).toContain('пещерная крыса наносит вам 3 урона.');
  });

  it('должен завершать бой, когда NPC повержен', async () => {
    // Устанавливаем урон игрока достаточным для убийства NPC за один удар
    vi.spyOn(combatManager, '_calculatePlayerDamage').mockReturnValue(20);

    const result = await combatManager.performCombatRound();

    expect(npc.hitPoints).toBe(0);
    expect(player.state).toBe('idle'); // Состояние игрока должно сброситься
    expect(player.experience).toBe(10); // Игрок должен получить опыт

    // Проверяем, что движку было отправлено сообщение о завершении боя
    expect(mockGame.stopCombat).toHaveBeenCalled();

    // Проверяем лог боя
    expect(result).toContain('пещерная крыса повержен!');
    expect(result).toContain('Вы получили 10 опыта.');
  });
});