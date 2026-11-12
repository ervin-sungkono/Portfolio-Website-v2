# Riverside assets

Original image-generated assets guided by the approved town concept. Editable source images are in `sources/` and are not shipped with the game.

- `town-water.png`: one 32 × 32 repeatable water tile.
- `town-riverbank.png`: two transparent 32 × 32 tiles. The first places a stone bank at the top edge; the second places one at the bottom edge.
- `river-bridge.png`: a 128 × 144 north–south bridge, origin `(0.5, 0.5)`, scale `1`. Its deck is walkable; river collisions are authored around its opening. Render the bridge above the water and below characters.
- `river-wall.png`: a 128 × 32 repeating raised stone face, origin `(0.5, 0.5)`, scale `1`. Place at the north water edge beneath the railing. The water collision already blocks the wall; the bridge is drawn over it and stays passable.
- `river-waterfall.png`: a 128 × 64 stone-faced waterfall and splash, origin `(0.5, 0.5)`, scale `1`. Align its coping with the raised bank and render above the water but below characters.
- `stone-stairs.png`: 112 × 80 stone steps, origin `(0.5, 0.5)`, scale `1`. The steps are ground art at both bridge approaches; they do not obstruct the crossing.
- `river-lilies.png`: a 48 × 23 floating lily cluster, origin `(0.5, 0.5)`, scale `1`, rendered above water with no collider.
- `plaza-medallion.png`: a 256 × 256 stone-and-compass inlay, origin `(0.5, 0.5)`, scale `1`. Render below the fountain and characters.
- `garden-fence.png`: a 64 × 24 decorative fence, origin `(0.5, 0.9)`, scale `1`, with a feet-level collision footprint. Leave gaps for park entrances.
- `flower-hedge.png`: a 64 × 32 flower hedge segment, origin `(0.5, 0.9)`, scale `1`, with a feet-level collision footprint.
- `stone-edging.png`: a 64 × 24 low stone border, origin `(0.5, 0.9)`, scale `1`, with a feet-level collision footprint.
- `arcade-awning.png`: a 300 × 120 transparent awning, origin `(0.5, 0.5)`, scale `1`. It is nonblocking and should be rendered behind the individual arcade cabinets.

The committed assets can be reproduced with ImageMagick:

```sh
convert art/world-polish/sources/town-water-generated.png -filter box -resize 32x32\! PNG32:public/game/tiles/town-water.png
convert art/world-polish/sources/river-bridge-generated.png -crop 413x842+421+206 +repage -filter point -resize 128x144\! PNG32:public/game/decor/river-bridge.png
convert art/world-polish/sources/riverbank-generated.png -crop 540x149+650+285 +repage -filter point -resize 32x9\! PNG32:/tmp/riverbank-strip.png
convert -size 32x32 xc:none /tmp/riverbank-strip.png -geometry +0+0 -composite PNG32:/tmp/riverbank-north.png
convert -size 32x32 xc:none /tmp/riverbank-strip.png -geometry +0+23 -composite PNG32:/tmp/riverbank-south.png
convert /tmp/riverbank-north.png /tmp/riverbank-south.png +append PNG32:public/game/tiles/town-riverbank.png
convert art/world-polish/sources/river-wall-generated.png -crop 1984x299+94+236 +repage -channel A -threshold 35% +channel -filter point -resize 128x32\! PNG32:public/game/decor/river-wall.png
convert art/world-polish/sources/river-waterfall-depth-generated.png -crop 1058x917+127+115 +repage -channel A -threshold 35% +channel -filter point -resize 128x64\! PNG32:public/game/decor/river-waterfall.png
convert art/world-polish/sources/stone-stairs-generated.png -crop 1058x765+239+130 +repage -channel A -threshold 35% +channel -filter point -resize 112x80\! PNG32:public/game/decor/stone-stairs.png
convert art/world-polish/sources/river-lilies-generated.png -crop 770x368+486+248 +repage -filter point -resize 48x23\! PNG32:public/game/decor/river-lilies.png
convert art/world-polish/sources/plaza-medallion-generated.png -crop 1182x1177+36+38 +repage -filter point -resize 256x256\! PNG32:public/game/decor/plaza-medallion.png
convert art/world-polish/sources/garden-fence-generated.png -crop 1085x341+544+195 +repage -filter point -resize 64x24\! PNG32:public/game/decor/garden-fence.png
convert art/world-polish/sources/flower-hedge-generated.png -crop 852x426+400+224 +repage -filter point -resize 64x32\! PNG32:public/game/decor/flower-hedge.png
convert art/world-polish/sources/stone-edging-generated.png -crop 704x263+672+239 +repage -filter point -resize 64x24\! -channel A -threshold 15% +channel PNG32:public/game/decor/stone-edging.png
convert art/world-polish/sources/arcade-awning-generated.png -crop 1863x738+60+21 +repage -channel A -threshold 60% +channel -filter point -resize 300x120\! PNG32:public/game/decor/arcade-awning.png
```

The tile and bridge have been checked for their dimensions and transparency. A native-scale playtest is still needed to inspect water repetition, bank alignment and the bridge crossing.
