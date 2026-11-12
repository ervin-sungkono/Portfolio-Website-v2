import type Phaser from 'phaser';
import residents from '@/content/residents.json';

type Waypoint = { x: number; y: number; pauseMs?: number; face?: 'left' | 'right' };
type Resident = { id: string; texture: string; mode: 'idle' | 'walk'; x: number; y: number; route?: Waypoint[] };
const residentsList = residents as Resident[];

/** Load the small resident sprites with the rest of the town art. */
export function preloadResidents(scene: Phaser.Scene) {
  for (const resident of residentsList) {
    const key = `resident-${resident.id}`, url = `/game/residents/${resident.texture}.png`;
    if (resident.mode === 'walk') scene.load.spritesheet(key, url, { frameWidth: 67, frameHeight: 90, endFrame: 3 });
    else scene.load.image(key, url);
  }
}

/** Residents are solid at their feet but have no prompts or interaction targets. */
export function createResidents(scene: Phaser.Scene, player: Phaser.Physics.Arcade.Sprite, reducedMotion: boolean) {
  residentsList.forEach((resident, index) => {
    const key = `resident-${resident.id}`;
    const actor = scene.add.container(resident.x, resident.y).setDepth(resident.y).setSize(24, 12);
    scene.physics.add.existing(actor);
    const body = actor.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false).setImmovable(true).setSize(24, 12, false).setOffset(0, -6).setDirectControl(true);
    scene.physics.add.collider(player, actor as Phaser.GameObjects.Container & { body: Phaser.Physics.Arcade.Body });
    if (resident.mode === 'walk' && !reducedMotion && resident.route?.length) {
      const sprite = scene.add.sprite(0, 0, key, 0).setOrigin(0.5, 1);
      actor.add(sprite);
      const animation = `${key}-walk`;
      if (!scene.anims.exists(animation)) scene.anims.create({ key: animation, frames: [0, 1, 2, 3].map(frame => ({ key, frame })), frameRate: 5, repeat: -1 });
      const route: Waypoint[] = [...resident.route, { x: resident.x, y: resident.y }];
      scene.tweens.chain({
        targets: actor,
        loop: -1,
        loopDelay: 900,
        tweens: route.map((point, index) => {
          const from: Waypoint = index === 0 ? resident : route[index - 1];
          const distance = Math.hypot(point.x - from.x, point.y - from.y);
          return {
            x: point.x,
            y: point.y,
            duration: Math.max(1000, distance / 48 * 1000),
            delay: from.pauseMs ?? 0,
            ease: 'Linear',
            onStart: () => {
              if (point.x !== from.x) sprite.setFlipX(point.x < from.x);
              sprite.play(animation);
            },
            onUpdate: () => actor.setDepth(actor.y),
            onComplete: () => {
              sprite.stop();
              sprite.setFrame(0);
              if (point.face) sprite.setFlipX(point.face === 'left');
            },
          };
        }),
      });
    } else {
      const sprite = scene.add.image(0, 0, key, resident.mode === 'walk' ? 0 : undefined).setOrigin(0.5, 1);
      if (reducedMotion) { actor.add(sprite); return; }
      // The generated gardener is smiling with gently closed eyes; both figures breathe and blink.
      const blink = scene.add.graphics().setAlpha(0);
      blink.fillStyle(resident.texture === 'gardener' ? 0xf0b392 : 0xf7bd9a).fillRect(-6, -62, 5, 4).fillRect(4, -62, 5, 4);
      blink.fillStyle(0x633b31).fillRect(-6, -60, 5, 1).fillRect(4, -60, 5, 1);
      const figure = scene.add.container(0, 0, [sprite, blink]);
      actor.add(figure);
      scene.tweens.add({ targets: figure, scaleY: 1.025, duration: 1250 + index * 140, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
      scene.tweens.add({ targets: blink, alpha: 1, duration: 60, hold: 90, yoyo: true, repeat: -1, delay: 1800 + index * 600, repeatDelay: 2800 + index * 450 });
    }
  });
}
