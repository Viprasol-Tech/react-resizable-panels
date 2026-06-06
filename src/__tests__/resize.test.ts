import { describe, expect, it } from "vitest";
import {
  applyCollapseSnap,
  collapsePanel,
  collapsedSizeOf,
  distributeEvenly,
  expandPanel,
  isCollapsed,
  normalize,
  pxDeltaToPct,
  resetToDefaults,
  resizePanels,
} from "../resize";

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

describe("resizePanels", () => {
  it("moves space from the right panel to the left on a positive delta", () => {
    const result = resizePanels([50, 50], 0, 10);
    expect(result[0]).toBeCloseTo(60, 5);
    expect(result[1]).toBeCloseTo(40, 5);
    expect(sum(result)).toBeCloseTo(100, 5);
  });

  it("moves space from the left panel to the right on a negative delta", () => {
    const result = resizePanels([50, 50], 0, -15);
    expect(result[0]).toBeCloseTo(35, 5);
    expect(result[1]).toBeCloseTo(65, 5);
    expect(sum(result)).toBeCloseTo(100, 5);
  });

  it("respects the max constraint of the growing panel", () => {
    // Left panel capped at 55, so a +20 delta can only grow it by 5.
    const result = resizePanels([50, 50], 0, 20, [{ max: 55 }, {}]);
    expect(result[0]).toBeCloseTo(55, 5);
    expect(result[1]).toBeCloseTo(45, 5);
  });

  it("respects the min constraint of the shrinking panel", () => {
    // Right panel floored at 30, so it can only give up 20 of a 40 request.
    const result = resizePanels([50, 50], 0, 40, [{}, { min: 30 }]);
    expect(result[0]).toBeCloseTo(70, 5);
    expect(result[1]).toBeCloseTo(30, 5);
  });

  it("cascades shrink to the next panel when the neighbor hits its min", () => {
    // 3 panels of 40/30/30. Grow panel 0 by 35. Panel 1 floors at 20 (gives 10),
    // remaining 25 comes from panel 2 which floors at 10 (gives 20). Total
    // available to take = 30, so panel 0 only grows by 30.
    const result = resizePanels([40, 30, 30], 0, 35, [
      {},
      { min: 20 },
      { min: 10 },
    ]);
    expect(result[0]).toBeCloseTo(70, 5);
    expect(result[1]).toBeCloseTo(20, 5);
    expect(result[2]).toBeCloseTo(10, 5);
    expect(sum(result)).toBeCloseTo(100, 5);
  });

  it("is a no-op for an out-of-range handle index", () => {
    expect(resizePanels([50, 50], 5, 10)).toEqual([50, 50]);
    expect(resizePanels([50, 50], -1, 10)).toEqual([50, 50]);
  });

  it("does not mutate the input array", () => {
    const input = [50, 50];
    resizePanels(input, 0, 10);
    expect(input).toEqual([50, 50]);
  });

  it("keeps the sum at 100 across a chain of resizes", () => {
    let sizes = [25, 25, 25, 25];
    sizes = resizePanels(sizes, 0, 7);
    sizes = resizePanels(sizes, 2, -12);
    sizes = resizePanels(sizes, 1, 3);
    expect(sum(sizes)).toBeCloseTo(100, 5);
  });
});

describe("normalize", () => {
  it("scales arbitrary values to sum to 100", () => {
    const result = normalize([1, 1, 2]);
    expect(result).toEqual([25, 25, 50]);
    expect(sum(result)).toBeCloseTo(100, 5);
  });

  it("distributes evenly when given all zeros", () => {
    expect(normalize([0, 0, 0, 0])).toEqual([25, 25, 25, 25]);
  });

  it("corrects floating-point drift to exactly 100", () => {
    const result = normalize([1, 1, 1]);
    expect(sum(result)).toBe(100);
  });
});

describe("distributeEvenly", () => {
  it("splits N panels evenly", () => {
    expect(distributeEvenly(4)).toEqual([25, 25, 25, 25]);
  });

  it("returns an empty array for non-positive counts", () => {
    expect(distributeEvenly(0)).toEqual([]);
  });
});

describe("pxDeltaToPct", () => {
  it("converts pixels to a percentage of the group size", () => {
    expect(pxDeltaToPct(50, 200)).toBe(25);
    expect(pxDeltaToPct(-20, 200)).toBe(-10);
  });

  it("returns 0 for a zero-sized group", () => {
    expect(pxDeltaToPct(50, 0)).toBe(0);
  });
});

describe("collapsedSizeOf", () => {
  it("defaults to 0 and never goes negative", () => {
    expect(collapsedSizeOf(undefined)).toBe(0);
    expect(collapsedSizeOf({})).toBe(0);
    expect(collapsedSizeOf({ collapsedSize: 8 })).toBe(8);
    expect(collapsedSizeOf({ collapsedSize: -5 })).toBe(0);
  });
});

describe("isCollapsed", () => {
  it("reports collapsed when size is at the collapsed size below min", () => {
    expect(isCollapsed(0, { min: 10, collapsible: true })).toBe(true);
    expect(isCollapsed(4, { min: 10, collapsedSize: 4 })).toBe(true);
  });

  it("is not collapsed when at or above min", () => {
    expect(isCollapsed(10, { min: 10 })).toBe(false);
    expect(isCollapsed(20, { min: 10 })).toBe(false);
  });

  it("is never collapsed when there is no real min above the collapsed size", () => {
    expect(isCollapsed(0, {})).toBe(false);
    expect(isCollapsed(0, { min: 0 })).toBe(false);
  });
});

describe("collapsePanel", () => {
  it("collapses a panel to 0 and gives space to its right neighbor", () => {
    const result = collapsePanel([30, 40, 30], 0, [
      { collapsible: true },
      {},
      {},
    ]);
    expect(result[0]).toBeCloseTo(0, 5);
    expect(result[1]).toBeCloseTo(70, 5);
    expect(result[2]).toBeCloseTo(30, 5);
    expect(sum(result)).toBeCloseTo(100, 5);
  });

  it("collapses to a non-zero collapsedSize", () => {
    const result = collapsePanel([40, 60], 0, [{ collapsedSize: 5 }, {}]);
    expect(result[0]).toBeCloseTo(5, 5);
    expect(result[1]).toBeCloseTo(95, 5);
  });

  it("hands freed space to the left neighbor for the last panel", () => {
    const result = collapsePanel([30, 30, 40], 2, [{}, {}, {}]);
    expect(result[2]).toBeCloseTo(0, 5);
    expect(result[1]).toBeCloseTo(70, 5);
  });

  it("is a no-op for an out-of-range index", () => {
    expect(collapsePanel([50, 50], 9)).toEqual([50, 50]);
  });

  it("does not mutate its input", () => {
    const input = [50, 50];
    collapsePanel(input, 0, [{ collapsible: true }, {}]);
    expect(input).toEqual([50, 50]);
  });
});

describe("expandPanel", () => {
  it("expands a collapsed panel back to its min, pulling from a neighbor", () => {
    const result = expandPanel([0, 100], 0, [{ min: 20 }, {}], undefined);
    expect(result[0]).toBeCloseTo(20, 5);
    expect(result[1]).toBeCloseTo(80, 5);
  });

  it("expands to an explicit target size", () => {
    const result = expandPanel([0, 100], 0, [{ min: 10, max: 60 }, {}], 40);
    expect(result[0]).toBeCloseTo(40, 5);
    expect(result[1]).toBeCloseTo(60, 5);
  });

  it("clamps the target to the panel max", () => {
    const result = expandPanel([0, 100], 0, [{ max: 30 }, {}], 90);
    expect(result[0]).toBeCloseTo(30, 5);
  });

  it("respects neighbor mins when pulling space", () => {
    const result = expandPanel([0, 50, 50], 0, [
      { min: 80 },
      { min: 30 },
      { min: 30 },
    ]);
    // Neighbors can only give up 20 each (50 - 30), so panel 0 reaches 40.
    expect(result[0]).toBeCloseTo(40, 5);
    expect(sum(result)).toBeCloseTo(100, 5);
  });

  it("is a no-op when already at or above the target", () => {
    expect(expandPanel([60, 40], 0, [{ min: 20 }, {}], 50)).toEqual([60, 40]);
  });
});

describe("resetToDefaults", () => {
  it("honors explicit defaults that already sum to 100", () => {
    const result = resetToDefaults([20, 30, 50], []);
    expect(result).toEqual([20, 30, 50]);
    expect(sum(result)).toBeCloseTo(100, 5);
  });

  it("fills gaps with an even share, then normalizes to 100", () => {
    const result = resetToDefaults([20, undefined, undefined], []);
    // 20 + 33.33 + 33.33 = 86.67, rescaled to 100 keeps proportions.
    expect(result[1]).toBeCloseTo(result[2], 5);
    expect(sum(result)).toBeCloseTo(100, 5);
  });

  it("falls back to an even split when no defaults are given", () => {
    expect(resetToDefaults([undefined, undefined])).toEqual([50, 50]);
  });

  it("returns an empty array for no panels", () => {
    expect(resetToDefaults([])).toEqual([]);
  });

  it("clamps each default into its constraint range before normalizing", () => {
    // 90 is clamped to its max of 60 first; then [60,10] normalizes to ~[85.7,14.3].
    const result = resetToDefaults([90, 10], [{ max: 60 }, {}]);
    expect(result[0]).toBeCloseTo(60 / 70 * 100, 5);
    expect(sum(result)).toBeCloseTo(100, 5);
  });
});

describe("applyCollapseSnap", () => {
  it("snaps a collapsible panel shut when dragged well below min", () => {
    const result = applyCollapseSnap(
      [2, 98],
      [{ min: 20, collapsible: true }, {}],
      5,
    );
    expect(result[0]).toBeCloseTo(0, 5);
    expect(result[1]).toBeCloseTo(100, 5);
  });

  it("pushes a non-collapsible panel back up to its min", () => {
    const result = applyCollapseSnap([5, 95], [{ min: 20 }, {}], 5);
    expect(result[0]).toBeCloseTo(20, 5);
    expect(result[1]).toBeCloseTo(80, 5);
  });

  it("leaves a panel within bounds untouched", () => {
    const result = applyCollapseSnap([30, 70], [{ min: 20 }, {}], 5);
    expect(result[0]).toBeCloseTo(30, 5);
    expect(result[1]).toBeCloseTo(70, 5);
  });
});
