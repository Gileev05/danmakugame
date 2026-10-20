import Phaser from 'phaser';
import { Player } from './Player';
import {
  ENEMY_SIZE,
  ENEMY_COLOR,
  ENEMY_EDGE_COLOR,
  ENEMY_SPEED,
  ENEMY_SHOOTER_COLOR,
  ENEMY_SHOOTER_EDGE_COLOR,
  ENEMY_SHOOTER_SPEED,
  ENEMY_SHOOTER_CHANCE_PERCENT,
  ENEMY_SPAWN_INTERVAL_MS,
  ENEMY_SHOOT_INTERVAL_MS,
  ENEMY_HP,
  ENEMY_BULLET_RADIUS,
  ENEMY_BULLET_COLOR,
  ENEMY_BULLET_SPEED,
  HEXAGON_HOVER_Y_MIN,
  HEXAGON_HOVER_Y_MAX,
  HEXAGON_DESCEND_SPEED,
  HEXAGON_SHOOT_INTERVAL_MS,
  HEXAGON_SPAWN_INTERVAL_MS,
  HEXAGON_SIZE,
  HEXAGON_HP,
  HEXAGON_BULLET_SPEED,
  HEXAGON_BULLET_RADIUS,
  HEXAGON_BULLET_COLOR,
  HEXAGON_ARM_DISTANCE,
  HEXAGON_INDICATOR_MS,
  HEXAGON_BULLET_FUSE_MS,
  HEXAGON_EXPLOSION_BULLET_SPEED,
  HEXAGON_EXPLOSION_COLOR,
  HEXAGON_COLOR,
  HEXAGON_EDGE_COLOR,
  SPLIT_ENEMY_SIZE,
  SPLIT_HP_DIVISOR,
  SPLIT_UP_SPEED,
  SPLIT_UP_TIME_MS,
  HOVER_Y_MIN,
  HOVER_Y_MAX,
  HOVER_DESCEND_SPEED,
  PHASE_1_DURATION_MS,
  PHASE_1_SHOOTER_START_MS,
  SPAWN_RATE_MIN,
  DIFFICULTY_PER_POWER,
} from './constants';
import { EnemyType, ExplosionShape, Difficulty } from './types';

/** Враги: обычные (летуны и стрелки), шестиугольник и их пули. */
export class EnemyManager {
  private scene: Phaser.Scene;
  private player: Player;
  private enemies: Phaser.GameObjects.Group;
  private enemyBullets: Phaser.GameObjects.Group;
  private hexagonBullets: Phaser.GameObjects.Group;
  private difficulties: Set<Difficulty> = new Set();
  private enemySpawnCooldown = 0;
  private hexagonSpawnCooldown = 0;

  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene;
    this.player = player;
    this.enemies = scene.add.group();
    this.enemyBullets = scene.add.group();
    this.hexagonBullets = scene.add.group();
  }

  getEnemies(): Phaser.GameObjects.Group {
    return this.enemies;
  }

  getEnemyBullets(): Phaser.GameObjects.Group {
    return this.enemyBullets;
  }

  getHexagonBullets(): Phaser.GameObjects.Group {
    return this.hexagonBullets;
  }

  /** Добавить активное усложнение (их может быть несколько). */
  addDifficulty(diff: Difficulty): void {
    if (diff !== null) this.difficulties.add(diff);
  }

  hasDifficulty(diff: Difficulty): boolean {
    return diff !== null && this.difficulties.has(diff);
  }

  /** Размер хитбокса врага: шестиугольник и маленькие треугольники отличаются. */
  getEnemySize(enemy: Phaser.GameObjects.Shape): number {
    const type = enemy.getData('type') as EnemyType;
    if (type === 'hexagon') return HEXAGON_SIZE;
    if (type === 'split') return SPLIT_ENEMY_SIZE;
    return ENEMY_SIZE;
  }

  update(delta: number, seconds: number, power: number, phaseTime: number): void {
    this.handleSpawning(delta, power, phaseTime);
    this.handleHexagonSpawning(delta, power);
    this.updateEnemies(seconds);
    this.updateEnemyBullets(seconds);
    this.updateHexagonBullets(seconds);
  }

  clearAll(): void {
    this.enemies.clear(true, true);
    this.enemyBullets.clear(true, true);
    this.hexagonBullets.clear(true, true);
  }

  /** Множитель сложности: 1.0 при силе 0.00, 2.0 при силе 4.00. */
  private getDifficultyMultiplier(power: number): number {
    return 1 + power * DIFFICULTY_PER_POWER;
  }

  // ── Обычные враги ──────────────────────────────────────

  private handleSpawning(delta: number, power: number, phaseTime: number): void {
    // В фазе 1 спавнрейт плавно растёт от минимума до 100%.
    const progress = Math.min(1, phaseTime / PHASE_1_DURATION_MS);
    const spawnRate = SPAWN_RATE_MIN + (1 - SPAWN_RATE_MIN) * progress;
    this.enemySpawnCooldown -= delta;
    if (this.enemySpawnCooldown > 0) return;

    this.spawnEnemy(power, phaseTime);
    this.enemySpawnCooldown =
      ENEMY_SPAWN_INTERVAL_MS / (this.getDifficultyMultiplier(power) * spawnRate);
  }

  private spawnEnemy(power: number, phaseTime: number): void {
    // В первые 30 секунд фазы 1 спавнятся только треугольники.
    const shootersAllowed = phaseTime >= PHASE_1_SHOOTER_START_MS;
    const isShooter =
      shootersAllowed && Phaser.Math.Between(1, 100) <= ENEMY_SHOOTER_CHANCE_PERCENT;
    const margin = ENEMY_SIZE / 2 + 8;
    const x = Phaser.Math.Between(margin, this.scene.scale.width - margin);
    const y = -ENEMY_SIZE / 2;
    const half = ENEMY_SIZE / 2;

    let enemy: Phaser.GameObjects.Shape;
    if (isShooter) {
      // Ромб: стрелок.
      enemy = this.scene.add
        .rectangle(x, y, ENEMY_SIZE, ENEMY_SIZE, ENEMY_SHOOTER_COLOR)
        .setAngle(45)
        .setStrokeStyle(2, ENEMY_SHOOTER_EDGE_COLOR);
    } else {
      // Треугольник остриём вниз: простой враг.
      enemy = this.scene.add
        .triangle(x, y, -half, -half, half, -half, 0, half, ENEMY_COLOR)
        .setStrokeStyle(2, ENEMY_EDGE_COLOR);
    }

    enemy.setData('type', isShooter ? 'shooter' : 'flyer');
    enemy.setData('speed', isShooter ? ENEMY_SHOOTER_SPEED : ENEMY_SPEED);
    enemy.setData('shootTimer', ENEMY_SHOOT_INTERVAL_MS);
    // Усложнение «Зависание ромбов»: ромб остаётся в верхней части экрана.
    if (isShooter && this.hasDifficulty('hover')) {
      enemy.setData('hoverY', Phaser.Math.Between(HOVER_Y_MIN, HOVER_Y_MAX));
    }
    const hp = Math.round(ENEMY_HP * this.getDifficultyMultiplier(power));
    enemy.setData('hp', hp);
    enemy.setData('maxHp', hp);

    this.enemies.add(enemy);
  }

  private updateEnemies(seconds: number): void {
    for (const child of [...this.enemies.getChildren()]) {
      const enemy = child as Phaser.GameObjects.Shape;
      const type = enemy.getData('type') as EnemyType;

      // Шестиугольник ведёт себя иначе: зависает в верхней части экрана.
      if (type === 'hexagon') {
        this.updateHexagon(enemy, seconds);
        continue;
      }
  
      // Маленький треугольник: сначала отлетает вверх, затем падает.
      if (type === 'split') {
        this.updateSplitTriangle(enemy, seconds);
        continue;
      }
  
      // Обычные враги летят вниз; ромбы с hoverY зависают вверху.
      const hoverY = enemy.getData('hoverY') as number | undefined;
      if (hoverY !== undefined) {
        if (enemy.y < hoverY) {
          enemy.y = Math.min(hoverY, enemy.y + HOVER_DESCEND_SPEED * seconds);
        }
      } else {
        enemy.y += (enemy.getData('speed') as number) * seconds;
      }
  
      if (enemy.y - ENEMY_SIZE / 2 > this.scene.scale.height) {
        enemy.destroy();
        continue;
      }
  
      if (type !== 'shooter') continue;

      const timer = (enemy.getData('shootTimer') as number) - seconds * 1000;
      if (timer <= 0) {
        this.enemyShoot(enemy);
        enemy.setData('shootTimer', ENEMY_SHOOT_INTERVAL_MS);
      } else {
        enemy.setData('shootTimer', timer);
      }
    }
  }

  /** Усложнение «Разделение треугольников»: из погибшего треугольника — 2 маленьких. */
  spawnSplitTriangles(x: number, y: number, power: number): void {
    if (!this.hasDifficulty('split')) return;
    const half = SPLIT_ENEMY_SIZE / 2;
    for (let i = 0; i < 2; i++) {
      const offset = i === 0 ? -10 : 10;
      const small = this.scene.add
        .triangle(x + offset, y, -half, -half, half, -half, 0, half, ENEMY_COLOR)
        .setStrokeStyle(2, ENEMY_EDGE_COLOR);

      small.setData('type', 'split');
      small.setData('splitTimer', SPLIT_UP_TIME_MS);
      const hp = Math.round((ENEMY_HP * this.getDifficultyMultiplier(power)) / SPLIT_HP_DIVISOR);
      small.setData('hp', hp);
      small.setData('maxHp', hp);

      this.enemies.add(small);
    }
  }

  /** Маленький треугольник: сначала вверх, затем падает как обычный. */
  private updateSplitTriangle(enemy: Phaser.GameObjects.Shape, seconds: number): void {
    const timer = (enemy.getData('splitTimer') as number) - seconds * 1000;
    if (timer > 0) {
      enemy.setData('splitTimer', timer);
      enemy.y -= SPLIT_UP_SPEED * seconds;
    } else {
      enemy.y += ENEMY_SPEED * seconds;
    }

    if (enemy.y - SPLIT_ENEMY_SIZE / 2 > this.scene.scale.height) {
      enemy.destroy();
    }
  }

  private enemyShoot(enemy: Phaser.GameObjects.Shape): void {
    const dx = this.player.x - enemy.x;
    const dy = this.player.y - enemy.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) return;

    const bullet = this.scene.add.circle(
      enemy.x,
      enemy.y + ENEMY_SIZE / 2 + ENEMY_BULLET_RADIUS,
      ENEMY_BULLET_RADIUS,
      ENEMY_BULLET_COLOR,
    );

    bullet.setData('vx', (dx / length) * ENEMY_BULLET_SPEED);
    bullet.setData('vy', (dy / length) * ENEMY_BULLET_SPEED);

    this.enemyBullets.add(bullet);
  }

  private updateEnemyBullets(seconds: number): void {
    for (const child of [...this.enemyBullets.getChildren()]) {
      const bullet = child as Phaser.GameObjects.Arc;
      bullet.x += (bullet.getData('vx') as number) * seconds;
      bullet.y += (bullet.getData('vy') as number) * seconds;

      const margin = ENEMY_BULLET_RADIUS;
      if (
        bullet.x < -margin ||
        bullet.x > this.scene.scale.width + margin ||
        bullet.y < -margin ||
        bullet.y > this.scene.scale.height + margin
      ) {
        bullet.destroy();
      }
    }
  }

  // ── Шестиугольник (усложнение) ─────────────────────────

  private handleHexagonSpawning(delta: number, power: number): void {
    if (!this.hasDifficulty('hexagon')) return;
    this.hexagonSpawnCooldown -= delta;
    if (this.hexagonSpawnCooldown > 0) return;
    this.spawnHexagon(power);
    this.hexagonSpawnCooldown = HEXAGON_SPAWN_INTERVAL_MS / this.getDifficultyMultiplier(power);
  }

  private spawnHexagon(power: number): void {
    const margin = HEXAGON_SIZE / 2 + 8;
    const x = Phaser.Math.Between(margin, this.scene.scale.width - margin);
    const y = -HEXAGON_SIZE / 2;

    const hex = this.scene.add
      .star(x, y, 6, 22, 26, HEXAGON_COLOR)
      .setStrokeStyle(2, HEXAGON_EDGE_COLOR);

    hex.setData('type', 'hexagon');
    hex.setData('hoverY', Phaser.Math.Between(HEXAGON_HOVER_Y_MIN, HEXAGON_HOVER_Y_MAX));
    hex.setData('shootTimer', HEXAGON_SHOOT_INTERVAL_MS);
    const hp = Math.round(HEXAGON_HP * this.getDifficultyMultiplier(power));
    hex.setData('hp', hp);
    hex.setData('maxHp', hp);

    this.enemies.add(hex);
  }

  /** Шестиугольник спускается до верхней части экрана и зависает. */
  private updateHexagon(hex: Phaser.GameObjects.Shape, seconds: number): void {
    const hoverY = hex.getData('hoverY') as number;
    if (hex.y < hoverY) {
      hex.y = Math.min(hoverY, hex.y + HEXAGON_DESCEND_SPEED * seconds);
    }

    const timer = (hex.getData('shootTimer') as number) - seconds * 1000;
    if (timer <= 0) {
      this.hexagonShoot(hex);
      hex.setData('shootTimer', HEXAGON_SHOOT_INTERVAL_MS);
    } else {
      hex.setData('shootTimer', timer);
    }
  }

  /** Медленный снаряд, наводящийся на игрока и взрывающийся. */
  private hexagonShoot(hex: Phaser.GameObjects.Shape): void {
    const bullet = this.scene.add.circle(
      hex.x,
      hex.y + HEXAGON_SIZE / 2,
      HEXAGON_BULLET_RADIUS,
      HEXAGON_BULLET_COLOR,
    );
    bullet.setData('fuse', HEXAGON_BULLET_FUSE_MS);
    bullet.setData('arming', false);
    bullet.setData('armTimer', 0);
    bullet.setData('shape', Phaser.Math.Between(0, 1) === 0 ? 'plus' : 'x');

    // Индикатор формы взрыва (+ или ×) перед самим взрывом.
    const indicator = this.scene.add
      .text(bullet.x, bullet.y, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
        color: '#fbbf24',
      })
      .setOrigin(0.5)
      .setStroke('#000000', 3)
      .setVisible(false);
    bullet.setData('indicator', indicator);

    this.hexagonBullets.add(bullet);
  }

  private updateHexagonBullets(seconds: number): void {
    for (const child of [...this.hexagonBullets.getChildren()]) {
      const bullet = child as Phaser.GameObjects.Arc;
      const indicator = bullet.getData('indicator') as Phaser.GameObjects.Text;
      const shape = bullet.getData('shape') as ExplosionShape;

      // Медленное наведение на игрока.
      const dx = this.player.x - bullet.x;
      const dy = this.player.y - bullet.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0) {
        bullet.x += (dx / dist) * HEXAGON_BULLET_SPEED * seconds;
        bullet.y += (dy / dist) * HEXAGON_BULLET_SPEED * seconds;
      }

      const fuse = (bullet.getData('fuse') as number) - seconds * 1000;
      bullet.setData('fuse', fuse);

      // Снаряд начинает взрываться рядом с игроком или когда таймер на исходе.
      if (
        !bullet.getData('arming') &&
        (dist < HEXAGON_ARM_DISTANCE || fuse <= HEXAGON_INDICATOR_MS)
      ) {
        bullet.setData('arming', true);
        bullet.setData('armTimer', HEXAGON_INDICATOR_MS);
      }

      const arming = bullet.getData('arming') as boolean;
      if (arming) {
        const armTimer = (bullet.getData('armTimer') as number) - seconds * 1000;
        bullet.setData('armTimer', armTimer);
        indicator.setVisible(true);
        indicator.setPosition(bullet.x, bullet.y);
        indicator.setText(shape === 'plus' ? '+' : '×');
        if (armTimer <= 0) {
          this.explodeHexagonBullet(bullet.x, bullet.y, shape);
          indicator.destroy();
          bullet.destroy();
          continue;
        }
      }

      if (fuse <= 0) {
        this.explodeHexagonBullet(bullet.x, bullet.y, shape);
        indicator.destroy();
        bullet.destroy();
      }
    }
  }

  /** Взрыв снаряда: пули в форме + или ×. */
  private explodeHexagonBullet(x: number, y: number, shape: ExplosionShape): void {
    const angles = shape === 'plus' ? [0, 90, 180, 270] : [45, 135, 225, 315];
    for (const deg of angles) {
      const rad = Phaser.Math.DegToRad(deg);
      const bullet = this.scene.add.circle(x, y, ENEMY_BULLET_RADIUS, HEXAGON_EXPLOSION_COLOR);
      bullet.setData('vx', Math.cos(rad) * HEXAGON_EXPLOSION_BULLET_SPEED);
      bullet.setData('vy', Math.sin(rad) * HEXAGON_EXPLOSION_BULLET_SPEED);
      this.enemyBullets.add(bullet);
    }
  }
}
