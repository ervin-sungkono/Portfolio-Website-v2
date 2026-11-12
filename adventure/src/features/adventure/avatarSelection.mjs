/** Keep the latest explorer choice while the scene is still loading. */
export function createAvatarSelection(initial) {
  let current = initial;
  let apply;
  let disposed = false;
  return {
    current: () => current,
    set(next) {
      if (disposed || next === current) return;
      current = next;
      apply?.(current);
    },
    bind(callback) {
      if (disposed) return;
      apply = callback;
      apply(current);
    },
    destroy() { disposed = true; apply = undefined; },
  };
}
