import Phaser from 'phaser';

// ── Игрок ────────────────────────────────────────────────
const PLAYER_SPEED = 260;
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 50;
const PLAYER_COLOR = 0x38bdf8;
const PLAYER_EDGE_COLOR = 0x0ea5e9;
const PLAYER_Y_MARGIN = 80;
const PLAYER_HITBOX_SIZE = 14; // маленький хитбокс, как принято в данмаку
const PLAYER_LIVES = 3;
const RESPAWN_INVULN_MS = 2000;

// ── Пули игрока ─────────────────────────────────────────
const BULLET_WIDTH = 6;
const BULLET_HEIGHT = 14;
const BULLET_COLOR = 0xfff1a8;
// Скорость и темп стрельбы растут вместе с силой (0.00 → 4.00).
const BULLET_BASE_SPEED = 400;
const BULLET_SPEED_PER_POWER = 75;
const FIRE_BASE_INTERVAL_MS = 200;
const FIRE_INTERVAL_PER_POWER_MS = 25;
// Количество пуль и полуугол разлёта по уровням силы.
const SHOT_BULLETS = [1, 2, 3, 4, 5];
const SHOT_SPREAD_DEG = [0, 4, 8, 12, 16];
// Урон: пули и ракеты бьют по одному попаданию, лазер — постепенно.
const BULLET_DAMAGE = 50;
const ROCKET_DAMAGE = 60;
const LASER_DPS = 100;

// ── Враги ───────────────────────────────────────────────
const ENEMY_SIZE = 32;
const ENEMY_COLOR = 0xf87171; // просто летит вниз
const ENEMY_EDGE_COLOR = 0xdc2626;
const ENEMY_SPEED = 140;
const ENEMY_SHOOTER_COLOR = 0xc084fc; // стреляет в игрока
const ENEMY_SHOOTER_EDGE_COLOR = 0x9333ea;
const ENEMY_SHOOTER_SPEED = 90;
const ENEMY_SHOOTER_CHANCE_PERCENT = 35;
const ENEMY_SPAWN_INTERVAL_MS = 1100;
const ENEMY_SHOOT_INTERVAL_MS = 1500;
const ENEMY_HP = 100;

// ── Пули врагов ─────────────────────────────────────────
const ENEMY_BULLET_RADIUS = 5;
const ENEMY_BULLET_COLOR = 0xf472b6;
const ENEMY_BULLET_SPEED = 240;

// ── Счёт ────────────────────────────────────────────────
const SCORE_PER_ENEMY = 100;

// ── Предметы ────────────────────────────────────────────
const POWER_MAX = 4.0;
const POWER_PER_ITEM = 0.05;
const SCORE_ITEM_VALUE = 30;
const ITEM_SIZE = 10;
const ITEM_FALL_SPEED = 90;
const ITEM_MAGNET_RADIUS = 90; // предметы притягиваются к игроку
const ITEM_MAGNET_SPEED = 420;
const ITEM_SCATTER_SPEED_MIN = 60; // разлёт при взрыве
const ITEM_SCATTER_SPEED_MAX = 200;
const ITEM_SCATTER_DECAY = 3; // затухание разлёта, 1/с
const ITEM_POWER_CHANCE_PERCENT = 40; // шанс очка силы среди остальных
const ITEM_SCORE_COLOR = 0x4ade80; // зелёный — очки счёта
const ITEM_POWER_COLOR = 0xfacc15; // жёлтый — очки силы

// ── Типы стрельбы ───────────────────────────────────────
const SHOT_SELECT_POWER = 1.0; // при этой силе игрок выбирает тип
const HOMING_TURN_RATE = 4; // рад/с — поворот самонаводки
const HOMING_ACTIVATE_RADIUS = 120; // самонаводка включается рядом с врагом
const HOMING_BULLET_SPEED = 420;
const LASER_BASE_WIDTH = 6; // ширина одного луча
const LASER_SPREAD_DEG = 8; // полуугол веера лазеров
const ROCKET_BASE_SPEED = 380;
const ROCKET_FIRE_INTERVAL_MS = 450; // ракеты стреляют медленнее
const ROCKET_FIRE_INTERVAL_PER_POWER_MS = 25;
const ROCKET_EXPLOSION_RADIUS = 60; // радиус взрыва ракеты

type EnemyType = 'flyer' | 'shooter';
type ItemType = 'score' | 'power';
type ShotType = 'homing' | 'laser' | 'rocket';
type BulletKind = 'basic' | 'homing' | 'rocket';

/** Уровень стрельбы по силе: 0.00–0.99 → 0, ..., 4.00 → 4. */
function getShotTier(power: number): number {
  if (power >= POWER_MAX) return 4;
  if (power >= 3) return 3;
  if (power >= 2) return 2;
  if (power >= 1) return 1;
  return 0;
}

/**
 * Danmaku-scroll shooter.
 *
 * Управление: стрелки — движение, Z — непрерывная стрельба вверх.
 * Враги появляются сверху: простые летят вниз, стрелки целятся в игрока.
 * С врагов падают предметы: очки счёта (бонус к счёту) и очки силы
 * (усиливают стрельбу от 0.00 до 4.00).
 * При силе 1.00 игра останавливается и игрок выбирает тип стрельбы:
 * 1 — самонаводка, 2 — лазеры, 3 — ракеты.
 * 3 жизни. Когда они заканчиваются — экран счёта и рестарт по R / Enter.
 */
export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Triangle;
  private playerBullets!: Phaser.GameObjects.Group;
  private enemies!: Phaser.GameObjects.Group;
  private enemyBullets!: Phaser.GameObjects.Group;
  private items!: Phaser.GameObjects.Group;
  private laserGraphics!: Phaser.GameObjects.Graphics;
  private laserSegments: { ax: number; ay: number; bx: number; by: number }[] = [];

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private fireKey!: Phaser.Input.Keyboard.Key;

  private livesText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private powerText!: Phaser.GameObjects.Text;

  private lives = PLAYER_LIVES;
  private score = 0;
  private power = 0;
  private shotType: ShotType | null = null;
  private choosingShot = false;
  private shotMenuObjects: Phaser.GameObjects.GameObject[] = [];
  private gameOver = false;
  private fireCooldown = 0;
  private enemySpawnCooldown = 0;
  private respawnInvulnUntil = 0;

  constructor() {
    super('GameScene');
  }

  create(): void {
    // Сброс состояния: объект сцены переживает рестарт.
    this.lives = PLAYER_LIVES;
    this.score = 0;
    this.power = 0;
    this.shotType = null;
    this.choosingShot = false;
    this.shotMenuObjects = [];
    this.gameOver = false;
    this.fireCooldown = 0;
    this.enemySpawnCooldown = 0;
    this.respawnInvulnUntil = 0;

    const { width, height } = this.scale;

    this.player = this.createPlayer(width / 2, height - PLAYER_Y_MARGIN);

    this.playerBullets = this.add.group();
    this.enemies = this.add.group();
    this.enemyBullets = this.add.group();
    this.items = this.add.group();

    // Лазер: рисуется линиями, пока не выбран тип — пусто.
    this.laserGraphics = this.add.graphics();

    this.livesText = this.add.text(24, 20, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
    });
    this.scoreText = this.add
      .text(width - 24, 20, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#ffffff',
      })
      .setOrigin(1, 0);
    this.powerText = this.add.text(24, 52, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      color: '#facc15',
    });
    this.updateHud();

    // Подсказка по управлению — внизу экрана.
    this.add
      .text(width / 2, height - 20, '← ↑ ↓ → — движение, Z — стрельба, собирай предметы', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#94a3b8',
      })
      .setOrigin(0.5)
      .setAlpha(0.7);

    if (!this.input.keyboard) {
      throw new Error('Keyboard input is unavailable.');
    }

    this.cursors = this.input.keyboard.createCursorKeys();
    this.fireKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
  }

  update(_time: number, delta: number): void {
    if (this.gameOver || this.choosingShot) return;

    const seconds = delta / 1000;

    this.movePlayer(seconds);
    this.keepPlayerOnScreen();
    this.updatePlayerBullets(seconds);
    this.handleFiring(delta);
    this.handleSpawning(delta);
    this.updateEnemies(seconds);
    this.updateEnemyBullets(seconds);
    this.updateItems(seconds);
    this.checkShotSelection();
    this.checkCollisions(seconds);
    this.updateInvulnerability();
  }

  // ── Модель игрока ──────────────────────────────────────

  /** Кораблик: треугольник носом вверх. */
  private createPlayer(x: number, y: number): Phaser.GameObjects.Triangle {
    const halfW = PLAYER_WIDTH / 2;
    const halfH = PLAYER_HEIGHT / 2;

    return this.add
      .triangle(x, y, -halfW + 20, halfH, halfW + 20, halfH, 20, -halfH, PLAYER_COLOR)
      .setStrokeStyle(2, PLAYER_EDGE_COLOR)
      .setOrigin(0.5, 0.5);
  }

  // ── Движение игрока ────────────────────────────────────

  private movePlayer(seconds: number): void {
    let dx = 0;
    let dy = 0;

    if (this.cursors.left.isDown) dx -= 1;
    if (this.cursors.right.isDown) dx += 1;
    if (this.cursors.up.isDown) dy -= 1;
    if (this.cursors.down.isDown) dy += 1;

    if (dx === 0 && dy === 0) return;

    const length = Math.hypot(dx, dy);
    this.player.x += (dx / length) * PLAYER_SPEED * seconds;
    this.player.y += (dy / length) * PLAYER_SPEED * seconds;
  }

  private keepPlayerOnScreen(): void {
    const halfW = PLAYER_WIDTH / 2;
    const halfH = PLAYER_HEIGHT / 2;
    this.player.x = Phaser.Math.Clamp(this.player.x, halfW, this.scale.width - halfW);
    this.player.y = Phaser.Math.Clamp(this.player.y, halfH, this.scale.height - halfH);
  }

  // ── Стрельба игрока ────────────────────────────────────

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
    this.fireCooldown =
      this.shotType === 'rocket'
        ? ROCKET_FIRE_INTERVAL_MS - this.power * ROCKET_FIRE_INTERVAL_PER_POWER_MS
        : FIRE_BASE_INTERVAL_MS - this.power * FIRE_INTERVAL_PER_POWER_MS;
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
    const bullet = this.add.rectangle(
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
        bullet.x > this.scale.width + BULLET_WIDTH
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

  // ── Появление врагов ───────────────────────────────────

  private handleSpawning(delta: number): void {
    this.enemySpawnCooldown -= delta;
    if (this.enemySpawnCooldown > 0) return;

    this.spawnEnemy();
    this.enemySpawnCooldown = ENEMY_SPAWN_INTERVAL_MS;
  }

  private spawnEnemy(): void {
    const isShooter = Phaser.Math.Between(1, 100) <= ENEMY_SHOOTER_CHANCE_PERCENT;
    const margin = ENEMY_SIZE / 2 + 8;
    const x = Phaser.Math.Between(margin, this.scale.width - margin);
    const y = -ENEMY_SIZE / 2;
    const half = ENEMY_SIZE / 2;

    let enemy: Phaser.GameObjects.Shape;
    if (isShooter) {
      // Ромб: стрелок.
      enemy = this.add
        .rectangle(x, y, ENEMY_SIZE, ENEMY_SIZE, ENEMY_SHOOTER_COLOR)
        .setAngle(45)
        .setStrokeStyle(2, ENEMY_SHOOTER_EDGE_COLOR);
    } else {
      // Треугольник остриём вниз: простой враг.
      enemy = this.add
        .triangle(x, y, -half, -half, half, -half, 0, half, ENEMY_COLOR)
        .setStrokeStyle(2, ENEMY_EDGE_COLOR);
    }

    enemy.setData('type', isShooter ? 'shooter' : 'flyer');
    enemy.setData('speed', isShooter ? ENEMY_SHOOTER_SPEED : ENEMY_SPEED);
    enemy.setData('shootTimer', ENEMY_SHOOT_INTERVAL_MS);
    enemy.setData('hp', ENEMY_HP);

    this.enemies.add(enemy);
  }

  private updateEnemies(seconds: number): void {
    for (const child of [...this.enemies.getChildren()]) {
      const enemy = child as Phaser.GameObjects.Shape;
      const type = enemy.getData('type') as EnemyType;

      enemy.y += (enemy.getData('speed') as number) * seconds;

      if (enemy.y - ENEMY_SIZE / 2 > this.scale.height) {
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

  private enemyShoot(enemy: Phaser.GameObjects.Shape): void {
    const dx = this.player.x - enemy.x;
    const dy = this.player.y - enemy.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) return;

    const bullet = this.add.circle(
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
        bullet.x > this.scale.width + margin ||
        bullet.y < -margin ||
        bullet.y > this.scale.height + margin
      ) {
        bullet.destroy();
      }
    }
  }

  // ── Предметы ───────────────────────────────────────────

  /** Враг роняет 3–5 предметов, разлетающихся как при взрыве. */
  private dropItems(enemy: Phaser.GameObjects.Shape): void {
    const count = Phaser.Math.Between(3, 5);
    for (let i = 0; i < count; i++) {
      // Первый предмет всегда очко силы, остальные — случайно.
      const type: ItemType =
        i === 0 || Phaser.Math.Between(1, 100) <= ITEM_POWER_CHANCE_PERCENT ? 'power' : 'score';
      this.spawnItem(enemy.x, enemy.y, type);
    }
  }

  private spawnItem(x: number, y: number, type: ItemType): void {
    const color = type === 'score' ? ITEM_SCORE_COLOR : ITEM_POWER_COLOR;
    const item = this.add.circle(x, y, ITEM_SIZE / 2, color);
    item.setData('type', type);
    // Случайное направление и скорость — эффект взрыва.
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const speed = Phaser.Math.Between(ITEM_SCATTER_SPEED_MIN, ITEM_SCATTER_SPEED_MAX);
    item.setData('vx', Math.cos(angle) * speed);
    item.setData('vy', Math.sin(angle) * speed);
    this.items.add(item);
  }

  private updateItems(seconds: number): void {
    for (const child of [...this.items.getChildren()]) {
      const item = child as Phaser.GameObjects.Arc;
      const type = item.getData('type') as ItemType;

      // Затухание разлёта после взрыва.
      const decay = Math.exp(-ITEM_SCATTER_DECAY * seconds);
      const vx = (item.getData('vx') as number) * decay;
      const vy = (item.getData('vy') as number) * decay;
      item.setData('vx', vx);
      item.setData('vy', vy);

      const dx = this.player.x - item.x;
      const dy = this.player.y - item.y;
      const dist = Math.hypot(dx, dy);

      if (dist < ITEM_MAGNET_RADIUS) {
        // Магнит: предмет летит к игроку.
        item.x += (dx / dist) * ITEM_MAGNET_SPEED * seconds;
        item.y += (dy / dist) * ITEM_MAGNET_SPEED * seconds;
      } else {
        item.x += vx * seconds;
        item.y += vy * seconds + ITEM_FALL_SPEED * seconds;
      }

      if (item.y - ITEM_SIZE > this.scale.height) {
        item.destroy();
        continue;
      }

      if (this.overlapsPlayerHitbox(item.x, item.y, ITEM_SIZE, ITEM_SIZE)) {
        if (type === 'score') {
          this.score += SCORE_ITEM_VALUE;
        } else {
          this.power = Math.min(POWER_MAX, this.power + POWER_PER_ITEM);
        }
        item.destroy();
        this.updateHud();
      }
    }
  }

  // ── Столкновения ───────────────────────────────────────

  private checkCollisions(seconds: number): void {
    // Лазер бьёт врагов непрерывно.
    if (this.shotType === 'laser') {
      this.laserHitsEnemies(seconds);
    }

    // Пули игрока против врагов.
    for (const bulletChild of [...this.playerBullets.getChildren()]) {
      const bullet = bulletChild as Phaser.GameObjects.Rectangle;
      const kind = bullet.getData('kind') as BulletKind;

      // Ракета: при попадании взрывается и бьёт всех врагов рядом.
      if (kind === 'rocket') {
        for (const enemyChild of this.enemies.getChildren()) {
          const enemy = enemyChild as Phaser.GameObjects.Shape;
          if (
            this.rectsOverlap(
              bullet.x,
              bullet.y,
              BULLET_WIDTH,
              BULLET_HEIGHT,
              enemy.x,
              enemy.y,
              ENEMY_SIZE,
              ENEMY_SIZE,
            )
          ) {
            this.explodeRocket(bullet.x, bullet.y);
            bullet.destroy();
            break;
          }
        }
        continue;
      }

      for (const enemyChild of this.enemies.getChildren()) {
        const enemy = enemyChild as Phaser.GameObjects.Shape;

        if (
          this.rectsOverlap(
            bullet.x,
            bullet.y,
            BULLET_WIDTH,
            BULLET_HEIGHT,
            enemy.x,
            enemy.y,
            ENEMY_SIZE,
            ENEMY_SIZE,
          )
        ) {
          bullet.destroy();
          this.damageEnemy(enemy, BULLET_DAMAGE);
          break; // одна пуля — одно попадание
        }
      }
    }

    if (this.isPlayerInvulnerable()) return;

    // Враг касается игрока.
    for (const enemyChild of this.enemies.getChildren()) {
      const enemy = enemyChild as Phaser.GameObjects.Shape;
      if (this.overlapsPlayerHitbox(enemy.x, enemy.y, ENEMY_SIZE, ENEMY_SIZE)) {
        enemy.destroy();
        this.damagePlayer();
        return;
      }
    }

    // Пуля врага касается игрока.
    for (const bulletChild of this.enemyBullets.getChildren()) {
      const bullet = bulletChild as Phaser.GameObjects.Arc;
      const size = ENEMY_BULLET_RADIUS * 2;
      if (this.overlapsPlayerHitbox(bullet.x, bullet.y, size, size)) {
        this.damagePlayer();
        return;
      }
    }
  }

  private laserHitsEnemies(seconds: number): void {
    for (const seg of this.laserSegments) {
      for (const enemyChild of [...this.enemies.getChildren()]) {
        const enemy = enemyChild as Phaser.GameObjects.Shape;
        const d = this.distanceToSegment(seg.ax, seg.ay, seg.bx, seg.by, enemy.x, enemy.y);
        if (d < LASER_BASE_WIDTH / 2 + ENEMY_SIZE / 2) {
          this.damageEnemy(enemy, LASER_DPS * seconds);
        }
      }
    }
  }

  /** Урон врагу; при нуле здоровья — дроп предметов, очки, уничтожение. */
  private damageEnemy(enemy: Phaser.GameObjects.Shape, damage: number): void {
    const hp = (enemy.getData('hp') as number) - damage;
    if (hp > 0) {
      enemy.setData('hp', hp);
      // Визуально враг тускнеет по мере потери здоровья.
      enemy.setAlpha(0.35 + 0.65 * (hp / ENEMY_HP));
      return;
    }

    this.dropItems(enemy);
    enemy.destroy();
    this.score += SCORE_PER_ENEMY;
    this.updateHud();
  }

  /** Взрыв ракеты: урон всем врагам в радиусе + вспышка. */
  private explodeRocket(x: number, y: number): void {
    for (const enemyChild of [...this.enemies.getChildren()]) {
      const enemy = enemyChild as Phaser.GameObjects.Shape;
      const d = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (d <= ROCKET_EXPLOSION_RADIUS + ENEMY_SIZE / 2) {
        this.damageEnemy(enemy, ROCKET_DAMAGE);
      }
    }

    const flash = this.add.circle(x, y, ROCKET_EXPLOSION_RADIUS, 0xffa94d, 0.6);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.4,
      duration: 250,
      onComplete: () => flash.destroy(),
    });
  }

  private overlapsPlayerHitbox(x: number, y: number, width: number, height: number): boolean {
    return this.rectsOverlap(
      this.player.x,
      this.player.y,
      PLAYER_HITBOX_SIZE,
      PLAYER_HITBOX_SIZE,
      x,
      y,
      width,
      height,
    );
  }

  private rectsOverlap(
    ax: number,
    ay: number,
    aw: number,
    ah: number,
    bx: number,
    by: number,
    bw: number,
    bh: number,
  ): boolean {
    return Math.abs(ax - bx) * 2 < aw + bw && Math.abs(ay - by) * 2 < ah + bh;
  }

  /** Расстояние от точки до отрезка (для проверки попадания лазера). */
  private distanceToSegment(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    px: number,
    py: number,
  ): number {
    const abx = bx - ax;
    const aby = by - ay;
    const len2 = abx * abx + aby * aby;
    let t = len2 === 0 ? 0 : ((px - ax) * abx + (py - ay) * aby) / len2;
    t = Phaser.Math.Clamp(t, 0, 1);
    const cx = ax + abx * t;
    const cy = ay + aby * t;
    return Math.hypot(px - cx, py - cy);
  }

  // ── Выбор типа стрельбы ────────────────────────────────

  private checkShotSelection(): void {
    if (this.choosingShot || this.shotType !== null) return;
    if (this.power < SHOT_SELECT_POWER) return;
    this.startShotSelection();
  }

  /** Пауза геймплея и меню выбора типа стрельбы. */
  private startShotSelection(): void {
    this.choosingShot = true;
    this.playerBullets.clear(true, true);
    this.enemies.clear(true, true);
    this.enemyBullets.clear(true, true);
    this.items.clear(true, true);
    this.laserGraphics.clear();
    this.laserSegments = [];

    const { width, height } = this.scale;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8);
    const title = this.add
      .text(width / 2, height / 2 - 120, 'ВЫБЕРИ ТИП СТРЕЛЬБЫ', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '40px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    const optHoming = this.add
      .text(width / 2, height / 2 - 40, '1 — Самонаводка', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '26px',
        color: '#4ade80',
      })
      .setOrigin(0.5);
    const optLaser = this.add
      .text(width / 2, height / 2 + 10, '2 — Лазеры', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '26px',
        color: '#f472b6',
      })
      .setOrigin(0.5);
    const optRocket = this.add
      .text(width / 2, height / 2 + 60, '3 — Ракеты', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '26px',
        color: '#facc15',
      })
      .setOrigin(0.5);

    this.shotMenuObjects = [overlay, title, optHoming, optLaser, optRocket];

    if (!this.input.keyboard) return;
    this.input.keyboard.once('keydown-ONE', () => this.chooseShot('homing'));
    this.input.keyboard.once('keydown-TWO', () => this.chooseShot('laser'));
    this.input.keyboard.once('keydown-THREE', () => this.chooseShot('rocket'));
  }

  private chooseShot(type: ShotType): void {
    if (!this.choosingShot) return;
    this.shotType = type;
    this.choosingShot = false;
    for (const obj of this.shotMenuObjects) obj.destroy();
    this.shotMenuObjects = [];
  }

  // ── Жизни и конец игры ─────────────────────────────────

  private damagePlayer(): void {
    this.lives -= 1;
    this.updateHud();

    if (this.lives <= 0) {
      this.endGame();
      return;
    }

    // Возрождение внизу по центру с краткой неуязвимостью.
    this.player.setPosition(this.scale.width / 2, this.scale.height - PLAYER_Y_MARGIN);
    this.respawnInvulnUntil = this.time.now + RESPAWN_INVULN_MS;
  }

  private isPlayerInvulnerable(): boolean {
    return this.time.now < this.respawnInvulnUntil;
  }

  private updateInvulnerability(): void {
    if (this.isPlayerInvulnerable()) {
      this.player.setAlpha(this.time.now % 200 < 100 ? 0.25 : 1);
    } else if (this.player.alpha !== 1) {
      this.player.setAlpha(1);
    }
  }

  private endGame(): void {
    this.gameOver = true;

    this.player.setVisible(false);
    this.playerBullets.clear(true, true);
    this.enemies.clear(true, true);
    this.enemyBullets.clear(true, true);
    this.items.clear(true, true);
    this.laserGraphics.clear();
    this.laserSegments = [];

    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75);

    this.add
      .text(width / 2, height / 2 - 70, 'ИГРА ОКОНЧЕНА', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '46px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 10, `Счёт: ${this.score}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '34px',
        color: '#facc15',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 90, 'Нажми R или Enter, чтобы начать заново', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#cbd5e1',
      })
      .setOrigin(0.5);

    if (!this.input.keyboard) return;

    // once(): обработчики добавляются только в момент конца игры.
    this.input.keyboard.once('keydown-R', () => this.scene.restart());
    this.input.keyboard.once('keydown-ENTER', () => this.scene.restart());
    this.input.once('pointerdown', () => this.scene.restart());
  }

  // ── HUD ────────────────────────────────────────────────

  private updateHud(): void {
    this.livesText.setText(`Жизни: ${this.lives}`);
    this.scoreText.setText(`Счёт: ${this.score}`);
    this.powerText.setText(`Сила: ${this.power.toFixed(2)}`);
  }
}
