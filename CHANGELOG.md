# Changelog

All notable changes to **Qing Shan Workbench (青山 · 图表与宽表工作台)** are documented here.

---

## [1.0.2] - 2026-11-25

### Fixed
- **Mermaid Lightbox & Export Reliability**:
  - Fixed `⌘F` node search centering on Mermaid v10/v11 diagrams where nodes are positioned via `transform="translate(x, y)"` by mapping `getBBox()` centers through SVG root-relative CTM transforms (`svgCtm.inverse().multiply(nodeCtm)`).
  - Fixed node search dimming on nodes with inline `style="opacity: 1"` or `#mermaid-xxx` ID-scoped rules by dynamically saving, overriding, and restoring inline opacity without CSS `!important`; prevented outer layout containers (`g#root`, `g.nodes`) and ancestor `g.cluster` subgraphs from dimming matched descendant nodes.
  - Fixed Dark-to-White backdrop detection (`hasDarkShapeBackdrop`) so bare canvas labels inside outer `<g id="root">` groups are never misclassified as sitting on sibling dark node rectangles, and prevented search-dimmed opacity from leaking into disconnected fallback exports.
  - Added `blur` and `pointercancel` cleanup for Mermaid pan/pinch and Minimap drag interactions.
- **Wide-Table Workbench, Inline Freeze & Cross-Platform Parsing**:
  - Isolated bare HTML and callout tables inside a dedicated `.qs-wb-table-wrap` wrapper (cleanly unwrapped on unload) so inline toolbar and Freeze mode never mutate sibling paragraphs or parent callout blocks.
  - Added `@media print` and `body.print` overrides to unclip frozen inline tables (`max-height: none; overflow: visible; position: static`) during Obsidian PDF export.
  - Fixed mixed unit sorting (`ms` vs `s` latency and case-insensitive `B`/`KB`/`MB`/`GB`/`TB` byte sizes) and replaced `Date.parse()` with explicit `Date.UTC()` calendar validation so single-digit and Chinese dates work reliably on iOS/iPadOS WebKit and reject invalid dates (e.g., `2026-02-30`).
  - Measured sticky table header height dynamically (`--qs-wb-head-h`) to prevent column filter row overlap and added `pointercancel`/`blur` cleanup for column drag-resize.
- **Live Preview & Command Picker**:
  - Fixed selective disabling of Mermaid-only or Table-only settings in Live Preview so already-mounted triggers of the disabled kind are immediately removed.
  - Scoped the Quick Picker command to the currently active Reading/Live Preview pane and visible elements only, and guaranteed only one active lightbox/table modal per window document.

## [1.0.1] - 2026-11-25

### Fixed
- **Obsidian Community Directory Automated Compliance**:
  - Replaced all static inline style assignments in Mermaid export, minimap, and lightbox modal with scoped CSS classes and dynamic `setCssProps` helpers (`obsidianmd/no-static-styles-assignment`).
  - Aligned `minAppVersion` to `1.8.7` matching `getLanguage()` API availability (`obsidianmd/no-unsupported-api`) and removed `globalThis` / `localStorage` fallback from `src/i18n.ts`.
  - Wrapped async DOM click listeners cleanly to satisfy `obsidianmd/no-misused-promises`, replaced redundant `document` / `setTimeout` fallbacks with `ownerDocument` / `win.setTimeout`, and removed deprecated `SliderComponent.setDynamicTooltip()` calls.
  - Eliminated all CSS `!important` declarations in favor of clean scoped specificity (`declaration-no-important`).
  - Added official `obsidianmd/obsidian-workflows@v1` scanner validation to CI.

## [1.0.0] - 2026-11-25

### Added
- **Mermaid Immersive Lightbox**: 60fps GPU pan/zoom (`10%–800%`), pointer-centered wheel & touch pinch-zoom, Fit / Fit-Width / 1:1 controls, interactive Minimap, in-diagram node search & centering, scoped-ID cloning, luminance-aware Dark-to-White preview & export adaptation, computed-style inlined `.svg` export (preserving `fill: none`), and `2×`/`3×` Retina `.png` copy/download with safe `8192px` canvas clamping.
- **Virtualized Wide-Table Workbench**: Threshold-gated Reading View inline filter/freeze/TSV bar, non-intrusive Live Preview read-only trigger, windowed virtualized fullscreen grid (validated up to 10,000 × 15 rows), multi-type auto-detected sorting (numeric/currency/percent/date/semver/zh-CN), global & per-column `!exclude` filtering, column visibility & drag-resize, Row Detail Drawer with per-field copy & clickable `[[wikilinks]]`, and TSV / UTF-8 BOM CSV / Markdown export.
- **Safety, Portability & i18n**: Configurable path exclusions, `qs-off` / `qs-no-workbench` / `.bases-view` / `[data-password-toggle]` / `@media print` guards, Popout window & mobile support (`isDesktopOnly: false`), and bilingual Chinese/English UI.
