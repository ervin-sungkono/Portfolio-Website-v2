/** @typedef {{offsetX:number, offsetY:number, width:number, height:number}} CollisionProfile */
/** @typedef {{name:string, type?:string, id?:number, x?:number, y?:number, properties?:{name:string,value:unknown}[]}} MapPoint */
/** @typedef {{x:number, y:number, width:number, height:number, source:string, sourceId?:number}} CollisionRect */

/** @param {unknown} value @returns {value is CollisionProfile} */
export function validCollisionProfile(value) {
  if (!value || typeof value !== 'object') return false;
  const profile = /** @type {Record<string, unknown>} */ (value);
  return ['offsetX', 'offsetY', 'width', 'height'].every(key => typeof profile[key] === 'number' && Number.isFinite(profile[key])) &&
    /** @type {number} */ (profile.width) > 0 && /** @type {number} */ (profile.height) > 0;
}

/** The profile is a feet-level rectangle in world pixels relative to the object's Tiled anchor.
 * @param {MapPoint} point @param {CollisionProfile|null|undefined} profile @param {string} source
 * @returns {CollisionRect|null}
 */
export function colliderAt(point, profile, source) {
  if (profile == null) return null;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !validCollisionProfile(profile)) throw new Error(`Invalid collision profile for ${source}`);
  return {
    x: /** @type {number} */ (point.x) + profile.offsetX - profile.width / 2,
    y: /** @type {number} */ (point.y) + profile.offsetY - profile.height / 2,
    width: profile.width, height: profile.height, source, sourceId: point.id,
  };
}

/** Derive colliders from the exact objects drawn by the map so moved props cannot leave stale blockers.
 * @param {MapPoint[]} decorations @param {MapPoint[]} interactions
 * @param {Record<string,{collision?:CollisionProfile|null}>} props
 * @param {{id:string,collision?:CollisionProfile|null}[]} npcs
 * @returns {CollisionRect[]}
 */
export function townColliders(decorations, interactions, props, npcs) {
  /** @type {CollisionRect[]} */
  const result = [];
  for (const object of decorations) {
    const rect = colliderAt(object, props[object.name]?.collision, `decoration:${object.name}`);
    if (rect) result.push(rect);
  }
  const interactionProps = { project: 'terminal', collection: 'terminal', contact: 'mailbox', arcade: 'arcade', match: 'arcade', cafe: 'sign', moments: 'painting-frame' };
  for (const object of interactions) {
    const key = /** @type {keyof typeof interactionProps} */ (object.type);
    const override = object.properties?.find(property => property.name === 'prop')?.value;
    if (override !== undefined && (typeof override !== 'string' || !Object.hasOwn(props, override))) throw new Error(`Unknown interaction prop for ${object.name}`);
    const districtPart = object.properties?.find(property => property.name === 'districtPart')?.value;
    if (districtPart !== undefined) {
      if (typeof districtPart !== 'string' || !districtPart.trim()) throw new Error(`Invalid district part for ${object.name}`);
      // District furniture uses the matching footprints exported into the Tiled collision layer.
      continue;
    }
    const prop = typeof override === 'string' ? override : interactionProps[key];
    const profile = object.type === 'npc' ? npcs.find(npc => npc.id === object.name)?.collision : props[prop]?.collision;
    const rect = colliderAt(object, profile, `interaction:${object.name}`);
    if (rect) result.push(rect);
  }
  return result;
}
