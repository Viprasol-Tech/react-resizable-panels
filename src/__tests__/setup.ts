import "@testing-library/jest-dom/vitest";

// jsdom does not implement PointerEvent or pointer capture. Polyfill the bits
// the components rely on so render + drag interaction tests can run.
if (typeof window.PointerEvent === "undefined") {
  class PointerEventPolyfill extends MouseEvent {
    public pointerId: number;
    public pointerType: string;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
      this.pointerType = params.pointerType ?? "mouse";
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).PointerEvent = PointerEventPolyfill;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).PointerEvent = PointerEventPolyfill;
}

if (!HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = () => {};
}
if (!HTMLElement.prototype.releasePointerCapture) {
  HTMLElement.prototype.releasePointerCapture = () => {};
}
