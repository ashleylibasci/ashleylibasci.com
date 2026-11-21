// Loading attributes for every image on the site. Pure and type-erasable:
// the tests import this file directly, so no Astro imports and no enums.

export interface LoadingAttrs {
  loading: 'lazy' | 'eager';
  decoding: 'async';
  fetchpriority?: 'high';
}

/** Lazy and async unless the image is above the fold, which loads at once with high priority. */
export function loadingAttrs(eager: boolean = false): LoadingAttrs {
  return eager
    ? { loading: 'eager', decoding: 'async', fetchpriority: 'high' }
    : { loading: 'lazy', decoding: 'async' };
}
