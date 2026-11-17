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
  ABILITY_MENU_ICON_X,
  ABILITY_MENU_LABEL_X,
  ABILITY_MENU_START_Y,
  ABILITY_MENU_STEP_Y,
  ABILITY_COLORS,
  CONTROL_MENU_START_Y,
  CONTROL_MENU_STEP_Y,
  HEXAGON_COLOR,
  HEXAGON_EDGE_COLOR,
  ENEMY_COLOR,
  ENEMY_SHOOTER_COLOR,
} from './constants';
import {
  ShotType,
  Difficulty,
  AbilityType,
  AbilityOption,
  ControlScheme,
  ControlOption,
} from './types';

/** Меню выбора типа стрельбы и усложнения: ↑ ↓ — выбор, Enter — подтвердить. */
export class MenuManager {
  private scene: Phaser.Scene;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private enterKey: Phaser.Input.Keyboard.Key;

  private choosingShot = false;
  private shotMenuObjects: Phaser.GameObjects.GameObject[] = [];
  private shotMenuIndex = 0;
  private shotMenuTexts: Phaser.GameObjects.Text[] = [];
  private shotMenuIcons: Phaser.GameObjects.Graphics[] = [];
  private shotMenuMarker!: Phaser.GameObjects.Text;
  private shotMenuUpWasDown = false;
  private shotMenuDownWasDown = false;
  private shotMenuEnterWasDown = false;
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
  private difficultyMenuEnterWasDown = false;
  private difficultyOptions: { diff: Difficulty; name: string; desc: string }[] = [];
  private onDifficultyChosen: ((diff: Difficulty) => void) | null = null;

  private choosingAbility = false;
  private abilityMenuObjects: Phaser.GameObjects.GameObject[] = [];
  private abilityMenuIndex = 0;
  private abilityMenuTexts: Phaser.GameObjects.Text[] = [];
  private abilityMenuDescTexts: Phaser.GameObjects.Text[] = [];
  private abilityMenuIcons: Phaser.GameObjects.Graphics[] = [];
  private abilityMenuMarker!: Phaser.GameObjects.Text;
  private abilityMenuUpWasDown = false;
  private abilityMenuDownWasDown = false;
  private abilityMenuEnterWasDown = false;
  private abilityOptions: AbilityOption[] = [];
  private onAbilityChosen: ((type: AbilityType) => void) | null = null;

  private choosingControl = false;
  private controlMenuObjects: Phaser.GameObjects.GameObject[] = [];
  private controlMenuIndex = 0;
  private controlMenuTexts: Phaser.GameObjects.Text[] = [];
  private controlMenuDescTexts: Phaser.GameObjects.Text[] = [];
  private controlMenuMarker!: Phaser.GameObjects.Text;
  private controlMenuUpWasDown = false;
  private controlMenuDownWasDown = false;
  private controlMenuEnterWasDown = false;
  private controlOptions: ControlOption[] = [];
  private onControlChosen: ((scheme: ControlScheme) => void) | null = null;

  private controlScheme: ControlScheme = 'keyboard';
  private navUpKey!: Phaser.Input.Keyboard.Key;
  private navDownKey!: Phaser.Input.Keyboard.Key;

  constructor(
    scene: Phaser.Scene,
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    enterKey: Phaser.Input.Keyboard.Key,
  ) {
    this.scene = scene;
    this.cursors = cursors;
    this.enterKey = enterKey;

    const keyboard = scene.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input is unavailable.');
    }
    this.navUpKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.navDownKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
  }

  /** Схема управления влияет на подсказки и клавиши навигации в меню. */
  setControlScheme(scheme: ControlScheme): void {
    this.controlScheme = scheme;
  }

  private isMenuUpDown(): boolean {
    return this.controlScheme === 'mouse' ? this.navUpKey.isDown : this.cursors.up.isDown;
  }

  private isMenuDownDown(): boolean {
    return this.controlScheme === 'mouse' ? this.navDownKey.isDown : this.cursors.down.isDown;
  }

  /** Подсказка навигации: W/S в схеме WASD, стрелки в клавиатурной. */
  private navHint(): string {
    return `${this.controlScheme === 'mouse' ? 'W S' : '↑ ↓'} — выбор, Enter — подтвердить`;
  }

  isChoosing(): boolean {
    return (
      this.choosingShot ||
      this.choosingDifficulty ||
      this.choosingAbility ||
      this.choosingControl
    );
  }

  update(): void {
    if (this.choosingShot) this.updateShotSelection();
    if (this.choosingDifficulty) this.updateDifficultySelection();
    if (this.choosingAbility) this.updateAbilitySelection();
    if (this.choosingControl) this.updateControlSelection();
  }

  // ── Меню выбора типа стрельбы ──────────────────────────

  startShotSelection(onChosen: (type: ShotType) => void): void {
    this.onShotChosen = onChosen;
    this.choosingShot = true;
    this.shotMenuIndex = 0;
    this.shotMenuTexts = [];
    this.shotMenuIcons = [];
    // Клавиши, зажатые до открытия меню, не должны сразу сработать.
    this.shotMenuUpWasDown = this.isMenuUpDown();
    this.shotMenuDownWasDown = this.isMenuDownDown();
    this.shotMenuEnterWasDown = this.enterKey.isDown;

    const { width, height } = this.scene.scale;
    const centerX = width / 2;
    const startY = height / 2 + SHOT_MENU_START_Y;

    const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8);
    const phaseLabel = this.scene.add
      .text(width / 2, height / 2 - 200, 'Фаза 2', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
        color: '#facc15',
      })
      .setOrigin(0.5);
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
      .text(width / 2, height - 40, this.navHint(), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#94a3b8',
      })
      .setOrigin(0.5)
      .setAlpha(0.8);

    this.shotMenuObjects = [
      overlay,
      phaseLabel,
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

  /** Управление меню: ↑ ↓ — выбор, Enter — подтвердить. */
  private updateShotSelection(): void {
    const up = this.isMenuUpDown();
    const down = this.isMenuDownDown();
    const enter = this.enterKey.isDown;

    // Срабатываем только на новое нажатие, а не на удержание.
    if (up && !this.shotMenuUpWasDown) {
      this.shotMenuIndex = (this.shotMenuIndex - 1 + SHOT_TYPES.length) % SHOT_TYPES.length;
      this.highlightShotOption();
    }
    if (down && !this.shotMenuDownWasDown) {
      this.shotMenuIndex = (this.shotMenuIndex + 1) % SHOT_TYPES.length;
      this.highlightShotOption();
    }
    if (enter && !this.shotMenuEnterWasDown) {
      this.chooseShot(SHOT_TYPES[this.shotMenuIndex]);
    }

    this.shotMenuUpWasDown = up;
    this.shotMenuDownWasDown = down;
    this.shotMenuEnterWasDown = enter;
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
    this.difficultyMenuUpWasDown = this.isMenuUpDown();
    this.difficultyMenuDownWasDown = this.isMenuDownDown();
    this.difficultyMenuEnterWasDown = this.enterKey.isDown;

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
      .text(width / 2, height - 40, this.navHint(), {
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

  /** Управление меню усложнения: ↑ ↓ — выбор, Enter — подтвердить. */
  private updateDifficultySelection(): void {
    const up = this.isMenuUpDown();
    const down = this.isMenuDownDown();
    const enter = this.enterKey.isDown;

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
    if (enter && !this.difficultyMenuEnterWasDown) {
      this.chooseDifficulty(this.difficultyOptions[this.difficultyMenuIndex].diff);
    }

    this.difficultyMenuUpWasDown = up;
    this.difficultyMenuDownWasDown = down;
    this.difficultyMenuEnterWasDown = enter;
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

  // ── Меню выбора активной способности ───────────────────

  startAbilitySelection(options: AbilityOption[], onChosen: (type: AbilityType) => void): void {
    this.abilityOptions = options;
    this.onAbilityChosen = onChosen;
    this.choosingAbility = true;
    this.abilityMenuIndex = 0;
    this.abilityMenuTexts = [];
    this.abilityMenuDescTexts = [];
    this.abilityMenuIcons = [];
    // Клавиши, зажатые до открытия меню, не должны сразу сработать.
    this.abilityMenuUpWasDown = this.isMenuUpDown();
    this.abilityMenuDownWasDown = this.isMenuDownDown();
    this.abilityMenuEnterWasDown = this.enterKey.isDown;

    const { width, height } = this.scene.scale;
    const centerX = width / 2;
    const startY = height / 2 + ABILITY_MENU_START_Y;

    const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8);
    const title = this.scene.add
      .text(width / 2, height / 2 - 150, 'ВЫБЕРИ АКТИВНУЮ СПОСОБНОСТЬ', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '36px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Ширина для переноса длинных описаний до правого края экрана.
    const descWidth = width - (centerX + ABILITY_MENU_LABEL_X) - 30;

    // Каждая способность: иконка, название, описание и перезарядка.
    for (let i = 0; i < this.abilityOptions.length; i++) {
      const opt = this.abilityOptions[i];
      const y = startY + i * ABILITY_MENU_STEP_Y;
      this.abilityMenuIcons.push(
        this.createAbilityIcon(opt.ability, centerX + ABILITY_MENU_ICON_X, y),
      );
      this.abilityMenuTexts.push(
        this.scene.add
          .text(centerX + ABILITY_MENU_LABEL_X, y - 26, opt.name, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '24px',
            color: '#ffffff',
          })
          .setOrigin(0, 0.5),
      );
      this.abilityMenuDescTexts.push(
        this.scene.add
          .text(
            centerX + ABILITY_MENU_LABEL_X,
            y - 6,
            `${opt.desc}\nКД ${Math.round(opt.cooldownMs / 1000)} с`,
            {
              fontFamily: 'system-ui, sans-serif',
              fontSize: '16px',
              color: '#94a3b8',
              wordWrap: { width: descWidth },
            },
          )
          .setOrigin(0, 0),
      );
    }

    this.abilityMenuMarker = this.scene.add
      .text(0, 0, '▶', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '26px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const hint = this.scene.add
      .text(width / 2, height - 40, this.navHint(), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#94a3b8',
      })
      .setOrigin(0.5)
      .setAlpha(0.8);

    this.abilityMenuObjects = [
      overlay,
      title,
      ...this.abilityMenuIcons,
      ...this.abilityMenuTexts,
      ...this.abilityMenuDescTexts,
      this.abilityMenuMarker,
      hint,
    ];

    this.highlightAbilityOption();
  }

  /** Иконка активной способности: рисуется примитивами, без файлов-картинок. */
  private createAbilityIcon(type: AbilityType, x: number, y: number): Phaser.GameObjects.Graphics {
    const icon = this.scene.add.graphics();
    const color = ABILITY_COLORS[type];

    switch (type) {
      case 'blank':
        // Перечёркнутый снаряд — пули исчезают.
        icon.lineStyle(3, color, 1);
        icon.strokeCircle(x, y, 9);
        icon.lineBetween(x - 8, y + 8, x + 8, y - 8);
        break;
      case 'medkit':
        // Аптечка: белый крест.
        icon.fillStyle(color, 1);
        icon.fillRect(x - 10, y - 10, 20, 20);
        icon.fillStyle(0xffffff, 1);
        icon.fillRect(x - 2, y - 7, 4, 14);
        icon.fillRect(x - 7, y - 2, 14, 4);
        break;
      case 'boost':
        // Молния — ускорение.
        icon.fillStyle(color, 1);
        icon.fillTriangle(x + 2, y - 13, x - 9, y + 2, x - 1, y + 2);
        icon.fillTriangle(x - 2, y + 13, x + 9, y - 2, x + 1, y - 2);
        break;
    }

    return icon;
  }

  /** Управление меню способности: ↑ ↓ — выбор, Enter — подтвердить. */
  private updateAbilitySelection(): void {
    const up = this.isMenuUpDown();
    const down = this.isMenuDownDown();
    const enter = this.enterKey.isDown;

    if (up && !this.abilityMenuUpWasDown) {
      this.abilityMenuIndex =
        (this.abilityMenuIndex - 1 + this.abilityOptions.length) % this.abilityOptions.length;
      this.highlightAbilityOption();
    }
    if (down && !this.abilityMenuDownWasDown) {
      this.abilityMenuIndex = (this.abilityMenuIndex + 1) % this.abilityOptions.length;
      this.highlightAbilityOption();
    }
    if (enter && !this.abilityMenuEnterWasDown) {
      this.chooseAbility(this.abilityOptions[this.abilityMenuIndex].ability);
    }

    this.abilityMenuUpWasDown = up;
    this.abilityMenuDownWasDown = down;
    this.abilityMenuEnterWasDown = enter;
  }

  /** Подсветка выбранной строки меню способности. */
  private highlightAbilityOption(): void {
    const startY = this.scene.scale.height / 2 + ABILITY_MENU_START_Y;
    this.abilityMenuMarker.setPosition(
      this.scene.scale.width / 2 + ABILITY_MENU_ICON_X - 24,
      startY + this.abilityMenuIndex * ABILITY_MENU_STEP_Y,
    );

    for (let i = 0; i < this.abilityOptions.length; i++) {
      const selected = i === this.abilityMenuIndex;
      const type = this.abilityOptions[i].ability;
      const color = selected ? `#${ABILITY_COLORS[type].toString(16).padStart(6, '0')}` : '#94a3b8';
      this.abilityMenuTexts[i].setColor(color);
      this.abilityMenuTexts[i].setAlpha(selected ? 1 : 0.6);
      this.abilityMenuIcons[i].setAlpha(selected ? 1 : 0.5);
    }
  }

  private chooseAbility(type: AbilityType): void {
    if (!this.choosingAbility) return;
    this.choosingAbility = false;
    for (const obj of this.abilityMenuObjects) obj.destroy();
    this.abilityMenuObjects = [];
    this.onAbilityChosen?.(type);
  }

  // ── Меню выбора схемы управления ───────────────────────

  startControlSelection(
    options: ControlOption[],
    onChosen: (scheme: ControlScheme) => void,
  ): void {
    this.controlOptions = options;
    this.onControlChosen = onChosen;
    this.choosingControl = true;
    this.controlMenuIndex = 0;
    this.controlMenuTexts = [];
    this.controlMenuDescTexts = [];
    // Клавиши, зажатые до открытия меню, не должны сразу сработать.
    this.controlMenuUpWasDown = this.isMenuUpDown();
    this.controlMenuDownWasDown = this.isMenuDownDown();
    this.controlMenuEnterWasDown = this.enterKey.isDown;

    const { width, height } = this.scene.scale;
    const centerX = width / 2;
    const startY = height / 2 + CONTROL_MENU_START_Y;

    const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85);
    const title = this.scene.add
      .text(width / 2, height / 2 - 150, 'ВЫБЕРИ УПРАВЛЕНИЕ', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '38px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Каждая схема: название и подсказка по кнопкам.
    for (let i = 0; i < this.controlOptions.length; i++) {
      const opt = this.controlOptions[i];
      const y = startY + i * CONTROL_MENU_STEP_Y;
      this.controlMenuTexts.push(
        this.scene.add
          .text(centerX, y - 14, opt.name, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '26px',
            color: '#ffffff',
          })
          .setOrigin(0.5),
      );
      this.controlMenuDescTexts.push(
        this.scene.add
          .text(centerX, y + 18, opt.desc, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '17px',
            color: '#94a3b8',
          })
          .setOrigin(0.5),
      );
    }

    this.controlMenuMarker = this.scene.add
      .text(0, 0, '▶', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '26px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const hint = this.scene.add
      .text(width / 2, height - 40, '↑ ↓ — выбор, Enter — начать игру', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#94a3b8',
      })
      .setOrigin(0.5)
      .setAlpha(0.8);

    this.controlMenuObjects = [
      overlay,
      title,
      ...this.controlMenuTexts,
      ...this.controlMenuDescTexts,
      this.controlMenuMarker,
      hint,
    ];

    this.highlightControlOption();
  }

  /** Управление меню: ↑ ↓ — выбор, Enter — начать игру. */
  private updateControlSelection(): void {
    const up = this.isMenuUpDown();
    const down = this.isMenuDownDown();
    const enter = this.enterKey.isDown;

    if (up && !this.controlMenuUpWasDown) {
      this.controlMenuIndex =
        (this.controlMenuIndex - 1 + this.controlOptions.length) % this.controlOptions.length;
      this.highlightControlOption();
    }
    if (down && !this.controlMenuDownWasDown) {
      this.controlMenuIndex = (this.controlMenuIndex + 1) % this.controlOptions.length;
      this.highlightControlOption();
    }
    if (enter && !this.controlMenuEnterWasDown) {
      this.chooseControl(this.controlOptions[this.controlMenuIndex].scheme);
    }

    this.controlMenuUpWasDown = up;
    this.controlMenuDownWasDown = down;
    this.controlMenuEnterWasDown = enter;
  }

  /** Подсветка выбранной схемы управления. */
  private highlightControlOption(): void {
    const startY = this.scene.scale.height / 2 + CONTROL_MENU_START_Y;
    this.controlMenuMarker.setPosition(
      this.scene.scale.width / 2 - 180,
      startY + this.controlMenuIndex * CONTROL_MENU_STEP_Y - 14,
    );

    for (let i = 0; i < this.controlOptions.length; i++) {
      const selected = i === this.controlMenuIndex;
      this.controlMenuTexts[i].setColor(selected ? '#facc15' : '#94a3b8');
      this.controlMenuTexts[i].setAlpha(selected ? 1 : 0.6);
      this.controlMenuDescTexts[i].setAlpha(selected ? 0.95 : 0.5);
    }
  }

  private chooseControl(scheme: ControlScheme): void {
    if (!this.choosingControl) return;
    this.choosingControl = false;
    for (const obj of this.controlMenuObjects) obj.destroy();
    this.controlMenuObjects = [];
    this.onControlChosen?.(scheme);
  }
}
