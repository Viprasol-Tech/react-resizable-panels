<div align="center">

<img src="docs/assets/logo.png" alt="Viprasol Tech" width="120" />

# react-resizable-panels

**Resizable split panels for React with drag handles and persisted sizes.**

_Built and maintained by Viprasol Tech_

[![CI](https://github.com/Viprasol-Tech/react-resizable-panels/actions/workflows/ci.yml/badge.svg)](https://github.com/Viprasol-Tech/react-resizable-panels/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/Viprasol-Tech/react-resizable-panels/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/v/react-resizable-panels.svg)](https://www.npmjs.com/package/react-resizable-panels)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)

</div>

---

## Features

- **Real resize math** — dragging a handle redistributes percentage sizes between adjacent panels, normalized to sum exactly 100%.
- **Min / max constraints** — per-panel `minSize` / `maxSize`; when a neighbor hits its limit the leftover delta cascades to the next panel.
- **Horizontal & vertical** — one `direction` prop flips the whole layout axis.
- **Persisted layout** — set `autoSaveId` and the size array is saved to `localStorage` and restored on reload.
- **Keyboard accessible** — handles are `role="separator"` and respond to arrow keys.
- **Tiny & dependency-free** — pure React + a small pure-math core. Strict TypeScript, zero runtime deps.

## Install

```bash
npm i react-resizable-panels
```

`react` and `react-dom` (>=18) are peer dependencies.

## Usage

```tsx
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";

export function Editor() {
  return (
    <div style={{ height: 400 }}>
      <PanelGroup direction="horizontal" autoSaveId="editor-layout">
        <Panel defaultSize={25} minSize={15}>
          <Sidebar />
        </Panel>

        <PanelResizeHandle handleIndex={0} />

        <Panel defaultSize={50} minSize={20}>
          <CodeView />
        </Panel>

        <PanelResizeHandle handleIndex={1} />

        <Panel defaultSize={25} minSize={15}>
          <Preview />
        </Panel>
      </PanelGroup>
    </div>
  );
}
```

The pure resize core is also exported if you want to drive layout yourself:

```ts
import { resizePanels } from "react-resizable-panels";

// Move handle 0 (between panel 0 and 1) by +10%, panel 1 floored at 30%.
resizePanels([50, 50], 0, 10, [{}, { min: 30 }]); // => [60, 40]
```

## API

### `<PanelGroup>`

| Prop         | Type                          | Default        | Description                                                |
| ------------ | ----------------------------- | -------------- | ---------------------------------------------------------- |
| `direction`  | `"horizontal" \| "vertical"`  | `"horizontal"` | Layout axis.                                               |
| `autoSaveId` | `string`                      | —              | `localStorage` key used to persist and restore the layout. |
| `onLayout`   | `(sizes: number[]) => void`   | —              | Called with the new size array (summing to 100) on change. |
| `className`  | `string`                      | —              | Class applied to the group container.                      |
| `style`      | `CSSProperties`               | —              | Inline style merged onto the flex container.               |

### `<Panel>`

| Prop          | Type            | Default | Description                          |
| ------------- | --------------- | ------- | ------------------------------------ |
| `defaultSize` | `number`        | even    | Initial size in percent.             |
| `minSize`     | `number`        | `0`     | Minimum size in percent.             |
| `maxSize`     | `number`        | `100`   | Maximum size in percent.             |
| `className`   | `string`        | —       | Class applied to the panel element.  |
| `style`       | `CSSProperties` | —       | Inline style merged onto the panel.  |

### `<PanelResizeHandle>`

| Prop           | Type     | Default | Description                                                       |
| -------------- | -------- | ------- | ---------------------------------------------------------------- |
| `handleIndex`  | `number` | —       | Index of the panel immediately before the handle (required).     |
| `keyboardStep` | `number` | `5`     | Percentage points moved per arrow-key press.                     |
| `className`    | `string` | —       | Class applied to the handle element.                             |
| `style`        | `CSSProperties` | — | Inline style merged onto the handle.                            |

### Pure helpers

| Function                                            | Description                                                       |
| --------------------------------------------------- | --------------------------------------------------------------- |
| `resizePanels(sizes, index, deltaPct, constraints)` | Move a handle by `deltaPct`, honoring constraints, summing to 100. |
| `normalize(sizes)`                                  | Scale any size array so it sums to exactly 100.                  |
| `distributeEvenly(count, constraints)`              | Build an even default layout for `count` panels.                |
| `pxDeltaToPct(deltaPx, groupSizePx)`                | Convert a pixel drag delta into a percentage delta.             |

## Note

Sizes are always expressed as percentages of the group that sum to 100, which keeps layouts responsive to container resizes without any pixel bookkeeping. The drag math lives in a tiny pure module (`resizePanels`) so it can be unit-tested with hand-computed values and reused outside React.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md). Open an issue to discuss substantial changes before sending a PR.

## Contact — Viprasol Tech Private Limited

- Website: [viprasol.com](https://viprasol.com)
- Email: [support@viprasol.com](mailto:support@viprasol.com)
- Telegram: [t.me/viprasol_help](https://t.me/viprasol_help) | WhatsApp: +91 96336 52112
- GitHub: [@Viprasol-Tech](https://github.com/Viprasol-Tech) | [LinkedIn](https://www.linkedin.com/in/viprasol/) | X [@viprasol](https://twitter.com/viprasol)

## License

[MIT](LICENSE) (c) 2025 Viprasol Tech Private Limited
