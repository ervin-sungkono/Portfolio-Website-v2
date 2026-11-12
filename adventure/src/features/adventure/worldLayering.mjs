const GROUND_DECORATIONS = new Set(['river-bridge', 'river-wall', 'stone-stairs', 'stairs', 'plaza-medallion', 'river-waterfall', 'river-lilies']);
export const RIVER_SURFACE_DEPTH = 0.25;
export const RIVER_BANK_DEPTH = 0.5;

/** Sort the canopy at its feet; walkable details remain beneath every character. */
export function decorationDepth(name, anchorY, displayHeight, originY) {
  if (name === 'plaza-medallion') return 0.75;
  if (GROUND_DECORATIONS.has(name)) return 1;
  if (name === 'arcade-awning') return anchorY + displayHeight * (1 - originY);
  return anchorY;
}

/** Keep grouped floors behind actors while sorting cropped foregrounds at their feet. */
export function districtPartLayout(groupX, groupY, placementScale, part) {
  return {
    x: groupX + part.localAnchor.x * placementScale,
    y: groupY + part.localAnchor.y * placementScale,
    depth: groupY + part.depthAnchorY * placementScale,
    scale: placementScale * (part.scale ?? 1),
  };
}

/** Keep photo pixels inside a transparent frame window, just below its frame art. */
export function districtPhotoDepth(frameDepth) {
  return frameDepth - 0.01;
}

export function districtBaseDepth() { return 1; }

/** Keep the complete 32px plate above the object's visual bounds and all actors. */
export function nameplateLayout(visualTop, worldHeight, height = 32) {
  return { y: Math.floor(visualTop) - height - 8, depth: worldHeight + 100 };
}
