import Phaser from 'phaser';
import { Player } from './Player';
import { ShotSystem } from './ShotSystem';
import { EnemyManager } from './EnemyManager';
import { ItemManager } from './ItemManager';
import { MenuManager } from './MenuManager';
import {
  PLAYER_LIVES,
  PLAYER_Y_MARGIN,
  RESPAWN_INVULN_MS,
  PLAYER_HITBOX_SIZE,
  BULLET_WIDTH,
  BULLET_HEIGHT,
  BULLET_DAMAGE,
  ROCKET_DAMAGE,
  LASER_DPS,
  LASER_BASE_WIDTH,
  ROCKET_EXPLOSION_RADIUS,
  SCORE_PER_ENEMY,
  SCORE_ITEM_VALUE,
  POWER_MAX,
  POWER_PER_ITEM,
  SHOT_SELECT_POWER,
  ENEMY_BULLET_RADIUS,
  DIFFICULTY_OPTIONS,
} from './constants';
import { ShotType, ItemType, BulletKind, EnemyType, Difficulty } from './types';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private shotSystem!: ShotSystem;
  private enemyManager!: EnemyManager;
  private itemManager!: ItemManager;
  private menuManager!: MenuManager;
  private fireKey!: Phaser.Input.Keyboard.Key;

  private livesText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private powerText!: Phaser.GameObjects.Text;

  private lives = PLAYER_LIVES;
  private score = 0;
  private power = 0;
  private shotType: ShotType | null = null;
  private difficultyPool: Difficulty[] = [];
  private nextDifficultyPower = SHOT_SELECT_POWER;
  private gameOver = false;
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
    this.difficultyPool = DIFFICULTY_OPTIONS.map((o) => o.diff).filter(
      (d): d is Difficulty => d !== null,
    );
    this.nextDifficultyPower = SHOT_SELECT_POWER;
    this.gameOver = false;
    this.respawnInvulnUntil = 0;

    const { width, height } = this.scale;

    if (!this.input.keyboard) {
      throw new Error('Keyboard input is unavailable.');
    }
    const cursors = this.input.keyboard.createCursorKeys();
    this.fireKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);

    this.player = new Player(this, width / 2, height - PLAYER_Y_MARGIN);
    this.enemyManager = new EnemyManager(this, this.player);
    this.shotSystem = new ShotSystem(this, this.player, this.enemyManager.getEnemies(), this.fireKey);
    this.itemManager = new ItemManager(this, this.player);
    this.menuManager = new MenuManager(this, cursors, this.fireKey);

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
  }

  update(_time: number, delta: number): void {
    if (this.gameOver) return;

    // Во время выбора типа стрельбы или усложнения геймплей стоит на паузе.
    if (this.menuManager.isChoosing()) {
      this.menuManager.update();
      return;
    }

    const seconds = delta / 1000;

    this.player.update(seconds);
    this.shotSystem.update(delta, seconds, this.power);
    this.enemyManager.update(delta, seconds, this.power);
    this.itemManager.update(seconds, (type) => this.collectItem(type));
    this.checkShotSelection();
    this.checkDifficultySelection();
    this.checkCollisions(seconds);
    this.updateInvulnerability();
  }

  // ── Предметы и выбор типа стрельбы ─────────────────────

  private collectItem(type: ItemType): void {
    if (type === 'score') {
      this.score += SCORE_ITEM_VALUE;
    } else {
      this.power = Math.min(POWER_MAX, this.power + POWER_PER_ITEM);
    }
    this.updateHud();
  }

  private checkShotSelection(): void {
    if (this.menuManager.isChoosing() || this.shotType !== null) return;
    if (this.power < SHOT_SELECT_POWER) return;

    this.clearGameplayObjects();
    this.menuManager.startShotSelection((type) => {
      this.shotType = type;
      this.shotSystem.setType(type);
      this.startDifficultySelection();
    });
  }

  /** Выбор усложнения на каждую 1.00 силы из пула оставшихся. */
  private checkDifficultySelection(): void {
    if (this.menuManager.isChoosing()) return;
    if (this.difficultyPool.length === 0) return;
    if (this.power < this.nextDifficultyPower) return;
    this.startDifficultySelection();
  }

  private startDifficultySelection(): void {
    if (this.difficultyPool.length === 0) return;
    this.clearGameplayObjects();
    this.menuManager.startDifficultySelection(
      DIFFICULTY_OPTIONS.filter((o) => o.diff !== null && this.difficultyPool.includes(o.diff)),
      (diff) => {
        if (diff !== null) {
          this.difficultyPool = this.difficultyPool.filter((d) => d !== diff);
          this.enemyManager.addDifficulty(diff);
        }
        this.nextDifficultyPower += 1.0;
      },
    );
  }

  private clearGameplayObjects(): void {
    this.shotSystem.clearBullets();
    this.shotSystem.clearLaser();
    this.enemyManager.clearAll();
    this.itemManager.clearItems();
  }

  // ── Столкновения ───────────────────────────────────────

  private checkCollisions(seconds: number): void {
    // Лазер бьёт врагов непрерывно.
    if (this.shotSystem.type === 'laser') {
      this.laserHitsEnemies(seconds);
    }

    // Пули игрока против врагов.
    for (const bulletChild of [...this.shotSystem.getBullets().getChildren()]) {
      const bullet = bulletChild as Phaser.GameObjects.Rectangle;
      const kind = bullet.getData('kind') as BulletKind;

      // Ракета: при попадании взрывается и бьёт всех врагов рядом.
      if (kind === 'rocket') {
        for (const enemyChild of this.enemyManager.getEnemies().getChildren()) {
          const enemy = enemyChild as Phaser.GameObjects.Shape;
          if (
            this.rectsOverlap(
              bullet.x,
              bullet.y,
              BULLET_WIDTH,
              BULLET_HEIGHT,
              enemy.x,
              enemy.y,
              this.enemyManager.getEnemySize(enemy),
              this.enemyManager.getEnemySize(enemy),
            )
          ) {
            this.explodeRocket(bullet.x, bullet.y);
            bullet.destroy();
            break;
          }
        }
        continue;
      }

      for (const enemyChild of this.enemyManager.getEnemies().getChildren()) {
        const enemy = enemyChild as Phaser.GameObjects.Shape;

        if (
          this.rectsOverlap(
            bullet.x,
            bullet.y,
            BULLET_WIDTH,
            BULLET_HEIGHT,
            enemy.x,
            enemy.y,
            this.enemyManager.getEnemySize(enemy),
            this.enemyManager.getEnemySize(enemy),
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
    for (const enemyChild of this.enemyManager.getEnemies().getChildren()) {
      const enemy = enemyChild as Phaser.GameObjects.Shape;
      if (
        this.overlapsPlayerHitbox(
          enemy.x,
          enemy.y,
          this.enemyManager.getEnemySize(enemy),
          this.enemyManager.getEnemySize(enemy),
        )
      ) {
        enemy.destroy();
        this.damagePlayer();
        return;
      }
    }

    // Пуля врага касается игрока.
    for (const bulletChild of this.enemyManager.getEnemyBullets().getChildren()) {
      const bullet = bulletChild as Phaser.GameObjects.Arc;
      const size = ENEMY_BULLET_RADIUS * 2;
      if (this.overlapsPlayerHitbox(bullet.x, bullet.y, size, size)) {
        this.damagePlayer();
        return;
      }
    }
  }

  private laserHitsEnemies(seconds: number): void {
    for (const seg of this.shotSystem.getLaserSegments()) {
      for (const enemyChild of [...this.enemyManager.getEnemies().getChildren()]) {
        const enemy = enemyChild as Phaser.GameObjects.Shape;
        const d = this.distanceToSegment(seg.ax, seg.ay, seg.bx, seg.by, enemy.x, enemy.y);
        if (d < LASER_BASE_WIDTH / 2 + this.enemyManager.getEnemySize(enemy) / 2) {
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
      const maxHp = enemy.getData('maxHp') as number;
      enemy.setAlpha(0.35 + 0.65 * (hp / maxHp));
      return;
    }

    const enemyType = enemy.getData('type') as EnemyType;

    // Усложнение «Разделение треугольников»: из погибшего треугольника — 2 маленьких.
    if (enemyType === 'flyer' && this.enemyManager.hasDifficulty('split')) {
      this.enemyManager.spawnSplitTriangles(enemy.x, enemy.y, this.power);
    }

    // Маленькие треугольники не роняют предметы.
    if (enemyType !== 'split') {
      this.itemManager.dropItems(enemy.x, enemy.y);
    }
    enemy.destroy();
    this.score += SCORE_PER_ENEMY;
    this.updateHud();
  }

  /** Взрыв ракеты: урон всем врагам в радиусе + вспышка. */
  private explodeRocket(x: number, y: number): void {
    for (const enemyChild of [...this.enemyManager.getEnemies().getChildren()]) {
      const enemy = enemyChild as Phaser.GameObjects.Shape;
      const d = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (d <= ROCKET_EXPLOSION_RADIUS + this.enemyManager.getEnemySize(enemy) / 2) {
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
    this.clearGameplayObjects();

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
