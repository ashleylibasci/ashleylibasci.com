// Sizes for an image on a Work entry's visual. Pure and type-erasable:
// the tests import this file directly, so no Astro imports and no enums.

/**
 * The visual's width at each layout: the full row at 760px and below, columns 7 to 12
 * inside the tablet gutters to 1060px, inside the desktop gutters after, then the widest.
 */
export const VISUAL_MOBILE = '100vw - 40px';
export const VISUAL_TABLET = '50vw - 44px';
export const VISUAL_DESKTOP = '50vw - 76px';
export const VISUAL_FULL = 560;

/** The share of the visual's width a plate takes, inside the mat on both sides. */
export const PLATE_SHARE = 0.886;

// Visual widths in px across the layouts, generated at 1x, 2x and 3x. The widest visual
// is the full row at 760px.
const VISUALS = [300, 400, VISUAL_FULL, 720] as const;
const DENSITIES = [1, 2, 3] as const;

export interface PlateImage {
  widths: number[];
  sizes: string;
}

/**
 * `widths` and `sizes` for an original `width` px wide, drawn at `scale` times the
 * visual's width (1 by default). No width goes above the original.
 */
export function plateImage(width: number, scale: number = 1): PlateImage {
  if (!(Number.isInteger(width) && width > 0)) throw new Error(`work-image: ${width} is not an image width`);
  if (!(Number.isFinite(scale) && scale > 0)) throw new Error(`work-image: ${scale} is not a scale`);

  const all = VISUALS.flatMap((visual) => DENSITIES.map((density) => Math.round(visual * density * scale)));
  const capped = all.map((w) => Math.min(w, width));
  const widths = [...new Set(capped)].sort((a, b) => a - b);

  const fluid = (visual: string) => (scale === 1 ? `calc(${visual})` : `calc((${visual}) * ${scale})`);
  const sizes = [
    `(max-width: 760px) ${fluid(VISUAL_MOBILE)}`,
    `(max-width: 1060px) ${fluid(VISUAL_TABLET)}`,
    `(max-width: 1271px) ${fluid(VISUAL_DESKTOP)}`,
    `${Math.round(VISUAL_FULL * scale)}px`,
  ].join(', ');

  return { widths, sizes };
}
