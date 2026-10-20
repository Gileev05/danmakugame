/** Общие типы игры. */

export type EnemyType = 'flyer' | 'shooter' | 'hexagon' | 'split';

export type ItemType = 'score' | 'power';

export type ShotType = 'homing' | 'laser' | 'rocket';

export type BulletKind = 'basic' | 'homing' | 'rocket';

export type ExplosionShape = 'plus' | 'x';

export type Difficulty = 'hexagon' | 'split' | 'hover' | null;
