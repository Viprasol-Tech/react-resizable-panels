# Changelog

Format based on [Keep a Changelog](https://keepachangelog.com/); versioning
follows [SemVer](https://semver.org/).

## [0.2.0] - 2025

### Added
- **Collapsible panels** — `collapsible` and `collapsedSize` props on `<Panel>`.
  Dragging a collapsible panel more than `collapseThreshold` below its `minSize`
  now snaps it shut; non-collapsible panels clamp back to their minimum.
- **Imperative API** — `<PanelGroup>` now forwards a `ref` exposing
  `getLayout`, `setLayout`, `collapse`, `expand`, `toggle`, `isCollapsed`, and
  `reset`. Panels can be addressed by numeric index or by their `id`.
- **Double-click to reset** — double-clicking a `<PanelResizeHandle>` restores
  its two adjacent panels to their default split. Opt out via
  `resetOnDoubleClick={false}`.
- **Richer keyboard resizing** — arrow keys nudge by `keyboardStep`; `Home` and
  `End` jump the divider fully one way (clamped by constraints).
- **Lifecycle callbacks** — `onCollapse`, `onExpand`, and `onResize` per panel.
- **Disabled handles** — `disabled` prop on `<PanelResizeHandle>` (also sets
  `aria-disabled` and removes it from the tab order).
- **Nested groups** — a `<PanelGroup>` can be rendered inside any `<Panel>`;
  each group keeps an isolated registry and layout.
- New pure helpers exported: `collapsePanel`, `expandPanel`, `resetToDefaults`,
  `applyCollapseSnap`, `isCollapsed`, `collapsedSizeOf`.

### Changed
- Panel registration is now slot-based, so layout, constraints, and the
  imperative API stay correct even when React bails out of re-rendering
  unchanged children.
- Resize handles emit `aria-disabled` and `data-panel-collapsed` is exposed on
  collapsed panels for styling.

### Fixed
- Constraints (min/max) are now consistently applied to keyboard and
  programmatic resizes, not just pointer drags.

## [0.1.0] - 2025

### Added
- Initial release of react-resizable-panels: Resizable split panels for React with drag handles and persisted sizes.
