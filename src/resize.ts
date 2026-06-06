/**
 * Pure layout math for resizable panels.
 *
 * All sizes are expressed as percentages of the panel group that sum to 100.
 * The resize algorithm moves a single handle (between panel `index` and panel
 * `index + 1`) by `deltaPct` percentage points, redistributing space between
 * the two adjacent panels while honoring each panel's min/max constraints.
 *
 * When the immediately adjacent panel hits a constraint, the leftover delta
 * cascades to the next panel in the direction of travel, mirroring the
 * behaviour users expect from native split panes.
 */

/** Per-panel size constraints, in percentage points. */
export interface PanelConstraint {
  /** Minimum size in percent. Defaults to 0. */
  min?: number;
  /** Maximum size in percent. Defaults to 100. */
  max?: number;
  /**
   * Size in percent the panel collapses to when collapsed. Defaults to 0.
   * Only meaningful for panels that opt into collapsing.
   */
  collapsedSize?: number;
  /**
   * If true, dragging the panel below `min` (closer than `collapseThreshold`)
   * snaps it shut to `collapsedSize` instead of stopping at `min`.
   */
  collapsible?: boolean;
}

const EPSILON = 1e-6;

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function minOf(c: PanelConstraint | undefined): number {
  return c?.min ?? 0;
}

function maxOf(c: PanelConstraint | undefined): number {
  return c?.max ?? 100;
}

/**
 * Move the handle at `index` (between panel `index` and `index + 1`) by
 * `deltaPct` percentage points. A positive delta grows the left/top panel and
 * shrinks the right/bottom panel; a negative delta does the reverse.
 *
 * The returned array is a new array with the same length and the same sum as
 * the input (normalized to exactly 100). The input is never mutated.
 */
export function resizePanels(
  sizes: number[],
  index: number,
  deltaPct: number,
  constraints: PanelConstraint[] = [],
): number[] {
  const next = sizes.slice();

  if (next.length < 2) return next;
  if (index < 0 || index >= next.length - 1) return next;
  if (!Number.isFinite(deltaPct) || Math.abs(deltaPct) < EPSILON) {
    return normalize(next);
  }

  if (deltaPct > 0) {
    // Grow the left side, shrink panels to the right of the handle.
    // The applied movement is bounded by both the grow room of the left panel
    // and the total shrink capacity of the panels on the right.
    const growRoom = maxOf(constraints[index]) - next[index];
    const shrinkRoom = shrinkCapacity(next, index + 1, constraints, +1);
    const applied = clamp(deltaPct, 0, Math.min(growRoom, shrinkRoom));
    next[index] += applied;
    shrink(next, index + 1, applied, constraints, +1);
  } else {
    // Grow the right side, shrink panels to the left of the handle.
    const want = -deltaPct;
    const growRoom = maxOf(constraints[index + 1]) - next[index + 1];
    const shrinkRoom = shrinkCapacity(next, index, constraints, -1);
    const applied = clamp(want, 0, Math.min(growRoom, shrinkRoom));
    next[index + 1] += applied;
    shrink(next, index, applied, constraints, -1);
  }

  return normalize(next);
}

/**
 * Total amount of space the panels starting at `start` (walking in `dir`) can
 * give up before they all reach their min constraints.
 */
function shrinkCapacity(
  sizes: number[],
  start: number,
  constraints: PanelConstraint[],
  dir: number,
): number {
  let capacity = 0;
  let i = start;
  while (i >= 0 && i < sizes.length) {
    capacity += Math.max(0, sizes[i] - minOf(constraints[i]));
    i += dir;
  }
  return capacity;
}

/**
 * Shrink panels starting at `start` and walking in `dir` (+1 to the right,
 * -1 to the left) until `amount` of space has been removed or no panel can
 * give up more. Mutates `sizes`. Returns the amount actually removed.
 */
function shrink(
  sizes: number[],
  start: number,
  amount: number,
  constraints: PanelConstraint[],
  dir: number,
): number {
  let remaining = amount;
  let i = start;
  while (remaining > EPSILON && i >= 0 && i < sizes.length) {
    const min = minOf(constraints[i]);
    const available = sizes[i] - min;
    if (available > EPSILON) {
      const take = Math.min(available, remaining);
      sizes[i] -= take;
      remaining -= take;
    }
    i += dir;
  }
  return amount - remaining;
}

/**
 * Distribute `count` panels evenly across 100%, honoring constraints where
 * possible. Useful as a default layout when no explicit sizes are supplied.
 */
export function distributeEvenly(
  count: number,
  constraints: PanelConstraint[] = [],
): number[] {
  if (count <= 0) return [];
  const base = 100 / count;
  const sizes = new Array<number>(count).fill(base).map((s, i) =>
    clamp(s, minOf(constraints[i]), maxOf(constraints[i])),
  );
  return normalize(sizes);
}

/**
 * Scale a set of sizes so they sum to exactly 100. Negative values are clamped
 * to 0. An all-zero input is distributed evenly. The input is not mutated.
 */
export function normalize(sizes: number[]): number[] {
  const cleaned = sizes.map((s) => (Number.isFinite(s) && s > 0 ? s : 0));
  const total = cleaned.reduce((a, b) => a + b, 0);
  if (total < EPSILON) {
    if (cleaned.length === 0) return [];
    return new Array<number>(cleaned.length).fill(100 / cleaned.length);
  }
  const scaled = cleaned.map((s) => (s / total) * 100);
  // Eliminate floating-point drift by pinning the largest panel to exactly
  // (100 - sum of the others), guaranteeing the array sums to 100.
  let maxIdx = 0;
  for (let i = 1; i < scaled.length; i++) {
    if (scaled[i] > scaled[maxIdx]) maxIdx = i;
  }
  let othersSum = 0;
  for (let i = 0; i < scaled.length; i++) {
    if (i !== maxIdx) othersSum += scaled[i];
  }
  scaled[maxIdx] = 100 - othersSum;
  return scaled;
}

/**
 * Convert a pixel delta along the group's main axis into a percentage delta,
 * given the group's total size in pixels.
 */
export function pxDeltaToPct(deltaPx: number, groupSizePx: number): number {
  if (groupSizePx <= 0) return 0;
  return (deltaPx / groupSizePx) * 100;
}

/** The size a panel collapses to (its `collapsedSize`, defaulting to 0). */
export function collapsedSizeOf(c: PanelConstraint | undefined): number {
  return Math.max(0, c?.collapsedSize ?? 0);
}

/**
 * True when `size` is at (or within EPSILON of) the panel's collapsed size and
 * strictly below its minimum — i.e. the panel is shut rather than merely small.
 */
export function isCollapsed(
  size: number,
  constraint: PanelConstraint | undefined,
): boolean {
  const collapsed = collapsedSizeOf(constraint);
  const min = minOf(constraint);
  if (min <= collapsed + EPSILON) return false;
  return size <= collapsed + EPSILON;
}

/**
 * Collapse the panel at `index` to its `collapsedSize`. The freed space is
 * handed to the nearest expandable neighbor (preferring the right/bottom one,
 * falling back to the left/top one). Returns a normalized copy; never mutates.
 */
export function collapsePanel(
  sizes: number[],
  index: number,
  constraints: PanelConstraint[] = [],
): number[] {
  if (index < 0 || index >= sizes.length) return normalize(sizes.slice());
  const next = sizes.slice();
  const target = collapsedSizeOf(constraints[index]);
  const freed = next[index] - target;
  if (freed <= EPSILON) return normalize(next);
  next[index] = target;

  const neighbor =
    index + 1 < next.length
      ? index + 1
      : index - 1 >= 0
        ? index - 1
        : -1;
  if (neighbor >= 0) {
    const room = maxOf(constraints[neighbor]) - next[neighbor];
    next[neighbor] += Math.min(freed, room < 0 ? 0 : freed);
  }
  return normalize(next);
}

/**
 * Expand the panel at `index` back to `targetSize` (or its min, or an even
 * share when no target is given), pulling the needed space from neighbors that
 * have room above their min. Returns a normalized copy; never mutates.
 */
export function expandPanel(
  sizes: number[],
  index: number,
  constraints: PanelConstraint[] = [],
  targetSize?: number,
): number[] {
  if (index < 0 || index >= sizes.length) return normalize(sizes.slice());
  const next = sizes.slice();
  const min = minOf(constraints[index]);
  const max = maxOf(constraints[index]);
  const want = clamp(
    targetSize ?? (min > 0 ? min : 100 / next.length),
    min,
    max,
  );
  let needed = want - next[index];
  if (needed <= EPSILON) return normalize(next);

  // Pull from the right first, then the left, respecting each neighbor's min.
  const order: number[] = [];
  for (let i = index + 1; i < next.length; i++) order.push(i);
  for (let i = index - 1; i >= 0; i--) order.push(i);

  for (const i of order) {
    if (needed <= EPSILON) break;
    const available = next[i] - minOf(constraints[i]);
    if (available > EPSILON) {
      const take = Math.min(available, needed);
      next[i] -= take;
      next[index] += take;
      needed -= take;
    }
  }
  return normalize(next);
}

/**
 * Build the default layout from per-panel `defaultSize` values, falling back to
 * an even split for panels that omit one. Honors min/max via {@link normalize}
 * after the raw defaults are assembled. Used by "reset" (e.g. double-click).
 */
export function resetToDefaults(
  defaults: (number | undefined)[],
  constraints: PanelConstraint[] = [],
): number[] {
  const count = defaults.length;
  if (count === 0) return [];
  const hasAny = defaults.some((d) => typeof d === "number");
  if (!hasAny) return distributeEvenly(count, constraints);
  const filled = defaults.map((d, i) =>
    typeof d === "number"
      ? clamp(d, minOf(constraints[i]), maxOf(constraints[i]))
      : 100 / count,
  );
  return normalize(filled);
}

/**
 * After a drag settles, snap a collapsible panel shut if the user dragged it
 * below `min` by more than `collapseThreshold` percentage points; otherwise
 * push it back up to its `min`. Non-collapsible panels are clamped to `min`.
 * Returns a normalized copy; never mutates.
 */
export function applyCollapseSnap(
  sizes: number[],
  constraints: PanelConstraint[] = [],
  collapseThreshold = 0,
): number[] {
  const next = sizes.slice();
  for (let i = 0; i < next.length; i++) {
    const c = constraints[i];
    const min = minOf(c);
    if (next[i] >= min - EPSILON) continue;
    const collapsed = collapsedSizeOf(c);
    if (c?.collapsible && next[i] <= min - collapseThreshold) {
      return collapsePanel(next, i, constraints);
    }
    return expandPanel(next, i, constraints, min);
  }
  return normalize(next);
}
