// Sizes for a picture cropped to fill a square Contact print. Pure and type-erasable:
// the tests import this file directly, so no Astro imports and no enums.

/**
 * The square's width at each layout, measured on the built page: two across at 760px and
 * below, four across to 1060px, four across beside the wide gutters, then the full sheet.
 */
export const SQUARE_MOBILE = '50vw - 65px';
export const SQUARE_TABLET = '25vw - 67px';
export const SQUARE_DESKTOP = '25vw - 90px';
export const SQUARE_FULL = 228;

// Square widths in px across the layouts, generated at 1x, 2x and 3x. The widest square
// is the two-across one at 760px.
const SQUARES = [100, 130, 190, SQUARE_FULL, 315] as const;
const DENSITIES = [1, 2, 3] as const;

export interface PrintImage {
  widths: number[];
  sizes: string;
}

/**
 * `widths` and `sizes` for an original of `width` by `height` shown with object-fit: cover
 * in the square. A wide original fills the square's height, so it is drawn wider than the
 * square by width / height; a tall one is drawn at the square's width. No width goes above
 * the original.
 */
export function printImage(width: number, height: number): PrintImage {
  if (!(Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0)) {
    throw new Error(`print-image: ${width} by ${height} is not an image size`);
  }
  const wide = width > height;
  const scale = wide ? width / height : 1;
  const fluid = (square: string) => (wide ? `calc((${square}) * ${width} / ${height})` : `calc(${square})`);

  const all = SQUARES.flatMap((square) => DENSITIES.map((density) => Math.round(square * density * scale)));
  const capped = all.map((w) => Math.min(w, width));
  const widths = [...new Set(capped)].sort((a, b) => a - b);

  const sizes = [
    `(max-width: 760px) ${fluid(SQUARE_MOBILE)}`,
    `(max-width: 1060px) ${fluid(SQUARE_TABLET)}`,
    `(max-width: 1271px) ${fluid(SQUARE_DESKTOP)}`,
    `${Math.round(SQUARE_FULL * scale)}px`,
  ].join(', ');

  return { widths, sizes };
}
