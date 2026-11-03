// Public browser checks use the real public content tree without production credentials.
// Owner identity and Dribbble responses are simulated; CMS writes use a separate fixture.
const nativeFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.origin === 'https://api.github.com' && url.pathname === '/user') {
    return Response.json({ id: 43065067, login: 'ervin-sungkono' });
  }
  if (
    url.origin === 'https://api.github.com' &&
    url.pathname === '/repos/ervin-sungkono/web-assets'
  ) {
    return Response.json({ private: false, default_branch: 'master' });
  }
  if (url.origin === 'https://api.dribbble.com' && url.pathname === '/v2/user/shots') {
    return Response.json([]);
  }
  return nativeFetch(input, init);
};
