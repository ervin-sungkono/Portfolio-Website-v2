import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { townColliders } from '../src/features/adventure/collisionModel.mjs';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const map = read('public/game/maps/town.json'), world = read('src/content/world.json');
const objects = name => map.layers.find(layer => layer.name === name).objects;
const rects = [...objects('collision'), ...townColliders(objects('decorations'), objects('interactions'), read('src/content/props.json'), read('src/content/npcs.json'))];
// Explorer anchor and body match createGame.ts: 96x128, scale .55, origin (.5,.85), offset (27,86), size (42,30).
const step = 8, cols = world.width / step, rows = world.height / step;
const halfWidth = 11.55, topOffset = -12.54, bottomOffset = 3.96;
const epsilon = 1e-6;
const blocked = (x, y) => x - halfWidth < 36 - epsilon || x + halfWidth > world.width - 36 + epsilon || y + topOffset < 36 - epsilon || y + bottomOffset > world.height - 36 + epsilon || rects.some(r => x + halfWidth > r.x + epsilon && x - halfWidth < r.x + r.width - epsilon && y + bottomOffset > r.y + epsilon && y + topOffset < r.y + r.height - epsilon);
const free = new Uint8Array(cols * rows), seen = new Uint8Array(cols * rows);
for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) free[y * cols + x] = +!blocked(x * step, y * step);
// Swept AABB, not just endpoints: even sub-grid-width walls block a transition.
const clearEdge = (x, y, dx, dy) => !rects.some(r => Math.max(x, x + dx) + halfWidth > r.x && Math.min(x, x + dx) - halfWidth < r.x + r.width && Math.max(y, y + dy) + bottomOffset > r.y && Math.min(y, y + dy) + topOffset < r.y + r.height);
const directions = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const start = Math.round(world.spawn.y / step) * cols + Math.round(world.spawn.x / step), queue = [start];
if (!free[start]) throw Error('Spawn is blocked');
seen[start] = 1;
for (let i = 0; i < queue.length; i++) {
  const id = queue[i], x = id % cols, y = Math.floor(id / cols);
  for (const [dx,dy] of directions) {
    const nx = x + dx, ny = y + dy, n = ny * cols + nx;
    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || seen[n] || !free[n] || !clearEdge(x * step, y * step, dx * step, dy * step)) continue;
    seen[n] = 1; queue.push(n);
  }
}
const tiles = [];
for (let row = 0; row < map.height; row++) for (let col = 0; col < map.width; col++) {
  let available = 0, reachable = 0;
  for (let y = row * 4; y < row * 4 + 4; y++) for (let x = col * 4; x < col * 4 + 4; x++) { const id = y * cols + x; available += free[id]; reachable += seen[id]; }
  tiles.push({ col, row, available, reachable });
}
// Independent visual core regions, traced from the rendered solid art rather than copied from its blockers.
const solidAreas = [
  { name: 'north retaining wall west of bridge', x: 0, y: 1184, width: 944, height: 32 },
  { name: 'north retaining wall east of bridge', x: 1072, y: 1184, width: 1104, height: 32 },
  { name: 'workshop masonry', x: 500, y: 160, width: 280, height: 90 },
  { name: 'cafe masonry', x: 1256, y: 196, width: 244, height: 84 },
  { name: 'fountain basin', x: 980, y: 634, width: 80, height: 56 },
];
const leaks = solidAreas.map(area => ({ ...area, reachable: queue.filter(id => { const x = id % cols * step, y = Math.floor(id / cols) * step; return x >= area.x && x < area.x + area.width && y >= area.y && y < area.y + area.height; }).map(id => [id % cols * step, Math.floor(id / cols) * step]) })).filter(area => area.reachable.length);
const approaches = objects('interactions').map(item => ({ name: item.name, selectable: queue.some(id => { const x = id % cols * step, y = Math.floor(id / cols) * step, distance = Math.hypot(x - item.x, y - item.y); return distance < world.interactionRadius - 12 && objects('interactions').every(other => other === item || distance < Math.hypot(x - other.x, y - other.y)); }) }));
let physicsMoves = 0, physicsContacts = 0, maxContactOverlap = 0;
const unusualContacts = [], contactFollowups = [];
if (process.argv.includes('--physics')) {
  globalThis.window = { devicePixelRatio: 1 }; globalThis.document = {}; globalThis.navigator ??= { userAgent: '', maxTouchPoints: 0 }; globalThis.importScripts = () => {};
  const Phaser = createRequire(import.meta.url)('phaser');
  const scene = { sys: { scale: { width: world.width, height: world.height }, events: new Phaser.Events.EventEmitter(), queueDepthSort() {}, updateList: { add() {}, remove() {} } } };
  const physics = new Phaser.Physics.Arcade.World(scene, { fixedStep: false }); physics.setBounds(36,36,world.width-72,world.height-72);
  const player = { x: 0, y: 0, angle: 0, scaleX: .55, scaleY: .55, displayOriginX: 48, displayOriginY: 108.8, displayWidth:52.8, displayHeight:70.4, width:96, height:128, setPosition(x,y){ this.x=x;this.y=y;return this; } };
  const body = new Phaser.Physics.Arcade.Body(physics, player); player.body = body; body.setSize(42,30,false).setOffset(27,86).setCollideWorldBounds(true); physics.add(body);
  const group = new Phaser.Physics.Arcade.StaticGroup(physics,scene);
  for (const r of rects) { const zone = new Phaser.GameObjects.Zone(scene,r.x+r.width/2,r.y+r.height/2,r.width,r.height); physics.enableBody(zone,Phaser.Physics.Arcade.STATIC_BODY); group.add(zone); }
  physics.addCollider(player,group);
  for (const id of queue) for (const [dx,dy] of directions) {
    const x = id % cols * step, y = Math.floor(id / cols) * step;
    body.reset(x,y);
    for (let frame=0;frame<3;frame++) { body.setVelocity(dx*160,dy*160); physics.update(frame*1000/60,1000/60); physics.postUpdate(); }
    physicsMoves++;
    if (blocked(player.x,player.y)) {
      physicsContacts++;
      const overlaps = rects.filter(r => player.x + halfWidth > r.x + epsilon && player.x - halfWidth < r.x + r.width - epsilon && player.y + bottomOffset > r.y + epsilon && player.y + topOffset < r.y + r.height - epsilon).map(r => ({ source: r.source ?? r.name, penetration: Math.min(player.x + halfWidth-r.x, r.x+r.width-player.x+halfWidth, player.y+bottomOffset-r.y, r.y+r.height-player.y-topOffset) }));
      const penetration = Math.max(0,...overlaps.map(o=>o.penetration)); maxContactOverlap = Math.max(maxContactOverlap,penetration);
      if (unusualContacts.length < 100) unusualContacts.push({ x,y,dx,dy,overlaps });
    }
    // A clear cardinal edge must be traversed, not merely remain outside geometry.
    if ((!dx || !dy) && free[(id+dy*cols+dx)] && clearEdge(x,y,dx*step,dy*step) && Math.hypot(player.x-x-dx*step,player.y-y-dy*step)>0.01) throw Error(`Physics unexpectedly blocked grid edge at ${x},${y}`);
  }
  // Replay unusual corner contacts for two seconds: shallow Arcade separation must not become a passage.
  for (const contact of unusualContacts) {
    body.reset(contact.x,contact.y); let maximum = 0;
    for (let frame=0;frame<120;frame++) {
      body.setVelocity(contact.dx*160,contact.dy*160); physics.update(frame*1000/60,1000/60); physics.postUpdate();
      for (const r of rects) {
        const penetration = Math.min(body.right-r.x,r.x+r.width-body.x,body.bottom-r.y,r.y+r.height-body.y);
        if (penetration>0) maximum=Math.max(maximum,penetration);
      }
    }
    contactFollowups.push({x:contact.x,y:contact.y,dx:contact.dx,dy:contact.dy,maxOverlap:maximum,end:[player.x,player.y]});
    if (maximum>4) throw Error(`Corner probe entered a blocker deeply at ${contact.x},${contact.y}: ${maximum}`);
  }
  physics.destroy();
}
const result = { grid: { step, cols, rows, sampled: free.length, reachable: queue.length, blocked: free.length-free.reduce((a,b)=>a+b,0), disconnected: free.reduce((a,b)=>a+b,0)-queue.length }, mapTiles:tiles.length, physicsMoves, physicsContacts, maxContactOverlap, unusualContacts, contactFollowups, approaches, leaks, tiles, rects, reachable:queue.map(id=>[id%cols*step,Math.floor(id/cols)*step]) };
const output = process.argv.indexOf('--output'); if(output>=0)writeFileSync(process.argv[output+1],JSON.stringify(result));
console.log(JSON.stringify({grid:result.grid,mapTiles:result.mapTiles,physicsMoves,physicsContacts,maxContactOverlap,approaches,leaks:leaks.map(x=>({name:x.name,cells:x.reachable.length,example:x.reachable[0]}))},null,2));
if (process.argv.includes('--check') && (leaks.length || approaches.some(x=>!x.selectable))) process.exitCode=1;
