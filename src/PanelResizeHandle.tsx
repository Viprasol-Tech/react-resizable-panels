import {
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { usePanelGroup } from "./PanelGroup";

export interface PanelResizeHandleProps {
  /**
   * Zero-based index of the handle within the group, i.e. the index of the
   * panel immediately before it. A handle between panel 0 and panel 1 has
   * `handleIndex={0}`. Required so the group knows which panels to resize.
   */
  handleIndex: number;
  /** Percentage points moved per arrow-key press. Defaults to 5. */
  keyboardStep?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  "aria-label"?: string;
}

/**
 * A draggable divider between two panels. Pointer drags resize the adjacent
 * panels; arrow keys nudge the layout for keyboard accessibility.
 */
export function PanelResizeHandle({
  handleIndex,
  keyboardStep = 5,
  className,
  style,
  children,
  "aria-label": ariaLabel,
}: PanelResizeHandleProps) {
  const { direction, startDrag, sizes } = usePanelGroup();
  const ref = useRef<HTMLDivElement>(null);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    ref.current?.setPointerCapture?.(e.pointerId);
    const clientPos = direction === "horizontal" ? e.clientX : e.clientY;
    startDrag(handleIndex, clientPos);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const horizontal = direction === "horizontal";
    let delta = 0;
    if ((horizontal && e.key === "ArrowLeft") || (!horizontal && e.key === "ArrowUp")) {
      delta = -keyboardStep;
    } else if (
      (horizontal && e.key === "ArrowRight") ||
      (!horizontal && e.key === "ArrowDown")
    ) {
      delta = keyboardStep;
    }
    if (delta === 0) return;
    e.preventDefault();
    // Simulate a drag of `delta` percent via the group's pointer pipeline by
    // seeding a start drag at 0 then dispatching an equivalent move is complex;
    // instead we resize directly through a synthetic single-step pointer model.
    // Reuse the same code path: start a drag and apply one discrete delta.
    startDrag(handleIndex, 0);
    // Dispatch a synthetic pointer move so the group's listener applies it.
    const groupEl = ref.current?.closest("[data-panel-group]") as HTMLElement | null;
    if (!groupEl) return;
    const rect = groupEl.getBoundingClientRect();
    const groupPx = horizontal ? rect.width : rect.height;
    const px = (delta / 100) * groupPx;
    const evt = new PointerEvent("pointermove", {
      clientX: horizontal ? px : 0,
      clientY: horizontal ? 0 : px,
      bubbles: true,
    });
    window.dispatchEvent(evt);
    window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  };

  const handleStyle: CSSProperties = {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: direction === "horizontal" ? "6px" : "auto",
    alignSelf: "stretch",
    cursor: direction === "horizontal" ? "col-resize" : "row-resize",
    touchAction: "none",
    userSelect: "none",
    background: "#d0d0d0",
    ...(direction === "vertical" ? { height: "6px", width: "100%" } : {}),
    ...style,
  };

  const valueNow = sizes[handleIndex];

  return (
    <div
      ref={ref}
      role="separator"
      tabIndex={0}
      aria-label={ariaLabel ?? "Resize panels"}
      aria-orientation={direction === "horizontal" ? "vertical" : "horizontal"}
      aria-valuenow={valueNow === undefined ? undefined : Math.round(valueNow)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={className}
      style={handleStyle}
      data-panel-resize-handle=""
      data-handle-index={handleIndex}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}
