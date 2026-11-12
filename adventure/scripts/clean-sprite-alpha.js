// LibreSprite script for draft sprite extraction. Keep edges crisp and remove
// semi-transparent haze. Do not run on the original generated proof.
function onEvent(name) {
  if (name !== 'init') return;
  const sprite = app.activeSprite;
  if (!sprite) throw new Error('No sprite is open');
  const image = sprite.layer(app.activeLayerNumber).cel(0).image;
  const data = image.getImageData();
  for (let i = 3; i < data.length; i += 4) data[i] = data[i] < 160 ? 0 : 255;
  image.putImageData(data);
}
