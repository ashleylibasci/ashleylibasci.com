// Copy logic with no DOM in it, so Node can test every way the clipboard fails.

export type CopyState = 'idle' | 'copied' | 'selected';

/** What the button reads and what the status region announces in each state. */
export const COPY_STATES: Readonly<Record<CopyState, { label: string; announcement: string }>> = {
  idle: { label: 'Copy', announcement: '' },
  copied: { label: 'Copied', announcement: 'Email address copied.' },
  selected: {
    label: 'Selected',
    announcement: 'Copying is blocked here, so the address is selected for you to copy.',
  },
};

/** How long a result stays on the button before it resets. */
export const COPY_RESET_MS = 2200;

export interface ClipboardLike {
  writeText(text: string): Promise<void>;
}

/**
 * Puts `address` on the clipboard. When the clipboard is missing, rejects or
 * throws, calls `selectFallback` instead. Never throws or rejects.
 */
export async function copyAddress(
  address: string,
  clipboard: ClipboardLike | null | undefined,
  selectFallback: () => void,
): Promise<'copied' | 'selected'> {
  try {
    if (clipboard && typeof clipboard.writeText === 'function') {
      await clipboard.writeText(address);
      return 'copied';
    }
  } catch {
    // Blocked: fall through to selecting the address.
  }
  try {
    selectFallback();
  } catch {
    // Nothing more to try; the mail link still works.
  }
  return 'selected';
}

/**
 * Returns a function that schedules `reset` to run `ms` after its latest call.
 * Calling it again first replaces the pending run, so there is only ever one timer.
 */
export function resetScheduler(reset: () => void, ms: number = COPY_RESET_MS): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(reset, ms);
  };
}
