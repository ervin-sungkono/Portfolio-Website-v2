// Slot hints follow the 75rem container, fluid gutters/gaps, and each page's grid.
// These describe layout widths; CSS still owns cropping, tilt, and parallax.
const full = 'calc(93.3333vw - 0.6667rem)';
const half = 'calc(45.4167vw - 0.8333rem)';
const third = 'calc(29.4444vw - 0.8889rem)';

export const imageSizes = {
  full: `(min-width: 81rem) 75rem, ${full}`,
  twoColumns: `(min-width: 81rem) 36rem, (min-width: 48rem) ${half}, ${full}`,
  threeColumns: `(min-width: 81rem) 23rem, (min-width: 64rem) ${third}, (min-width: 48rem) ${half}, ${full}`,
  featuredCollection: `(min-width: 81rem) 23rem, (min-width: 64rem) ${third}, ${full}`,
  homePrimary: `(min-width: 81rem) 49.5rem, (min-width: 70rem) calc(62.2222vw - 0.9444rem), ${full}`,
  homeSecondary: `(min-width: 81rem) 24rem, (min-width: 70rem) calc(31.1111vw - 1.2222rem), (min-width: 48rem) ${half}, ${full}`,
  homeAdditional: `(min-width: 81rem) 36.75rem, (min-width: 70rem) calc(46.6667vw - 1.0833rem), (min-width: 48rem) ${half}, ${full}`,
  homeTeaser: `(min-width: 81rem) 12.5rem, (min-width: 70rem) calc(17.3333vw - 1.5rem), (min-width: 48rem) ${half}, ${full}`,
  homeArtworkPrimary: `(min-width: 81rem) 43.2rem, (min-width: 70rem) calc(54.5vw - 1rem), (min-width: 48rem) ${half}, ${full}`,
  homeArtworkSecondary: `(min-width: 81rem) 28.8rem, (min-width: 70rem) calc(36.3333vw - 0.6667rem), (min-width: 48rem) ${half}, ${full}`,
  hero: '(min-width: 81rem) 32.0625rem, (min-width: 64rem) calc(43.6vw - 3.3rem), calc(93.3333vw - 3.1667rem)',
};
