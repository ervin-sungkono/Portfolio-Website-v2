/** Reuse one Phaser texture when multiple prop profiles point at the same image and frame layout.
 * @param {Record<string, {url:string, frameWidth?:number, frameHeight?:number, frameCount?:number}>} styles
 * @returns {Record<string,string>}
 */
export function propTextureKeys(styles) {
  const keysBySource = new Map();
  /** @type {Record<string,string>} */
  const result = {};
  for (const [id, style] of Object.entries(styles)) {
    const source = JSON.stringify([style.url, style.frameWidth ?? null, style.frameHeight ?? null, style.frameCount ?? null]);
    let key = keysBySource.get(source);
    if (!key) {
      key = `prop-${id}`;
      keysBySource.set(source, key);
    }
    result[id] = key;
  }
  return result;
}
