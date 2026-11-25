# Changelog

All notable changes to **Qing Shan Workbench (青山 · 图表与宽表工作台)** are documented here.

---

## [1.0.0] - 2026-11-25

### Added
- **Mermaid Immersive Lightbox**: 60fps GPU pan/zoom (`10%–800%`), pointer-centered wheel & touch pinch-zoom, Fit / Fit-Width / 1:1 controls, interactive Minimap, in-diagram node search & centering, scoped-ID cloning, luminance-aware Dark-to-White preview & export adaptation, computed-style inlined `.svg` export (preserving `fill: none`), and `2×`/`3×` Retina `.png` copy/download with safe `8192px` canvas clamping.
- **Virtualized Wide-Table Workbench**: Threshold-gated Reading View inline filter/freeze/TSV bar, non-intrusive Live Preview read-only trigger, windowed virtualized fullscreen grid (validated up to 10,000 × 15 rows), multi-type auto-detected sorting (numeric/currency/percent/date/semver/zh-CN), global & per-column `!exclude` filtering, column visibility & drag-resize, Row Detail Drawer with per-field copy & clickable `[[wikilinks]]`, and TSV / UTF-8 BOM CSV / Markdown export.
- **Safety, Portability & i18n**: Configurable path exclusions, `qs-off` / `qs-no-workbench` / `.bases-view` / `[data-password-toggle]` / `@media print` guards, Popout window & mobile support (`isDesktopOnly: false`), and bilingual Chinese/English UI.
