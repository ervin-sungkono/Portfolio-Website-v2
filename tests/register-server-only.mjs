import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') {
      return { url: 'data:text/javascript,', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
