import Phaser from 'phaser';
import type { Character, GameBridge, Interaction } from './types';
import world from '@/content/world.json';
import npcs from '@/content/npcs.json';
import props from '@/content/props.json';
import moments from '@/content/moments.json';
import terrain from '../../../art/town-redesign/runtime/terrain.json';
import districtData from '../../../art/town-redesign/runtime/groups.json';
import { createOverlayPauseController } from './overlayPause.mjs';
import { BLINK_IDLE, BLINK_WALK, DIRECTIONS, explorerFrame } from './sheetFrames.mjs';
import { townColliders } from './collisionModel.mjs';
import { movementFacing, movementVector } from './movementModel.mjs';
import { hairSlices, hairSway } from './worldMotion.mjs';
import { createAvatarSelection } from './avatarSelection.mjs';
import { drawPixelPhotoPreview, drawPixelPhotoToQuad, drawPhotoQuadSample } from './pixelPhotoPreview.mjs';
import { propTextureKeys } from './propTextureKeys.mjs';
import { createResidents, preloadResidents } from './ambientResidents';
import { decorationDepth, districtBaseDepth, districtPartLayout, districtPhotoDepth, nameplateLayout, RIVER_BANK_DEPTH, RIVER_SURFACE_DEPTH } from './worldLayering.mjs';

type Callbacks = {
  onReady: () => void;
  onTarget: (target: Interaction | null) => void;
  onInteract: (target: Interaction) => void;
  onError: () => void;
};

type WorldThing = Interaction & { x: number; y: number; color: number; icon: string; displayName: string; role: string; prop?: string; districtPart?: string };
type PropStyle = {
  url: string;
  originX: number;
  originY: number;
  scale: number;
  collision: { offsetX: number; offsetY: number; width: number; height: number } | null;
  frameWidth?: number;
  frameHeight?: number;
  frameCount?: number;
  frameRate?: number;
  repeat?: number;
  kind?: 'animated-sprite' | 'animated-texture' | 'static-sprite';
  displayMode?: 'sprite' | 'repeat-texture';
};
type DistrictPart = {
  id: string;
  prop: string;
  url: string;
  width: number;
  height: number;
  localAnchor: { x: number; y: number };
  originX: number;
  originY: number;
  scale: number;
  depthAnchorY: number;
  interactionId?: string;
  photoQuad?: { x: number; y: number }[];
};
type DistrictGroup = {
  placementScale: number;
  base: { prop: string; url: string; width: number; height: number; originX: number; originY: number; scale: number };
  parts: DistrictPart[];
};
const definitions = world.interactions as WorldThing[];
const parkPhotos = (moments.photos as Array<{ image: string }>).slice(0, 3);
const propStyles = props as Record<string, PropStyle>;
const propKeys: Record<string, string> = propTextureKeys(propStyles);
const propTextureKey = (id: string) => propKeys[id] ?? `prop-${id}`;
const districtGroups = districtData.groups as Record<string, DistrictGroup>;
const districtGroupsByBaseProp = new Map(Object.entries(districtGroups).map(([id, group]) => [group.base.prop, { id, group }]));

export function createGame(host: HTMLElement, character: Character, bridge: GameBridge, callbacks: Callbacks) {
  const avatar = createAvatarSelection(character);
  const explorerTexture = () => `explorer-${avatar.current()}`;
  class WorldScene extends Phaser.Scene {
    private player!: Phaser.Physics.Arcade.Sprite;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private keys!: Record<string, Phaser.Input.Keyboard.Key>;
    private selected: Interaction | null = null;
    private selectedKey = '';
    private things: WorldThing[] = [];
    private facing = 'down';
    private blinkSprite!: Phaser.GameObjects.Image;
    private nextBlink = 0;
    private blinkingUntil = 0;
    private reducedMotion = false;
    private npcActors: Array<{ body: Phaser.GameObjects.Sprite; blink: Phaser.GameObjects.Image; nextBlink: number; until: number }> = [];
    private hairParts: Phaser.GameObjects.Image[] = [];
    private districtParts = new Map<string, Phaser.GameObjects.Image>();
    private riverSurface?: Phaser.GameObjects.TileSprite;
    private riverFrame = 0;
    constructor() { super('world'); }

    stopMovement() {
      if (!this.player) return;
      this.player.setVelocity(0, 0);
      this.player.anims.stop();
      this.player.setTexture(explorerTexture(), explorerFrame(this.facing)).setVisible(true);
      this.blinkSprite?.setVisible(false);
      for (const part of this.hairParts) part.setVisible(false);
    }

    private addDistrictPhotoPreview(groupId: string, part: DistrictPart, layout: { x: number; y: number; depth: number; scale: number }, photo?: { image: string }) {
      if (!part.photoQuad) return;
      const preview = this.textures.createCanvas(`district-photo-${part.id}`, part.width, part.height);
      if (!preview) return;
      const context = preview.getContext();
      const baseProp = districtGroups[groupId].base.prop;
      const base = this.textures.get(propTextureKey(baseProp)).getSourceImage() as CanvasImageSource;
      if (!drawPhotoQuadSample(context, base, part.localAnchor, part.width, part.height, part.photoQuad)) { this.textures.remove(`district-photo-${part.id}`); return; }
      preview.refresh();
      this.add.image(layout.x, layout.y, `district-photo-${part.id}`).setOrigin(part.originX, part.originY)
        .setScale(layout.scale).setDepth(districtPhotoDepth(layout.depth));
      if (!photo) return;
      const source = new Image();
      const cleanup = () => { source.onload = null; source.onerror = null; this.events.off('shutdown', cleanup); this.events.off('destroy', cleanup); };
      source.onload = () => {
        cleanup();
        if (!this.sys.isActive() || !source.naturalWidth || !source.naturalHeight) return;
        if (drawPixelPhotoToQuad(preview.getContext(), source, part.photoQuad!)) preview.refresh();
      };
      source.onerror = cleanup;
      source.decoding = 'async';
      this.events.once('shutdown', cleanup);
      this.events.once('destroy', cleanup);
      source.src = photo.image;
    }

    preload() {
      this.load.tilemapTiledJSON('town-map', '/game/maps/town.json');
      for (const tileset of terrain.tilesets) this.load.image(`tileset-${tileset.name}`, tileset.path);
      for (const variant of ['male', 'female'] as const) {
        this.load.spritesheet(`explorer-${variant}`, `/game/sheets/${variant}.png`, { frameWidth: 96, frameHeight: 128, endFrame: 21 });
      }
      for (const sprite of new Set(npcs.map(npc => npc.sprite))) {
        this.load.spritesheet(`npc-${sprite}`, `/game/sheets/${sprite}-display.png`, { frameWidth: 67, frameHeight: 90, endFrame: 3 });
      }
      preloadResidents(this);
      for (const [id, prop] of Object.entries(propStyles)) {
        const key = propTextureKey(id);
        if (key !== `prop-${id}`) continue;
        if (prop.frameCount && prop.frameWidth && prop.frameHeight) {
          this.load.spritesheet(key, prop.url, { frameWidth: prop.frameWidth, frameHeight: prop.frameHeight, endFrame: prop.frameCount - 1 });
        } else this.load.image(key, prop.url);
      }
      this.load.once('loaderror', callbacks.onError);
    }

    create() {
      const map = this.make.tilemap({ key: 'town-map' });
      const interactionLayer = map.getObjectLayer('interactions');
      const collisionLayer = map.getObjectLayer('collision');
      const decorationLayer = map.getObjectLayer('decorations');
      const tilesets = new Map(terrain.tilesets.map(tileset => [tileset.name, map.addTilesetImage(
        tileset.name,
        `tileset-${tileset.name}`,
        terrain.tileWidth,
        terrain.tileHeight,
        0,
        0,
        tileset.firstgid,
      )]));
      const baseTiles = tilesets.get('town');
      const additions = tilesets.get('town-additions');
      const transitions = tilesets.get('town-transitions');
      const waterTiles = tilesets.get('town-water');
      const bankTiles = tilesets.get('town-riverbank');
      if (!baseTiles || !additions || !transitions || !waterTiles || !bankTiles || !interactionLayer || !collisionLayer || !decorationLayer) { callbacks.onError(); return; }
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!map.createLayer('ground', [baseTiles, additions], 0, 0)) { callbacks.onError(); return; }
      if (!map.createLayer('ground-edges', transitions, 0, 0)) { callbacks.onError(); return; }
      const waterLayer = map.createLayer('water', waterTiles, 0, 0);
      if (!waterLayer) { callbacks.onError(); return; }
      const waterStyle = propStyles['river-water'];
      if (waterStyle?.displayMode === 'repeat-texture' && waterStyle.frameCount) {
        const waterCells = waterLayer.getTilesWithin(0, 0, map.width, map.height, { isNotEmpty: true });
        if (waterCells.length) {
          const left = Math.min(...waterCells.map(tile => tile.pixelX));
          const top = Math.min(...waterCells.map(tile => tile.pixelY));
          const right = Math.max(...waterCells.map(tile => tile.pixelX + tile.width));
          const bottom = Math.max(...waterCells.map(tile => tile.pixelY + tile.height));
          this.riverSurface = this.add.tileSprite(left, top, right - left, bottom - top, propTextureKey('river-water'), 0).setOrigin(0).setDepth(RIVER_SURFACE_DEPTH);
        }
      }
      const bankLayer = map.createLayer('river-banks', bankTiles, 0, 0);
      if (!bankLayer) { callbacks.onError(); return; }
      bankLayer.setDepth(RIVER_BANK_DEPTH);
      for (const sprite of new Set(npcs.map(npc => npc.sprite))) {
        this.anims.create({ key: `npc-${sprite}-breathing`, frames: [0, 1, 0, 3].map(frame => ({ key: `npc-${sprite}`, frame })), frameRate: 1.25, repeat: -1 });
      }
      for (const [id, style] of Object.entries(propStyles)) {
        if (style.displayMode !== 'repeat-texture' && style.frameCount && style.frameCount > 1) {
          this.anims.create({
            key: `prop-${id}-loop`,
            frames: this.anims.generateFrameNumbers(propTextureKey(id), { start: 0, end: style.frameCount - 1 }),
            frameRate: style.frameRate ?? 6,
            repeat: style.repeat ?? -1,
          });
        }
      }
      this.things = interactionLayer.objects.flatMap(object => {
        const definition = definitions.find(item => item.id === object.name);
        const prop = object.properties?.find((property: { name: string }) => property.name === 'prop')?.value;
        const districtPart = object.properties?.find((property: { name: string }) => property.name === 'districtPart')?.value;
        return definition && typeof object.x === 'number' && typeof object.y === 'number'
          ? [{ ...definition, x: object.x, y: object.y, prop: typeof prop === 'string' ? prop : undefined, districtPart: typeof districtPart === 'string' ? districtPart : undefined }] : [];
      });
      if (this.things.length !== definitions.length) { callbacks.onError(); return; }
      for (const object of decorationLayer.objects) {
        const district = districtGroupsByBaseProp.get(object.name);
        const group = district?.group;
        if (district && group && typeof object.x === 'number' && typeof object.y === 'number') {
          const placementScale = group.placementScale ?? 1;
          this.add.image(object.x, object.y, propTextureKey(group.base.prop))
            .setOrigin(group.base.originX, group.base.originY)
            .setScale(placementScale * group.base.scale)
            .setDepth(districtBaseDepth());
          for (const part of group.parts) {
            const layout = districtPartLayout(object.x, object.y, placementScale, part);
            const visual = this.add.image(layout.x, layout.y, propTextureKey(part.prop))
              .setOrigin(part.originX, part.originY)
              .setScale(layout.scale)
              .setDepth(layout.depth);
            if (part.interactionId) {
              if (this.districtParts.has(part.id)) callbacks.onError();
              else this.districtParts.set(part.id, visual);
            }
            const photoIndex = definitions.find(item => item.id === part.interactionId)?.photoIndex;
            const photo = photoIndex === undefined ? undefined : parkPhotos[photoIndex];
            if (part.photoQuad) this.addDistrictPhotoPreview(district.id, part, layout, photo);
          }
          continue;
        }
        const style = propStyles[object.name];
        if (style && typeof object.x === 'number' && typeof object.y === 'number') {
          const key = propTextureKey(object.name);
          const image = style.frameCount && style.frameCount > 1
            ? this.add.sprite(object.x, object.y, key, 0)
            : this.add.image(object.x, object.y, key);
          image.setOrigin(style.originX, style.originY).setScale(style.scale);
          image.setDepth(decorationDepth(object.name, object.y, image.displayHeight, style.originY));
          if (!this.reducedMotion && style.frameCount && style.frameCount > 1) {
            (image as Phaser.GameObjects.Sprite).play(`prop-${object.name}-loop`);
          }
          const caption = object.properties?.find((property: { name: string }) => property.name === 'caption')?.value;
          if (object.name === 'sign' && typeof caption === 'string' && caption.trim()) {
            this.add.text(object.x, object.y - 54, caption, { fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#365849', backgroundColor: '#fff8e6', padding: { x: 5, y: 3 } }).setOrigin(0.5, 1).setDepth(world.height + 100);
          }
        }
      }
      for (const thing of this.things) {
        let visual = thing.districtPart ? this.districtParts.get(thing.districtPart) : undefined;
        if (thing.districtPart && !visual) { callbacks.onError(); return; }
        const customStyle = thing.prop ? propStyles[thing.prop] : undefined;
        if (!visual && customStyle && thing.prop) {
          const key = propTextureKey(thing.prop);
          const custom = customStyle.frameCount && customStyle.frameCount > 1
            ? this.add.sprite(thing.x, thing.y, key, 0)
            : this.add.image(thing.x, thing.y, key);
          custom.setOrigin(customStyle.originX, customStyle.originY).setScale(customStyle.scale).setDepth(thing.y);
          if (!this.reducedMotion && customStyle.frameCount && customStyle.frameCount > 1) (custom as Phaser.GameObjects.Sprite).play(`prop-${thing.prop}-loop`);
          visual = custom;
        }
        if (thing.kind === 'npc') {
          const npc = npcs.find(item => item.id === thing.id);
          if (npc) {
            const displayScale = npc.scale / 0.7;
            const body = this.add.sprite(thing.x, thing.y, `npc-${npc.sprite}`, 0).setOrigin(0.5, npc.originY).setScale(displayScale).setDepth(thing.y);
            visual = body;
            const blink = this.add.image(thing.x, thing.y, `npc-${npc.sprite}`, 2).setOrigin(0.5, npc.originY).setScale(displayScale).setDepth(thing.y).setVisible(false);
            if (!this.reducedMotion) body.play(`npc-${npc.sprite}-breathing`);
            this.npcActors.push({ body, blink, nextBlink: this.time.now + 3000 + Math.random() * 3000, until: 0 });
          }
        } else if (thing.kind === 'moments') {
          if (!visual) {
            const style = propStyles['painting-frame'];
            visual = this.add.image(thing.x, thing.y, propTextureKey('painting-frame')).setOrigin(style.originX, style.originY).setScale(style.scale).setDepth(thing.y);
          }
          const index = thing.photoIndex;
          const photo = index === undefined ? undefined : parkPhotos[index];
          if (photo && index !== undefined && !thing.districtPart) {
            // Only the tiny preview becomes a Phaser texture; full photos stay in the album.
            const source = new Image();
            const cleanup = () => { source.onload = null; source.onerror = null; this.events.off('shutdown', cleanup); this.events.off('destroy', cleanup); };
            source.onload = () => {
              cleanup();
              if (!this.sys.isActive() || !source.naturalWidth || !source.naturalHeight) return;
              const preview = this.textures.createCanvas(`moment-preview-${index}`, 70, 34);
              if (preview) {
                if (!drawPixelPhotoPreview(preview.getContext(), source)) { this.textures.remove(`moment-preview-${index}`); return; }
                preview.refresh();
                this.add.image(thing.x - 34, thing.y - 67, `moment-preview-${index}`).setOrigin(0).setDepth(thing.y + 0.1);
              }
            };
            source.onerror = cleanup;
            source.decoding = 'async';
            this.events.once('shutdown', cleanup);
            this.events.once('destroy', cleanup);
            source.src = photo.image;
          }
          if (!this.reducedMotion && !thing.districtPart) {
            const glint = this.add.graphics().setDepth(thing.y + 0.2).setAlpha(0);
            glint.fillStyle(0xfff7cb).fillRect(thing.x, thing.y - 79, 3, 3).fillRect(thing.x + 39, thing.y - 73, 2, 2);
            this.tweens.add({ targets: glint, alpha: 0.9, duration: 800, hold: 150, yoyo: true, repeat: -1, repeatDelay: 2400 + (thing.x % 5) * 300 });
          }
        } else if (!visual && (thing.kind === 'arcade' || thing.kind === 'match')) {
          const style = propStyles.arcade;
          visual = this.add.image(thing.x, thing.y, propTextureKey('arcade')).setOrigin(style.originX, style.originY).setScale(style.scale).setDepth(thing.y);
        } else if (!visual && thing.kind === 'cafe') {
          const style = propStyles.sign;
          visual = this.add.image(thing.x, thing.y, propTextureKey('sign')).setOrigin(style.originX, style.originY).setScale(style.scale).setDepth(thing.y);
        } else if (!visual && (thing.kind === 'project' || thing.kind === 'collection')) {
          visual = this.add.image(thing.x, thing.y, propTextureKey('terminal')).setOrigin(0.38, 0.78).setScale(0.85).setDepth(thing.y);
        } else if (!visual) {
          const style = propStyles.mailbox;
          visual = this.add.image(thing.x, thing.y, propTextureKey('mailbox')).setOrigin(style.originX, style.originY).setScale(style.scale).setDepth(thing.y);
        }
        const compactName = thing.kind === 'arcade' || thing.kind === 'match';
        const name = this.add.text(0, compactName ? 3 : 4, thing.displayName, {
          fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#315848',
          ...(compactName ? { wordWrap: { width: 60, useAdvancedWrap: true }, align: 'center' } : {}),
        }).setOrigin(0.5, 0);
        const roleY = compactName ? name.y + name.height + 2 : 19;
        const role = this.add.text(0, roleY, thing.role, { fontFamily: 'Arial, sans-serif', fontSize: '9px', fontStyle: 'bold', color: '#9a7045' }).setOrigin(0.5, 0);
        const plateHeight = compactName ? Math.ceil(roleY + role.height + 4) : 32;
        const width = Math.max(name.width, role.width) + (compactName ? 16 : 22);
        const plate = this.add.graphics();
        plate.fillStyle(0x294b3d, 0.3).fillRect(-width / 2 + 2, 3, width, plateHeight);
        plate.fillStyle(0xfff8e5).fillRect(-width / 2, 0, width, plateHeight);
        plate.lineStyle(1, 0xc7a777).strokeRect(-width / 2, 0, width, plateHeight);
        plate.fillStyle(0xe4b96a).fillRect(-width / 2 + 2, 2, 2, plateHeight - 4);
        const visualBounds = visual?.getBounds();
        const label = nameplateLayout(visualBounds?.top ?? thing.y - 90, world.height, plateHeight);
        const labelX = thing.districtPart && visualBounds ? visualBounds.centerX : thing.x;
        this.add.container(labelX, label.y, [plate, name, role]).setDepth(label.depth);
      }

      this.physics.world.setBounds(36, 36, world.width - 72, world.height - 72);
      for (const variant of ['male', 'female'] as const) for (const direction of DIRECTIONS) {
        this.anims.create({
          key: `${variant}-walking-${direction}`,
          frames: [0, 1, 2, 3].map(frame => ({ key: `explorer-${variant}`, frame: explorerFrame(direction, frame) })),
          frameRate: 6,
          repeat: -1,
        });
      }
      this.player = this.physics.add.sprite(world.spawn.x, world.spawn.y, explorerTexture(), explorerFrame('down'));
      bridge.playerX = this.player.x;
      bridge.playerY = this.player.y;
      this.player.setScale(0.55).setOrigin(0.5, 0.85).setCollideWorldBounds(true);
      this.blinkSprite = this.add.image(0, 0, explorerTexture(), BLINK_IDLE).setScale(0.55).setOrigin(0.5, 0.85).setVisible(false);
      if (!this.reducedMotion) {
        for (let index = 0; index < 5; index++) this.hairParts.push(this.add.image(0, 0, explorerTexture()).setScale(0.55).setOrigin(0.5, 0.85).setVisible(false));
      }
      avatar.bind(() => {
        this.stopMovement();
        this.blinkSprite.setTexture(explorerTexture(), BLINK_IDLE);
        for (const part of this.hairParts) part.setTexture(explorerTexture());
      });
      this.nextBlink = this.time.now + 3000;
      this.player.body?.setSize(42, 30);
      this.player.body?.setOffset(27, 86);
      createResidents(this, this.player, this.reducedMotion);
      const obstacles = [...townColliders(decorationLayer.objects, interactionLayer.objects, propStyles, npcs), ...collisionLayer.objects];
      const blockers = this.physics.add.staticGroup();
      for (const obstacle of obstacles) {
        const width = obstacle.width ?? 0, height = obstacle.height ?? 0;
        const x = (obstacle.x ?? 0) + width / 2, y = (obstacle.y ?? 0) + height / 2;
        const zone = this.add.zone(x, y, width, height).removeFromDisplayList();
        this.physics.add.existing(zone, true);
        blockers.add(zone);
      }
      this.physics.add.collider(this.player, blockers);
      this.cameras.main.setBounds(0, 0, world.width, world.height);
      const followSpeed = window.matchMedia('(pointer: coarse)').matches ? 0.4 : 0.12;
      this.cameras.main.startFollow(this.player, true, followSpeed, followSpeed);
      this.cameras.main.setRoundPixels(true);
      this.cursors = this.input.keyboard!.createCursorKeys();
      this.keys = this.input.keyboard!.addKeys('W,A,S,D,E,ENTER') as Record<string, Phaser.Input.Keyboard.Key>;
      callbacks.onReady();
    }

    update(time: number) {
      if (!this.player?.body) return;
      bridge.playerX = this.player.x;
      bridge.playerY = this.player.y;
      const waterStyle = propStyles['river-water'];
      if (this.riverSurface && waterStyle?.frameCount && !this.reducedMotion && !document.hidden) {
        const frame = Math.floor(time * (waterStyle.frameRate ?? 5) / 1000) % waterStyle.frameCount;
        if (frame !== this.riverFrame) { this.riverFrame = frame; this.riverSurface.setFrame(frame); }
      }
      for (const actor of this.npcActors) {
        if (!this.reducedMotion && !document.hidden && time >= actor.nextBlink) {
          actor.until = time + 150;
          actor.nextBlink = time + 3000 + Math.random() * 3000;
        }
        const blinking = !this.reducedMotion && !document.hidden && time < actor.until;
        actor.body.setVisible(!blinking);
        actor.blink.setVisible(blinking);
      }
      if (bridge.suspended || document.hidden) {
        this.player.setVelocity(0, 0);
        this.player.anims.stop();
        this.player.setTexture(explorerTexture(), explorerFrame(this.facing));
        this.player.setVisible(true);
        this.blinkSprite.setVisible(false);
        for (const part of this.hairParts) part.setVisible(false);
        bridge.interact = false;
        return;
      }
      const keyboardX = Number(this.cursors.right.isDown || this.keys.D.isDown) - Number(this.cursors.left.isDown || this.keys.A.isDown);
      const keyboardY = Number(this.cursors.down.isDown || this.keys.S.isDown) - Number(this.cursors.up.isDown || this.keys.W.isDown);
      const movement = movementVector(bridge.x + keyboardX, bridge.y + keyboardY);
      this.player.setVelocity(movement.x * 175, movement.y * 175);
      if (movement.moving) {
        this.facing = movementFacing(movement.x, movement.y, this.facing, !keyboardX && !keyboardY);
        this.player.play(`${avatar.current()}-walking-${this.facing}`, true);
        this.player.anims.timeScale = movement.speed;
      } else {
        this.player.anims.stop();
        this.player.anims.timeScale = 1;
        this.player.setTexture(explorerTexture(), explorerFrame(this.facing));
      }
      if (this.player.depth !== this.player.y) this.player.setDepth(this.player.y);
      if (!this.reducedMotion && time >= this.nextBlink && this.facing === 'down') {
        this.blinkingUntil = time + 140;
        this.nextBlink = time + 3000 + Math.random() * 3000;
      }
      const blinking = !this.reducedMotion && time < this.blinkingUntil && this.facing === 'down';
      const swayHair = movement.moving && !this.reducedMotion && !blinking;
      this.player.setVisible(!blinking && !swayHair);
      this.blinkSprite.setTexture(explorerTexture(), movement.moving ? BLINK_WALK : BLINK_IDLE).setVisible(blinking).setPosition(this.player.x, this.player.y);
      if (this.blinkSprite.depth !== this.player.y) this.blinkSprite.setDepth(this.player.y);
      if (swayHair) {
        const slices = hairSlices(avatar.current(), this.facing);
        const sway = hairSway(this.player.anims.currentFrame?.index ?? 1, avatar.current());
        for (let i = 0; i < this.hairParts.length; i++) {
          const part = this.hairParts[i], slice = slices[i];
          if (!slice.width || !slice.height) { part.setVisible(false); continue; }
          part.setFrame(this.player.frame.name).setCrop(slice.x, slice.y, slice.width, slice.height)
            .setPosition(this.player.x + (i === 4 ? sway : 0), this.player.y).setDepth(this.player.y).setVisible(true);
        }
      } else {
        for (const part of this.hairParts) part.setVisible(false);
      }

      let closest: WorldThing | null = null;
      let distance = world.interactionRadius;
      for (const item of this.things) {
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, item.x, item.y);
        if (d < distance) { closest = item; distance = d; }
      }
      const id = closest?.id ?? '';
      if (id !== this.selectedKey) {
        this.selectedKey = id;
        this.selected = closest ? { kind: closest.kind, id: closest.id, label: `${closest.displayName}, ${closest.role.toLowerCase()}`, photoIndex: closest.photoIndex } : null;
        callbacks.onTarget(this.selected);
      }
      const focused = document.activeElement;
      const focusIsUi = focused instanceof HTMLElement && !!focused.closest('button,a,input,textarea,select,[role="dialog"]');
      const keyboardInteract = !focusIsUi && (Phaser.Input.Keyboard.JustDown(this.keys.E) || Phaser.Input.Keyboard.JustDown(this.keys.ENTER));
      if (bridge.interact || keyboardInteract) {
        bridge.interact = false;
        if (this.selected) {
          bridge.suspended = true;
          this.player.setVelocity(0, 0);
          callbacks.onInteract(this.selected);
        }
      }
    }
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: host,
    backgroundColor: '#52865d',
    pixelArt: true,
    input: { keyboard: { target: host } },
    scale: { mode: Phaser.Scale.RESIZE, width: host.clientWidth || 960, height: host.clientHeight || 640 },
    physics: { default: 'arcade', arcade: { debug: false } },
    scene: WorldScene,
  });
  const pause = createOverlayPauseController(game, bridge, () => {
    try { (game.scene.getScene('world') as WorldScene).stopMovement(); }
    catch { /* The scene can still be starting during cancellation. */ }
  });
  return { ...pause, setCharacter: (next: Character) => avatar.set(next), destroy() { avatar.destroy(); pause.destroy(); } };
}
