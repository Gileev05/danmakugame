import Phaser from 'phaser';
import {
  SHOT_TYPES,
  SHOT_NAMES,
  SHOT_COLORS,
  SHOT_MENU_ICON_X,
  SHOT_MENU_LABEL_X,
  SHOT_MENU_START_Y,
  SHOT_MENU_STEP_Y,
  DIFF_MENU_ICON_X,
  DIFF_MENU_LABEL_X,
  DIFF_MENU_START_Y,
  DIFF_MENU_STEP_Y,
  HEXAGON_COLOR,
  HEXAGON_EDGE_COLOR,
  ENEMY_COLOR,
  ENEMY_SHOOTER_COLOR,
} from './constants';
import { ShotType, Difficulty } from './types';

/** Меню выбора типа стрельбы и усложнения: ↑ ↓ — выбор, Z — подтвердить. */
export class MenuManager {
  private scene: Phaser.Scene;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private fireKey: Phaser.Input.Keyboard.Key;

  private choosingShot = false;
  private shotMenuObjects: Phaser.GameObjects.GameObject[] = [];
  private shotMenuIndex = 0;
  private shotMenuTexts: Phaser.GameObjects.Text[] = [];
  private shotMenuIcons: Phaser.GameObjects.Graphics[] = [];
  private shotMenuMarker!: Phaser.GameObjects.Text;
  private shotMenuUpWasDown = false;
  private shotMenuDownWasDown = false;
  private shotMenuZWasDown = false;
  private onShotChosen: ((type: ShotType) => void) | null = null;

  private choosingDifficulty = false;
  private difficultyMenuObjects: Phaser.GameObjects.GameObject[] = [];
  private difficultyMenuIndex = 0;
  private difficultyMenuTexts: Phaser.GameObjects.Text[] = [];
  private difficultyMenuDescTexts: Phaser.GameObjects.Text[] = [];
  private difficultyMenuIcons: Phaser.GameObjects.Graphics[] = [];
  private difficultyMenuMarker!: Phaser.GameObjects.Text;
  private difficultyMenuUpWasDown = false;
  private difficultyMenuDownWasDown = false;
  private difficultyMenuZWasDown = false;
  private difficultyOptions: { diff: Difficulty; name: string; desc: string }[] = [];
  private onDifficultyChosen: ((diff: Difficulty) => void) | null = null;

  constructor(
    scene: Phaser.Scene,
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    fireKey: Phaser.Input.Keyboard.Key,
  ) {
    this.scene = scene;
    this.cursors = cursors;
    this.fireKey = fireKey;
  }

  isChoosing(): boolean {
    return this.choosingShot || this.choosingDifficulty;
  }

  update(): void {
    if (this.choosingShot) this.updateShotSelection();
    if (this.choosingDifficulty) this.updateDifficultySelection();
  }

  // ── Меню выбора типа стрельбы ──────────────────────────

  startShotSelection(onChosen: (type: ShotType) => void): void {
    this.onShotChosen = onChosen;
    this.choosingShot = true;
    this.shotMenuIndex = 0;
    this.shotMenuTexts = [];
    this.shotMenuIcons = [];
    // Клавиши, зажатые до открытия меню, не должны сразу сработать.
    this.shotMenuUpWasDown = this.cursors.up.isDown;
    this.shotMenuDownWasDown = this.cursors.down.isDown;
    this.shotMenuZWasDown = this.fireKey.isDown;

    const { width, height } = this.scene.scale;
    const centerX = width / 2;
    const startY = height / 2 + SHOT_MENU_START_Y;

    const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8);
    const title = this.scene.add
      .text(width / 2, height / 2 - 150, 'ВЫБЕРИ ТИП СТРЕЛЬБЫ', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '40px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Каждый тип: иконка слева и надпись рядом.
    for (let i = 0; i < SHOT_TYPES.length; i++) {
      const type = SHOT_TYPES[i];
      const y = startY + i * SHOT_MENU_STEP_Y;
      this.shotMenuIcons.push(this.createShotIcon(type, centerX + SHOT_MENU_ICON_X, y));
      this.shotMenuTexts.push(
        this.scene.add
          .text(centerX + SHOT_MENU_LABEL_X, y, SHOT_NAMES[type], {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '26px',
            color: '#ffffff',
          })
          .setOrigin(0, 0.5),
      );
    }

    // Маркер текущего выбора.
    this.shotMenuMarker = this.scene.add
      .text(0, 0, '▶', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '26px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Подсказка управления на время выбора.
    const hint = this.scene.add
      .text(width / 2, height - 40, '↑ ↓ — выбор, Z — подтвердить', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#94a3b8',
      })
      .setOrigin(0.5)
      .setAlpha(0.8);

    this.shotMenuObjects = [
      overlay,
      title,
      ...this.shotMenuIcons,
      ...this.shotMenuTexts,
      this.shotMenuMarker,
      hint,
    ];

    this.highlightShotOption();
  }

  /** Иконка типа стрельбы: рисуется примитивами, без файлов-картинок. */
  private createShotIcon(type: ShotType, x: number, y: number): Phaser.GameObjects.Graphics {
    const icon = this.scene.add.graphics();
    const color = SHOT_COLORS[type];

    switch (type) {
      case 'homing':
        // Пуля с изогнутым хвостом — самонаводка.
        icon.fillStyle(color, 1);
        icon.fillCircle(x, y, 7);
        icon.lineStyle(2, 0xffffff, 0.85);
        icon.lineBetween(x - 2, y - 6, x - 8, y - 2);
        icon.lineBetween(x - 8, y - 2, x - 10, y + 4);
        break;
      case 'laser':
        // Вертикальный луч.
        icon.lineStyle(4, color, 0.9);
        icon.lineBetween(x, y - 14, x, y + 14);
        break;
      case 'rocket':
        // Корпус с носом и хвостовым пламенем.
        icon.fillStyle(color, 1);
        icon.fillRect(x - 4, y - 4, 8, 12);
        icon.fillTriangle(x - 4, y - 4, x + 4, y - 4, x, y - 14);
        icon.fillStyle(0xffa94d, 1);
        icon.fillTriangle(x - 3, y + 8, x + 3, y + 8, x, y + 16);
        break;
    }

    return icon;
  }

  /** Управление меню: ↑ ↓ — выбор, Z — подтвердить. */
  private updateShotSelection(): void {
    const up = this.cursors.up.isDown;
    const down = this.cursors.down.isDown;
    const z = this.fireKey.isDown;

    // Срабатываем только на новое нажатие, а не на удержание.
    if (up && !this.shotMenuUpWasDown) {
      this.shotMenuIndex = (this.shotMenuIndex - 1 + SHOT_TYPES.length) % SHOT_TYPES.length;
      this.highlightShotOption();
    }
    if (down && !this.shotMenuDownWasDown) {
      this.shotMenuIndex = (this.shotMenuIndex + 1) % SHOT_TYPES.length;
      this.highlightShotOption();
    }
    if (z && !this.shotMenuZWasDown) {
      this.chooseShot(SHOT_TYPES[this.shotMenuIndex]);
    }

    this.shotMenuUpWasDown = up;
    this.shotMenuDownWasDown = down;
    this.shotMenuZWasDown = z;
  }

  /** Подсветка выбранной строки меню. */
  private highlightShotOption(): void {
    const startY = this.scene.scale.height / 2 + SHOT_MENU_START_Y;
    this.shotMenuMarker.setPosition(
      this.scene.scale.width / 2 + SHOT_MENU_ICON_X - 24,
      startY + this.shotMenuIndex * SHOT_MENU_STEP_Y,
    );

    for (let i = 0; i < SHOT_TYPES.length; i++) {
      const selected = i === this.shotMenuIndex;
      const type = SHOT_TYPES[i];
      const color = selected ? `#${SHOT_COLORS[type].toString(16).padStart(6, '0')}` : '#94a3b8';
      this.shotMenuTexts[i].setColor(color);
      this.shotMenuTexts[i].setAlpha(selected ? 1 : 0.6);
      this.shotMenuIcons[i].setAlpha(selected ? 1 : 0.5);
    }
  }

  private chooseShot(type: ShotType): void {
    if (!this.choosingShot) return;
    this.choosingShot = false;
    for (const obj of this.shotMenuObjects) obj.destroy();
    this.shotMenuObjects = [];
    this.onShotChosen?.(type);
  }

  // ── Меню выбора усложнения ─────────────────────────────

  startDifficultySelection(
    options: { diff: Difficulty; name: string; desc: string }[],
    onChosen: (diff: Difficulty) => void,
  ): void {
    this.difficultyOptions = options;
    this.onDifficultyChosen = onChosen;
    this.choosingDifficulty = true;
    this.difficultyMenuIndex = 0;
    this.difficultyMenuTexts = [];
    this.difficultyMenuDescTexts = [];
    this.difficultyMenuIcons = [];
    // Клавиши, зажатые до открытия меню, не должны сразу сработать.
    this.difficultyMenuUpWasDown = this.cursors.up.isDown;
    this.difficultyMenuDownWasDown = this.cursors.down.isDown;
    this.difficultyMenuZWasDown = this.fireKey.isDown;

    const { width, height } = this.scene.scale;
    const centerX = width / 2;
    const startY = height / 2 + DIFF_MENU_START_Y;

    const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8);
    const title = this.scene.add
      .text(width / 2, height / 2 - 150, 'ВЫБЕРИ УСЛОЖНЕНИЕ', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '40px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Каждое усложнение: иконка, название и описание.
    for (let i = 0; i < this.difficultyOptions.length; i++) {
      const opt = this.difficultyOptions[i];
      const y = startY + i * DIFF_MENU_STEP_Y;
      this.difficultyMenuIcons.push(
        this.createDifficultyIcon(opt.diff, centerX + DIFF_MENU_ICON_X, y),
      );
      this.difficultyMenuTexts.push(
        this.scene.add
          .text(centerX + DIFF_MENU_LABEL_X, y - 12, opt.name, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '24px',
            color: '#ffffff',
          })
          .setOrigin(0, 0.5),
      );
      this.difficultyMenuDescTexts.push(
        this.scene.add
          .text(centerX + DIFF_MENU_LABEL_X, y + 16, opt.desc, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '16px',
            color: '#94a3b8',
          })
          .setOrigin(0, 0.5),
      );
    }

    this.difficultyMenuMarker = this.scene.add
      .text(0, 0, '▶', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '26px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const hint = this.scene.add
      .text(width / 2, height - 40, '↑ ↓ — выбор, Z — подтвердить', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#94a3b8',
      })
      .setOrigin(0.5)
      .setAlpha(0.8);

    this.difficultyMenuObjects = [
      overlay,
      title,
      ...this.difficultyMenuIcons,
      ...this.difficultyMenuTexts,
      ...this.difficultyMenuDescTexts,
      this.difficultyMenuMarker,
      hint,
    ];

    this.highlightDifficultyOption();
  }

  /** Иконка усложнения: рисуется примитивами, без файлов-картинок. */
  private createDifficultyIcon(diff: Difficulty, x: number, y: number): Phaser.GameObjects.Graphics {
    const icon = this.scene.add.graphics();
    if (diff === 'hexagon') {
      // Шестиугольник.
      const points: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        points.push(new Phaser.Math.Vector2(x + Math.cos(angle) * 16, y + Math.sin(angle) * 16));
      }
      icon.fillStyle(HEXAGON_COLOR, 1);
      icon.fillPoints(points, true);
      icon.lineStyle(2, HEXAGON_EDGE_COLOR, 1);
      icon.strokePoints(points, true);
    } else if (diff === 'split') {
      // Два маленьких треугольника — разделение.
      icon.fillStyle(ENEMY_COLOR, 1);
      icon.fillTriangle(x - 11, y - 6, x - 3, y - 6, x - 7, y + 8);
      icon.fillTriangle(x + 3, y - 6, x + 11, y - 6, x + 7, y + 8);
    } else {
      // Ромб — зависание ромбов.
      icon.fillStyle(ENEMY_SHOOTER_COLOR, 1);
      icon.fillPoints(
        [
          new Phaser.Math.Vector2(x, y - 14),
          new Phaser.Math.Vector2(x + 14, y),
          new Phaser.Math.Vector2(x, y + 14),
          new Phaser.Math.Vector2(x - 14, y),
        ],
        true,
      );
    }
    return icon;
  }

  /** Управление меню усложнения: ↑ ↓ — выбор, Z — подтвердить. */
  private updateDifficultySelection(): void {
    const up = this.cursors.up.isDown;
    const down = this.cursors.down.isDown;
    const z = this.fireKey.isDown;

    if (up && !this.difficultyMenuUpWasDown) {
      this.difficultyMenuIndex =
        (this.difficultyMenuIndex - 1 + this.difficultyOptions.length) %
        this.difficultyOptions.length;
      this.highlightDifficultyOption();
    }
    if (down && !this.difficultyMenuDownWasDown) {
      this.difficultyMenuIndex = (this.difficultyMenuIndex + 1) % this.difficultyOptions.length;
      this.highlightDifficultyOption();
    }
    if (z && !this.difficultyMenuZWasDown) {
      this.chooseDifficulty(this.difficultyOptions[this.difficultyMenuIndex].diff);
    }

    this.difficultyMenuUpWasDown = up;
    this.difficultyMenuDownWasDown = down;
    this.difficultyMenuZWasDown = z;
  }

  /** Подсветка выбранной строки меню усложнения. */
  private highlightDifficultyOption(): void {
    const startY = this.scene.scale.height / 2 + DIFF_MENU_START_Y;
    this.difficultyMenuMarker.setPosition(
      this.scene.scale.width / 2 + DIFF_MENU_ICON_X - 24,
      startY + this.difficultyMenuIndex * DIFF_MENU_STEP_Y,
    );

    for (let i = 0; i < this.difficultyOptions.length; i++) {
      const selected = i === this.difficultyMenuIndex;
      const color = selected ? '#ffffff' : '#94a3b8';
      this.difficultyMenuTexts[i].setColor(color);
      this.difficultyMenuTexts[i].setAlpha(selected ? 1 : 0.6);
      this.difficultyMenuIcons[i].setAlpha(selected ? 1 : 0.5);
    }
  }

  private chooseDifficulty(diff: Difficulty): void {
    if (!this.choosingDifficulty) return;
    this.choosingDifficulty = false;
    for (const obj of this.difficultyMenuObjects) obj.destroy();
    this.difficultyMenuObjects = [];
    this.onDifficultyChosen?.(diff);
  }
}
