import Phaser from 'phaser';

// ── Игрок ────────────────────────────────────────────────
const PLAYER_SPEED = 260;
const PLAYER_WIDTH = 38;
const PLAYER_HEIGHT = 44;
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

// ── Пули врагов ─────────────────────────────────────────
const ENEMY_BULLET_RADIUS = 5;
const ENEMY_BULLET_COLOR = 0xf472b6;
const ENEMY_BULLET_SPEED = 240;

// ── Счёт ────────────────────────────────────────────────
const SCORE_PER_ENEMY = 100;

// ── Предметы (Touhou) ───────────────────────────────────
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

type EnemyType = 'flyer' | 'shooter';
type ItemType = 'score' | 'power';

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
 * 3 жизни. Когда они заканчиваются — экран счёта и рестарт по R / Enter.
 */
export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Triangle;
  private playerBullets!: Phaser.GameObjects.Group;
  private enemies!: Phaser.GameObjects.Group;
  private enemyBullets!: Phaser.GameObjects.Group;
  private items!: Phaser.GameObjects.Group;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private fireKey!: Phaser.Input.Keyboard.Key;

  private livesText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private powerText!: Phaser.GameObjects.Text;

  private lives = PLAYER_LIVES;
  private score = 0;
  private power = 0;
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

    // Подсказка по управлению.
    this.add
      .text(width / 2, 26, '← ↑ ↓ → — движение, Z — стрельба, собирай предметы', {
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
    if (this.gameOver) return;

    const seconds = delta / 1000;

    this.movePlayer(seconds);
    this.keepPlayerOnScreen();
    this.updatePlayerBullets(seconds);
    this.handleFiring(delta);
    this.handleSpawning(delta);
    this.updateEnemies(seconds);
    this.updateEnemyBullets(seconds);
    this.updateItems(seconds);
    this.checkCollisions();
    this.updateInvulnerability();
  }

  // ── Модель игрока ──────────────────────────────────────

  /** Кораблик: треугольник носом вверх. */
  private createPlayer(x: number, y: number): Phaser.GameObjects.Triangle {
    const halfW = PLAYER_WIDTH / 2;
    const halfH = PLAYER_HEIGHT / 2;

    return this.add
      .triangle(x, y, -halfW, halfH, halfW, halfH, 0, -halfH, PLAYER_COLOR)
      .setStrokeStyle(2, PLAYER_EDGE_COLOR);
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
    if (!this.fireKey.isDown || this.fireCooldown > 0) return;

    this.fireShot();
    this.fireCooldown = FIRE_BASE_INTERVAL_MS - this.power * FIRE_INTERVAL_PER_POWER_MS;
  }

  /** Выстрел: количество пуль и разлёт зависят от силы. */
  private fireShot(): void {
    const tier = getShotTier(this.power);
    const count = SHOT_BULLETS[tier];
    const halfSpread = SHOT_SPREAD_DEG[tier];
    const speed = BULLET_BASE_SPEED + this.power * BULLET_SPEED_PER_POWER;

    for (let i = 0; i < count; i++) {
      // Угол пули: равномерно от -halfSpread до +halfSpread.
      const angleDeg = count === 1 ? 0 : -halfSpread + (i * 2 * halfSpread) / (count - 1);
      const rad = Phaser.Math.DegToRad(angleDeg);
      this.spawnPlayerBullet(Math.sin(rad) * speed, -Math.cos(rad) * speed);
    }
  }

  private spawnPlayerBullet(vx: number, vy: number): void {
    const bullet = this.add.rectangle(
      this.player.x,
      this.player.y - PLAYER_HEIGHT / 2 - BULLET_HEIGHT / 2,
      BULLET_WIDTH,
      BULLET_HEIGHT,
      BULLET_COLOR,
    );

    bullet.setData('vx', vx);
    bullet.setData('vy', vy);

    this.playerBullets.add(bullet);
  }

  private updatePlayerBullets(seconds: number): void {
    // Копия массива: внутри цикла пули могут уничтожаться.
    for (const child of [...this.playerBullets.getChildren()]) {
      const bullet = child as Phaser.GameObjects.Rectangle;
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

  private checkCollisions(): void {
    // Пули игрока против врагов.
    for (const bulletChild of [...this.playerBullets.getChildren()]) {
      const bullet = bulletChild as Phaser.GameObjects.Rectangle;

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
          this.dropItems(enemy);
          enemy.destroy();
          this.score += SCORE_PER_ENEMY;
          this.updateHud();
          break; // одна пуля — один враг
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
