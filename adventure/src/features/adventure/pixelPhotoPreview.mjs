/** Render a contained photo into the output canvas using 2×2 pixel blocks.
 * @param {CanvasRenderingContext2D} output
 * @param {HTMLImageElement} source
 * @param {() => HTMLCanvasElement} [makeCanvas]
 * @returns {boolean}
 */
export function drawPixelPhotoPreview(output, source, makeCanvas = () => document.createElement('canvas')) {
  const width = source.naturalWidth, height = source.naturalHeight;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return false;
  const targetWidth = output.canvas?.width ?? 70, targetHeight = output.canvas?.height ?? 34;
  if (targetWidth <= 0 || targetHeight <= 0) return false;
  const sample = makeCanvas();
  sample.width = Math.max(1, Math.ceil(targetWidth / 2));
  sample.height = Math.max(1, Math.ceil(targetHeight / 2));
  const context = sample.getContext('2d');
  if (!context) return false;

  const scale = Math.min(sample.width / width, sample.height / height);
  const drawWidth = Math.max(1, Math.round(width * scale));
  const drawHeight = Math.max(1, Math.round(height * scale));
  const x = Math.floor((sample.width - drawWidth) / 2);
  const y = Math.floor((sample.height - drawHeight) / 2);
  context.fillStyle = '#fff0d4';
  context.fillRect(0, 0, sample.width, sample.height);
  context.imageSmoothingEnabled = false;
  context.drawImage(source, x, y, drawWidth, drawHeight);
  output.imageSmoothingEnabled = false;
  output.drawImage(sample, 0, 0, targetWidth, targetHeight);
  return true;
}

/** Map the tiny contained preview to a perspective easel window, in TL/TR/BR/BL order.
 * @param {CanvasRenderingContext2D} output
 * @param {HTMLImageElement} source
 * @param {{x:number,y:number}[]} quad
 * @param {() => HTMLCanvasElement} [makeCanvas]
 * @returns {boolean}
 */
export function drawPixelPhotoToQuad(output, source, quad, makeCanvas = () => document.createElement('canvas')) {
  if (!Array.isArray(quad) || quad.length !== 4 || quad.some(point => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y))) return false;
  const [tl, tr, br, bl] = quad;
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const turns = quad.map((point, index) => cross(point, quad[(index + 1) % 4], quad[(index + 2) % 4]));
  if (turns.some(turn => turn <= 0)) return false;
  const width = Math.max(1, Math.round(Math.max(Math.hypot(tr.x - tl.x, tr.y - tl.y), Math.hypot(br.x - bl.x, br.y - bl.y))));
  const height = Math.max(1, Math.round(Math.max(Math.hypot(bl.x - tl.x, bl.y - tl.y), Math.hypot(br.x - tr.x, br.y - tr.y))));
  const flat = makeCanvas(); flat.width = width; flat.height = height;
  const context = flat.getContext('2d');
  if (!context || !drawPixelPhotoPreview(context, source, makeCanvas)) return false;
  const a1 = (tr.x - tl.x) / width, b1 = (tr.y - tl.y) / width;
  const c1 = (bl.x - tl.x) / height, d1 = (bl.y - tl.y) / height;
  const a2 = (br.x - bl.x) / width, b2 = (br.y - bl.y) / width;
  const c2 = (br.x - tr.x) / height, d2 = (br.y - tr.y) / height;
  const triangles = [
    { points: [tl, tr, bl], transform: [a1, b1, c1, d1, tl.x, tl.y] },
    { points: [tr, br, bl], transform: [a2, b2, c2, d2, tr.x - a2 * width, tr.y - b2 * width] },
  ];
  for (const triangle of triangles) {
    output.save(); output.beginPath();
    output.moveTo(triangle.points[0].x, triangle.points[0].y);
    for (const point of triangle.points.slice(1)) output.lineTo(point.x, point.y);
    output.closePath(); output.clip();
    output.transform(...triangle.transform);
    output.imageSmoothingEnabled = false;
    output.drawImage(flat, 0, 0);
    output.restore();
  }
  return true;
}

/** Copy the approved base-image crop through a frame window before owner photos are available.
 * @param {CanvasRenderingContext2D} output
 * @param {CanvasImageSource} source
 * @param {{x:number,y:number}} anchor
 * @param {number} width
 * @param {number} height
 * @param {{x:number,y:number}[]} quad
 * @returns {boolean}
 */
export function drawPhotoQuadSample(output, source, anchor, width, height, quad) {
  if (!source || !anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y) || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || !Array.isArray(quad) || quad.length !== 4 || quad.some(point => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y))) return false;
  const [tl, tr, br, bl] = quad;
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (quad.some((point, index) => cross(point, quad[(index + 1) % 4], quad[(index + 2) % 4]) <= 0)) return false;
  output.save(); output.beginPath(); output.moveTo(tl.x, tl.y);
  for (const point of [tr, br, bl]) output.lineTo(point.x, point.y);
  output.closePath(); output.clip(); output.imageSmoothingEnabled = false;
  output.drawImage(source, anchor.x, anchor.y, width, height, 0, 0, width, height);
  output.restore();
  return true;
}
