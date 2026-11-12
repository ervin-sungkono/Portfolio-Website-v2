# Town NPC idle drafts

Two original pixel-art NPCs, guided by the approved `art/concepts/direction-a-selected.png` character and town direction. These files are review-quality drafts and have not been visually verified in the Phaser scene or on a phone.

- `guide`: friendly town/about guide; 96×128 RGBA, visible bounds `(22, 7, 75, 122)`, feet baseline `y=122`.
- `workshop`: friendly workshop guide; 96×128 RGBA, visible bounds `(20, 5, 77, 124)`, feet baseline `y=124`.
- `frames/{guide,workshop}/idle-0.png`: neutral pose. `idle-1.png` and `idle-3.png`: subtle breathing poses. `idle-2.png`: closed-eye blink, to be triggered separately.
- A natural starting loop is `[0, 1, 0, 3]` at 1.25 frames per second; independently blink with frame 2 for about 150 ms every 3–6 seconds. Keep position and feet anchor fixed.
- `previews/*-idle.gif`: four-second visual studies; `previews/contact.png` shows all eight poses. `previews/previous-and-new.png` compares the previous static sprites (first/third) with the new drafts (second/fourth).
- `sources/{guide,workshop}/idle-*.aseprite`: editable, single-frame, flattened LibreSprite source files. These are not layered multi-frame animation masters.
- `studies/`: retained generated reference and pose sheets. Generated drafts derive from the selected Direction A concept via `image_gen`; crops, alpha cleanup and frame compositing use LibreSprite and FFmpeg as recorded in `build.sh`.

The 96×128 PNGs have binary alpha, a consistent canvas, and no edge clipping. Their feet area is unchanged across each NPC's four frames. All eight native source files were reopened and exported via LibreSprite 1.3 without pixel or alpha differences. The breathing frames are restrained generated torso variations, and visual continuity, readability, and apparent size still need in-game inspection.

To rebuild, run `bash art/npc-polish/build.sh` with LibreSprite and FFmpeg available. The script defaults to `/workspace/.tools/squashfs-root/AppRun`; set `LIBRESPRITE_APP` for another installation. This will overwrite the frame and source drafts. Run `python3 art/npc-polish/verify.py` to check the resulting files. The project manifest records checksums for the reviewed drafts; regenerate it deliberately after editing.
