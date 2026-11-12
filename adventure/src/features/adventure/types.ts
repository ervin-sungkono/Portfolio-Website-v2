export type Character = 'male' | 'female';
export type Interaction = { kind: 'project' | 'collection' | 'npc' | 'contact' | 'arcade' | 'moments' | 'cafe' | 'match'; id: string; label: string; photoIndex?: number };
export type GameBridge = {
  x: number;
  y: number;
  interact: boolean;
  suspended: boolean;
  playerX?: number;
  playerY?: number;
};

export function clearInput(bridge: GameBridge) {
  bridge.x = 0;
  bridge.y = 0;
  bridge.interact = false;
}
