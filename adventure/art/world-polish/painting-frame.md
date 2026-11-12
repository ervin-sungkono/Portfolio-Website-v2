# Park gallery frame

An original empty easel generated to match the existing town's pixel-art props; the full generated source is `sources/painting-frame-generated.png`. No personal photograph is included.

The game-ready image is a 96 × 102 RGBA PNG. Recreate it with FFmpeg:

```sh
ffmpeg -i art/world-polish/sources/painting-frame-generated.png -vf 'crop=864:918:320:52,scale=96:102:flags=neighbor' -frames:v 1 -y public/game/decor/painting-frame.png
```

Suggested Phaser origin is `(0.5, 0.95)` at scale `1`, with a feet-level collision rectangle `{ offsetX: 0, offsetY: -6, width: 60, height: 12 }`. The clear photo window is approximately `(14, 30, 70, 34)` in image pixels. At the suggested origin it starts at `(anchorX - 34, anchorY - 67)` in world coordinates. A real photograph may be cropped to fill this rectangle; the complete image remains available in the gallery.

The gold studs near `(anchorX + 1, anchorY - 78)` and `(anchorX + 40, anchorY - 72)` allow a subtle animated highlight without altering the source sprite. Suppress nonessential motion when reduced motion is requested.
