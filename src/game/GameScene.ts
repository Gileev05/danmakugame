import Phaser from 'phaser';
import { Player } from './Player';
import { ShotSystem } from './ShotSystem';
import { EnemyManager } from './EnemyManager';
import { ItemManager } from './ItemManager';
import { MenuManager } from './MenuManager';
import { AbilityManager } from './AbilityManager';
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
  ABILITY_OPTIONS,
  ABILITY_SELECT_POWER,
  PLAYER_MAX_LIVES,
  CONTROL_OPTIONS,
  SHOT_NAMES,
  PLAYFIELD_WIDTH,
  UI_PANEL_WIDTH,
  UI_PANEL_COLOR,
  UI_PANEL_BORDER_COLOR,
  UI_PANEL_PADDING,
  UI_LABEL_COLOR,
  UI_VALUE_COLOR,
  UI_HEART_COLOR,
  UI_HEART_EMPTY_COLOR,
} from './constants';
import { ShotType, ItemType, BulletKind, EnemyType, Difficulty, ControlScheme } from './types';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private shotSystem!: ShotSystem;
  private enemyManager!: EnemyManager;
  private itemManager!: ItemManager;
  private menuManager!: MenuManager;
  private abilityManager!: AbilityManager;
  private fireKey!: Phaser.Input.Keyboard.Key;
  private xKey!: Phaser.Input.Keyboard.Key;
  private escKey!: Phaser.Input.Keyboard.Key;

  private livesGfx!: Phaser.GameObjects.Graphics;
  private scoreValueText!: Phaser.GameObjects.Text;
  private powerValueText!: Phaser.GameObjects.Text;
  private shotTypeValueText!: Phaser.GameObjects.Text;
  private abilityNameText!: Phaser.GameObjects.Text;
  private abilityCooldownText!: Phaser.GameObjects.Text;

  private lives = PLAYER_LIVES;
  private score = 0;
  private power = 0;
  private shotType: ShotType | null = null;
  private controlScheme: ControlScheme = 'keyboard';
  private difficultyPool: Difficulty[] = [];
  private nextDifficultyPower = SHOT_SELECT_POWER;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private gameOver = false;
  private paused = false;
  private pauseOverlay: Phaser.GameObjects.GameObject[] = [];
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
    this.controlScheme = 'keyboard';
    this.difficultyPool = DIFFICULTY_OPTIONS.map((o) => o.diff).filter(
      (d): d is Difficulty => d !== null,
    );
    this.nextDifficultyPower = SHOT_SELECT_POWER;
    this.gameOver = false;
    this.paused = false;
    this.pauseOverlay = [];
    this.respawnInvulnUntil = 0;

    const { height } = this.scale;

    if (!this.input.keyboard) {
      throw new Error('Keyboard input is unavailable.');
    }
    const cursors = this.input.keyboard.createCursorKeys();
    this.fireKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.xKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    // Пауза по Esc: слушаем событие самой клавиши (а не опрос JustDown),
    // чтобы не терять быстрые нажатия, когда keydown и keyup приходят
    // в одном кадре.
    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.escKey.on('down', () => this.togglePause());

    // ПКМ используется как кнопка способности — отключаем контекстное меню.
    this.input.mouse?.disableContextMenu();

    this.player = new Player(this, PLAYFIELD_WIDTH / 2, height - PLAYER_Y_MARGIN);
    this.enemyManager = new EnemyManager(this, this.player);
    this.shotSystem = new ShotSystem(this, this.player, this.enemyManager.getEnemies(), this.fireKey);
    this.itemManager = new ItemManager(this, this.player);
    this.abilityManager = new AbilityManager(
      this.enemyManager,
      this.itemManager,
      this.shotSystem,
      () => this.isAbilityDown(),
      () => this.healPlayer(),
    );
    this.menuManager = new MenuManager(this, cursors, this.enterKey);

    // Боковая панель UI справа: игровое поле остаётся шириной PLAYFIELD_WIDTH.
    this.add
      .rectangle(PLAYFIELD_WIDTH, 0, UI_PANEL_WIDTH, height, UI_PANEL_COLOR)
      .setOrigin(0, 0);
    this.add
      .rectangle(PLAYFIELD_WIDTH, 0, 2, height, UI_PANEL_BORDER_COLOR)
      .setOrigin(0, 0);

    // Сердечки жизней — в самом верху панели.
    this.livesGfx = this.add.graphics();

    // Счёт — сразу под жизнями.
    this.add.text(PLAYFIELD_WIDTH + UI_PANEL_PADDING, 62, 'Счёт', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: UI_LABEL_COLOR,
    });
    this.scoreValueText = this.add.text(PLAYFIELD_WIDTH + UI_PANEL_PADDING, 84, '0', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '28px',
      color: UI_VALUE_COLOR,
    });

    // Сила.
    this.add.text(PLAYFIELD_WIDTH + UI_PANEL_PADDING, 132, 'Сила', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: UI_LABEL_COLOR,
    });
    this.powerValueText = this.add.text(PLAYFIELD_WIDTH + UI_PANEL_PADDING, 154, '0.00', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      color: UI_VALUE_COLOR,
    });

    // Тип стрельбы.
    this.add.text(PLAYFIELD_WIDTH + UI_PANEL_PADDING, 202, 'Тип выстрела', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: UI_LABEL_COLOR,
    });
    this.shotTypeValueText = this.add.text(
      PLAYFIELD_WIDTH + UI_PANEL_PADDING,
      224,
      'не выбран',
      {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: UI_VALUE_COLOR,
        wordWrap: { width: UI_PANEL_WIDTH - UI_PANEL_PADDING * 2 },
      },
    );

    // Активная способность и её перезарядка.
    this.add.text(PLAYFIELD_WIDTH + UI_PANEL_PADDING, 272, 'Способность', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: UI_LABEL_COLOR,
    });
    this.abilityNameText = this.add.text(
      PLAYFIELD_WIDTH + UI_PANEL_PADDING,
      294,
      'не выбрана',
      {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: UI_VALUE_COLOR,
        wordWrap: { width: UI_PANEL_WIDTH - UI_PANEL_PADDING * 2 },
      },
    );
    this.abilityCooldownText = this.add.text(PLAYFIELD_WIDTH + UI_PANEL_PADDING, 318, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#f472b6',
    });

    this.updateHud();
    this.updateAbilityHud();

    // Перед началом игры — выбор схемы управления.
    this.menuManager.startControlSelection(CONTROL_OPTIONS, (scheme) => {
      this.controlScheme = scheme;
      this.player.setControlScheme(scheme);
      this.shotSystem.setControlScheme(scheme);
      this.menuManager.setControlScheme(scheme);
    });
  }

  update(_time: number, delta: number): void {
    if (this.gameOver) return;

    if (this.paused) return;

    // Во время выбора типа стрельбы или усложнения геймплей стоит на паузе.
    if (this.menuManager.isChoosing()) {
      this.menuManager.update();
      return;
    }

    const seconds = delta / 1000;

    this.player.update(seconds);
    this.shotSystem.update(delta, seconds, this.power);
    this.enemyManager.update(delta, seconds, this.power);
    this.abilityManager.update(delta);
    this.updateAbilityHud();
    this.itemManager.update(seconds, (type) => this.collectItem(type));
    this.checkShotSelection();
    this.checkDifficultySelection();
    this.checkAbilitySelection();
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

    // Игра просто ставится на паузу: объекты на экране остаются.
    this.menuManager.startShotSelection((type) => {
      this.shotType = type;
      this.shotSystem.setType(type);
      // Убрать лазер, если он был нарисован до выбора.
      this.shotSystem.clearLaser();
      this.updateHud();
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
    // Игра просто ставится на паузу: объекты на экране остаются.
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

  // ── Активная способность ───────────────────────────────

  /** При достижении нужной силы игрок выбирает одну активную способность. */
  private checkAbilitySelection(): void {
    if (this.menuManager.isChoosing()) return;
    if (this.abilityManager.selected !== null) return;
    if (this.power < ABILITY_SELECT_POWER) return;

    this.menuManager.startAbilitySelection(ABILITY_OPTIONS, (ability) => {
      this.abilityManager.setAbility(ability);
      this.updateAbilityHud();
    });
  }

  /** Кнопка способности: X на клавиатуре или ПКМ в схеме с мышью. */
  private isAbilityDown(): boolean {
    if (this.controlScheme === 'mouse') {
      return this.input.activePointer.rightButtonDown();
    }
    return this.xKey.isDown;
  }

  /** Лечение «Аптечкой»; false — если жизни уже на максимуме. */
  private healPlayer(): boolean {
    if (this.lives >= PLAYER_MAX_LIVES) return false;
    this.lives += 1;
    this.updateHud();
    return true;
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

    // Маленькие треугольники не роняют предметы; в фазе 1 нет очков силы.
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

  // ── Пауза ──────────────────────────────────────────────

  private togglePause(): void {
    if (this.gameOver || this.menuManager.isChoosing()) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.showPauseOverlay();
    } else {
      this.hidePauseOverlay();
    }
  }

  private showPauseOverlay(): void {
    const { width, height } = this.scale;
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75);
    const title = this.add
      .text(width / 2, height / 2 - 40, 'ПАУЗА', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '46px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    const hint = this.add
      .text(width / 2, height / 2 + 40, 'Esc — продолжить', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#94a3b8',
      })
      .setOrigin(0.5);
    this.pauseOverlay = [overlay, title, hint];
  }

  private hidePauseOverlay(): void {
    for (const obj of this.pauseOverlay) obj.destroy();
    this.pauseOverlay = [];
  }

  // ── Жизни и конец игры ─────────────────────────────────

  private damagePlayer(): void {
    this.lives -= 1;
    this.updateHud();

    if (this.lives <= 0) {
      this.endGame();
      return;
    }

    // Возрождение внизу по центру игрового поля с краткой неуязвимостью.
    this.player.setPosition(PLAYFIELD_WIDTH / 2, this.scale.height - PLAYER_Y_MARGIN);
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
    this.drawLives();
    this.scoreValueText.setText(String(this.score));
    this.powerValueText.setText(this.power.toFixed(2));
    this.shotTypeValueText.setText(
      this.shotType === null ? 'не выбран' : SHOT_NAMES[this.shotType],
    );
  }

  /** Выбранная способность и её перезарядка в боковой панели. */
  private updateAbilityHud(): void {
    if (this.abilityManager.selected === null) {
      this.abilityNameText.setText('не выбрана');
      this.abilityCooldownText.setText('');
      return;
    }

    this.abilityNameText.setText(this.abilityManager.selectedName);
    const remain = this.abilityManager.cooldownRemainingMs;
    this.abilityCooldownText.setText(remain > 0 ? `КД: ${Math.ceil(remain / 1000)} с` : 'готово');
  }

  /** Сердечки: заполненные — текущие жизни, пустые — свободные слоты. */
  private drawLives(): void {
    this.livesGfx.clear();
    for (let i = 0; i < PLAYER_MAX_LIVES; i++) {
      this.drawHeart(PLAYFIELD_WIDTH + UI_PANEL_PADDING + 14 + i * 28, 32, 18, i < this.lives);
    }
  }

  private drawHeart(x: number, y: number, size: number, filled: boolean): void {
    const r = size * 0.26;
    this.livesGfx.fillStyle(filled ? UI_HEART_COLOR : UI_HEART_EMPTY_COLOR, 1);
    this.livesGfx.fillCircle(x - r * 0.9, y - r * 0.6, r);
    this.livesGfx.fillCircle(x + r * 0.9, y - r * 0.6, r);
    this.livesGfx.fillTriangle(
      x - size * 0.5,
      y - r * 0.1,
      x + size * 0.5,
      y - r * 0.1,
      x,
      y + size * 0.6,
    );
  }
}
