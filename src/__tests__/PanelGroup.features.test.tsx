import { createRef } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type PanelGroupHandle,
} from "../index";

/** Stub the group container's measured size; jsdom returns all-zero rects. */
function mockGroupSize(px: number) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      if (this.hasAttribute("data-panel-group")) {
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: px,
          bottom: px,
          width: px,
          height: px,
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

const basis = (i: number) =>
  parseFloat((document.querySelectorAll("[data-panel]")[i] as HTMLElement).style.flexBasis);

beforeEach(() => mockGroupSize(1000));
afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("keyboard resizing", () => {
  function App() {
    return (
      <PanelGroup direction="horizontal">
        <Panel defaultSize={50} minSize={10}>
          left
        </Panel>
        <PanelResizeHandle handleIndex={0} keyboardStep={10} />
        <Panel defaultSize={50} minSize={10}>
          right
        </Panel>
      </PanelGroup>
    );
  }

  it("grows the left panel on ArrowRight", () => {
    render(<App />);
    const handle = screen.getByRole("separator");
    act(() => {
      handle.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
    });
    expect(basis(0)).toBeCloseTo(60, 1);
    expect(basis(1)).toBeCloseTo(40, 1);
  });

  it("shrinks the left panel on ArrowLeft", () => {
    render(<App />);
    const handle = screen.getByRole("separator");
    act(() => {
      handle.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
      );
    });
    expect(basis(0)).toBeCloseTo(40, 1);
  });

  it("jumps fully one way on End (clamped by min)", () => {
    render(<App />);
    const handle = screen.getByRole("separator");
    act(() => {
      handle.dispatchEvent(
        new KeyboardEvent("keydown", { key: "End", bubbles: true }),
      );
    });
    // Right panel floored at 10 => left grows to 90.
    expect(basis(0)).toBeCloseTo(90, 1);
    expect(basis(1)).toBeCloseTo(10, 1);
  });

  it("ignores keyboard input when disabled", () => {
    render(
      <PanelGroup direction="horizontal">
        <Panel defaultSize={50}>left</Panel>
        <PanelResizeHandle handleIndex={0} disabled />
        <Panel defaultSize={50}>right</Panel>
      </PanelGroup>,
    );
    const handle = screen.getByRole("separator");
    expect(handle).toHaveAttribute("tabindex", "-1");
    act(() => {
      handle.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
    });
    expect(basis(0)).toBeCloseTo(50, 1);
  });
});

describe("double-click reset", () => {
  it("restores the default split after a drag", () => {
    render(
      <PanelGroup direction="horizontal">
        <Panel defaultSize={30}>left</Panel>
        <PanelResizeHandle handleIndex={0} />
        <Panel defaultSize={70}>right</Panel>
      </PanelGroup>,
    );
    const handle = screen.getByRole("separator");

    act(() => {
      handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(basis(0)).not.toBeCloseTo(30, 1);

    act(() => {
      handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    expect(basis(0)).toBeCloseTo(30, 1);
    expect(basis(1)).toBeCloseTo(70, 1);
  });

  it("does not reset when resetOnDoubleClick is false", () => {
    render(
      <PanelGroup direction="horizontal">
        <Panel defaultSize={30}>left</Panel>
        <PanelResizeHandle handleIndex={0} resetOnDoubleClick={false} />
        <Panel defaultSize={70}>right</Panel>
      </PanelGroup>,
    );
    const handle = screen.getByRole("separator");
    act(() => {
      handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    const after = basis(0);
    act(() => {
      handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    expect(basis(0)).toBeCloseTo(after, 1);
  });
});

describe("imperative API (ref)", () => {
  it("collapses, expands and toggles a panel by id", () => {
    const ref = createRef<PanelGroupHandle>();
    const onCollapse = vi.fn();
    const onExpand = vi.fn();
    render(
      <PanelGroup ref={ref} direction="horizontal">
        <Panel id="sidebar" defaultSize={30} minSize={20} collapsible onCollapse={onCollapse} onExpand={onExpand}>
          side
        </Panel>
        <PanelResizeHandle handleIndex={0} />
        <Panel defaultSize={70}>main</Panel>
      </PanelGroup>,
    );

    act(() => ref.current!.collapse("sidebar"));
    expect(basis(0)).toBeCloseTo(0, 1);
    expect(ref.current!.isCollapsed("sidebar")).toBe(true);
    expect(onCollapse).toHaveBeenCalledTimes(1);

    act(() => ref.current!.expand("sidebar"));
    expect(basis(0)).toBeCloseTo(20, 1);
    expect(ref.current!.isCollapsed("sidebar")).toBe(false);
    expect(onExpand).toHaveBeenCalledTimes(1);

    act(() => ref.current!.toggle("sidebar"));
    expect(ref.current!.isCollapsed("sidebar")).toBe(true);
  });

  it("collapses by numeric index and reflects in data attributes", () => {
    const ref = createRef<PanelGroupHandle>();
    render(
      <PanelGroup ref={ref} direction="horizontal">
        <Panel defaultSize={50} minSize={20} collapsible>a</Panel>
        <PanelResizeHandle handleIndex={0} />
        <Panel defaultSize={50}>b</Panel>
      </PanelGroup>,
    );
    act(() => ref.current!.collapse(0));
    const first = document.querySelectorAll("[data-panel]")[0] as HTMLElement;
    expect(first).toHaveAttribute("data-panel-collapsed", "");
  });

  it("getLayout / setLayout round-trips a normalized layout", () => {
    const ref = createRef<PanelGroupHandle>();
    render(
      <PanelGroup ref={ref} direction="horizontal">
        <Panel defaultSize={50}>a</Panel>
        <PanelResizeHandle handleIndex={0} />
        <Panel defaultSize={50}>b</Panel>
      </PanelGroup>,
    );
    act(() => ref.current!.setLayout([20, 60]));
    const layout = ref.current!.getLayout();
    expect(layout[0]).toBeCloseTo(25, 1);
    expect(layout[1]).toBeCloseTo(75, 1);
  });

  it("reset returns panels to their default sizes", () => {
    const ref = createRef<PanelGroupHandle>();
    render(
      <PanelGroup ref={ref} direction="horizontal">
        <Panel defaultSize={40}>a</Panel>
        <PanelResizeHandle handleIndex={0} />
        <Panel defaultSize={60}>b</Panel>
      </PanelGroup>,
    );
    act(() => ref.current!.setLayout([80, 20]));
    act(() => ref.current!.reset());
    expect(basis(0)).toBeCloseTo(40, 1);
    expect(basis(1)).toBeCloseTo(60, 1);
  });
});

describe("onLayout callback", () => {
  it("fires with the size array once panels register", () => {
    const onLayout = vi.fn();
    render(
      <PanelGroup direction="horizontal" onLayout={onLayout}>
        <Panel defaultSize={40}>a</Panel>
        <PanelResizeHandle handleIndex={0} />
        <Panel defaultSize={60}>b</Panel>
      </PanelGroup>,
    );
    expect(onLayout).toHaveBeenCalled();
    const last = onLayout.mock.calls.at(-1)![0] as number[];
    expect(last[0]).toBeCloseTo(40, 1);
    expect(last.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 1);
  });
});

describe("vertical direction", () => {
  it("exposes a horizontal separator orientation and row-resize cursor", () => {
    render(
      <PanelGroup direction="vertical">
        <Panel defaultSize={50}>top</Panel>
        <PanelResizeHandle handleIndex={0} />
        <Panel defaultSize={50}>bottom</Panel>
      </PanelGroup>,
    );
    const handle = screen.getByRole("separator");
    expect(handle).toHaveAttribute("aria-orientation", "horizontal");
    expect((handle as HTMLElement).style.cursor).toBe("row-resize");
  });
});

describe("persistence (autoSaveId)", () => {
  it("writes the layout to localStorage and restores it on remount", () => {
    const { unmount } = render(
      <PanelGroup direction="horizontal" autoSaveId="suite">
        <Panel defaultSize={50}>a</Panel>
        <PanelResizeHandle handleIndex={0} />
        <Panel defaultSize={50}>b</Panel>
      </PanelGroup>,
    );
    const handle = screen.getByRole("separator");
    act(() => {
      handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    const moved = basis(0);
    expect(window.localStorage.getItem("react-resizable-panels:suite")).not.toBeNull();
    unmount();

    render(
      <PanelGroup direction="horizontal" autoSaveId="suite">
        <Panel defaultSize={50}>a</Panel>
        <PanelResizeHandle handleIndex={0} />
        <Panel defaultSize={50}>b</Panel>
      </PanelGroup>,
    );
    expect(basis(0)).toBeCloseTo(moved, 1);
  });
});

describe("nested groups", () => {
  it("renders an inner group inside a panel and resizes each independently", () => {
    render(
      <PanelGroup direction="horizontal">
        <Panel defaultSize={50}>
          <PanelGroup direction="vertical">
            <Panel defaultSize={50}>inner-top</Panel>
            <PanelResizeHandle handleIndex={0} aria-label="inner" />
            <Panel defaultSize={50}>inner-bottom</Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle handleIndex={0} aria-label="outer" />
        <Panel defaultSize={50}>right</Panel>
      </PanelGroup>,
    );
    expect(screen.getByText("inner-top")).toBeInTheDocument();
    expect(screen.getByText("inner-bottom")).toBeInTheDocument();
    expect(screen.getByText("right")).toBeInTheDocument();
    // Two groups, two handles total (one per group).
    expect(document.querySelectorAll("[data-panel-group]")).toHaveLength(2);
    expect(screen.getAllByRole("separator")).toHaveLength(2);
  });
});
