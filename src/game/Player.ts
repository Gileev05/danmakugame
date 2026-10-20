import Phaser from 'phaser';
import {
  PLAYER_SPEED,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  PLAYER_COLOR,
  PLAYER_EDGE_COLOR,
  PLAYER_HITBOX_SIZE,
} from './constants';

/** Игрок: модель-треугольник, движение и видимый хитбокс. */
export class Player {
  readonly sprite: Phaser.GameObjects.Triangle;
  readonly hitboxMarker: Phaser.GameObjects.Arc;
  readonly hitboxSize = PLAYER_HITBOX_SIZE;

  private scene: Phaser.Scene;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    if (!scene.input.keyboard) {
      throw new Error('Keyboard input is unavailable.');
    }
    this.cursors = scene.input.keyboard.createCursorKeys();

    const halfW = PLAYER_WIDTH / 2;
    const halfH = PLAYER_HEIGHT / 2;

    this.sprite = scene.add
      .triangle(x, y, -halfW + 20, halfH, halfW + 20, halfH, 20, -halfH, PLAYER_COLOR)
      .setStrokeStyle(2, PLAYER_EDGE_COLOR)
      .setOrigin(0.5, 0.5);

    // Видимый хитбокс: точка в геометрическом центре корабля.
    // Центроид треугольника смещён вниз на высоту/6 — поднимаем маркер.
    this.hitboxMarker = scene.add
      .circle(x, y - PLAYER_HEIGHT / 6, 4, 0xffffff, 0.9)
      .setStrokeStyle(1, 0x000000, 0.8);
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  get alpha(): number {
    return this.sprite.alpha;
  }

  update(seconds: number): void {
    this.move(seconds);
    this.keepOnScreen();
    this.hitboxMarker.setPosition(this.x, this.y - PLAYER_HEIGHT / 6);
  }

  setPosition(x: number, y: number): void {
    this.sprite.setPosition(x, y);
  }

  setVisible(visible: boolean): void {
    this.sprite.setVisible(visible);
    this.hitboxMarker.setVisible(visible);
  }

  setAlpha(alpha: number): void {
    this.sprite.setAlpha(alpha);
  }

  private move(seconds: number): void {
    let dx = 0;
    let dy = 0;

    if (this.cursors.left.isDown) dx -= 1;
    if (this.cursors.right.isDown) dx += 1;
    if (this.cursors.up.isDown) dy -= 1;
    if (this.cursors.down.isDown) dy += 1;

    if (dx === 0 && dy === 0) return;

    const length = Math.hypot(dx, dy);
    this.sprite.x += (dx / length) * PLAYER_SPEED * seconds;
    this.sprite.y += (dy / length) * PLAYER_SPEED * seconds;
  }

  private keepOnScreen(): void {
    const halfW = PLAYER_WIDTH / 2;
    const halfH = PLAYER_HEIGHT / 2;
    this.sprite.x = Phaser.Math.Clamp(this.sprite.x, halfW, this.scene.scale.width - halfW);
    this.sprite.y = Phaser.Math.Clamp(this.sprite.y, halfH, this.scene.scale.height - halfH);
  }
}
