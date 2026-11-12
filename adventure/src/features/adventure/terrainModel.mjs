/** Material of a 32px ground cell in the approved town-v2 atlases. */
export function tileSurface(gid) {
  if (gid >= 1 && gid <= 32) return (gid - 1) % 8 < 4 ? 'grass' : 'plaza';
  if (gid >= 52 && gid <= 83) return (gid - 52) % 8 < 4 ? 'garden-path' : 'promenade';
  return null;
}

export function isPavedTile(gid) {
  const surface = tileSurface(gid);
  return surface !== null && surface !== 'grass';
}
