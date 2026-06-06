import { describe, expect, it } from "vitest";
import {
  distributeEvenly,
  normalize,
  pxDeltaToPct,
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
