# Town café

The café was generated as an original transparent pixel-art building, using `public/game/drafts/prop-workshop.png` as the visual reference. The full-size generated source is `sources/city-cafe-generated.png`.

The game uses a 380 × 259 lossless WebP, prepared for its displayed size from the original image:

```sh
ffmpeg -i art/world-polish/sources/city-cafe-generated.png -vf 'scale=380:259:flags=area' -c:v libwebp -lossless 1 -compression_level 6 -y public/game/decor/city-cafe.webp
```

The building has a feet-level collision footprint in `src/content/props.json`. Its final appearance should be reviewed at native game scale on desktop and mobile.
