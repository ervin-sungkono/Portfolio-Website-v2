// Gently close the existing bird's eye; head, beak, body and canvas stay fixed.
function onEvent(name) {
  if (name !== 'init') return;
  const sprite = app.activeSprite;
  const image = sprite.layer(app.activeLayerNumber).cel(0).image;
  const data = image.getImageData();
  const width = sprite.width;
  const write = (x, y, color) => { const i = (y * width + x) * 4; for (let n = 0; n < 4; n++) data[i + n] = color[n]; };
  const read = (x, y) => { const i = (y * width + x) * 4; return [data[i], data[i+1], data[i+2], data[i+3]]; };
  for (let y = 14; y <= 22; y++) {
    const face = read(40, y);
    for (let x = 42; x <= 46; x++) write(x, y, face);
  }
  for (const [x, y] of [[42,18],[43,19],[44,20],[45,19],[46,18]]) write(x, y, [36, 17, 43, 255]);
  image.putImageData(data);
}
