import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  distributeEvenly,
  normalize,
  pxDeltaToPct,
  resizePanels,
  type PanelConstraint,
} from "./resize";

export type Direction = "horizontal" | "vertical";

interface PanelMeta extends PanelConstraint {
  defaultSize?: number;
}

interface PanelGroupContextValue {
  direction: Direction;
  sizes: number[];
  registerPanel: (meta: PanelMeta) => number;
  startDrag: (handleIndex: number, clientPos: number) => void;
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
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

function readPersisted(key: string | undefined): number[] | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`react-resizable-panels:${key}`);
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
    window.localStorage.setItem(
      `react-resizable-panels:${key}`,
      JSON.stringify(sizes),
    );
  } catch {
    /* storage may be unavailable (private mode); ignore */
  }
}

export function PanelGroup({
  direction = "horizontal",
  autoSaveId,
  onLayout,
  className,
  style,
  children,
}: PanelGroupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const metaRef = useRef<PanelMeta[]>([]);
  const [sizes, setSizes] = useState<number[]>(() => readPersisted(autoSaveId) ?? []);

  // Reset the registration list on every render; panels re-register in order.
  metaRef.current = [];

  const registerPanel = useCallback((meta: PanelMeta): number => {
    metaRef.current.push(meta);
    return metaRef.current.length - 1;
  }, []);

  // Establish the initial layout once all panels have registered.
  useEffect(() => {
    const metas = metaRef.current;
    if (metas.length === 0) return;
    setSizes((prev) => {
      if (prev.length === metas.length) return prev;
      const constraints: PanelConstraint[] = metas.map((m) => ({
        min: m.min,
        max: m.max,
      }));
      const defaults = metas.map((m) => m.defaultSize);
      const hasDefaults = defaults.some((d) => typeof d === "number");
      if (hasDefaults) {
        const filled = defaults.map((d, i) =>
          typeof d === "number" ? d : 100 / metas.length,
        );
        return normalize(filled);
      }
      return distributeEvenly(metas.length, constraints);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Children.count(children)]);

  useEffect(() => {
    if (sizes.length === 0) return;
    onLayout?.(sizes);
    writePersisted(autoSaveId, sizes);
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

  useEffect(() => {
    function onMove(clientPos: number) {
      const drag = dragState.current;
      const container = containerRef.current;
      if (!drag || !container) return;
      const rect = container.getBoundingClientRect();
      const groupPx = direction === "horizontal" ? rect.width : rect.height;
      const deltaPx = clientPos - drag.startPos;
      const deltaPct = pxDeltaToPct(deltaPx, groupPx);
      const constraints: PanelConstraint[] = metaRef.current.map((m) => ({
        min: m.min,
        max: m.max,
      }));
      const updated = resizePanels(
        drag.startSizes,
        drag.handleIndex,
        deltaPct,
        constraints,
      );
      setSizes(updated);
    }

    function onPointerMove(e: PointerEvent) {
      if (!dragState.current) return;
      e.preventDefault();
      onMove(direction === "horizontal" ? e.clientX : e.clientY);
    }
    function onPointerUp() {
      dragState.current = null;
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [direction]);

  const ctx = useMemo<PanelGroupContextValue>(
    () => ({ direction, sizes, registerPanel, startDrag }),
    [direction, sizes, registerPanel, startDrag],
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
}

/** Count direct Panel children. Exposed for testing the registration flow. */
export function countPanels(children: ReactNode): number {
  let count = 0;
  Children.forEach(children, (child) => {
    if (isValidElement(child)) count += 1;
  });
  return count;
}
