import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { PLAYFIELD_WIDTH, UI_PANEL_WIDTH } from './constants';

export function createGame(parent: string): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: PLAYFIELD_WIDTH + UI_PANEL_WIDTH,
    height: 640,
    backgroundColor: '#0f172a',
    scene: [GameScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  };

  return new Phaser.Game(config);
}
