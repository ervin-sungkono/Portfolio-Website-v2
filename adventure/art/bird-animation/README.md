# Garden Glide bird animation drafts

These four original 64×52 transparent poses build on the existing blue bird in `public/game/arcade/bird.png`. `up`, `mid`, and `down` are a wing cycle; `dazed` uses the down pose with a gently closed eye. The body and head are registered to the original so the character stays in place between frames. The generated wing-position study is retained at `sources/wing-study.png`; its wing regions were combined with the original body in FFmpeg and the closed eye was refined with LibreSprite. The source frames are editable, flattened LibreSprite files in `sources/frames/`.

Runtime copies are under `public/game/arcade/bird-animation/`. A starting animation is `up → mid → down → mid` at approximately 8–10 frames per second when flapping; `mid` or `down` can be held during a fall, and `dazed` can accompany a short crash/drop effect. The asset files do not implement timing or death movement. `previews/frames.png` and `previews/flap.gif` are enlarged previews.

Run `bash art/bird-animation/build.sh` to rebuild using LibreSprite 1.3 and FFmpeg; it overwrites the generated frame outputs and runtime copies. Run `python3 art/bird-animation/verify.py` to check dimensions, transparency, frame registration, distinct poses, and recorded editor round trips. These assets are drafts and have not been reviewed at game scale or on mobile.
