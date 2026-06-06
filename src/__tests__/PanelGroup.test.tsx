import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Panel, PanelGroup, PanelResizeHandle } from "../index";

function mockGroupWidth(px: number) {
  // jsdom returns all-zero rects; stub the group container's measured width.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      if (this.hasAttribute("data-panel-group")) {
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: px,
          bottom: 100,
          width: px,
          height: 100,
          toJSON: () => ({}),
        } as DOMRect;
      }
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      } as DOMRect;
    },
  );
}

function App() {
  return (
    <PanelGroup direction="horizontal">
      <Panel defaultSize={50} minSize={10}>
        <div>left</div>
      </Panel>
      <PanelResizeHandle handleIndex={0} />
      <Panel defaultSize={50} minSize={10}>
        <div>right</div>
      </Panel>
    </PanelGroup>
  );
}

describe("<PanelGroup>", () => {
  beforeEach(() => {
    mockGroupWidth(1000);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders panels and a resize handle", () => {
    render(<App />);
    expect(screen.getByText("left")).toBeInTheDocument();
    expect(screen.getByText("right")).toBeInTheDocument();
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("applies the default 50/50 layout via flex-basis", () => {
    render(<App />);
    const panels = document.querySelectorAll("[data-panel]");
    expect(panels).toHaveLength(2);
    expect((panels[0] as HTMLElement).style.flexBasis).toBe("50%");
    expect((panels[1] as HTMLElement).style.flexBasis).toBe("50%");
  });

  it("changes panel sizes when a pointer drag moves the handle", () => {
    render(<App />);
    const handle = screen.getByRole("separator");
    const panels = document.querySelectorAll("[data-panel]");

    // Drag the handle 200px to the right within a 1000px group => +20%.
    act(() => {
      handle.dispatchEvent(
        new PointerEvent("pointerdown", { clientX: 0, bubbles: true }),
      );
      window.dispatchEvent(
        new PointerEvent("pointermove", { clientX: 200, bubbles: true }),
      );
      window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    });

    const left = (panels[0] as HTMLElement).style.flexBasis;
    const right = (panels[1] as HTMLElement).style.flexBasis;
    expect(parseFloat(left)).toBeCloseTo(70, 1);
    expect(parseFloat(right)).toBeCloseTo(30, 1);
  });

  it("exposes accessible separator metadata", () => {
    render(<App />);
    const handle = screen.getByRole("separator");
    expect(handle).toHaveAttribute("aria-orientation", "vertical");
    expect(handle).toHaveAttribute("aria-valuenow", "50");
  });
});
