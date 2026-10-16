/**
 * Cell semantics for Shopify product CSV comparison.
 *
 * The whole tool rests on keeping THREE states distinct, because Shopify's
 * overwrite import treats them differently:
 *
 *   absent  - the column is not in this file at all.
 *             Nothing about that field is sent, so the store value survives.
 *   empty   - the column exists and this cell is a zero-length string.
 *             The field IS present in the payload, carrying "no value",
 *             which is how a value gets cleared.
 *   value   - a non-zero-length string (including whitespace-only: " " is a
 *             real value to Shopify, and is a classic silent-mismatch trap).
 *
 * Collapsing `absent` into `empty` is the single most damaging bug this tool
 * could have: every "this column will clear your data" finding would fire on
 * files that are perfectly safe, and every genuinely dangerous file would look
 * like the others.
 */

export type Cell =
  | { readonly kind: 'absent' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'value'; readonly value: string };

export const ABSENT: Cell = { kind: 'absent' };
export const EMPTY: Cell = { kind: 'empty' };

export function cell(value: string | undefined | null): Cell {
  if (value === undefined || value === null) return ABSENT;
  return value.length === 0 ? EMPTY : { kind: 'value', value };
}

/** Reads a cell out of a parsed row. `undefined` column index => absent. */
export function cellAt(row: readonly (string | undefined)[], index: number): Cell {
  if (index < 0) return ABSENT;
  return cell(row[index]);
}

/**
 * Content for comparison purposes.
 * `absent` and `empty` both collapse to "" ONLY where a rule explicitly wants
 * "no content here"; rules that care about the distinction must branch on
 * `c.kind` first.
 */
export function text(c: Cell): string {
  return c.kind === 'value' ? c.value : '';
}

/**
 * Compact rendering for report cells and CSV/JSON output. The three states stay
 * visibly distinct, because "(empty)" and "—" mean opposite things to a
 * merchant: one clears a value, the other does not touch it.
 */
export function renderShort(c: Cell): string {
  switch (c.kind) {
    case 'absent':
      return '—';
    case 'empty':
      return '(empty)';
    case 'value':
      return c.value;
  }
}
