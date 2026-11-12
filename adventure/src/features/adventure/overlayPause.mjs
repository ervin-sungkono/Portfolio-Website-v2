/** Pause the town while a dialog owns focus. Phaser still gets a frame to destroy itself. */
export function createOverlayPauseController(game, bridge, stopMovement) {
  let active = false, disposed = false, alreadyPaused = false, savedKeyboard = null, pendingRestore = null;
  const cancelRestore = () => {
    if (pendingRestore) game.events.off('poststep', pendingRestore);
    pendingRestore = null;
  };
  const resetKeys = () => {
    try { game.scene.getScene('world')?.input?.keyboard?.resetKeys(); }
    catch { /* The scene may not yet be available during early cleanup. */ }
  };
  const restoreKeyboard = () => {
    resetKeys();
    if (savedKeyboard) savedKeyboard.manager.enabled = savedKeyboard.enabled;
    savedKeyboard = null;
  };
  const resetInput = () => {
    bridge.x = 0; bridge.y = 0; bridge.interact = false;
    stopMovement();
    resetKeys();
  };
  return {
    // Canvas focus can move to the on-screen stick while a touch is already active.
    resetKeyboard() { if (!disposed) { stopMovement(); resetKeys(); } },
    setActive(next) {
      if (disposed || active === next) return;
      active = next;
      if (active) {
        cancelRestore();
        resetInput();
        const manager = game.input?.keyboard;
        if (manager && !savedKeyboard) savedKeyboard = { manager, enabled: manager.enabled };
        if (manager) manager.enabled = false;
        alreadyPaused = game.isPaused;
        if (!alreadyPaused) game.pause();
      } else {
        if (alreadyPaused) restoreKeyboard();
        else {
          // Let Phaser flush its opening key event at POST_STEP before it captures keys again.
          pendingRestore = () => { pendingRestore = null; if (!active && !disposed) restoreKeyboard(); };
          game.events.once('poststep', pendingRestore);
          game.resume();
        }
      }
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      cancelRestore();
      if (savedKeyboard) restoreKeyboard();
      game.destroy(true);
    },
  };
}
