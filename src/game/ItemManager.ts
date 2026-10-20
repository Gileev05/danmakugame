import Phaser from 'phaser';
import { Player } from './Player';
import {
  ITEM_SIZE,
  ITEM_FALL_SPEED,
  ITEM_MAGNET_RADIUS,
  ITEM_MAGNET_SPEED,
  ITEM_SCATTER_SPEED_MIN,
  ITEM_SCATTER_SPEED_MAX,
  ITEM_SCATTER_DECAY,
  ITEM_POWER_CHANCE_PERCENT,
  ITEM_SCORE_COLOR,
  ITEM_POWER_COLOR,
} from './constants';
import { ItemType } from './types';

/** Предметы: очки счёта и очки силы, выпадающие из врагов. */
export class ItemManager {
  private scene: Phaser.Scene;
  private player: Player;
  private items: Phaser.GameObjects.Group;

  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene;
    this.player = player;
    this.items = scene.add.group();
  }

  getItems(): Phaser.GameObjects.Group {
    return this.items;
  }

  update(seconds: number, onCollect: (type: ItemType) => void): void {
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

      if (item.y - ITEM_SIZE > this.scene.scale.height) {
        item.destroy();
        continue;
      }

      if (this.overlapsPlayer(item.x, item.y, ITEM_SIZE, ITEM_SIZE)) {
        onCollect(type);
        item.destroy();
      }
    }
  }

  /** Враг роняет 3–5 предметов, разлетающихся как при взрыве. */
  dropItems(x: number, y: number, allowPower: boolean): void {
    const count = Phaser.Math.Between(3, 5);
    for (let i = 0; i < count; i++) {
      // В фазе 1 очки силы не выпадают.
      const isPower =
        allowPower && (i === 0 || Phaser.Math.Between(1, 100) <= ITEM_POWER_CHANCE_PERCENT);
      this.spawnItem(x, y, isPower ? 'power' : 'score');
    }
  }

  clearItems(): void {
    this.items.clear(true, true);
  }

  private spawnItem(x: number, y: number, type: ItemType): void {
    const color = type === 'score' ? ITEM_SCORE_COLOR : ITEM_POWER_COLOR;
    const item = this.scene.add.circle(x, y, ITEM_SIZE / 2, color);
    item.setData('type', type);
    // Случайное направление и скорость — эффект взрыва.
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const speed = Phaser.Math.Between(ITEM_SCATTER_SPEED_MIN, ITEM_SCATTER_SPEED_MAX);
    item.setData('vx', Math.cos(angle) * speed);
    item.setData('vy', Math.sin(angle) * speed);
    this.items.add(item);
  }

  private overlapsPlayer(x: number, y: number, width: number, height: number): boolean {
    return (
      Math.abs(this.player.x - x) * 2 < this.player.hitboxSize + width &&
      Math.abs(this.player.y - y) * 2 < this.player.hitboxSize + height
    );
  }
}
