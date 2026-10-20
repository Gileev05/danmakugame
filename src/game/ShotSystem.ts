import Phaser from 'phaser';
import { Player } from './Player';
import {
  BULLET_WIDTH,
  BULLET_HEIGHT,
  BULLET_COLOR,
  BULLET_BASE_SPEED,
  BULLET_SPEED_PER_POWER,
  FIRE_BASE_INTERVAL_MS,
  SHOT_BULLETS,
  SHOT_SPREAD_DEG,
  HOMING_TURN_RATE,
  HOMING_ACTIVATE_RADIUS,
  HOMING_BULLET_SPEED,
  LASER_BASE_WIDTH,
  LASER_SPREAD_DEG,
  ROCKET_BASE_SPEED,
  ROCKET_FIRE_INTERVAL_MS,
  PLAYER_HEIGHT,
  getShotTier,
} from './constants';
import { ShotType, BulletKind } from './types';

/** Стрельба игрока: базовый выстрел, самонаводка, лазер и ракеты. */
export class ShotSystem {
  private scene: Phaser.Scene;
  private player: Player;
  private enemies: Phaser.GameObjects.Group;
  private fireKey: Phaser.Input.Keyboard.Key;
  private playerBullets: Phaser.GameObjects.Group;
  private laserGraphics: Phaser.GameObjects.Graphics;
  private laserSegments: { ax: number; ay: number; bx: number; by: number }[] = [];
  private shotType: ShotType | null = null;
  private fireCooldown = 0;
  private power = 0;

  constructor(
    scene: Phaser.Scene,
    player: Player,
    enemies: Phaser.GameObjects.Group,
    fireKey: Phaser.Input.Keyboard.Key,
  ) {
    this.scene = scene;
    this.player = player;
    this.enemies = enemies;
    this.fireKey = fireKey;
    this.playerBullets = scene.add.group();
    this.laserGraphics = scene.add.graphics();
  }

  get type(): ShotType | null {
    return this.shotType;
  }

  setType(type: ShotType | null): void {
    this.shotType = type;
  }

  getBullets(): Phaser.GameObjects.Group {
    return this.playerBullets;
  }

  getLaserSegments(): { ax: number; ay: number; bx: number; by: number }[] {
    return this.laserSegments;
  }

  update(delta: number, seconds: number, power: number): void {
    this.power = power;
    this.handleFiring(delta);
    this.updatePlayerBullets(seconds);
  }

  clearBullets(): void {
    this.playerBullets.clear(true, true);
  }

  clearLaser(): void {
    this.laserGraphics.clear();
    this.laserSegments = [];
  }

  private handleFiring(delta: number): void {
    this.fireCooldown -= delta;

    // Лазер работает непрерывно, пока зажата Z.
    if (this.shotType === 'laser') {
      this.updateLaser();
      return;
    }

    if (!this.fireKey.isDown || this.fireCooldown > 0) return;

    this.fireShot();
    // Ракеты стреляют медленнее обычного выстрела.
    this.fireCooldown = this.shotType === 'rocket' ? ROCKET_FIRE_INTERVAL_MS : FIRE_BASE_INTERVAL_MS;
  }

  /** Выстрел по выбранному типу; до выбора — базовый. */
  private fireShot(): void {
    switch (this.shotType) {
      case 'homing':
        this.fireHoming();
        break;
      case 'rocket':
        this.fireRocket();
        break;
      default:
        this.fireBasic();
    }
  }

  /** Базовый выстрел: веер пуль, растёт с силой. */
  private fireBasic(): void {
    const tier = getShotTier(this.power);
    const count = SHOT_BULLETS[tier];
    const halfSpread = SHOT_SPREAD_DEG[tier];
    const speed = BULLET_BASE_SPEED + this.power * BULLET_SPEED_PER_POWER;

    for (let i = 0; i < count; i++) {
      // Угол пули: равномерно от -halfSpread до +halfSpread.
      const angleDeg = count === 1 ? 0 : -halfSpread + (i * 2 * halfSpread) / (count - 1);
      const rad = Phaser.Math.DegToRad(angleDeg);
      this.spawnPlayerBullet(Math.sin(rad) * speed, -Math.cos(rad) * speed, 'basic');
    }
  }

  /** Самонаводка: пули поворачивают к врагу, когда он рядом. */
  private fireHoming(): void {
    const tier = getShotTier(this.power);
    const count = 1 + tier;
    const speed = HOMING_BULLET_SPEED + this.power * BULLET_SPEED_PER_POWER;

    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 6;
      const rad = Phaser.Math.DegToRad(spread);
      this.spawnPlayerBullet(Math.sin(rad) * speed, -Math.cos(rad) * speed, 'homing');
    }
  }

  /** Ракеты: летят вперёд, при попадании взрываются по площади. */
  private fireRocket(): void {
    const tier = getShotTier(this.power);
    const count = 1 + tier;
    const speed = ROCKET_BASE_SPEED + this.power * BULLET_SPEED_PER_POWER;

    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 5;
      const rad = Phaser.Math.DegToRad(spread);
      this.spawnPlayerBullet(Math.sin(rad) * speed, -Math.cos(rad) * speed, 'rocket');
    }
  }

  /** Лазер: веер лучей от носа игрока до верха экрана. */
  private updateLaser(): void {
    this.laserGraphics.clear();
    this.laserSegments = [];
    if (!this.fireKey.isDown) return;

    const tier = getShotTier(this.power);
    const count = tier;
    const halfSpread = Phaser.Math.DegToRad(LASER_SPREAD_DEG);
    const nx = this.player.x;
    const ny = this.player.y - PLAYER_HEIGHT / 2;

    this.laserGraphics.lineStyle(LASER_BASE_WIDTH, 0xffffff, 0.85);
    for (let i = 0; i < count; i++) {
      const angle = count === 1 ? 0 : -halfSpread + (i * 2 * halfSpread) / (count - 1);
      const length = ny / Math.cos(angle);
      const endX = nx + Math.sin(angle) * length;
      this.laserGraphics.lineBetween(nx, ny, endX, 0);
      this.laserSegments.push({ ax: nx, ay: ny, bx: endX, by: 0 });
    }
  }

  private spawnPlayerBullet(vx: number, vy: number, kind: BulletKind = 'basic'): void {
    const bullet = this.scene.add.rectangle(
      this.player.x,
      this.player.y - PLAYER_HEIGHT / 2 - BULLET_HEIGHT / 2,
      BULLET_WIDTH,
      BULLET_HEIGHT,
      BULLET_COLOR,
    );

    bullet.setData('vx', vx);
    bullet.setData('vy', vy);
    bullet.setData('kind', kind);

    this.playerBullets.add(bullet);
  }

  private updatePlayerBullets(seconds: number): void {
    // Копия массива: внутри цикла пули могут уничтожаться.
    for (const child of [...this.playerBullets.getChildren()]) {
      const bullet = child as Phaser.GameObjects.Rectangle;
      const kind = bullet.getData('kind') as BulletKind;

      if (kind === 'homing') this.steerHomingBullet(bullet, seconds);

      bullet.x += (bullet.getData('vx') as number) * seconds;
      bullet.y += (bullet.getData('vy') as number) * seconds;

      if (
        bullet.y + BULLET_HEIGHT / 2 < 0 ||
        bullet.x < -BULLET_WIDTH ||
        bullet.x > this.scene.scale.width + BULLET_WIDTH
      ) {
        bullet.destroy();
      }
    }
  }

  /** Самонаводка: пуля летит прямо и поворачивает, только если враг рядом. */
  private steerHomingBullet(bullet: Phaser.GameObjects.Rectangle, seconds: number): void {
    let target: Phaser.GameObjects.Shape | null = null;
    let bestDist = Infinity;
    for (const enemyChild of this.enemies.getChildren()) {
      const enemy = enemyChild as Phaser.GameObjects.Shape;
      const d = Phaser.Math.Distance.Between(bullet.x, bullet.y, enemy.x, enemy.y);
      if (d < bestDist) {
        bestDist = d;
        target = enemy;
      }
    }
    if (!target || bestDist > HOMING_ACTIVATE_RADIUS) return;

    const vx = bullet.getData('vx') as number;
    const vy = bullet.getData('vy') as number;
    const speed = Math.hypot(vx, vy);
    const currentAngle = Math.atan2(vy, vx);
    const desiredAngle = Math.atan2(target.y - bullet.y, target.x - bullet.x);

    let diff = desiredAngle - currentAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    const maxTurn = HOMING_TURN_RATE * seconds;
    const newAngle = currentAngle + Phaser.Math.Clamp(diff, -maxTurn, maxTurn);
    bullet.setData('vx', Math.cos(newAngle) * speed);
    bullet.setData('vy', Math.sin(newAngle) * speed);
  }
}
