/** Общие типы игры. */

export type EnemyType = 'flyer' | 'shooter' | 'hexagon' | 'split';

/** Схема управления: клавиатура или клавиатура + мышь. */
export type ControlScheme = 'keyboard' | 'mouse';

/** Описание схемы управления для стартового меню. */
export interface ControlOption {
  scheme: ControlScheme;
  name: string;
  desc: string;
}

/** Активная способность игрока (кнопка X). */
export type AbilityType = 'blank' | 'medkit' | 'boost';

/** Описание активной способности для меню выбора и HUD. */
export interface AbilityOption {
  ability: AbilityType;
  name: string;
  desc: string;
  cooldownMs: number;
}

export type ItemType = 'score' | 'power';

export type ShotType = 'homing' | 'laser' | 'rocket';

export type BulletKind = 'basic' | 'homing' | 'rocket';

export type ExplosionShape = 'plus' | 'x';

export type Difficulty = 'hexagon' | 'split' | 'hover' | null;
