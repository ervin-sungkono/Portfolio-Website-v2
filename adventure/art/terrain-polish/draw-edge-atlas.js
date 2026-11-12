// LibreSprite 1.3 script: draw 16 transparent 32px edging tiles.
// Tile index is a bit mask of exposed paving edges: N=1, E=2, S=4, W=8.
function onEvent(name) {
  if (name !== 'init') return;
  const image = app.activeSprite.layer(app.activeLayerNumber).cel(0).image;
  const data = image.getImageData();
  const width = 128;
  for (let i = 0; i < data.length; i++) data[i] = 0;
  const palette = [
    [126, 91, 61], [179, 128, 87], [226, 181, 127],
    [244, 202, 151], [216, 167, 119], [194, 147, 102],
  ];
  for (let mask = 1; mask < 16; mask++) {
    const ox = (mask % 4) * 32;
    const oy = Math.floor(mask / 4) * 32;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      let distance = 100, along = 0;
      if ((mask & 1) && y < distance) { distance = y; along = x; }
      if ((mask & 2) && 31 - x < distance) { distance = 31 - x; along = y; }
      if ((mask & 4) && 31 - y < distance) { distance = 31 - y; along = x; }
      if ((mask & 8) && x < distance) { distance = x; along = y; }
      if (distance >= 6) continue;
      let color = palette[distance];
      // Small joints and highlights make the border read as individual stones.
      if ((along % 8 === 0 || along % 8 === 1) && distance >= 2 && distance <= 4) color = palette[distance === 2 ? 1 : 5];
      if (along % 8 === 4 && distance === 3) color = palette[3];
      const i = ((oy + y) * width + ox + x) * 4;
      data[i] = color[0]; data[i + 1] = color[1]; data[i + 2] = color[2]; data[i + 3] = 255;
    }
  }
  image.putImageData(data);
}
