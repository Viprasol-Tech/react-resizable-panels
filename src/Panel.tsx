import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { usePanelGroup } from "./PanelGroup";

export interface PanelProps {
  /** Stable id, used for imperative addressing (`ref.collapse("sidebar")`). */
  id?: string;
  /** Initial size in percent. If omitted, space is divided evenly. */
  defaultSize?: number;
  /** Minimum size in percent. Defaults to 0. */
  minSize?: number;
  /** Maximum size in percent. Defaults to 100. */
  maxSize?: number;
  /** Allow the panel to collapse shut when dragged below its `minSize`. */
  collapsible?: boolean;
  /** Size in percent the panel collapses to. Defaults to 0. */
  collapsedSize?: number;
  /** Fired when the panel transitions into the collapsed state. */
  onCollapse?: () => void;
  /** Fired when the panel transitions out of the collapsed state. */
  onExpand?: () => void;
  /** Fired with the panel's new size (percent) whenever the layout changes. */
  onResize?: (size: number) => void;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * A single resizable region inside a {@link PanelGroup}. The panel registers
 * its constraints with the group and renders with a `flexBasis` driven by the
 * group's current layout.
 */
export function Panel({
  id,
  defaultSize,
  minSize,
  maxSize,
  collapsible,
  collapsedSize,
  onCollapse,
  onExpand,
  onResize,
  className,
  style,
  children,
}: PanelProps) {
  const { sizes, registerPanel, updatePanel, markRegistered, isPanelCollapsed } =
    usePanelGroup();
  // Register exactly once per mount; index is stable for the panel's lifetime.
  const indexRef = useRef<number>(-1);
  const meta = {
    id,
    defaultSize,
    min: minSize,
    max: maxSize,
    collapsible,
    collapsedSize,
    onCollapse,
    onExpand,
    onResize,
  };
  if (indexRef.current === -1) {
    indexRef.current = registerPanel(meta);
  } else {
    // Keep the group's snapshot of this panel's props current across renders.
    updatePanel(indexRef.current, meta);
  }

  const index = indexRef.current;

  // Announce this panel to the group after mount (never during render) so the
  // group can establish its initial layout and clean up on unmount.
  useEffect(() => markRegistered(index), [index, markRegistered]);

  const size = sizes[index];
  const collapsed = size !== undefined && isPanelCollapsed(index);

  const panelStyle: CSSProperties = {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: size === undefined ? "0%" : `${size}%`,
    overflow: "hidden",
    ...style,
  };

  return (
    <div
      id={id}
      className={className}
      style={panelStyle}
      data-panel=""
      data-panel-index={index}
      data-panel-id={id}
      data-panel-size={size === undefined ? undefined : size.toFixed(2)}
      data-panel-collapsed={collapsed ? "" : undefined}
    >
      {children}
    </div>
  );
}
