// Secret code logic with no DOM in it, so Node can test every row with plain
// objects and a seeded random. The DOM script feeds it key events and paints
// the bubbles it returns.

/** Up up down down left right left right B A, as lower-cased `KeyboardEvent.key` values. */
export const CODE: readonly string[] = [
  'arrowup',
  'arrowup',
  'arrowdown',
  'arrowdown',
  'arrowleft',
  'arrowright',
  'arrowleft',
  'arrowright',
  'b',
  'a',
];

export const BUBBLE_COUNT = 30;
/** The layer is emptied this long after the code, moving or still. */
export const RISE_CLEAR_MS = 4300;
export const STILL_CLEAR_MS = 2400;

/** Input types that take no typing, so the code still counts on them. */
const NOT_TYPING = /^(radio|checkbox|button|submit|reset|range|color|file|image)$/i;
/** Keys that neither advance nor reset the sequence when pressed alone. */
const BARE_MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'AltGraph']);

export interface TargetLike {
  tagName?: string;
  type?: string;
  isContentEditable?: boolean;
}

export interface KeyLike {
  key?: string;
  repeat?: boolean;
  isComposing?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  target?: unknown;
}

/** True when the target takes typed text, so keys there are not counted. */
export function isTextField(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const t = target as TargetLike;
  if (typeof t.tagName !== 'string') return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName.toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return tag === 'INPUT' && !NOT_TYPING.test(t.type ?? '');
}

/**
 * A matcher holding its own place in the code. `step` returns true on the key
 * that completes the code. A wrong key resets; an up arrow restarts at step 1,
 * or keeps step 2 after two ups. Repeats, composition, bare modifiers and
 * Ctrl/Alt/Meta chords are ignored, as are keys typed in a text field.
 */
export function createMatcher(): (event: KeyLike) => boolean {
  let at = 0;
  return (event) => {
    if (isTextField(event.target)) return false;
    if (event.repeat || event.isComposing || event.key === 'Process') return false;
    if (event.ctrlKey || event.altKey || event.metaKey) return false;
    if (event.key !== undefined && BARE_MODIFIERS.has(event.key)) return false;
    const key = (typeof event.key === 'string' ? event.key : '').toLowerCase();
    if (key === CODE[at]) {
      at += 1;
      if (at === CODE.length) {
        at = 0;
        return true;
      }
    } else if (key === 'arrowup') {
      at = at === 2 ? 2 : 1;
    } else {
      at = 0;
    }
    return false;
  };
}

export interface BubbleSpec {
  /** Width and height, in px. */
  size: string;
  left: string;
  /** Still bubbles only. */
  top?: string;
  /** Moving bubbles only: custom properties the rise keyframes read. */
  vars?: { '--d': string; '--w': string; '--dx': string };
}

/** Thirty bubbles: still ones scattered over the window, moving ones set to rise from below. */
export function bubbles(random: () => number, still: boolean): BubbleSpec[] {
  const out: BubbleSpec[] = [];
  for (let i = 0; i < BUBBLE_COUNT; i++) {
    const spec: BubbleSpec = {
      size: `${(4 + random() * 10).toFixed(1)}px`,
      left: `${(2 + random() * 96).toFixed(1)}%`,
    };
    if (still) {
      spec.top = `${(12 + random() * 76).toFixed(1)}%`;
    } else {
      spec.vars = {
        '--d': `${(2.6 + random() * 0.9).toFixed(2)}s`,
        '--w': `${(random() * 0.6).toFixed(2)}s`,
        '--dx': `${((random() - 0.5) * 60).toFixed(1)}px`,
      };
    }
    out.push(spec);
  }
  return out;
}

/** How long the bubbles stay before the layer is emptied. */
export function clearAfter(still: boolean): number {
  return still ? STILL_CLEAR_MS : RISE_CLEAR_MS;
}
