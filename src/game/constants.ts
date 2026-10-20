import { ShotType, Difficulty } from './types';

// ── Игрок ────────────────────────────────────────────────
export const PLAYER_SPEED = 260;
export const PLAYER_WIDTH = 40;
export const PLAYER_HEIGHT = 50;
export const PLAYER_COLOR = 0x38bdf8;
export const PLAYER_EDGE_COLOR = 0x0ea5e9;
export const PLAYER_Y_MARGIN = 80;
export const PLAYER_HITBOX_SIZE = 14;
export const PLAYER_LIVES = 3;
export const RESPAWN_INVULN_MS = 2000;

// ── Пули игрока ─────────────────────────────────────────
export const BULLET_WIDTH = 6;
export const BULLET_HEIGHT = 14;
export const BULLET_COLOR = 0xfff1a8;
// Скорость и темп стрельбы растут вместе с силой (0.00 → 4.00).
export const BULLET_BASE_SPEED = 400;
export const BULLET_SPEED_PER_POWER = 75;
export const FIRE_BASE_INTERVAL_MS = 200;
// Количество пуль и полуугол разлёта по уровням силы.
export const SHOT_BULLETS = [1, 2, 3, 4, 5];
export const SHOT_SPREAD_DEG = [0, 4, 8, 12, 16];
// Урон: пули и ракеты бьют по одному попаданию, лазер — постепенно.
export const BULLET_DAMAGE = 50;
export const ROCKET_DAMAGE = 60;
export const LASER_DPS = 200;

// ── Враги ───────────────────────────────────────────────
export const ENEMY_SIZE = 32;
export const ENEMY_COLOR = 0xf87171; // просто летит вниз
export const ENEMY_EDGE_COLOR = 0xdc2626;
export const ENEMY_SPEED = 140;
export const ENEMY_SHOOTER_COLOR = 0xc084fc; // стреляет в игрока
export const ENEMY_SHOOTER_EDGE_COLOR = 0x9333ea;
export const ENEMY_SHOOTER_SPEED = 90;
export const ENEMY_SHOOTER_CHANCE_PERCENT = 35;
export const ENEMY_SPAWN_INTERVAL_MS = 1100;
export const ENEMY_SHOOT_INTERVAL_MS = 1500;
export const ENEMY_HP = 100;

// ── Пули врагов ─────────────────────────────────────────
export const ENEMY_BULLET_RADIUS = 5;
export const ENEMY_BULLET_COLOR = 0xf472b6;
export const ENEMY_BULLET_SPEED = 240;

// ── Счёт ────────────────────────────────────────────────
export const SCORE_PER_ENEMY = 100;

// ── Предметы ────────────────────────────────────────────
export const POWER_MAX = 4.0;
export const POWER_PER_ITEM = 0.05;
export const SCORE_ITEM_VALUE = 30;
export const ITEM_SIZE = 10;
export const ITEM_FALL_SPEED = 90;
export const ITEM_MAGNET_RADIUS = 90; // предметы притягиваются к игроку
export const ITEM_MAGNET_SPEED = 420;
export const ITEM_SCATTER_SPEED_MIN = 60; // разлёт при взрыве
export const ITEM_SCATTER_SPEED_MAX = 200;
export const ITEM_SCATTER_DECAY = 3; // затухание разлёта, 1/с
export const ITEM_POWER_CHANCE_PERCENT = 25; // шанс очка силы среди остальных
export const ITEM_SCORE_COLOR = 0x4ade80; // зелёный — очки счёта
export const ITEM_POWER_COLOR = 0xfacc15; // жёлтый — очки силы

// ── Типы стрельбы ───────────────────────────────────────
export const SHOT_SELECT_POWER = 1.0; // при этой силе игрок выбирает тип
export const HOMING_TURN_RATE = 4; // рад/с — поворот самонаводки
export const HOMING_ACTIVATE_RADIUS = 120; // самонаводка включается рядом с врагом
export const HOMING_BULLET_SPEED = 420;
export const LASER_BASE_WIDTH = 6; // ширина одного луча
export const LASER_SPREAD_DEG = 8; // полуугол веера лазеров
export const ROCKET_BASE_SPEED = 380;
export const ROCKET_FIRE_INTERVAL_MS = 450; // ракеты стреляют медленнее
export const ROCKET_FIRE_INTERVAL_PER_POWER_MS = 25;
export const ROCKET_EXPLOSION_RADIUS = 60; // радиус взрыва ракеты

// ── Усложнения ──────────────────────────────────────────
export const HEXAGON_HOVER_Y_MIN = 100; // шестиугольник остаётся в верхней части
export const HEXAGON_HOVER_Y_MAX = 180;
export const HEXAGON_DESCEND_SPEED = 60;
export const HEXAGON_SHOOT_INTERVAL_MS = 2500;
export const HEXAGON_SPAWN_INTERVAL_MS = 6000;
export const HEXAGON_SIZE = 52; // шестиугольник крупнее обычных врагов
export const HEXAGON_HP = 300; // и прочнее
export const HEXAGON_BULLET_SPEED = 60; // медленный наводящийся снаряд
export const HEXAGON_BULLET_RADIUS = 6;
export const HEXAGON_BULLET_COLOR = 0xf97316;
export const HEXAGON_ARM_DISTANCE = 200; // на этом расстоянии снаряд начинает взрываться
export const HEXAGON_INDICATOR_MS = 800; // индикатор формы перед взрывом
export const HEXAGON_BULLET_FUSE_MS = 6000; // максимум жизни снаряда
export const HEXAGON_EXPLOSION_BULLET_SPEED = 160;
export const HEXAGON_EXPLOSION_COLOR = 0xfdba74;
export const HEXAGON_COLOR = 0xf97316;
export const HEXAGON_EDGE_COLOR = 0xea580c;

// ── Усложнение «Разделение треугольников» ───────────────
export const SPLIT_ENEMY_SIZE = 20; // размер маленьких треугольников
export const SPLIT_HP_DIVISOR = 1.5; // их HP в 1.5 раза меньше
export const SPLIT_UP_SPEED = 120; // сначала отлетают вверх
export const SPLIT_UP_TIME_MS = 400; // сколько летят вверх

// ── Усложнение «Зависание ромбов» ───────────────────────
export const HOVER_Y_MIN = 200; // ромбы зависают ниже шестиугольников
export const HOVER_Y_MAX = 260;
export const HOVER_DESCEND_SPEED = 60;

// ── Сложность ───────────────────────────────────────────
export const DIFFICULTY_PER_POWER = 0.5; // множитель сложности

// ── Меню выбора типа стрельбы ───────────────────────────
export const SHOT_TYPES: ShotType[] = ['homing', 'laser', 'rocket'];
export const SHOT_NAMES: Record<ShotType, string> = {
  homing: 'Самонаводка',
  laser: 'Лазеры',
  rocket: 'Ракеты',
};
export const SHOT_COLORS: Record<ShotType, number> = {
  homing: 0x4ade80,
  laser: 0xf472b6,
  rocket: 0xfacc15,
};
export const SHOT_MENU_ICON_X = -110; // иконка слева от центра экрана
export const SHOT_MENU_LABEL_X = -70; // надпись рядом с иконкой
export const SHOT_MENU_START_Y = -60; // первая строка меню от центра
export const SHOT_MENU_STEP_Y = 70; // шаг между строками

// ── Меню выбора усложнения ──────────────────────────────
export const DIFFICULTY_OPTIONS: { diff: Difficulty; name: string; desc: string }[] = [
  { diff: 'hexagon', name: 'Шестиугольник', desc: 'Новый тип врагов' },
  {
    diff: 'split',
    name: 'Усиление треугольников 1',
    desc: 'Треугольники разделяются на 2 после смерти',
  },
  {
    diff: 'hover',
    name: 'Усиление ромбов 1',
    desc: 'Ромбы больше не улетают с поля боя',
  },
];
export const DIFF_MENU_ICON_X = -110; // иконка слева от центра экрана
export const DIFF_MENU_LABEL_X = -70; // надпись рядом с иконкой
export const DIFF_MENU_START_Y = -60; // первая строка меню от центра
export const DIFF_MENU_STEP_Y = 80; // шаг между строками

/** Уровень стрельбы по силе: 0.00–0.99 → 0, ..., 4.00 → 4. */
export function getShotTier(power: number): number {
  if (power >= POWER_MAX) return 4;
  if (power >= 3) return 3;
  if (power >= 2) return 2;
  if (power >= 1) return 1;
  return 0;
}
