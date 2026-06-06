import {
  Children,
  createContext,
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  applyCollapseSnap,
  collapsePanel,
  distributeEvenly,
  expandPanel,
  isCollapsed,
  normalize,
  pxDeltaToPct,
  resetToDefaults,
  resizePanels,
  type PanelConstraint,
} from "./resize";

export type Direction = "horizontal" | "vertical";

interface PanelMeta extends PanelConstraint {
  defaultSize?: number;
  /** Stable id used for collapse callbacks and imperative addressing. */
  id?: string;
  onCollapse?: () => void;
  onExpand?: () => void;
  onResize?: (size: number) => void;
}

/**
 * Imperative handle exposed via `ref` on {@link PanelGroup}. Lets callers drive
 * the layout programmatically (toolbar buttons, keyboard shortcuts, tests).
 */
export interface PanelGroupHandle {
  /** Current layout as percentages summing to 100. */
  getLayout: () => number[];
  /** Replace the whole layout (normalized to 100 internally). */
  setLayout: (sizes: number[]) => void;
  /** Collapse the panel at `index` (or by registered `id`). */
  collapse: (target: number | string) => void;
  /** Expand the panel at `index` (or `id`) to `size`, its min, or an even share. */
  expand: (target: number | string, size?: number) => void;
  /** Toggle collapse/expand for the panel at `index` (or `id`). */
  toggle: (target: number | string) => void;
  /** True if the panel at `index` (or `id`) is currently collapsed. */
  isCollapsed: (target: number | string) => boolean;
  /** Reset every panel to its `defaultSize` (even split otherwise). */
  reset: () => void;
}

interface PanelGroupContextValue {
  direction: Direction;
  sizes: number[];
  registerPanel: (meta: PanelMeta) => number;
  updatePanel: (index: number, meta: PanelMeta) => void;
  markRegistered: (index: number) => () => void;
  startDrag: (handleIndex: number, clientPos: number) => void;
  nudge: (handleIndex: number, deltaPct: number) => void;
  resetHandle: (handleIndex: number) => void;
  isPanelCollapsed: (index: number) => boolean;
}

const PanelGroupContext = createContext<PanelGroupContextValue | null>(null);

export function usePanelGroup(): PanelGroupContextValue {
  const ctx = useContext(PanelGroupContext);
  if (!ctx) {
    throw new Error("Panel components must be rendered inside a <PanelGroup>.");
  }
  return ctx;
}

export interface PanelGroupProps {
  /** Layout axis. `horizontal` lays panels left-to-right. */
  direction?: Direction;
  /** localStorage key used to persist the layout across reloads. */
  autoSaveId?: string;
  /** Called with the new size array (percentages summing to 100) on resize. */
  onLayout?: (sizes: number[]) => void;
  /**
   * When dragging a collapsible panel this many percentage points below its
   * `minSize`, it snaps shut instead of stopping at the minimum. Default `5`.
   */
  collapseThreshold?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

const storageKey = (key: string) => `react-resizable-panels:${key}`;

function readPersisted(key: string | undefined): number[] | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number")) {
      return parsed as number[];
    }
  } catch {
    /* ignore malformed storage */
  }
  return null;
}

function writePersisted(key: string | undefined, sizes: number[]): void {
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(key), JSON.stringify(sizes));
  } catch {
    /* storage may be unavailable (private mode); ignore */
  }
}

export const PanelGroup = forwardRef<PanelGroupHandle, PanelGroupProps>(
  function PanelGroup(
    {
      direction = "horizontal",
      autoSaveId,
      onLayout,
      collapseThreshold = 5,
      className,
      style,
      children,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const metaRef = useRef<PanelMeta[]>([]);
    const slotCounter = useRef(0);
    const [panelCount, setPanelCount] = useState(0);
    const [sizes, setSizes] = useState<number[]>(
      () => readPersisted(autoSaveId) ?? [],
    );

    // Slot-based registration that survives React bailing out of re-rendering
    // unchanged Panel children. Each panel claims a stable slot on first render
    // (recording its meta synchronously so it is available immediately) and
    // keeps its slot's meta current on every render via `updatePanel`. The
    // panel count is bumped from the panel's mount effect, never during render.
    const registerPanel = useCallback((meta: PanelMeta): number => {
      const index = slotCounter.current++;
      metaRef.current[index] = meta;
      return index;
    }, []);

    const updatePanel = useCallback((index: number, meta: PanelMeta): void => {
      metaRef.current[index] = meta;
    }, []);

    const markRegistered = useCallback((index: number): (() => void) => {
      setPanelCount((c) => Math.max(c, index + 1));
      return () => {
        // On unmount, recompute the live panel count from remaining slots.
        setPanelCount(metaRef.current.filter(Boolean).length);
      };
    }, []);

    const constraintsOf = useCallback(
      (): PanelConstraint[] =>
        metaRef.current.map((m) => ({
          min: m.min,
          max: m.max,
          collapsedSize: m.collapsedSize,
          collapsible: m.collapsible,
        })),
      [],
    );

    // Establish the initial layout once all panels have registered.
    useEffect(() => {
      const metas = metaRef.current;
      if (metas.length === 0 || panelCount === 0) return;
      setSizes((prev) => {
        if (prev.length === panelCount) return prev;
        return resetToDefaults(
          metas.slice(0, panelCount).map((m) => m.defaultSize),
          constraintsOf(),
        );
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [panelCount]);

    // Track previous collapse state per panel to fire onCollapse/onExpand.
    const collapsedRef = useRef<boolean[]>([]);

    useEffect(() => {
      if (sizes.length === 0) return;
      onLayout?.(sizes);
      writePersisted(autoSaveId, sizes);

      const cons = constraintsOf();
      const prev = collapsedRef.current;
      const nextState: boolean[] = [];
      for (let i = 0; i < sizes.length; i++) {
        const collapsed = isCollapsed(sizes[i], cons[i]);
        nextState[i] = collapsed;
        metaRef.current[i]?.onResize?.(sizes[i]);
        if (prev[i] !== undefined && prev[i] !== collapsed) {
          if (collapsed) metaRef.current[i]?.onCollapse?.();
          else metaRef.current[i]?.onExpand?.();
        }
      }
      collapsedRef.current = nextState;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sizes]);

    const dragState = useRef<{
      handleIndex: number;
      startPos: number;
      startSizes: number[];
    } | null>(null);

    const startDrag = useCallback(
      (handleIndex: number, clientPos: number) => {
        dragState.current = {
          handleIndex,
          startPos: clientPos,
          startSizes: sizes.slice(),
        };
      },
      [sizes],
    );

    // Apply a discrete percentage nudge to a handle (keyboard, programmatic).
    // Constraints are snapshotted *now*, before the (lazily-run) state updater,
    // because metaRef is cleared at the top of every render.
    const nudge = useCallback(
      (handleIndex: number, deltaPct: number) => {
        const cons = constraintsOf();
        setSizes((prev) => resizePanels(prev, handleIndex, deltaPct, cons));
      },
      [constraintsOf],
    );

    // Reset both panels adjacent to a handle to their default split.
    const resetHandle = useCallback(
      (handleIndex: number) => {
        const cons = constraintsOf();
        const defaults = resetToDefaults(
          metaRef.current.map((m) => m.defaultSize),
          cons,
        );
        setSizes((prev) => {
          if (handleIndex < 0 || handleIndex + 1 >= prev.length) return prev;
          const next = prev.slice();
          // Redistribute only the two adjacent panels back to their defaults,
          // keeping the combined width they currently occupy.
          const pair = handleIndex;
          const combined = next[pair] + next[pair + 1];
          const dTotal = defaults[pair] + defaults[pair + 1];
          if (dTotal <= 0) return prev;
          next[pair] = (defaults[pair] / dTotal) * combined;
          next[pair + 1] = (defaults[pair + 1] / dTotal) * combined;
          return normalize(next);
        });
      },
      [constraintsOf],
    );

    const isPanelCollapsed = useCallback(
      (index: number) => isCollapsed(sizes[index] ?? 0, constraintsOf()[index]),
      [sizes, constraintsOf],
    );

    useEffect(() => {
      function onMove(clientPos: number) {
        const drag = dragState.current;
        const container = containerRef.current;
        if (!drag || !container) return;
        const rect = container.getBoundingClientRect();
        const groupPx = direction === "horizontal" ? rect.width : rect.height;
        const deltaPx = clientPos - drag.startPos;
        const deltaPct = pxDeltaToPct(deltaPx, groupPx);
        const updated = resizePanels(
          drag.startSizes,
          drag.handleIndex,
          deltaPct,
          constraintsOf(),
        );
        setSizes(updated);
      }

      function onPointerMove(e: PointerEvent) {
        if (!dragState.current) return;
        e.preventDefault();
        onMove(direction === "horizontal" ? e.clientX : e.clientY);
      }
      function onPointerUp() {
        if (!dragState.current) return;
        dragState.current = null;
        // Settle: snap collapsible panels shut / clamp others to their min.
        const cons = constraintsOf();
        setSizes((prev) => applyCollapseSnap(prev, cons, collapseThreshold));
      }

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      return () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };
    }, [direction, collapseThreshold, constraintsOf]);

    const resolveIndex = useCallback((target: number | string): number => {
      if (typeof target === "number") return target;
      return metaRef.current.findIndex((m) => m.id === target);
    }, []);

    useImperativeHandle(
      ref,
      (): PanelGroupHandle => ({
        getLayout: () => sizes.slice(),
        setLayout: (next) => setSizes(normalize(next.slice())),
        collapse: (target) => {
          const i = resolveIndex(target);
          if (i < 0) return;
          const cons = constraintsOf();
          setSizes((prev) => collapsePanel(prev, i, cons));
        },
        expand: (target, size) => {
          const i = resolveIndex(target);
          if (i < 0) return;
          const cons = constraintsOf();
          setSizes((prev) => expandPanel(prev, i, cons, size));
        },
        toggle: (target) => {
          const i = resolveIndex(target);
          if (i < 0) return;
          const cons = constraintsOf();
          setSizes((prev) =>
            isCollapsed(prev[i], cons[i])
              ? expandPanel(prev, i, cons)
              : collapsePanel(prev, i, cons),
          );
        },
        isCollapsed: (target) => {
          const i = resolveIndex(target);
          if (i < 0) return false;
          return isCollapsed(sizes[i] ?? 0, constraintsOf()[i]);
        },
        reset: () =>
          setSizes(
            resetToDefaults(
              metaRef.current.map((m) => m.defaultSize),
              constraintsOf(),
            ),
          ),
      }),
      [sizes, resolveIndex, constraintsOf],
    );

    const ctx = useMemo<PanelGroupContextValue>(
      () => ({
        direction,
        sizes,
        registerPanel,
        updatePanel,
        markRegistered,
        startDrag,
        nudge,
        resetHandle,
        isPanelCollapsed,
      }),
      [
        direction,
        sizes,
        registerPanel,
        updatePanel,
        markRegistered,
        startDrag,
        nudge,
        resetHandle,
        isPanelCollapsed,
      ],
    );

    const groupStyle: CSSProperties = {
      display: "flex",
      flexDirection: direction === "horizontal" ? "row" : "column",
      width: "100%",
      height: "100%",
      ...style,
    };

    return (
      <PanelGroupContext.Provider value={ctx}>
        <div
          ref={containerRef}
          className={className}
          style={groupStyle}
          data-panel-group=""
          data-panel-group-direction={direction}
        >
          {children}
        </div>
      </PanelGroupContext.Provider>
    );
  },
);

/** Count direct Panel children. Exposed for testing the registration flow. */
export function countPanels(children: ReactNode): number {
  let count = 0;
  Children.forEach(children, (child) => {
    if (isValidElement(child)) count += 1;
  });
  return count;
}
