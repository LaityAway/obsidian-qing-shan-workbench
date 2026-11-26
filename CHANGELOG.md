# Changelog

All notable changes to **Qing Shan Workbench (青山 · 图表与宽表工作台)** are documented here.

---

## [1.1.0] - 2026-11-26

### Added
- **Wide-Table Analytics & Multi-Sort**:
  - Upgraded per-column filter expressions to support numeric/date/semver comparisons (`>1000`, `<=500ms`, `>=2026-03-01`, `>=v1.0.0`), inclusive ranges (`50ms..1.5s`, `2026-01-01..2026-06-30`), multi-branch OR (`Billing|Analytics`), and negated OR (`!Alert|Pending`).
  - Added `Shift + Click` multi-column sorting with priority indicators (`1▲`, `2▼`).
  - Added a collapsible **Numeric Summary Bar** above the table footer showing live `Sum / Avg / Min / Max` statistics for filtered numeric and percentage columns (click any chip to copy).
  - Added XSS-safe `<mark>` search highlighting inside visible table cells and double-click-to-copy on individual cells.
  - Added bounded in-memory session state persistence (per note path + table header signature) so reopening a table restores column visibility, column widths, freeze state, drawer toggle, and summary bar preference without writing to `data.json`.
- **Mermaid UX & Export Enhancements**:
  - Upgraded wheel zoom to continuous exponential scaling for smooth macOS trackpad pinch and responsive mouse wheel zooming.
  - Added double-click on the Mermaid stage to toggle smoothly between Fit-to-View and 1:1 centered at the click point.
  - Synced the Minimap background and adapted SVG clone automatically when switching canvas backgrounds (`Theme` / `White` / `Transparent`).
  - Added an actionable one-click **Export SVG** fallback button inside the Notice if PNG canvas rasterization is ever restricted.

### Improved
- **Table Engine & Drag-Resize Performance**:
  - Precomputed row search text and introduced a WeakMap-cached Schwartzian Transform sort key index to eliminate repeated $O(N \log N)$ parsing on large tables.
  - Added leading-edge + trailing coalesced filtering and Chinese IME (`compositionstart`/`compositionend`) guards for jank-free typing on 10,000-row tables.
  - Replaced full `tbody` teardown during column drag-resizing with `requestAnimationFrame`-scheduled `<colgroup><col>` + live column width updates (zero DOM row rebuilds).
  - Added responsive narrow-screen/mobile overlay drawer (`<= 760px`, closed by default, slides over cleanly on row click) and `ResizeObserver` height tracking + row text caching for inline frozen tables.
- **Export Hardening**:
  - Neutralized spreadsheet formula injection (`=`, `@`, `+cmd`, `-cmd`) in CSV/TSV exports while leaving numeric negatives/positives (`-120`, `+5.2%`) and phone numbers untouched.
  - Used `Blob` + `URL.createObjectURL` for pure-SVG PNG decoding (lower peak memory on large diagrams) while retaining untainted data-URI rendering for `<foreignObject>` Mermaid diagrams.

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
