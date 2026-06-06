import {
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
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
  /** Disable dragging and keyboard resizing for this handle. */
  disabled?: boolean;
  /**
   * Double-clicking the handle resets its two adjacent panels to their default
   * split. Set to `false` to opt out. Defaults to `true`.
   */
  resetOnDoubleClick?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  "aria-label"?: string;
}

/**
 * A draggable divider between two panels. Pointer drags resize the adjacent
 * panels; arrow keys nudge the layout for keyboard accessibility; Home/End jump
 * the divider fully one way; double-click resets to the default split.
 */
export function PanelResizeHandle({
  handleIndex,
  keyboardStep = 5,
  disabled = false,
  resetOnDoubleClick = true,
  className,
  style,
  children,
  "aria-label": ariaLabel,
}: PanelResizeHandleProps) {
  const { direction, startDrag, nudge, resetHandle, sizes } = usePanelGroup();
  const ref = useRef<HTMLDivElement>(null);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    ref.current?.setPointerCapture?.(e.pointerId);
    const clientPos = direction === "horizontal" ? e.clientX : e.clientY;
    startDrag(handleIndex, clientPos);
  };

  const onDoubleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (disabled || !resetOnDoubleClick) return;
    e.preventDefault();
    resetHandle(handleIndex);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const horizontal = direction === "horizontal";
    const decrease = horizontal ? "ArrowLeft" : "ArrowUp";
    const increase = horizontal ? "ArrowRight" : "ArrowDown";

    let delta = 0;
    if (e.key === decrease) delta = -keyboardStep;
    else if (e.key === increase) delta = keyboardStep;
    else if (e.key === "Home") delta = -100;
    else if (e.key === "End") delta = 100;
    else return;

    e.preventDefault();
    nudge(handleIndex, delta);
  };

  const handleStyle: CSSProperties = {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: direction === "horizontal" ? "6px" : "auto",
    alignSelf: "stretch",
    cursor: disabled
      ? "default"
      : direction === "horizontal"
        ? "col-resize"
        : "row-resize",
    touchAction: "none",
    userSelect: "none",
    background: "#d0d0d0",
    opacity: disabled ? 0.5 : 1,
    ...(direction === "vertical" ? { height: "6px", width: "100%" } : {}),
    ...style,
  };

  const valueNow = sizes[handleIndex];

  return (
    <div
      ref={ref}
      role="separator"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel ?? "Resize panels"}
      aria-orientation={direction === "horizontal" ? "vertical" : "horizontal"}
      aria-valuenow={valueNow === undefined ? undefined : Math.round(valueNow)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-disabled={disabled || undefined}
      className={className}
      style={handleStyle}
      data-panel-resize-handle=""
      data-handle-index={handleIndex}
      data-disabled={disabled ? "" : undefined}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}
