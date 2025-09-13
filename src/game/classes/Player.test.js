import { describe, it, expect, beforeEach } from 'vitest';
import { Player } from './Player.js';

// `describe` группирует связанные тесты в один блок.
describe('Player', () => {
  let player;

  // `beforeEach` выполняется перед каждым тестом (`it`) в этом блоке.
  // Это гарантирует, что каждый тест начинается с "чистого" экземпляра игрока.
  beforeEach(() => {
    player = new Player('Тестер');
  });

  // `it` или `test` определяет отдельный тестовый сценарий.
  it('должен правильно инициализироваться с начальными значениями', () => {
    // `expect` - это утверждение. Мы "ожидаем", что какое-то значение
    // будет соответствовать определенному условию.
    expect(player.name).toBe('Тестер');
    expect(player.level).toBe(1);
    expect(player.hitPoints).toBe(20);
    expect(player.maxHitPoints).toBe(20);
    expect(player.experience).toBe(0);
    expect(player.experienceToNext).toBe(100);
    expect(player.state).toBe('idle');
  });

  it('должен корректно добавлять опыт', () => {
    player.addExperience(50);
    expect(player.experience).toBe(50);
  });

  it('должен повышать уровень при накоплении достаточного опыта', () => {
    const levelUpInfo = player.addExperience(120);

    expect(player.level).toBe(2);
    // Опыт должен стать 20 (120 - 100)
    expect(player.experience).toBe(20);
    // Опыт до следующего уровня должен обновиться
    expect(player.experienceToNext).toBe(200);
    // Здоровье должно полностью восстановиться и увеличиться
    expect(player.maxHitPoints).toBe(25);
    expect(player.hitPoints).toBe(25);
    // Проверяем, что сообщение о повышении уровня было возвращено
    expect(levelUpInfo).not.toBeNull();
    expect(levelUpInfo.message).toContain('Вы достигли 2 уровня!');
  });

  it('должен получать урон и изменять состояние на "dead" при HP <= 0', () => {
    player.takeDamage(15);
    expect(player.hitPoints).toBe(5);
    expect(player.state).toBe('idle');

    player.takeDamage(10); // Получаем урон, превышающий остаток HP
    expect(player.hitPoints).toBe(0);
    expect(player.state).toBe('dead');
    // Проверяем, что комната смерти записалась
    expect(player.deathRoom).toBe(player.currentRoom);
  });

  it('не должен позволять здоровью опускаться ниже 0', () => {
    player.takeDamage(1000);
    expect(player.hitPoints).toBe(0);
  });

  it('должен восстанавливать здоровье, но не выше максимума', () => {
    player.takeDamage(10); // HP = 10
    const healedAmount = player.heal(5);
    expect(player.hitPoints).toBe(15);
    expect(healedAmount).toBe(5);

    // Пытаемся вылечить больше, чем максимум
    const overHealedAmount = player.heal(100);
    expect(player.hitPoints).toBe(player.maxHitPoints); // HP должно быть 20
    expect(overHealedAmount).toBe(5); // Фактически вылечено 5 HP
  });

  it('должен правильно добавлять и удалять предметы из инвентаря', () => {
    const sword = { name: 'Железный меч', globalId: 'midgard:iron_sword' };
    const potion = { name: 'Зелье лечения', globalId: 'midgard:potion_heal' };

    player.addItem(sword);
    player.addItem(potion);

    expect(player.inventory.length).toBe(2);
    expect(player.findItem('меч')).toEqual(sword);

    const removedItem = player.removeItem('midgard:iron_sword');
    expect(removedItem).toEqual(sword);
    expect(player.inventory.length).toBe(1);
    expect(player.findItem('меч')).toBeUndefined();
  });
});