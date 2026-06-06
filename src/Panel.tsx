import { useRef, type CSSProperties, type ReactNode } from "react";
import { usePanelGroup } from "./PanelGroup";

export interface PanelProps {
  /** Initial size in percent. If omitted, space is divided evenly. */
  defaultSize?: number;
  /** Minimum size in percent. Defaults to 0. */
  minSize?: number;
  /** Maximum size in percent. Defaults to 100. */
  maxSize?: number;
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
  defaultSize,
  minSize,
  maxSize,
  className,
  style,
  children,
}: PanelProps) {
  const { sizes, registerPanel } = usePanelGroup();
  // Register exactly once per mount; index is stable for the panel's lifetime.
  const indexRef = useRef<number>(-1);
  if (indexRef.current === -1) {
    indexRef.current = registerPanel({
      defaultSize,
      min: minSize,
      max: maxSize,
    });
  }

  const index = indexRef.current;
  const size = sizes[index];

  const panelStyle: CSSProperties = {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: size === undefined ? "0%" : `${size}%`,
    overflow: "hidden",
    ...style,
  };

  return (
    <div
      className={className}
      style={panelStyle}
      data-panel=""
      data-panel-index={index}
      data-panel-size={size === undefined ? undefined : size.toFixed(2)}
    >
      {children}
    </div>
  );
}
