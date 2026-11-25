"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => QingShanWorkbenchPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian9 = require("obsidian");

// src/settings.ts
var import_obsidian2 = require("obsidian");

// src/guard.ts
var BUILTIN_EXCLUDED_PATHS = Object.freeze([]);
var EXEMPT_CSSCLASSES = Object.freeze(["qs-off", "qs-no-workbench"]);
function normalizePathPrefix(raw) {
  return raw.trim().replace(/\\/g, "/").replace(/^\/+/, "");
}
function mergeExcludedPaths(userPaths) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const item of [...BUILTIN_EXCLUDED_PATHS, ...userPaths ?? []]) {
    const cleaned = normalizePathPrefix(String(item || ""));
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
  }
  return out;
}
function isPathExcluded(sourcePath, userPaths) {
  if (!sourcePath) return false;
  const normalized = normalizePathPrefix(sourcePath);
  if (!normalized) return false;
  const prefixes = mergeExcludedPaths(userPaths);
  for (const prefix of prefixes) {
    if (prefix.endsWith("/")) {
      if (normalized.startsWith(prefix) || normalized === prefix.slice(0, -1)) return true;
    } else if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      return true;
    }
  }
  return false;
}
function extractFrontmatterCssClasses(frontmatter) {
  if (!frontmatter || typeof frontmatter !== "object") return [];
  const raw = frontmatter.cssclasses ?? frontmatter.cssclass;
  if (typeof raw === "string") {
    return raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  }
  if (Array.isArray(raw)) {
    return raw.flatMap(
      (item) => typeof item === "string" ? item.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean) : []
    );
  }
  return [];
}
function hasExemptFrontmatterClass(frontmatter, extraExempt = []) {
  const classes = extractFrontmatterCssClasses(frontmatter);
  if (classes.length === 0) return false;
  const exemptSet = /* @__PURE__ */ new Set([...EXEMPT_CSSCLASSES, ...extraExempt]);
  return classes.some((c) => exemptSet.has(c));
}
function hasExemptCssClass(element) {
  if (!element || typeof element.closest !== "function") return false;
  const selector = EXEMPT_CSSCLASSES.map((cls) => `.${cls}`).join(", ");
  return Boolean(element.closest(selector));
}
function isPrintSurface(element) {
  if (!element || typeof element.closest !== "function") return false;
  return Boolean(element.closest(".print"));
}
function isProtectedTableElement(table) {
  if (!table || typeof table.closest !== "function") return true;
  if (isPrintSurface(table) || hasExemptCssClass(table)) return true;
  if (table.closest(".bases-view, .qs-wb-overlay, .qs-wb-modal, .qs-home")) return true;
  if (table.querySelector("[data-password-toggle], .account-secret-toolbar, .account-password-value")) return true;
  return false;
}
function isProtectedMermaidElement(container) {
  if (!container || typeof container.closest !== "function") return true;
  if (isPrintSurface(container) || hasExemptCssClass(container)) return true;
  if (container.closest(".qs-wb-overlay, .qs-wb-modal, .qs-wb-minimap")) return true;
  return false;
}
function shouldEnhanceTableInline(colCount, rowCount, minCols, minRows) {
  if (colCount <= 0 || rowCount <= 0) return false;
  return colCount >= minCols || rowCount >= minRows;
}

// src/i18n.ts
var import_obsidian = require("obsidian");
function isZh() {
  try {
    if (typeof import_obsidian.getLanguage === "function") {
      const lang = (0, import_obsidian.getLanguage)();
      if (lang) return String(lang).toLowerCase().startsWith("zh");
    }
    if (typeof globalThis.localStorage?.getItem === "function") {
      const stored = globalThis.localStorage.getItem("language");
      if (stored) return String(stored).toLowerCase().startsWith("zh");
      const docLang2 = globalThis.document?.documentElement?.lang;
      if (docLang2) return String(docLang2).toLowerCase().startsWith("zh");
      return false;
    }
    const docLang = globalThis.document?.documentElement?.lang;
    if (docLang) return String(docLang).toLowerCase().startsWith("zh");
    return false;
  } catch {
    return false;
  }
}
function t(zh, en) {
  return isZh() ? zh : en;
}

// src/settings.ts
var DEFAULT_SETTINGS = Object.freeze({
  enableMermaidWorkbench: true,
  enableTableWorkbench: true,
  enableLivePreviewTriggers: true,
  wheelZoomMode: "direct",
  defaultExportBg: "theme",
  pngScale: 2,
  showMinimap: true,
  doubleClickToOpen: true,
  inlineMinColumns: 5,
  inlineMinRows: 12,
  inlineMaxHeight: 560,
  defaultFreezeFirstCol: true,
  virtualScrollThreshold: 100,
  excludedPaths: [...BUILTIN_EXCLUDED_PATHS]
});
var WHEEL_MODES = ["direct", "ctrl"];
var BG_MODES = ["theme", "white", "transparent"];
function clampInt(raw, fallback, min, max) {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback;
  return Math.round(Math.min(max, Math.max(min, raw)));
}
function normalizeSettings(raw) {
  const data = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const bool = (key) => typeof data[key] === "boolean" ? data[key] : DEFAULT_SETTINGS[key];
  const rawExcluded = Array.isArray(data.excludedPaths) ? data.excludedPaths.map((v) => normalizePathPrefix(String(v || ""))).filter(Boolean) : [];
  const mergedExcluded = Array.from(/* @__PURE__ */ new Set([...BUILTIN_EXCLUDED_PATHS, ...rawExcluded]));
  const wheelZoomMode = WHEEL_MODES.includes(data.wheelZoomMode) ? data.wheelZoomMode : DEFAULT_SETTINGS.wheelZoomMode;
  const defaultExportBg = BG_MODES.includes(data.defaultExportBg) ? data.defaultExportBg : DEFAULT_SETTINGS.defaultExportBg;
  const pngScale = data.pngScale === 3 ? 3 : 2;
  return {
    enableMermaidWorkbench: bool("enableMermaidWorkbench"),
    enableTableWorkbench: bool("enableTableWorkbench"),
    enableLivePreviewTriggers: bool("enableLivePreviewTriggers"),
    wheelZoomMode,
    defaultExportBg,
    pngScale,
    showMinimap: bool("showMinimap"),
    doubleClickToOpen: bool("doubleClickToOpen"),
    inlineMinColumns: clampInt(data.inlineMinColumns, DEFAULT_SETTINGS.inlineMinColumns, 1, 30),
    inlineMinRows: clampInt(data.inlineMinRows, DEFAULT_SETTINGS.inlineMinRows, 1, 200),
    inlineMaxHeight: clampInt(data.inlineMaxHeight, DEFAULT_SETTINGS.inlineMaxHeight, 260, 1200),
    defaultFreezeFirstCol: bool("defaultFreezeFirstCol"),
    virtualScrollThreshold: clampInt(data.virtualScrollThreshold, DEFAULT_SETTINGS.virtualScrollThreshold, 30, 500),
    excludedPaths: mergedExcluded
  };
}
var WorkbenchSettingsTab = class extends import_obsidian2.PluginSettingTab {
  host;
  constructor(app, plugin) {
    super(app, plugin);
    this.host = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("p", {
      cls: "qs-wb-settings-desc",
      text: t(
        "\u9752\u5C71 \xB7 \u56FE\u8868\u4E0E\u5BBD\u8868\u5DE5\u4F5C\u53F0\uFF1A\u4E0D\u4FEE\u6539\u4EFB\u4F55\u7B14\u8BB0\u539F\u6587\uFF0C\u4E3A\u590D\u6742 Mermaid \u56FE\u63D0\u4F9B GPU \u7F29\u653E/\u5C0F\u5730\u56FE/\u8282\u70B9\u641C\u7D22/\u9AD8\u4FDD\u771F\u5BFC\u56FE\uFF0C\u4E3A\u8D85\u5BBD\u8D85\u957F\u8868\u683C\u63D0\u4F9B\u9875\u5185\u51BB\u7ED3\u4E0E\u5343\u884C\u7EA7\u865A\u62DF\u6EDA\u52A8\u5DE5\u4F5C\u53F0\u3002",
        "Qing Shan Workbench: Zero-mutation interactive Mermaid lightbox (GPU zoom, minimap, node search, styled SVG/PNG export) and virtualized wide-table workbench."
      )
    });
    const heading = (title) => {
      const s = new import_obsidian2.Setting(containerEl).setName(title);
      if (typeof s.setHeading === "function") s.setHeading();
    };
    heading(t("\u6838\u5FC3\u5F00\u5173", "Core toggles"));
    new import_obsidian2.Setting(containerEl).setName(t("\u542F\u7528 Mermaid \u6C89\u6D78\u5F0F\u706F\u7BB1", "Enable Mermaid lightbox")).setDesc(t("\u4E3A\u9605\u8BFB\u89C6\u56FE\u548C\u5B9E\u65F6\u9884\u89C8\u4E2D\u7684 Mermaid \u56FE\u8868\u6DFB\u52A0\u7F29\u653E\u3001\u5C0F\u5730\u56FE\u3001\u8282\u70B9\u641C\u7D22\u4E0E\u9AD8\u6E05\u5BFC\u51FA\u3002", "Add zoom, minimap, node search, and styled SVG/PNG export to Mermaid diagrams.")).addToggle((ctrl) => ctrl.setValue(this.host.settings.enableMermaidWorkbench).onChange((v) => this.host.updateSettings({ enableMermaidWorkbench: v })));
    new import_obsidian2.Setting(containerEl).setName(t("\u542F\u7528\u5BBD\u8868\u9875\u5185\u589E\u5F3A\u4E0E\u5168\u5C4F\u5DE5\u4F5C\u53F0", "Enable wide-table workbench")).setDesc(t("\u5728\u9605\u8BFB\u89C6\u56FE\u6309\u9608\u503C\u6302\u8F7D\u51BB\u7ED3\u4E0E\u7B5B\u67E5\u5165\u53E3\uFF0C\u5E76\u652F\u6301\u5343\u884C\u7EA7\u5168\u5C4F\u865A\u62DF\u6EDA\u52A8\u5DE5\u4F5C\u53F0\u4E0E\u5BFC\u51FA\u3002", "Enhance wide/tall tables in Reading view and provide a virtualized fullscreen table workbench.")).addToggle((ctrl) => ctrl.setValue(this.host.settings.enableTableWorkbench).onChange((v) => this.host.updateSettings({ enableTableWorkbench: v })));
    new import_obsidian2.Setting(containerEl).setName(t("\u5728\u5B9E\u65F6\u9884\u89C8\u663E\u793A\u53EA\u8BFB\u5DE5\u4F5C\u53F0\u5165\u53E3", "Show read-only triggers in Live Preview")).setDesc(t("\u5728 Live Preview \u7684 Mermaid \u4E0E\u8868\u683C\u53F3\u4E0A\u89D2\u907F\u8BA9\u4F4D\u7F6E\u6302\u8F7D\u53EA\u8BFB\u5165\u53E3\uFF0C\u7EDD\u4E0D\u5E72\u6D89\u8868\u683C\u7F16\u8F91\u3002", "Attach non-intrusive read-only triggers on Mermaid blocks and tables in Live Preview.")).addToggle((ctrl) => ctrl.setValue(this.host.settings.enableLivePreviewTriggers).onChange((v) => this.host.updateSettings({ enableLivePreviewTriggers: v })));
    heading(t("Mermaid \u706F\u7BB1\u8BBE\u7F6E", "Mermaid lightbox"));
    new import_obsidian2.Setting(containerEl).setName(t("\u6EDA\u8F6E\u7F29\u653E\u65B9\u5F0F", "Wheel zoom behavior")).setDesc(t("\u76F4\u63A5\u6EDA\u8F6E\u7F29\u653E\u4F53\u9A8C\u6700\u6D41\u7545\uFF1B\u82E5\u5E38\u5728\u706F\u7BB1\u5185\u6EDA\u5C4F\u53EF\u6539\u4E3A\u6309\u4F4F Ctrl/Cmd + \u6EDA\u8F6E\u3002", "Zoom directly with mouse wheel or require Ctrl/Cmd modifier.")).addDropdown((ctrl) => ctrl.addOption("direct", t("\u76F4\u63A5\u6EDA\u8F6E\u7F29\u653E\uFF08\u63A8\u8350\uFF09", "Direct wheel zoom (Recommended)")).addOption("ctrl", t("\u6309\u4F4F Ctrl / Cmd + \u6EDA\u8F6E", "Hold Ctrl / Cmd + wheel")).setValue(this.host.settings.wheelZoomMode).onChange((v) => this.host.updateSettings({ wheelZoomMode: v })));
    new import_obsidian2.Setting(containerEl).setName(t("\u9ED8\u8BA4\u5BFC\u51FA\u753B\u5E03\u5E95\u8272", "Default export background")).setDesc(t("\u5BFC\u51FA PNG/SVG \u65F6\u7684\u9ED8\u8BA4\u80CC\u666F\u6A21\u5F0F\uFF0C\u706F\u7BB1\u5185\u968F\u65F6\u53EF\u4E00\u952E\u5207\u6362\u3002", "Default canvas background for exported PNG/SVG (toggleable inside lightbox).")).addDropdown((ctrl) => ctrl.addOption("theme", t("\u8DDF\u968F\u5F53\u524D\u4E3B\u9898\u5E95\u8272", "Follow active theme")).addOption("white", t("\u7EAF\u767D\u7EB8\u5E95\uFF08\u6C47\u62A5\u6587\u6863\u63A8\u8350\uFF09", "Pure white paper")).addOption("transparent", t("\u900F\u660E\u5E95", "Transparent")).setValue(this.host.settings.defaultExportBg).onChange((v) => this.host.updateSettings({ defaultExportBg: v })));
    new import_obsidian2.Setting(containerEl).setName(t("PNG \u5BFC\u51FA\u6E05\u6670\u5EA6", "PNG export resolution")).setDesc(t("2\xD7 \u9002\u5408\u65E5\u5E38\u5206\u4EAB\u4E0E\u6587\u6863\uFF0C3\xD7 \u9002\u5408\u9AD8\u5206\u5927\u5C4F PPT \u6C47\u62A5\u3002", "2x for general sharing, 3x for crisp HiDPI slides.")).addDropdown((ctrl) => ctrl.addOption("2", "2\xD7 Retina").addOption("3", "3\xD7 Ultra HD").setValue(String(this.host.settings.pngScale)).onChange((v) => this.host.updateSettings({ pngScale: v === "3" ? 3 : 2 })));
    new import_obsidian2.Setting(containerEl).setName(t("\u663E\u793A\u7F29\u7565\u5C0F\u5730\u56FE\uFF08Minimap\uFF09", "Show minimap")).setDesc(t("\u5728\u706F\u7BB1\u53F3\u4E0B\u89D2\u663E\u793A\u5B9E\u65F6\u7F29\u7565\u56FE\u4E0E\u89C6\u53E3\u5B9A\u4F4D\u6846\uFF0C\u9002\u5408\u5927\u578B ER \u56FE\u548C\u6D41\u7A0B\u56FE\u6F2B\u6E38\u3002", "Display a draggable viewport minimap in the bottom-right corner.")).addToggle((ctrl) => ctrl.setValue(this.host.settings.showMinimap).onChange((v) => this.host.updateSettings({ showMinimap: v })));
    new import_obsidian2.Setting(containerEl).setName(t("\u53CC\u51FB\u56FE\u8868\u76F4\u63A5\u6253\u5F00\u706F\u7BB1", "Double-click diagram to open lightbox")).setDesc(t("\u5728\u9605\u8BFB\u89C6\u56FE\u53CC\u51FB Mermaid SVG \u5373\u53EF\u5FEB\u901F\u8FDB\u5165\u6C89\u6D78\u706F\u7BB1\u3002", "Double-click a rendered Mermaid SVG in Reading view to launch the lightbox.")).addToggle((ctrl) => ctrl.setValue(this.host.settings.doubleClickToOpen).onChange((v) => this.host.updateSettings({ doubleClickToOpen: v })));
    heading(t("\u5BBD\u8868\u5DE5\u4F5C\u53F0\u8BBE\u7F6E", "Wide-table workbench"));
    new import_obsidian2.Setting(containerEl).setName(t("\u9875\u5185\u589E\u5F3A\u6700\u5C0F\u5217\u6570\u9608\u503C", "Inline enhancement min columns")).setDesc(t("\u9605\u8BFB\u89C6\u56FE\u8868\u683C\u5217\u6570\u8FBE\u5230\u8BE5\u503C\uFF08\u6216\u884C\u6570\u8FBE\u6807\uFF09\u65F6\u81EA\u52A8\u6302\u8F7D\u9875\u5185\u589E\u5F3A\uFF0C\u5C0F\u8868\u4FDD\u6301\u7EAF\u51C0\u3002", "Enhance tables in Reading view when columns meet this threshold.")).addSlider((ctrl) => ctrl.setLimits(1, 15, 1).setValue(this.host.settings.inlineMinColumns).setDynamicTooltip().onChange((v) => this.host.updateSettings({ inlineMinColumns: v })));
    new import_obsidian2.Setting(containerEl).setName(t("\u9875\u5185\u589E\u5F3A\u6700\u5C0F\u884C\u6570\u9608\u503C", "Inline enhancement min rows")).setDesc(t("\u9605\u8BFB\u89C6\u56FE\u8868\u683C\u6570\u636E\u884C\u6570\u8FBE\u5230\u8BE5\u503C\u65F6\u81EA\u52A8\u6302\u8F7D\u9875\u5185\u51BB\u7ED3\u4E0E\u7B5B\u9009\u5165\u53E3\u3002", "Enhance tables in Reading view when body rows meet this threshold.")).addSlider((ctrl) => ctrl.setLimits(1, 50, 1).setValue(this.host.settings.inlineMinRows).setDynamicTooltip().onChange((v) => this.host.updateSettings({ inlineMinRows: v })));
    new import_obsidian2.Setting(containerEl).setName(t("\u9875\u5185\u51BB\u7ED3\u5BB9\u5668\u6700\u5927\u9AD8\u5EA6 (px)", "Inline sticky table max height (px)")).setDesc(t("\u5728\u9605\u8BFB\u89C6\u56FE\u5F00\u542F\u51BB\u7ED3\u8868\u5934\u65F6\uFF0C\u8868\u683C\u6EDA\u52A8\u533A\u57DF\u7684\u6700\u5927\u9AD8\u5EA6\u3002", "Maximum scroll height when sticky header is toggled inline.")).addSlider((ctrl) => ctrl.setLimits(260, 1e3, 20).setValue(this.host.settings.inlineMaxHeight).setDynamicTooltip().onChange((v) => this.host.updateSettings({ inlineMaxHeight: v })));
    new import_obsidian2.Setting(containerEl).setName(t("\u5DE5\u4F5C\u53F0\u9ED8\u8BA4\u51BB\u7ED3\u9996\u5217", "Freeze first column by default")).setDesc(t("\u6253\u5F00\u5BBD\u8868\u5168\u5C4F\u5DE5\u4F5C\u53F0\u65F6\u9ED8\u8BA4\u56FA\u5B9A\u7B2C\u4E00\u5217\uFF0C\u4FBF\u4E8E\u6A2A\u5411\u6838\u5BF9\u591A\u5217\u5B57\u6BB5\u3002", "Keep the first column sticky when opening the fullscreen table workbench.")).addToggle((ctrl) => ctrl.setValue(this.host.settings.defaultFreezeFirstCol).onChange((v) => this.host.updateSettings({ defaultFreezeFirstCol: v })));
    heading(t("\u5B89\u5168\u9694\u79BB\u4E0E\u8C41\u514D", "Safety & exclusions"));
    new import_obsidian2.Setting(containerEl).setName(t("\u6392\u9664\u76EE\u5F55\uFF08\u6BCF\u884C\u4E00\u4E2A\u8DEF\u5F84\u524D\u7F00\uFF09", "Excluded folders (one path prefix per line)")).setDesc(t("\u547D\u4E2D\u524D\u7F00\u7684\u7B14\u8BB0\u4E0E\u5D4C\u5165\u5757\u5C06\u5B8C\u5168\u8DF3\u8FC7\u5DE5\u4F5C\u53F0\u589E\u5F3A\uFF08\u5982 Secrets/\u3001Credentials/ \u7B49\u654F\u611F\u76EE\u5F55\uFF09\u3002", "Notes and embeds under these path prefixes are completely skipped (e.g. Secrets/, Credentials/).")).addTextArea((ctrl) => {
      ctrl.inputEl.rows = 3;
      ctrl.setPlaceholder(t("Secrets/\nCredentials/", "Secrets/\nCredentials/"));
      ctrl.setValue(this.host.settings.excludedPaths.join("\n")).onChange(async (val) => {
        const list = val.split("\n").map((s) => normalizePathPrefix(s)).filter(Boolean);
        await this.host.updateSettings({ excludedPaths: list });
      });
    });
    new import_obsidian2.Setting(containerEl).setName(t("\u6062\u590D\u9ED8\u8BA4\u8BBE\u7F6E", "Reset defaults")).setDesc(t("\u5C06\u5168\u90E8\u5DE5\u4F5C\u53F0\u914D\u7F6E\u6062\u590D\u4E3A\u63A8\u8350\u9ED8\u8BA4\u503C\u3002", "Restore all workbench settings to recommended defaults.")).addButton((btn) => btn.setButtonText(t("\u6062\u590D\u9ED8\u8BA4", "Reset")).onClick(async () => {
      await this.host.resetSettings();
      this.display();
    }));
  }
};

// src/detectors/reading-detector.ts
var import_obsidian5 = require("obsidian");

// src/ui/icons.ts
var import_obsidian3 = require("obsidian");
function attachIcon(el, iconName, fallbackText = "") {
  try {
    if (typeof import_obsidian3.setIcon === "function") {
      (0, import_obsidian3.setIcon)(el, iconName);
      if (el.childNodes.length > 0) return;
    }
  } catch {
  }
  if (fallbackText) el.textContent = fallbackText;
}
function createIconButton(doc, iconName, label, text, cls = "qs-wb-btn") {
  const btn = doc.createElement("button");
  btn.type = "button";
  btn.className = cls;
  btn.setAttribute("aria-label", label);
  btn.title = label;
  const iconWrap = doc.createElement("span");
  iconWrap.className = "qs-wb-icon";
  attachIcon(iconWrap, iconName);
  btn.appendChild(iconWrap);
  if (text) {
    const span = doc.createElement("span");
    span.className = "qs-wb-btn-label";
    span.textContent = text;
    btn.appendChild(span);
  }
  return btn;
}

// src/mermaid/mermaid-export.ts
var MAX_CANVAS_EDGE = 8192;
var INLINE_STYLE_PROPS = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-opacity",
  "opacity",
  "color",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "text-anchor",
  "dominant-baseline",
  "text-align",
  "background-color",
  "border-color",
  "border-width",
  "border-style",
  "border-radius"
];
var PRESERVE_NONE_PROPS = /* @__PURE__ */ new Set(["fill", "stroke"]);
var DARK_INK = "#1e293b";
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function parseRgbColor(cssColor) {
  if (!cssColor) return null;
  const s = cssColor.trim().toLowerCase();
  if (!s || s === "none" || s === "transparent") return null;
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1];
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: 1
    };
  }
  const rgb = s.match(/^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
  if (!rgb) return null;
  let a = 1;
  if (rgb[4] !== void 0) {
    a = rgb[4].endsWith("%") ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4]);
  }
  return {
    r: Math.max(0, Math.min(255, Number(rgb[1]))),
    g: Math.max(0, Math.min(255, Number(rgb[2]))),
    b: Math.max(0, Math.min(255, Number(rgb[3]))),
    a: Number.isFinite(a) ? Math.max(0, Math.min(1, a)) : 1
  };
}
function relativeLuminance(r, g, b) {
  const channel = (v) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function darkenColorForWhiteBg(cssColor, maxLuminance = 0.17) {
  const parsed = parseRgbColor(cssColor);
  if (!parsed || parsed.a < 0.05) return cssColor;
  const lum = relativeLuminance(parsed.r, parsed.g, parsed.b);
  if (lum <= maxLuminance) return cssColor;
  let lo = 0.1;
  let hi = 1;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const testLum = relativeLuminance(parsed.r * mid, parsed.g * mid, parsed.b * mid);
    if (testLum > maxLuminance) hi = mid;
    else lo = mid;
  }
  const r = Math.round(parsed.r * lo);
  const g = Math.round(parsed.g * lo);
  const b = Math.round(parsed.b * lo);
  return parsed.a < 0.999 ? `rgba(${r}, ${g}, ${b}, ${parsed.a})` : `rgb(${r}, ${g}, ${b})`;
}
function isDarkThemeDocument(doc) {
  if (doc.body?.classList?.contains("theme-dark")) return true;
  if (doc.body?.classList?.contains("theme-light")) return false;
  const win = doc.defaultView || window;
  const bg = parseRgbColor(win.getComputedStyle(doc.body).backgroundColor);
  return Boolean(bg && bg.a > 0.5 && relativeLuminance(bg.r, bg.g, bg.b) < 0.3);
}
function isOpaqueDarkColor(cssColor) {
  const parsed = parseRgbColor(cssColor);
  return Boolean(parsed && parsed.a > 0.45 && relativeLuminance(parsed.r, parsed.g, parsed.b) < 0.32);
}
function isLabelMaskElement(el) {
  return Boolean(
    el.matches?.(".edgeLabel, .labelBkg, .relationshipLabelBox") || el.closest?.(".edgeLabel, .labelBkg")
  );
}
function hasDarkShapeBackdrop(el, win) {
  if (isLabelMaskElement(el)) return false;
  let cur = el;
  while (cur && cur.tagName.toLowerCase() !== "svg") {
    if (isLabelMaskElement(cur)) return false;
    const cs = win.getComputedStyle(cur);
    if (isOpaqueDarkColor(cs.backgroundColor)) return true;
    cur = cur.parentElement;
  }
  const group = el.closest("g.node, g.actor, g.classGroup, g.statediagram-state, g.entity, g[id]");
  if (group && !group.matches(".edgeLabel, .edgeLabels, .edgePath, .edgePaths")) {
    const shapes = group.querySelectorAll(":scope > rect, :scope > polygon, :scope > circle, :scope > ellipse, :scope > path, :scope > g > rect, :scope > g > polygon");
    for (const shape of Array.from(shapes)) {
      if (shape.matches(".relationshipLabelBox, .labelBkg")) continue;
      const scs = win.getComputedStyle(shape);
      if (isOpaqueDarkColor(scs.fill)) return true;
    }
  }
  return false;
}
function adaptSvgForWhiteBackground(sourceSvg, targetSvg, win) {
  const srcList = [sourceSvg, ...Array.from(sourceSvg.querySelectorAll("*"))];
  const dstList = [targetSvg, ...Array.from(targetSvg.querySelectorAll("*"))];
  const count = Math.min(srcList.length, dstList.length);
  for (let i = 0; i < count; i++) {
    const src = srcList[i];
    const dst = dstList[i];
    if (!dst || !dst.style) continue;
    const tag = src.tagName.toLowerCase();
    const cs = win.getComputedStyle(src);
    if (src.matches(".relationshipLabelBox")) {
      if (isOpaqueDarkColor(cs.fill)) {
        dst.style.setProperty("fill", "#ffffff");
      }
      continue;
    }
    if (src.matches(".edgeLabel, .labelBkg") || src.closest(".edgeLabel, .labelBkg")) {
      if (isOpaqueDarkColor(cs.backgroundColor)) {
        dst.style.setProperty("background-color", "#ffffff");
      }
      if (isOpaqueDarkColor(cs.fill) && tag === "rect") {
        dst.style.setProperty("fill", "#ffffff");
      }
    }
    if (tag === "text" || tag === "tspan") {
      const fill = parseRgbColor(cs.fill);
      if (fill && relativeLuminance(fill.r, fill.g, fill.b) > 0.3 && !hasDarkShapeBackdrop(src, win)) {
        dst.style.setProperty("fill", DARK_INK);
      }
      continue;
    }
    if (src.closest("foreignObject") && tag !== "foreignobject") {
      const color = parseRgbColor(cs.color);
      if (color && relativeLuminance(color.r, color.g, color.b) > 0.3 && !hasDarkShapeBackdrop(src, win)) {
        dst.style.setProperty("color", DARK_INK);
      }
      continue;
    }
    if (src.closest("marker")) {
      const mFill = parseRgbColor(cs.fill);
      if (mFill && relativeLuminance(mFill.r, mFill.g, mFill.b) > 0.35) {
        dst.style.setProperty("fill", darkenColorForWhiteBg(cs.fill, 0.17));
      }
      const mStroke = parseRgbColor(cs.stroke);
      if (mStroke && relativeLuminance(mStroke.r, mStroke.g, mStroke.b) > 0.35) {
        dst.style.setProperty("stroke", darkenColorForWhiteBg(cs.stroke, 0.17));
      }
      continue;
    }
    if (tag === "path" || tag === "line" || tag === "polyline" || tag === "polygon" || tag === "rect") {
      const stroke = parseRgbColor(cs.stroke);
      if (stroke && relativeLuminance(stroke.r, stroke.g, stroke.b) > 0.36) {
        dst.style.setProperty("stroke", darkenColorForWhiteBg(cs.stroke, 0.17));
      }
    }
  }
}
function cloneSvgWithScopedId(sourceSvg, suffix) {
  const clone = sourceSvg.cloneNode(true);
  const oldId = sourceSvg.getAttribute("id");
  const idMap = /* @__PURE__ */ new Map();
  if (oldId) {
    const newId = `${oldId}-${suffix}`;
    clone.setAttribute("id", newId);
    idMap.set(oldId, newId);
  }
  for (const el of Array.from(clone.querySelectorAll("[id]"))) {
    const orig = el.getAttribute("id");
    if (!orig) continue;
    const mapped = `${orig}-${suffix}`;
    el.setAttribute("id", mapped);
    idMap.set(orig, mapped);
  }
  if (idMap.size > 0) {
    for (const styleEl of Array.from(clone.querySelectorAll("style"))) {
      let cssText = styleEl.textContent || "";
      if (oldId) {
        const re = new RegExp(`#${escapeRegExp(oldId)}(?![\\w-])`, "g");
        cssText = cssText.replace(re, `#${idMap.get(oldId)}`);
      }
      styleEl.textContent = cssText;
    }
    const refAttrs = ["marker-start", "marker-mid", "marker-end", "clip-path", "mask", "filter", "fill", "stroke", "href", "xlink:href"];
    for (const el of Array.from(clone.querySelectorAll("*"))) {
      for (const attr of refAttrs) {
        const val = el.getAttribute(attr);
        if (!val) continue;
        if (attr === "href" || attr === "xlink:href") {
          if (val.startsWith("#")) {
            const mapped = idMap.get(val.slice(1));
            if (mapped) el.setAttribute(attr, `#${mapped}`);
          }
        } else if (val.includes("url(#")) {
          const next = val.replace(/url\(#([^)]+)\)/g, (full, refId) => {
            const mapped = idMap.get(refId);
            return mapped ? `url(#${mapped})` : full;
          });
          if (next !== val) el.setAttribute(attr, next);
        }
      }
    }
  }
  return clone;
}
function measureSvgDimensions(svg) {
  const vb = svg.viewBox?.baseVal;
  if (vb && vb.width > 0 && vb.height > 0) {
    return {
      width: Math.ceil(vb.width),
      height: Math.ceil(vb.height),
      minX: vb.x,
      minY: vb.y
    };
  }
  try {
    const box = svg.getBBox();
    if (box.width > 0 && box.height > 0) {
      return {
        width: Math.ceil(box.width),
        height: Math.ceil(box.height),
        minX: box.x,
        minY: box.y
      };
    }
  } catch {
  }
  const rect = svg.getBoundingClientRect();
  return {
    width: Math.max(100, Math.ceil(rect.width || Number(svg.getAttribute("width")) || 640)),
    height: Math.max(80, Math.ceil(rect.height || Number(svg.getAttribute("height")) || 360)),
    minX: 0,
    minY: 0
  };
}
function computeSafeExportScale(width, height, requestedScale, maxEdge = MAX_CANVAS_EDGE) {
  const safeW = Math.max(1, width);
  const safeH = Math.max(1, height);
  const maxByW = maxEdge / safeW;
  const maxByH = maxEdge / safeH;
  const ceiling = Math.min(maxByW, maxByH);
  if (requestedScale <= ceiling) {
    return { scale: requestedScale, clamped: false };
  }
  return { scale: Math.max(0.5, Math.floor(ceiling * 100) / 100), clamped: true };
}
function resolveExportBackground(doc, bgMode) {
  if (bgMode === "transparent") return null;
  if (bgMode === "white") return "#ffffff";
  const win = doc.defaultView || window;
  const cs = win.getComputedStyle(doc.body);
  const qsBg = cs.getPropertyValue("--qs-bg-paper").trim();
  const obsBg = cs.getPropertyValue("--background-primary").trim();
  const bodyBg = cs.backgroundColor;
  return qsBg || obsBg || (bodyBg && bodyBg !== "rgba(0, 0, 0, 0)" ? bodyBg : "#ffffff");
}
function inlineComputedStyles(sourceRoot, cloneRoot, win) {
  const srcList = [sourceRoot, ...Array.from(sourceRoot.querySelectorAll("*"))];
  const dstList = [cloneRoot, ...Array.from(cloneRoot.querySelectorAll("*"))];
  const count = Math.min(srcList.length, dstList.length);
  for (let i = 0; i < count; i++) {
    const src = srcList[i];
    const dst = dstList[i];
    if (!dst || !dst.style) continue;
    dst.classList.remove("qs-wb-node-dim", "qs-wb-node-match", "qs-wb-node-current");
    const cs = win.getComputedStyle(src);
    for (const prop of INLINE_STYLE_PROPS) {
      const val = cs.getPropertyValue(prop);
      if (!val || val === "normal" || val === "auto") continue;
      if (val === "none" && !PRESERVE_NONE_PROPS.has(prop)) continue;
      dst.style.setProperty(prop, val);
    }
  }
}
function buildStandaloneSvgString(sourceSvg, bgMode, padding = 24) {
  const doc = sourceSvg.ownerDocument || document;
  const win = doc.defaultView || window;
  const dims = measureSvgDimensions(sourceSvg);
  const totalW = dims.width + padding * 2;
  const totalH = dims.height + padding * 2;
  const clone = sourceSvg.cloneNode(true);
  inlineComputedStyles(sourceSvg, clone, win);
  if (bgMode === "white" && isDarkThemeDocument(doc)) {
    adaptSvgForWhiteBackground(sourceSvg, clone, win);
  }
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  clone.setAttribute("width", String(totalW));
  clone.setAttribute("height", String(totalH));
  clone.setAttribute(
    "viewBox",
    `${dims.minX - padding} ${dims.minY - padding} ${totalW} ${totalH}`
  );
  clone.style.maxWidth = "none";
  clone.style.maxHeight = "none";
  const bgColor = resolveExportBackground(doc, bgMode);
  if (bgColor) {
    const bgRect = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("x", String(dims.minX - padding));
    bgRect.setAttribute("y", String(dims.minY - padding));
    bgRect.setAttribute("width", String(totalW));
    bgRect.setAttribute("height", String(totalH));
    bgRect.setAttribute("fill", bgColor);
    clone.insertBefore(bgRect, clone.firstChild);
  }
  const serializer = new XMLSerializer();
  let serialized = serializer.serializeToString(clone);
  if (!serialized.startsWith("<?xml")) {
    serialized = `<?xml version="1.0" encoding="UTF-8"?>
${serialized}`;
  }
  return { svgString: serialized, width: totalW, height: totalH };
}
async function renderSvgToPngBlob(sourceSvg, bgMode, requestedScale) {
  const doc = sourceSvg.ownerDocument || document;
  const { svgString, width, height } = buildStandaloneSvgString(sourceSvg, bgMode);
  const { scale, clamped } = computeSafeExportScale(width, height, requestedScale);
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to decode SVG for PNG rendering"));
    image.src = dataUrl;
  });
  const canvas = doc.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  const bgColor = resolveExportBackground(doc, bgMode);
  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, width, height);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("Canvas toBlob returned null"));
    }, "image/png");
  });
  return { blob, scale, clamped };
}
function triggerBlobDownload(doc, blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = doc.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  doc.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
async function copyPngBlobToClipboard(win, blob) {
  try {
    const ClipboardItemCtor = win.ClipboardItem || globalThis.ClipboardItem;
    const clipboard = win.navigator?.clipboard || globalThis.navigator?.clipboard;
    if (!ClipboardItemCtor || !clipboard || typeof clipboard.write !== "function") {
      return false;
    }
    await clipboard.write([new ClipboardItemCtor({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
}

// src/table/table-inline.ts
var import_obsidian4 = require("obsidian");

// src/table/table-model.ts
var PERCENT_RE = /^[+-]?\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*%$|^[+-]?\d+(?:\.\d+)?\s*%$/;
var NUMBER_RE = /^[+-]?\s*[¥$€£]?\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:万|亿|千|k|K|m|M|ms|s|px|KB|MB|GB|%)?$|^[+-]?\s*[¥$€£]?\s*\d+(?:\.\d+)?\s*(?:万|亿|千|k|K|m|M|ms|s|px|KB|MB|GB)?$/;
var DATE_RE = /^\d{4}[-/年]\d{1,2}[-/月]\d{1,2}(?:日)?(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/;
var SEMVER_RE = /^v?\d+\.\d+(?:\.\d+)?(?:-[0-9A-Za-z.-]+)?$/;
function parseNumericValue(raw) {
  const s = raw.trim();
  if (!s) return null;
  let multiplier = 1;
  let cleaned = s.replace(/[¥$€£,\s]/g, "");
  if (cleaned.endsWith("\u4EBF")) {
    multiplier = 1e8;
    cleaned = cleaned.slice(0, -1);
  } else if (cleaned.endsWith("\u4E07")) {
    multiplier = 1e4;
    cleaned = cleaned.slice(0, -1);
  } else if (cleaned.endsWith("\u5343")) {
    multiplier = 1e3;
    cleaned = cleaned.slice(0, -1);
  } else if (/ms$/i.test(cleaned)) {
    cleaned = cleaned.slice(0, -2);
  } else if (/px$/i.test(cleaned)) {
    cleaned = cleaned.slice(0, -2);
  } else if (/kb$/i.test(cleaned)) {
    multiplier = 1024;
    cleaned = cleaned.slice(0, -2);
  } else if (/mb$/i.test(cleaned)) {
    multiplier = 1024 * 1024;
    cleaned = cleaned.slice(0, -2);
  } else if (/gb$/i.test(cleaned)) {
    multiplier = 1024 * 1024 * 1024;
    cleaned = cleaned.slice(0, -2);
  } else if (/[kK]$/.test(cleaned)) {
    multiplier = 1e3;
    cleaned = cleaned.slice(0, -1);
  } else if (/[mM]$/.test(cleaned)) {
    multiplier = 1e6;
    cleaned = cleaned.slice(0, -1);
  } else if (cleaned.endsWith("%")) {
    cleaned = cleaned.slice(0, -1);
  } else if (cleaned.endsWith("s")) {
    cleaned = cleaned.slice(0, -1);
  }
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n * multiplier : null;
}
function parseDateTimestamp(raw) {
  const s = raw.trim();
  if (!DATE_RE.test(s)) return null;
  const iso = s.replace(/年|月/g, "-").replace(/日/g, "").replace(/\//g, "-").replace(" ", "T");
  const ts = Date.parse(iso);
  return Number.isFinite(ts) ? ts : null;
}
function parseSemverTuple(raw) {
  const s = raw.trim();
  if (!SEMVER_RE.test(s)) return null;
  const core = s.replace(/^v/i, "").split("-")[0];
  return core.split(".").map((part) => Number(part));
}
function detectColumnType(values) {
  const sample = values.map((v) => v.trim()).filter(Boolean).slice(0, 50);
  if (sample.length === 0) return "text";
  const threshold = Math.ceil(sample.length * 0.75);
  if (sample.filter((v) => PERCENT_RE.test(v)).length >= threshold) return "percent";
  if (sample.filter((v) => DATE_RE.test(v) && parseDateTimestamp(v) !== null).length >= threshold) return "date";
  if (sample.filter((v) => SEMVER_RE.test(v)).length >= threshold) return "semver";
  if (sample.filter((v) => NUMBER_RE.test(v) && parseNumericValue(v) !== null).length >= threshold) return "number";
  return "text";
}
function normalizeCellText(el, isLivePreviewTable) {
  if (!el.firstElementChild) {
    const raw = (el.textContent || "").replace(/\u200B/g, "").trim();
    return raw.includes("\n") ? raw.replace(/\s*\n\s*/g, "\n") : raw;
  }
  if (isLivePreviewTable) {
    const cmLines = el.querySelectorAll(".cm-line");
    if (cmLines.length > 0) {
      return Array.from(cmLines).map((line) => (line.textContent || "").replace(/\u200B/g, "").trim()).join("\n").trim();
    }
  }
  const text = (el.textContent || "").replace(/\u200B/g, "").trim();
  return text.includes("\n") ? text.replace(/\s*\n\s*/g, "\n") : text;
}
function extractCellLinks(el) {
  if (!el.firstElementChild) return [];
  const anchors = el.querySelectorAll("a.internal-link, a.external-link, a[href]");
  if (anchors.length === 0) return [];
  const out = [];
  for (const a of Array.from(anchors)) {
    const text = (a.textContent || "").trim();
    const isInternal = a.classList.contains("internal-link");
    const href = (a.getAttribute("data-href") || a.getAttribute("href") || "").trim();
    if (!href || !text) continue;
    if (!isInternal && !/^https?:\/\//i.test(href)) continue;
    out.push({ text, href, isInternal });
  }
  return out;
}
function extractTableGrid(table) {
  let hasSpans = false;
  const isLivePreviewTable = Boolean(table.closest?.(".cm-table-widget") || table.querySelector?.(".cm-line"));
  const checkSpans = (cells) => {
    for (const c of Array.from(cells)) {
      if (c.hasAttribute("colspan") || c.hasAttribute("rowspan")) {
        const cs = Number(c.getAttribute("colspan") || "1");
        const rs = Number(c.getAttribute("rowspan") || "1");
        if (cs > 1 || rs > 1) hasSpans = true;
      }
    }
  };
  const theadRow = table.querySelector("thead tr");
  const tbodyRows = Array.from(table.querySelectorAll("tbody tr"));
  const allRows = tbodyRows.length > 0 ? tbodyRows : Array.from(table.querySelectorAll("tr"));
  let headerLabels = [];
  let dataRowsEls = [];
  let hasExplicitHeader = false;
  if (theadRow) {
    hasExplicitHeader = true;
    const ths = Array.from(theadRow.children).filter((el) => el.tagName === "TH" || el.tagName === "TD");
    checkSpans(ths);
    headerLabels = ths.map((th, i) => normalizeCellText(th, isLivePreviewTable) || `Col ${i + 1}`);
    dataRowsEls = tbodyRows;
  } else if (allRows.length > 0) {
    const firstCells = Array.from(allRows[0].children).filter((el) => el.tagName === "TH" || el.tagName === "TD");
    checkSpans(firstCells);
    headerLabels = firstCells.map((c, i) => normalizeCellText(c, isLivePreviewTable) || `Col ${i + 1}`);
    dataRowsEls = allRows.slice(1);
  }
  let maxCols = headerLabels.length;
  const rawRows = [];
  for (const tr of dataRowsEls) {
    const cellEls = Array.from(tr.children).filter((el) => el.tagName === "TD" || el.tagName === "TH");
    checkSpans(cellEls);
    if (cellEls.length > maxCols) maxCols = cellEls.length;
    rawRows.push(
      cellEls.map((cell) => ({
        text: normalizeCellText(cell, isLivePreviewTable),
        links: extractCellLinks(cell)
      }))
    );
  }
  while (headerLabels.length < maxCols) {
    headerLabels.push(`Col ${headerLabels.length + 1}`);
  }
  const rows = rawRows.map((cells, rowIndex) => {
    const padded = cells.slice();
    while (padded.length < maxCols) padded.push({ text: "", links: [] });
    return { rowIndex, cells: padded };
  });
  const columns = headerLabels.map((label, index) => ({
    index,
    label,
    type: detectColumnType(rows.map((r) => r.cells[index]?.text ?? ""))
  }));
  return { columns, rows, hasSpans, hasExplicitHeader };
}

// src/table/table-export.ts
function escapeTsvCell(raw) {
  const s = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (/[\t\n"]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
function escapeCsvCell(raw) {
  const s = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
function escapeMdCell(raw) {
  return raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}
function serializeToTsv(columns, rows, visibleColIndexes) {
  const colIds = visibleColIndexes ?? columns.map((c) => c.index);
  const headerLine = colIds.map((i) => escapeTsvCell(columns[i]?.label ?? "")).join("	");
  const bodyLines = rows.map(
    (row) => colIds.map((i) => escapeTsvCell(row.cells[i]?.text ?? "")).join("	")
  );
  return [headerLine, ...bodyLines].join("\n");
}
function serializeToCsv(columns, rows, visibleColIndexes, withBom = true) {
  const colIds = visibleColIndexes ?? columns.map((c) => c.index);
  const headerLine = colIds.map((i) => escapeCsvCell(columns[i]?.label ?? "")).join(",");
  const bodyLines = rows.map(
    (row) => colIds.map((i) => escapeCsvCell(row.cells[i]?.text ?? "")).join(",")
  );
  const content = [headerLine, ...bodyLines].join("\r\n");
  return withBom ? `\uFEFF${content}` : content;
}
function serializeToMarkdown(columns, rows, visibleColIndexes) {
  const colIds = visibleColIndexes ?? columns.map((c) => c.index);
  const header = `| ${colIds.map((i) => escapeMdCell(columns[i]?.label ?? "")).join(" | ")} |`;
  const sep = `| ${colIds.map(() => "---").join(" | ")} |`;
  const body = rows.map(
    (row) => `| ${colIds.map((i) => escapeMdCell(row.cells[i]?.text ?? "")).join(" | ")} |`
  );
  return [header, sep, ...body].join("\n");
}

// src/table/table-inline.ts
function enhanceInlineTable(table, child, settings, callbacks) {
  if (table.dataset.qsWbTable === "1") return false;
  const theadCols = table.querySelectorAll("thead tr:first-child th, thead tr:first-child td").length;
  const firstRowCols = table.querySelectorAll("tr:first-child th, tr:first-child td").length;
  const colCount = theadCols || firstRowCols;
  const bodyRows = Array.from(table.querySelectorAll("tbody tr"));
  const rowCount = bodyRows.length;
  if (!shouldEnhanceTableInline(colCount, rowCount, settings.inlineMinColumns, settings.inlineMinRows)) {
    return false;
  }
  const host = table.parentElement?.classList.contains("table-wrapper") ? table.parentElement : table.closest(".el-table") || table.parentElement;
  if (!host) return false;
  table.dataset.qsWbTable = "1";
  const doc = table.ownerDocument || document;
  const bar = doc.createElement("div");
  bar.className = "qs-wb-inline-bar qs-wb-table-bar";
  const meta = doc.createElement("span");
  meta.className = "qs-wb-inline-meta";
  meta.textContent = `${rowCount}\xD7${colCount}`;
  const filterInput = doc.createElement("input");
  filterInput.type = "search";
  filterInput.className = "qs-wb-inline-filter";
  filterInput.placeholder = t("\u9875\u5185\u7B5B\u9009...", "Quick filter...");
  const btnFreeze = createIconButton(
    doc,
    "pin",
    t("\u51BB\u7ED3\u8868\u5934\u4E0E\u9996\u5217", "Toggle sticky header & first column"),
    t("\u51BB\u7ED3", "Freeze"),
    "qs-wb-inline-btn"
  );
  const btnCopy = createIconButton(
    doc,
    "copy",
    t("\u590D\u5236\u4E3A TSV\uFF08\u76F4\u8D34 Excel / \u9489\u9489\uFF09", "Copy as TSV (Excel / spreadsheet ready)"),
    "TSV",
    "qs-wb-inline-btn"
  );
  const btnExpand = createIconButton(
    doc,
    "maximize-2",
    t("\u5728\u5168\u5C4F\u5BBD\u8868\u5DE5\u4F5C\u53F0\u6253\u5F00", "Open in wide-table workbench"),
    t("\u5DE5\u4F5C\u53F0", "Workbench"),
    "qs-wb-inline-btn is-primary"
  );
  bar.append(meta, filterInput, btnFreeze, btnCopy, btnExpand);
  host.classList.add("qs-wb-table-host");
  host.style.setProperty("--qs-wb-inline-max-h", `${settings.inlineMaxHeight}px`);
  host.insertBefore(bar, host.firstChild);
  let frozen = false;
  const setFrozen = (next) => {
    frozen = next;
    host.classList.toggle("qs-wb-table-frozen", frozen);
    btnFreeze.classList.toggle("is-active", frozen);
    if (frozen) {
      const barH = Math.max(32, Math.ceil(bar.getBoundingClientRect().height || 36));
      host.style.setProperty("--qs-wb-bar-h", `${barH}px`);
    } else {
      host.style.removeProperty("--qs-wb-bar-h");
    }
  };
  const applyFilter = () => {
    const q = filterInput.value.trim().toLowerCase();
    let visible = 0;
    for (const tr of bodyRows) {
      const match = !q || (tr.textContent || "").toLowerCase().includes(q);
      tr.classList.toggle("qs-wb-row-hidden", !match);
      if (match) visible++;
    }
    meta.textContent = q ? `${visible}/${rowCount}\xD7${colCount}` : `${rowCount}\xD7${colCount}`;
  };
  child.registerDomEvent(filterInput, "input", applyFilter);
  child.registerDomEvent(btnFreeze, "click", (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    setFrozen(!frozen);
  });
  child.registerDomEvent(btnCopy, "click", async (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    try {
      const grid = extractTableGrid(table);
      const visibleRows = grid.rows.filter((_, idx) => !bodyRows[idx]?.classList.contains("qs-wb-row-hidden"));
      const tsv = serializeToTsv(grid.columns, visibleRows);
      const nav = doc.defaultView?.navigator || navigator;
      await nav.clipboard.writeText(tsv);
      new import_obsidian4.Notice(t(`\u5DF2\u590D\u5236 ${visibleRows.length} \u884C TSV\uFF08\u53EF\u76F4\u8D34 Excel/\u9489\u9489\uFF09`, `Copied ${visibleRows.length} rows as TSV`));
    } catch {
      new import_obsidian4.Notice(t("\u590D\u5236 TSV \u5931\u8D25", "Failed to copy TSV"));
    }
  });
  child.registerDomEvent(btnExpand, "click", (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    callbacks.onOpenWorkbench(table);
  });
  child.register(() => {
    for (const tr of bodyRows) tr.classList.remove("qs-wb-row-hidden");
    host.classList.remove("qs-wb-table-host", "qs-wb-table-frozen");
    host.style.removeProperty("--qs-wb-inline-max-h");
    host.style.removeProperty("--qs-wb-bar-h");
    bar.remove();
    delete table.dataset.qsWbTable;
  });
  return true;
}

// src/detectors/reading-detector.ts
function noteTitleFromPath(sourcePath) {
  const base = sourcePath.split("/").pop() || "Note";
  return base.replace(/\.md$/i, "") || "Note";
}
function attachMermaidTrigger(mermaidBox, child, title, actions) {
  if (mermaidBox.dataset.qsWbMermaid === "1") return false;
  if (isProtectedMermaidElement(mermaidBox)) return false;
  const doc = mermaidBox.ownerDocument || document;
  const win = doc.defaultView || window;
  const mountForSvg = (svg) => {
    if (mermaidBox.dataset.qsWbMermaid === "1") return;
    if (isProtectedMermaidElement(mermaidBox)) return;
    mermaidBox.dataset.qsWbMermaid = "1";
    mermaidBox.classList.add("qs-wb-mermaid-host");
    const bar = doc.createElement("div");
    bar.className = "qs-wb-float-bar qs-wb-mermaid-bar";
    const btnZoom = createIconButton(
      doc,
      "maximize-2",
      t("\u6253\u5F00 Mermaid \u6C89\u6D78\u5F0F\u706F\u7BB1", "Open Mermaid lightbox"),
      t("\u706F\u7BB1", "Zoom"),
      "qs-wb-inline-btn is-primary"
    );
    const btnPng = createIconButton(
      doc,
      "copy",
      t("\u590D\u5236\u9AD8\u6E05 PNG \u5230\u526A\u8D34\u677F", "Copy Retina PNG to clipboard"),
      "PNG",
      "qs-wb-inline-btn"
    );
    const btnSvg = createIconButton(
      doc,
      "download",
      t("\u5BFC\u51FA\u9AD8\u4FDD\u771F SVG", "Export styled SVG"),
      "SVG",
      "qs-wb-inline-btn"
    );
    bar.append(btnZoom, btnPng, btnSvg);
    mermaidBox.appendChild(bar);
    const getLiveSvg = () => mermaidBox.querySelector("svg");
    child.registerDomEvent(btnZoom, "click", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const target = getLiveSvg() || svg;
      actions.openMermaid(target, title);
    });
    child.registerDomEvent(btnPng, "click", async (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const target = getLiveSvg() || svg;
      const cur = actions.getSettings();
      try {
        const { blob, scale } = await renderSvgToPngBlob(target, cur.defaultExportBg, cur.pngScale);
        const copied = await copyPngBlobToClipboard(win, blob);
        if (copied) {
          new import_obsidian5.Notice(t(`\u5DF2\u590D\u5236 ${scale}\xD7 \u9AD8\u6E05 PNG`, `Copied ${scale}x PNG`));
        } else {
          triggerBlobDownload(doc, blob, `${title}-${scale}x.png`);
          new import_obsidian5.Notice(t("\u526A\u8D34\u677F\u4E0D\u53EF\u7528\uFF0C\u5DF2\u81EA\u52A8\u4E0B\u8F7D PNG", "Clipboard unavailable; downloaded PNG"));
        }
      } catch {
        new import_obsidian5.Notice(t("PNG \u5BFC\u51FA\u53D7\u9650\uFF0C\u8BF7\u6539\u7528 SVG", "PNG export restricted; try SVG"));
      }
    });
    child.registerDomEvent(btnSvg, "click", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const target = getLiveSvg() || svg;
      const cur = actions.getSettings();
      try {
        const { svgString } = buildStandaloneSvgString(target, cur.defaultExportBg);
        const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        triggerBlobDownload(doc, blob, `${title}.svg`);
        new import_obsidian5.Notice(t("\u5DF2\u5BFC\u51FA\u9AD8\u4FDD\u771F SVG", "Exported styled SVG"));
      } catch {
        new import_obsidian5.Notice(t("SVG \u5BFC\u51FA\u5931\u8D25", "Failed to export SVG"));
      }
    });
    child.registerDomEvent(mermaidBox, "dblclick", (evt) => {
      if (!actions.getSettings().doubleClickToOpen) return;
      if (!actions.getSettings().enableMermaidWorkbench) return;
      if (evt.target?.closest?.(".qs-wb-float-bar")) return;
      const target = getLiveSvg() || svg;
      actions.openMermaid(target, title);
    });
    child.register(() => {
      bar.remove();
      mermaidBox.classList.remove("qs-wb-mermaid-host");
      delete mermaidBox.dataset.qsWbMermaid;
    });
  };
  const existingSvg = mermaidBox.querySelector("svg");
  if (existingSvg) {
    mountForSvg(existingSvg);
    return true;
  }
  if (typeof MutationObserver !== "function") return false;
  const observer = new MutationObserver(() => {
    const svg = mermaidBox.querySelector("svg");
    if (svg) {
      observer.disconnect();
      mountForSvg(svg);
    }
  });
  observer.observe(mermaidBox, { childList: true, subtree: true });
  child.register(() => observer.disconnect());
  return true;
}
var GuardedSectionChild = class extends import_obsidian5.MarkdownRenderChild {
  checkAfterMount;
  constructor(containerEl, checkAfterMount) {
    super(containerEl);
    this.checkAfterMount = checkAfterMount;
  }
  onload() {
    const verify = () => {
      if (!this.checkAfterMount()) {
        this.unload();
      }
    };
    if (this.containerEl.isConnected) {
      verify();
    } else {
      const win = this.containerEl.ownerDocument?.defaultView || window;
      const raf = win.requestAnimationFrame(() => verify());
      this.register(() => win.cancelAnimationFrame(raf));
    }
  }
};
function processReadingSection(element, context, actions) {
  const settings = actions.getSettings();
  if (!settings.enableMermaidWorkbench && !settings.enableTableWorkbench) return;
  if (isPathExcluded(context.sourcePath, settings.excludedPaths)) return;
  if (hasExemptFrontmatterClass(context.frontmatter)) return;
  if (element.closest(".markdown-source-view")) return;
  const title = noteTitleFromPath(context.sourcePath);
  const child = new GuardedSectionChild(element, () => {
    if (!element.isConnected) return true;
    if (isPrintSurface(element) || hasExemptCssClass(element)) return false;
    if (element.closest(".markdown-source-view, .bases-view, .qs-home")) return false;
    if (element.querySelector("[data-password-toggle], .account-secret-toolbar")) return false;
    return true;
  });
  let attached = false;
  if (settings.enableMermaidWorkbench) {
    const mermaidContainers = element.matches(".mermaid") ? [element] : Array.from(element.querySelectorAll(".mermaid"));
    for (const box of mermaidContainers) {
      if (isProtectedMermaidElement(box)) continue;
      if (attachMermaidTrigger(box, child, title, actions)) {
        attached = true;
      }
    }
  }
  if (settings.enableTableWorkbench && !hasExemptFrontmatterClass(context.frontmatter, ["qs-home"])) {
    const tables = element.matches("table") ? [element] : Array.from(element.querySelectorAll("table"));
    for (const table of tables) {
      if (isProtectedTableElement(table)) continue;
      if (enhanceInlineTable(table, child, settings, {
        onOpenWorkbench: (target) => actions.openTable(target, title, context.sourcePath)
      })) {
        attached = true;
      }
    }
  }
  if (attached) {
    context.addChild(child);
  }
}

// src/detectors/editor-detector.ts
var import_obsidian6 = require("obsidian");
var LP_TRIGGER_CLASS = "qs-wb-lp-trigger";
var LivePreviewTriggerManager = class {
  app;
  actions;
  mounted = /* @__PURE__ */ new Set();
  observers = /* @__PURE__ */ new Map();
  constructor(app, actions) {
    this.app = app;
    this.actions = actions;
  }
  refreshAll() {
    this.pruneDisconnected();
    const settings = this.actions.getSettings();
    if (!settings.enableLivePreviewTriggers || !settings.enableMermaidWorkbench && !settings.enableTableWorkbench) {
      this.cleanupAll();
      return;
    }
    const liveRoots = /* @__PURE__ */ new Set();
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf?.view;
      if (!(view instanceof import_obsidian6.MarkdownView)) return;
      const lpRoot = view.containerEl.querySelector(".markdown-source-view.mod-cm6.is-live-preview");
      if (!lpRoot) return;
      const sourcePath = view.file?.path || "";
      if (isPathExcluded(sourcePath, settings.excludedPaths) || hasExemptCssClass(lpRoot)) {
        this.removeTriggersIn(lpRoot);
        return;
      }
      liveRoots.add(lpRoot);
      this.scanRoot(lpRoot, view);
      this.ensureObserver(lpRoot, view);
    });
    for (const [root, entry] of Array.from(this.observers.entries())) {
      if (!liveRoots.has(root) || !root.isConnected) {
        entry.observer.disconnect();
        this.observers.delete(root);
        this.removeTriggersIn(root);
      }
    }
  }
  pruneDisconnected() {
    for (const el of Array.from(this.mounted)) {
      if (!el.isConnected) this.mounted.delete(el);
    }
  }
  removeTriggersIn(root) {
    for (const el of Array.from(root.querySelectorAll(`.${LP_TRIGGER_CLASS}`))) {
      const parent = el.parentElement;
      if (parent && parent.dataset.qsWbLp) delete parent.dataset.qsWbLp;
      el.remove();
      this.mounted.delete(el);
    }
  }
  ensureObserver(lpRoot, view) {
    const existing = this.observers.get(lpRoot);
    if (existing) {
      existing.view = view;
      return;
    }
    if (typeof MutationObserver !== "function") return;
    let scheduled = false;
    const entry = {
      view,
      observer: new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        const win = lpRoot.ownerDocument?.defaultView || window;
        win.requestAnimationFrame(() => {
          scheduled = false;
          if (!lpRoot.isConnected) return;
          this.pruneDisconnected();
          this.scanRoot(lpRoot, entry.view);
        });
      })
    };
    entry.observer.observe(lpRoot, { childList: true, subtree: true });
    this.observers.set(lpRoot, entry);
  }
  scanRoot(lpRoot, view) {
    const settings = this.actions.getSettings();
    const sourcePath = view.file?.path || "";
    const title = view.file?.basename || "Note";
    if (!settings.enableLivePreviewTriggers || isPathExcluded(sourcePath, settings.excludedPaths) || hasExemptCssClass(lpRoot)) {
      this.removeTriggersIn(lpRoot);
      return;
    }
    if (settings.enableMermaidWorkbench) {
      const mermaidEmbeds = lpRoot.querySelectorAll(".cm-embed-block .mermaid");
      for (const box of Array.from(mermaidEmbeds)) {
        if (isProtectedMermaidElement(box)) continue;
        const svg = box.querySelector("svg");
        const embed = box.closest(".cm-embed-block");
        if (!svg || !embed || embed.dataset.qsWbLp === "1") continue;
        this.mountTrigger(embed, "mermaid", () => {
          const liveSvg = embed.querySelector("svg");
          if (liveSvg) this.actions.openMermaid(liveSvg, view.file?.basename || title);
        });
      }
    }
    if (settings.enableTableWorkbench) {
      const tableWidgets = lpRoot.querySelectorAll(".cm-embed-block.cm-table-widget");
      for (const widget of Array.from(tableWidgets)) {
        const table = widget.querySelector("table");
        if (!table || isProtectedTableElement(table) || widget.dataset.qsWbLp === "1") continue;
        this.mountTrigger(widget, "table", () => {
          const liveTable = widget.querySelector("table");
          if (liveTable) {
            this.actions.openTable(liveTable, view.file?.basename || title, view.file?.path || "");
          }
        });
      }
    }
  }
  mountTrigger(host, kind, onClick) {
    host.dataset.qsWbLp = "1";
    const doc = host.ownerDocument || document;
    const wrap = doc.createElement("div");
    wrap.className = `${LP_TRIGGER_CLASS} is-${kind}`;
    const label = kind === "mermaid" ? t("\u5728 Mermaid \u706F\u7BB1\u4E2D\u6253\u5F00", "Open in Mermaid lightbox") : t("\u5728\u5BBD\u8868\u5DE5\u4F5C\u53F0\u6253\u5F00\uFF08\u53EA\u8BFB\uFF09", "Open in wide-table workbench (read-only)");
    const text = kind === "mermaid" ? t("\u706F\u7BB1", "Zoom") : t("\u5DE5\u4F5C\u53F0", "Workbench");
    const btn = createIconButton(doc, "maximize-2", label, text, "qs-wb-inline-btn is-primary");
    btn.addEventListener("click", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      onClick();
    });
    wrap.appendChild(btn);
    host.appendChild(wrap);
    this.mounted.add(wrap);
  }
  cleanupAll() {
    for (const entry of this.observers.values()) entry.observer.disconnect();
    this.observers.clear();
    for (const el of this.mounted) {
      const parent = el.parentElement;
      if (parent && parent.dataset.qsWbLp) delete parent.dataset.qsWbLp;
      el.remove();
    }
    this.mounted.clear();
  }
};

// src/mermaid/mermaid-modal.ts
var import_obsidian7 = require("obsidian");

// src/mermaid/mermaid-viewport.ts
var MIN_ZOOM = 0.1;
var MAX_ZOOM = 8;
function clampZoom(scale) {
  if (!Number.isFinite(scale)) return 1;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale));
}
function clampPan(state, bounds, margin = 48) {
  const sw = Math.max(1, bounds.stageWidth);
  const sh = Math.max(1, bounds.stageHeight);
  const cw = Math.max(1, bounds.contentWidth) * state.scale;
  const ch = Math.max(1, bounds.contentHeight) * state.scale;
  const minX = Math.min(margin - cw, sw - cw - margin);
  const maxX = Math.max(sw - margin, margin);
  const minY = Math.min(margin - ch, sh - ch - margin);
  const maxY = Math.max(sh - margin, margin);
  return {
    scale: state.scale,
    x: Math.max(minX, Math.min(maxX, state.x)),
    y: Math.max(minY, Math.min(maxY, state.y))
  };
}
function computeFitViewport(bounds, padding = 32) {
  const sw = Math.max(1, bounds.stageWidth);
  const sh = Math.max(1, bounds.stageHeight);
  const cw = Math.max(1, bounds.contentWidth);
  const ch = Math.max(1, bounds.contentHeight);
  const availW = Math.max(40, sw - padding * 2);
  const availH = Math.max(40, sh - padding * 2);
  const scale = clampZoom(Math.min(availW / cw, availH / ch, 2));
  return {
    scale,
    x: (sw - cw * scale) / 2,
    y: (sh - ch * scale) / 2
  };
}
function computeFitWidthViewport(bounds, padding = 24) {
  const sw = Math.max(1, bounds.stageWidth);
  const cw = Math.max(1, bounds.contentWidth);
  const availW = Math.max(40, sw - padding * 2);
  const scale = clampZoom(availW / cw);
  return {
    scale,
    x: (sw - cw * scale) / 2,
    y: padding
  };
}
function zoomAtPoint(state, factor, anchorX, anchorY, bounds) {
  const nextScale = clampZoom(state.scale * factor);
  const ratio = nextScale / state.scale;
  const next = {
    scale: nextScale,
    x: anchorX - (anchorX - state.x) * ratio,
    y: anchorY - (anchorY - state.y) * ratio
  };
  return bounds ? clampPan(next, bounds) : next;
}
function centerOnContentPoint(contentX, contentY, bounds, targetScale) {
  const scale = clampZoom(targetScale);
  const next = {
    scale,
    x: bounds.stageWidth / 2 - contentX * scale,
    y: bounds.stageHeight / 2 - contentY * scale
  };
  return clampPan(next, bounds);
}
function computeMinimapViewportRect(state, bounds, mapWidth, mapHeight) {
  const cw = Math.max(1, bounds.contentWidth);
  const ch = Math.max(1, bounds.contentHeight);
  const mw = Math.max(1, mapWidth);
  const mh = Math.max(1, mapHeight);
  const rawLeft = -state.x / state.scale / cw * mw;
  const rawTop = -state.y / state.scale / ch * mh;
  const rawWidth = bounds.stageWidth / state.scale / cw * mw;
  const rawHeight = bounds.stageHeight / state.scale / ch * mh;
  const width = Math.max(12, Math.min(mw, rawWidth));
  const height = Math.max(10, Math.min(mh, rawHeight));
  const left = Math.max(0, Math.min(mw - width, rawLeft));
  const top = Math.max(0, Math.min(mh - height, rawTop));
  return { left, top, width, height };
}

// src/mermaid/mermaid-search.ts
function extractDiagramSearchNodes(svg) {
  const candidates = /* @__PURE__ */ new Map();
  const labelEls = svg.querySelectorAll("text, foreignObject");
  for (const el of Array.from(labelEls)) {
    const raw = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!raw) continue;
    const host = el.closest("g.node, g.cluster, g.actor, g.classGroup, g.statediagram-state, g[id]") || el;
    const existing = candidates.get(host);
    if (existing) existing.push(raw);
    else candidates.set(host, [raw]);
  }
  const out = [];
  for (const [element, parts] of candidates.entries()) {
    const text = parts.join(" ").trim();
    if (!text) continue;
    out.push({
      element,
      text,
      normalized: text.toLowerCase()
    });
  }
  return out;
}
function filterDiagramNodes(nodes, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  return nodes.filter((node) => terms.every((term) => node.normalized.includes(term)));
}
function getNodeCenterInSvg(node, svg, contentWidth, contentHeight) {
  try {
    const graphics = node;
    if (typeof graphics.getBBox === "function") {
      const box = graphics.getBBox();
      if (Number.isFinite(box.width) && (box.width > 0 || box.height > 0)) {
        const vb = svg.viewBox?.baseVal;
        const offsetX = vb && vb.width > 0 ? vb.x : 0;
        const offsetY = vb && vb.height > 0 ? vb.y : 0;
        const scaleX = vb && vb.width > 0 ? contentWidth / vb.width : 1;
        const scaleY = vb && vb.height > 0 ? contentHeight / vb.height : 1;
        return {
          x: (box.x + box.width / 2 - offsetX) * scaleX,
          y: (box.y + box.height / 2 - offsetY) * scaleY
        };
      }
    }
  } catch {
  }
  const svgRect = svg.getBoundingClientRect();
  const nodeRect = node.getBoundingClientRect();
  if (svgRect.width > 0 && svgRect.height > 0) {
    return {
      x: (nodeRect.left + nodeRect.width / 2 - svgRect.left) / svgRect.width * contentWidth,
      y: (nodeRect.top + nodeRect.height / 2 - svgRect.top) / svgRect.height * contentHeight
    };
  }
  return { x: contentWidth / 2, y: contentHeight / 2 };
}

// src/mermaid/mermaid-minimap.ts
function createMermaidMinimap(doc, sourceSvg, onNavigate) {
  const wrap = doc.createElement("div");
  wrap.className = "qs-wb-minimap";
  wrap.title = t("\u70B9\u51FB\u6216\u62D6\u62FD\u5C0F\u5730\u56FE\u5FEB\u901F\u6F2B\u6E38", "Click or drag minimap to pan");
  const label = doc.createElement("span");
  label.className = "qs-wb-minimap-label";
  label.textContent = "Minimap";
  wrap.appendChild(label);
  const previewSvg = cloneSvgWithScopedId(sourceSvg, "qs-mini");
  previewSvg.removeAttribute("width");
  previewSvg.removeAttribute("height");
  previewSvg.style.width = "100%";
  previewSvg.style.height = "100%";
  previewSvg.style.maxWidth = "100%";
  previewSvg.style.maxHeight = "100%";
  previewSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  previewSvg.setAttribute("aria-hidden", "true");
  wrap.appendChild(previewSvg);
  const vpBox = doc.createElement("div");
  vpBox.className = "qs-wb-minimap-vp";
  wrap.appendChild(vpBox);
  const win = doc.defaultView || window;
  let dragging = false;
  const navigateFromEvent = (evt) => {
    const rect = wrap.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const rx = Math.max(0, Math.min(1, (evt.clientX - rect.left) / rect.width));
    const ry = Math.max(0, Math.min(1, (evt.clientY - rect.top) / rect.height));
    onNavigate(rx, ry);
  };
  const onDown = (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    dragging = true;
    navigateFromEvent(evt);
  };
  const onMove = (evt) => {
    if (!dragging) return;
    navigateFromEvent(evt);
  };
  const onUp = () => {
    dragging = false;
  };
  wrap.addEventListener("pointerdown", onDown);
  win.addEventListener("pointermove", onMove);
  win.addEventListener("pointerup", onUp);
  return {
    element: wrap,
    sync(state, bounds) {
      const mw = wrap.clientWidth || 168;
      const mh = wrap.clientHeight || 96;
      const r = computeMinimapViewportRect(state, bounds, mw, mh);
      vpBox.style.left = `${r.left}px`;
      vpBox.style.top = `${r.top}px`;
      vpBox.style.width = `${r.width}px`;
      vpBox.style.height = `${r.height}px`;
    },
    setVisible(visible) {
      wrap.classList.toggle("is-hidden", !visible);
    },
    destroy() {
      wrap.removeEventListener("pointerdown", onDown);
      win.removeEventListener("pointermove", onMove);
      win.removeEventListener("pointerup", onUp);
      wrap.remove();
    }
  };
}

// src/mermaid/mermaid-modal.ts
var BG_ORDER = ["theme", "white", "transparent"];
function openMermaidLightbox(sourceSvg, settings, title = "Mermaid", onClose) {
  const doc = sourceSvg.ownerDocument || document;
  const win = doc.defaultView || window;
  const prevFocused = doc.activeElement;
  const overlay = doc.createElement("div");
  overlay.className = "qs-wb-overlay qs-wb-mermaid-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", t("Mermaid \u6C89\u6D78\u5F0F\u706F\u7BB1", "Mermaid lightbox"));
  overlay.tabIndex = -1;
  const modal = doc.createElement("div");
  modal.className = "qs-wb-modal";
  overlay.appendChild(modal);
  const toolbar = doc.createElement("div");
  toolbar.className = "qs-wb-toolbar";
  modal.appendChild(toolbar);
  const leftGroup = doc.createElement("div");
  leftGroup.className = "qs-wb-group";
  const rightGroup = doc.createElement("div");
  rightGroup.className = "qs-wb-group";
  toolbar.append(leftGroup, rightGroup);
  const btnOut = createIconButton(doc, "zoom-out", t("\u7F29\u5C0F (-)", "Zoom out (-)"));
  const zoomReadout = doc.createElement("span");
  zoomReadout.className = "qs-wb-zoom-readout";
  zoomReadout.textContent = "100%";
  const btnIn = createIconButton(doc, "zoom-in", t("\u653E\u5927 (+)", "Zoom in (+)"));
  const btnFit = createIconButton(doc, "maximize-2", t("\u9002\u5E94\u7A97\u53E3 (F)", "Fit to view (F)"), t("\u9002\u5C4F", "Fit"));
  const btnFitW = createIconButton(doc, "move-horizontal", t("\u9002\u5E94\u5BBD\u5EA6 (W)", "Fit width (W)"), t("\u9002\u5BBD", "Width"));
  const btnReset = createIconButton(doc, "rotate-ccw", t("100% \u539F\u59CB\u5C3A\u5BF8 (0)", "Actual size (0)"), "1:1");
  let bgMode = settings.defaultExportBg;
  const bgLabel = (mode) => {
    if (mode === "white") return t("\u7EAF\u767D\u5E95", "White");
    if (mode === "transparent") return t("\u900F\u660E\u5E95", "Transparent");
    return t("\u4E3B\u9898\u5E95", "Theme");
  };
  const btnBg = createIconButton(doc, "palette", t("\u5207\u6362\u753B\u5E03\u4E0E\u5BFC\u51FA\u5E95\u8272", "Switch canvas & export background"), bgLabel(bgMode));
  const btnMinimap = createIconButton(doc, "map", t("\u663E\u793A/\u9690\u85CF\u5C0F\u5730\u56FE (M)", "Toggle minimap (M)"));
  btnMinimap.classList.toggle("is-active", settings.showMinimap);
  leftGroup.append(btnOut, zoomReadout, btnIn, btnFit, btnFitW, btnReset, btnBg, btnMinimap);
  const searchWrap = doc.createElement("div");
  searchWrap.className = "qs-wb-search-wrap";
  const searchInput = doc.createElement("input");
  searchInput.type = "search";
  searchInput.className = "qs-wb-input";
  searchInput.placeholder = t("\u56FE\u5185\u641C\u8282\u70B9 (\u2318F)", "Search nodes (\u2318F)");
  const matchStat = doc.createElement("span");
  matchStat.className = "qs-wb-meta";
  const btnPrev = createIconButton(doc, "chevron-up", t("\u4E0A\u4E00\u4E2A\u547D\u4E2D (Shift+Enter)", "Previous match"));
  const btnNext = createIconButton(doc, "chevron-down", t("\u4E0B\u4E00\u4E2A\u547D\u4E2D (Enter)", "Next match"));
  searchWrap.append(searchInput, matchStat, btnPrev, btnNext);
  const btnCopyPng = createIconButton(
    doc,
    "copy",
    t(`\u590D\u5236 ${settings.pngScale}\xD7 \u9AD8\u6E05 PNG`, `Copy ${settings.pngScale}x PNG`),
    t("\u590D\u5236 PNG", "Copy PNG")
  );
  const btnDlPng = createIconButton(doc, "image", t("\u4E0B\u8F7D\u9AD8\u6E05 PNG", "Download PNG"), "PNG");
  const btnDlSvg = createIconButton(doc, "download", t("\u5BFC\u51FA\u9AD8\u4FDD\u771F SVG", "Export SVG"), "SVG");
  const btnClose = createIconButton(doc, "x", t("\u5173\u95ED (Esc)", "Close (Esc)"));
  rightGroup.append(searchWrap, btnCopyPng, btnDlPng, btnDlSvg, btnClose);
  const stage = doc.createElement("div");
  stage.className = "qs-wb-mermaid-stage";
  stage.dataset.bg = bgMode;
  modal.appendChild(stage);
  const canvas = doc.createElement("div");
  canvas.className = "qs-wb-mermaid-canvas";
  stage.appendChild(canvas);
  const dims = measureSvgDimensions(sourceSvg);
  const mountLiveClone = () => {
    canvas.textContent = "";
    const nextClone = cloneSvgWithScopedId(sourceSvg, "qs-live");
    nextClone.setAttribute("width", String(dims.width));
    nextClone.setAttribute("height", String(dims.height));
    nextClone.style.width = `${dims.width}px`;
    nextClone.style.height = `${dims.height}px`;
    nextClone.style.maxWidth = "none";
    nextClone.style.maxHeight = "none";
    nextClone.style.display = "block";
    if (bgMode === "white" && isDarkThemeDocument(doc) && sourceSvg.isConnected) {
      adaptSvgForWhiteBackground(sourceSvg, nextClone, win);
    }
    canvas.appendChild(nextClone);
    return nextClone;
  };
  let liveClone = mountLiveClone();
  const footer = doc.createElement("div");
  footer.className = "qs-wb-footer";
  const footerLeft = doc.createElement("span");
  footerLeft.textContent = `${title} \xB7 ${dims.width} \xD7 ${dims.height}px`;
  const footerRight = doc.createElement("span");
  footerRight.textContent = t(
    "\u6EDA\u8F6E\u7F29\u653E \xB7 \u5DE6\u952E\u62D6\u62FD \xB7 +/-/0/F/W/M \xB7 \u2318F \u641C\u8282\u70B9 \xB7 Esc \u5173\u95ED",
    "Wheel zoom \xB7 Drag pan \xB7 +/-/0/F/W/M \xB7 \u2318F search \xB7 Esc close"
  );
  footer.append(footerLeft, footerRight);
  modal.appendChild(footer);
  doc.body.appendChild(overlay);
  const getBounds = () => ({
    stageWidth: stage.clientWidth || win.innerWidth || 900,
    stageHeight: stage.clientHeight || win.innerHeight || 600,
    contentWidth: dims.width,
    contentHeight: dims.height
  });
  let state = computeFitViewport(getBounds());
  let minimapVisible = settings.showMinimap;
  let minimap = null;
  const renderViewport = () => {
    canvas.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) scale(${state.scale})`;
    zoomReadout.textContent = `${Math.round(state.scale * 100)}%`;
    minimap?.sync(state, getBounds());
  };
  minimap = createMermaidMinimap(doc, sourceSvg, (rx, ry) => {
    const b = getBounds();
    state = centerOnContentPoint(rx * b.contentWidth, ry * b.contentHeight, b, state.scale);
    renderViewport();
  });
  minimap.setVisible(minimapVisible);
  stage.appendChild(minimap.element);
  let indexedNodes = extractDiagramSearchNodes(liveClone);
  let matchedNodes = [];
  let matchIdx = -1;
  const focusMatch = () => {
    if (!matchedNodes.length) return;
    for (let i = 0; i < matchedNodes.length; i++) {
      matchedNodes[i].element.classList.toggle("qs-wb-node-current", i === matchIdx);
    }
    const target = matchedNodes[matchIdx];
    const center = getNodeCenterInSvg(target.element, liveClone, dims.width, dims.height);
    const b = getBounds();
    state = centerOnContentPoint(center.x, center.y, b, Math.max(state.scale, 1.25));
    matchStat.textContent = `${matchIdx + 1} / ${matchedNodes.length}`;
    renderViewport();
  };
  const applySearch = () => {
    const q = searchInput.value.trim();
    for (const item of indexedNodes) {
      item.element.classList.remove("qs-wb-node-dim", "qs-wb-node-match", "qs-wb-node-current");
    }
    if (!q) {
      matchedNodes = [];
      matchIdx = -1;
      matchStat.textContent = "";
      return;
    }
    matchedNodes = filterDiagramNodes(indexedNodes, q);
    const matchSet = new Set(matchedNodes.map((m) => m.element));
    for (const item of indexedNodes) {
      if (matchSet.has(item.element)) item.element.classList.add("qs-wb-node-match");
      else item.element.classList.add("qs-wb-node-dim");
    }
    if (matchedNodes.length) {
      matchIdx = 0;
      focusMatch();
    } else {
      matchIdx = -1;
      matchStat.textContent = "0 / 0";
    }
  };
  const doZoom = (factor) => {
    const b = getBounds();
    state = zoomAtPoint(state, factor, b.stageWidth / 2, b.stageHeight / 2, b);
    renderViewport();
  };
  btnIn.addEventListener("click", () => doZoom(1.25));
  btnOut.addEventListener("click", () => doZoom(0.8));
  btnFit.addEventListener("click", () => {
    state = computeFitViewport(getBounds());
    renderViewport();
  });
  btnFitW.addEventListener("click", () => {
    state = computeFitWidthViewport(getBounds());
    renderViewport();
  });
  btnReset.addEventListener("click", () => {
    const b = getBounds();
    state = centerOnContentPoint(b.contentWidth / 2, b.contentHeight / 2, b, 1);
    renderViewport();
  });
  btnBg.addEventListener("click", () => {
    bgMode = BG_ORDER[(BG_ORDER.indexOf(bgMode) + 1) % BG_ORDER.length];
    stage.dataset.bg = bgMode;
    const lbl = btnBg.querySelector(".qs-wb-btn-label");
    if (lbl) lbl.textContent = bgLabel(bgMode);
    if (isDarkThemeDocument(doc) && sourceSvg.isConnected) {
      liveClone = mountLiveClone();
      indexedNodes = extractDiagramSearchNodes(liveClone);
      if (searchInput.value.trim()) applySearch();
    }
  });
  btnMinimap.addEventListener("click", () => {
    minimapVisible = !minimapVisible;
    btnMinimap.classList.toggle("is-active", minimapVisible);
    minimap?.setVisible(minimapVisible);
    if (minimapVisible) minimap?.sync(state, getBounds());
  });
  searchInput.addEventListener("input", applySearch);
  searchInput.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter" && matchedNodes.length) {
      evt.preventDefault();
      matchIdx = evt.shiftKey ? (matchIdx - 1 + matchedNodes.length) % matchedNodes.length : (matchIdx + 1) % matchedNodes.length;
      focusMatch();
    }
  });
  btnNext.addEventListener("click", () => {
    if (!matchedNodes.length) return;
    matchIdx = (matchIdx + 1) % matchedNodes.length;
    focusMatch();
  });
  btnPrev.addEventListener("click", () => {
    if (!matchedNodes.length) return;
    matchIdx = (matchIdx - 1 + matchedNodes.length) % matchedNodes.length;
    focusMatch();
  });
  const safeSlug = title.replace(/[^\w\u4e00-\u9fff-]+/g, "-").replace(/^-+|-+$/g, "") || "diagram";
  const getExportSource = () => sourceSvg.isConnected ? sourceSvg : liveClone;
  btnDlSvg.addEventListener("click", () => {
    try {
      const { svgString } = buildStandaloneSvgString(getExportSource(), bgMode);
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      triggerBlobDownload(doc, blob, `${safeSlug}.svg`);
      new import_obsidian7.Notice(t("\u5DF2\u5BFC\u51FA\u9AD8\u4FDD\u771F SVG", "Exported styled SVG"));
    } catch {
      new import_obsidian7.Notice(t("SVG \u5BFC\u51FA\u5931\u8D25", "Failed to export SVG"));
    }
  });
  const exportPng = async (copyOnly) => {
    try {
      const { blob, scale, clamped } = await renderSvgToPngBlob(getExportSource(), bgMode, settings.pngScale);
      if (copyOnly) {
        const copied = await copyPngBlobToClipboard(win, blob);
        if (copied) {
          new import_obsidian7.Notice(
            clamped ? t(`\u5DF2\u590D\u5236 ${scale}\xD7 PNG\uFF08\u8D85\u5927\u56FE\u81EA\u52A8\u964D\u6863\uFF09`, `Copied ${scale}x PNG (auto-clamped for large diagram)`) : t(`\u5DF2\u590D\u5236 ${scale}\xD7 \u9AD8\u6E05 PNG \u5230\u526A\u8D34\u677F`, `Copied ${scale}x PNG to clipboard`)
          );
          return;
        }
        triggerBlobDownload(doc, blob, `${safeSlug}-${scale}x.png`);
        new import_obsidian7.Notice(t("\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u526A\u8D34\u677F\u5199\u56FE\uFF0C\u5DF2\u81EA\u52A8\u4E0B\u8F7D PNG", "Clipboard image write unavailable; downloaded PNG instead"));
        return;
      }
      triggerBlobDownload(doc, blob, `${safeSlug}-${scale}x.png`);
      new import_obsidian7.Notice(
        clamped ? t(`\u5DF2\u4E0B\u8F7D ${scale}\xD7 PNG\uFF08\u8D85\u5927\u56FE\u81EA\u52A8\u964D\u6863\uFF09`, `Downloaded ${scale}x PNG (auto-clamped)`) : t(`\u5DF2\u4E0B\u8F7D ${scale}\xD7 \u9AD8\u6E05 PNG`, `Downloaded ${scale}x PNG`)
      );
    } catch {
      new import_obsidian7.Notice(t("PNG \u6E32\u67D3\u53D7\u9650\uFF0C\u5EFA\u8BAE\u4F7F\u7528\u300C\u5BFC\u51FA SVG\u300D", "PNG rendering restricted; try Export SVG instead"));
    }
  };
  btnCopyPng.addEventListener("click", () => {
    void exportPng(true);
  });
  btnDlPng.addEventListener("click", () => {
    void exportPng(false);
  });
  const activePointers = /* @__PURE__ */ new Map();
  let panStart = null;
  let lastPinchDist = 0;
  const onPointerDown = (evt) => {
    if (evt.target?.closest?.(".qs-wb-minimap")) return;
    activePointers.set(evt.pointerId, { x: evt.clientX, y: evt.clientY });
    if (activePointers.size === 1) {
      panStart = { x: evt.clientX, y: evt.clientY, ox: state.x, oy: state.y };
      stage.classList.add("is-dragging");
    } else if (activePointers.size === 2) {
      panStart = null;
      const pts = Array.from(activePointers.values());
      lastPinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    }
  };
  const onPointerMove = (evt) => {
    if (!activePointers.has(evt.pointerId)) return;
    activePointers.set(evt.pointerId, { x: evt.clientX, y: evt.clientY });
    if (activePointers.size === 1 && panStart) {
      state = clampPan(
        {
          scale: state.scale,
          x: panStart.ox + (evt.clientX - panStart.x),
          y: panStart.oy + (evt.clientY - panStart.y)
        },
        getBounds()
      );
      renderViewport();
    } else if (activePointers.size === 2) {
      const pts = Array.from(activePointers.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      if (lastPinchDist > 0 && dist > 0) {
        const rect = stage.getBoundingClientRect();
        const midX = (pts[0].x + pts[1].x) / 2 - rect.left;
        const midY = (pts[0].y + pts[1].y) / 2 - rect.top;
        state = zoomAtPoint(state, dist / lastPinchDist, midX, midY, getBounds());
        renderViewport();
      }
      lastPinchDist = dist;
    }
  };
  const onPointerUp = (evt) => {
    activePointers.delete(evt.pointerId);
    if (activePointers.size < 2) lastPinchDist = 0;
    if (activePointers.size === 0) {
      panStart = null;
      stage.classList.remove("is-dragging");
    }
  };
  const onWheel = (evt) => {
    if (settings.wheelZoomMode === "ctrl" && !evt.ctrlKey && !evt.metaKey) return;
    evt.preventDefault();
    const rect = stage.getBoundingClientRect();
    const factor = evt.deltaY < 0 ? 1.14 : 0.88;
    state = zoomAtPoint(state, factor, evt.clientX - rect.left, evt.clientY - rect.top, getBounds());
    renderViewport();
  };
  const onKeyDown = (evt) => {
    if (evt.key === "Escape") {
      evt.preventDefault();
      evt.stopPropagation();
      close();
      return;
    }
    if ((evt.metaKey || evt.ctrlKey) && evt.key.toLowerCase() === "f") {
      evt.preventDefault();
      searchInput.focus();
      searchInput.select();
      return;
    }
    if (doc.activeElement === searchInput) return;
    if (evt.key === "+" || evt.key === "=") {
      evt.preventDefault();
      doZoom(1.25);
    } else if (evt.key === "-") {
      evt.preventDefault();
      doZoom(0.8);
    } else if (evt.key === "0") {
      evt.preventDefault();
      btnReset.click();
    } else if (evt.key.toLowerCase() === "f") {
      evt.preventDefault();
      btnFit.click();
    } else if (evt.key.toLowerCase() === "w") {
      evt.preventDefault();
      btnFitW.click();
    } else if (evt.key.toLowerCase() === "m") {
      evt.preventDefault();
      btnMinimap.click();
    }
  };
  const onOverlayClick = (evt) => {
    if (evt.target === overlay) close();
  };
  const onResize = () => {
    state = clampPan(state, getBounds());
    renderViewport();
  };
  stage.addEventListener("pointerdown", onPointerDown);
  win.addEventListener("pointermove", onPointerMove);
  win.addEventListener("pointerup", onPointerUp);
  win.addEventListener("pointercancel", onPointerUp);
  stage.addEventListener("wheel", onWheel, { passive: false });
  win.addEventListener("keydown", onKeyDown, true);
  win.addEventListener("resize", onResize);
  overlay.addEventListener("click", onOverlayClick);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    stage.removeEventListener("pointerdown", onPointerDown);
    win.removeEventListener("pointermove", onPointerMove);
    win.removeEventListener("pointerup", onPointerUp);
    win.removeEventListener("pointercancel", onPointerUp);
    stage.removeEventListener("wheel", onWheel);
    win.removeEventListener("keydown", onKeyDown, true);
    win.removeEventListener("resize", onResize);
    overlay.removeEventListener("click", onOverlayClick);
    minimap?.destroy();
    minimap = null;
    overlay.remove();
    prevFocused?.focus?.();
    onClose?.();
  };
  btnClose.addEventListener("click", close);
  win.requestAnimationFrame(() => {
    state = computeFitViewport(getBounds());
    renderViewport();
    overlay.focus();
  });
  return { close };
}

// src/table/table-modal.ts
var import_obsidian8 = require("obsidian");

// src/table/table-query.ts
var zhCollator = new Intl.Collator("zh-Hans-CN", {
  numeric: true,
  sensitivity: "base"
});
function compareCellValues(aRaw, bRaw, type) {
  const a = aRaw.trim();
  const b = bRaw.trim();
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  if (type === "number" || type === "percent") {
    const an = parseNumericValue(a);
    const bn = parseNumericValue(b);
    if (an !== null && bn !== null) return an - bn;
    if (an !== null) return -1;
    if (bn !== null) return 1;
  }
  if (type === "date") {
    const ad = parseDateTimestamp(a);
    const bd = parseDateTimestamp(b);
    if (ad !== null && bd !== null) return ad - bd;
    if (ad !== null) return -1;
    if (bd !== null) return 1;
  }
  if (type === "semver") {
    const av = parseSemverTuple(a);
    const bv = parseSemverTuple(b);
    if (av && bv) {
      const len = Math.max(av.length, bv.length);
      for (let i = 0; i < len; i++) {
        const diff = (av[i] ?? 0) - (bv[i] ?? 0);
        if (diff !== 0) return diff;
      }
      return zhCollator.compare(a, b);
    }
  }
  return zhCollator.compare(a, b);
}
function queryTableRows(grid, query) {
  const globalTerms = query.globalQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const activeColFilters = Object.entries(query.columnFilters).map(([k, v]) => [Number(k), v.trim().toLowerCase()]).filter(([, v]) => Boolean(v));
  let result = grid.rows.filter((row) => {
    if (globalTerms.length > 0) {
      const joined = row.cells.map((c) => c.text).join(" ").toLowerCase();
      for (const term of globalTerms) {
        if (!joined.includes(term)) return false;
      }
    }
    for (const [colIdx, filterVal] of activeColFilters) {
      const cellText = (row.cells[colIdx]?.text ?? "").toLowerCase();
      if (filterVal.startsWith("!")) {
        const neg = filterVal.slice(1).trim();
        if (neg && cellText.includes(neg)) return false;
      } else if (!cellText.includes(filterVal)) {
        return false;
      }
    }
    return true;
  });
  if (query.sort && !grid.hasSpans) {
    const { colIndex, direction } = query.sort;
    const colType = grid.columns[colIndex]?.type ?? "text";
    const mult = direction === "asc" ? 1 : -1;
    result = [...result].sort((ra, rb) => {
      const av = ra.cells[colIndex]?.text ?? "";
      const bv = rb.cells[colIndex]?.text ?? "";
      const aEmpty = !av.trim();
      const bEmpty = !bv.trim();
      if (aEmpty && bEmpty) return ra.rowIndex - rb.rowIndex;
      if (aEmpty) return 1;
      if (bEmpty) return -1;
      const cmp = compareCellValues(av, bv, colType);
      return cmp !== 0 ? cmp * mult : ra.rowIndex - rb.rowIndex;
    });
  }
  return result;
}

// src/table/table-virtual.ts
var VIRTUAL_ROW_HEIGHT = 34;
var VIRTUAL_OVERSCAN = 8;
function computeVirtualRange(totalRows, scrollTop, viewportHeight, rowHeight = VIRTUAL_ROW_HEIGHT, overscan = VIRTUAL_OVERSCAN) {
  if (totalRows <= 0) {
    return { start: 0, end: 0, topSpacerHeight: 0, bottomSpacerHeight: 0 };
  }
  const safeRowH = Math.max(16, rowHeight);
  const safeVpH = Math.max(safeRowH, viewportHeight);
  const firstVisible = Math.floor(Math.max(0, scrollTop) / safeRowH);
  const visibleCount = Math.ceil(safeVpH / safeRowH);
  const start = Math.max(0, firstVisible - overscan);
  const end = Math.min(totalRows, firstVisible + visibleCount + overscan);
  return {
    start,
    end,
    topSpacerHeight: start * safeRowH,
    bottomSpacerHeight: Math.max(0, (totalRows - end) * safeRowH)
  };
}

// src/table/table-modal.ts
function openTableWorkbench(sourceTable, settings, titleOrOptions = "Table", legacyOnClose) {
  const opts = typeof titleOrOptions === "string" ? { title: titleOrOptions, onClose: legacyOnClose } : titleOrOptions;
  const title = opts.title || "Table";
  const onClose = opts.onClose;
  const onOpenInternalLink = opts.onOpenInternalLink;
  const doc = sourceTable.ownerDocument || document;
  const win = doc.defaultView || window;
  const prevFocused = doc.activeElement;
  const grid = extractTableGrid(sourceTable);
  let globalQuery = "";
  const columnFilters = {};
  let sortSpec = null;
  const visibleCols = new Set(grid.columns.map((c) => c.index));
  const colWidths = /* @__PURE__ */ new Map();
  let freezeFirst = settings.defaultFreezeFirstCol;
  let showColFilterRow = false;
  let selectedFilteredIdx = 0;
  let filteredRows = grid.rows;
  const overlay = doc.createElement("div");
  overlay.className = "qs-wb-overlay qs-wb-table-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", t("\u5BBD\u8868\u5168\u5C4F\u5DE5\u4F5C\u53F0", "Wide-table workbench"));
  overlay.tabIndex = -1;
  const modal = doc.createElement("div");
  modal.className = "qs-wb-modal qs-wb-table-modal";
  overlay.appendChild(modal);
  const toolbar = doc.createElement("div");
  toolbar.className = "qs-wb-toolbar";
  modal.appendChild(toolbar);
  const leftGroup = doc.createElement("div");
  leftGroup.className = "qs-wb-group";
  const rightGroup = doc.createElement("div");
  rightGroup.className = "qs-wb-group";
  toolbar.append(leftGroup, rightGroup);
  const searchInput = doc.createElement("input");
  searchInput.type = "search";
  searchInput.className = "qs-wb-input qs-wb-table-search";
  searchInput.placeholder = t("\u5168\u8868\u68C0\u7D22 (\u2318F\uFF0C\u652F\u6301\u7A7A\u683C\u591A\u8BCD)", "Search all cells (\u2318F)");
  const statBadge = doc.createElement("span");
  statBadge.className = "qs-wb-meta";
  const btnColFilter = createIconButton(
    doc,
    "filter",
    t("\u5F00\u542F/\u9690\u85CF\u5217\u7EA7\u7B5B\u9009\u884C", "Toggle per-column filter row"),
    t("\u5217\u7B5B\u9009", "Column filter")
  );
  const btnClear = createIconButton(doc, "eraser", t("\u6E05\u7A7A\u7B5B\u9009\u4E0E\u6392\u5E8F", "Reset filters & sort"), t("\u91CD\u7F6E", "Reset"));
  leftGroup.append(searchInput, statBadge, btnColFilter, btnClear);
  const btnFreeze = createIconButton(doc, "pin", t("\u51BB\u7ED3\u9996\u5217", "Freeze first column"), t("\u51BB\u9996\u5217", "Freeze 1st"));
  btnFreeze.classList.toggle("is-active", freezeFirst);
  const btnCols = createIconButton(doc, "columns", t("\u663E\u793A/\u9690\u85CF\u5217", "Toggle columns"), t("\u5217\u663E\u9690", "Columns"));
  const btnDrawer = createIconButton(doc, "panel-right", t("\u5F00\u5173\u5355\u884C\u7AD6\u6392\u8BE6\u60C5\u62BD\u5C49", "Toggle row detail drawer"), t("\u884C\u8BE6\u60C5", "Details"));
  btnDrawer.classList.add("is-active");
  const btnTsv = createIconButton(doc, "copy", t("\u590D\u5236 TSV\uFF08\u76F4\u8D34 Excel/\u9489\u9489/\u98DE\u4E66\uFF09", "Copy TSV (Excel/Sheet ready)"), "TSV");
  const btnCsv = createIconButton(doc, "download", t("\u4E0B\u8F7D UTF-8 BOM CSV", "Download UTF-8 BOM CSV"), "CSV");
  const btnMd = createIconButton(doc, "file-text", t("\u590D\u5236 Markdown \u7B5B\u9009\u5B50\u8868", "Copy filtered Markdown table"), "MD");
  const btnClose = createIconButton(doc, "x", t("\u5173\u95ED (Esc)", "Close (Esc)"));
  rightGroup.append(btnFreeze, btnCols, btnDrawer, btnTsv, btnCsv, btnMd, btnClose);
  const colMenu = doc.createElement("div");
  colMenu.className = "qs-wb-col-menu";
  modal.appendChild(colMenu);
  const body = doc.createElement("div");
  body.className = "qs-wb-table-body";
  modal.appendChild(body);
  const gridWrap = doc.createElement("div");
  gridWrap.className = "qs-wb-grid-wrap";
  body.appendChild(gridWrap);
  const tableEl = doc.createElement("table");
  tableEl.className = "qs-wb-grid-table";
  if (freezeFirst) tableEl.classList.add("is-freeze-first");
  const theadEl = doc.createElement("thead");
  const tbodyEl = doc.createElement("tbody");
  tableEl.append(theadEl, tbodyEl);
  gridWrap.appendChild(tableEl);
  const drawer = doc.createElement("aside");
  drawer.className = "qs-wb-drawer";
  const drawerHead = doc.createElement("div");
  drawerHead.className = "qs-wb-drawer-head";
  const drawerTitle = doc.createElement("span");
  drawerTitle.textContent = t("\u5355\u884C\u7AD6\u6392\u8BE6\u60C5", "Row detail");
  const drawerCloseBtn = createIconButton(doc, "x", t("\u6536\u8D77\u8BE6\u60C5\u62BD\u5C49", "Close drawer"));
  drawerHead.append(drawerTitle, drawerCloseBtn);
  const drawerList = doc.createElement("div");
  drawerList.className = "qs-wb-drawer-list";
  drawer.append(drawerHead, drawerList);
  body.appendChild(drawer);
  const footer = doc.createElement("div");
  footer.className = "qs-wb-footer";
  const footerLeft = doc.createElement("span");
  footerLeft.textContent = grid.hasSpans ? t(`${title} \xB7 \u68C0\u6D4B\u5230\u5408\u5E76\u5355\u5143\u683C\uFF0C\u5DF2\u542F\u7528\u53EA\u8BFB\u4FDD\u62A4\uFF08\u7981\u7528\u6392\u5E8F\uFF09`, `${title} \xB7 Merged cells detected; sorting disabled for safety`) : `${title} \xB7 ${t("\u70B9\u51FB\u8868\u5934\u667A\u80FD\u6392\u5E8F \xB7 \u62D6\u62FD\u8868\u5934\u53F3\u7F18\u8C03\u5BBD \xB7 \u539F\u59CB\u7B14\u8BB0\u96F6\u6539\u52A8", "Click headers to sort \xB7 Drag edges to resize \xB7 Source note untouched")}`;
  const footerRight = doc.createElement("span");
  footerRight.textContent = t("\u2191/\u2193 \u5207\u6362\u884C \xB7 \u2318F \u68C0\u7D22 \xB7 Esc \u5173\u95ED", "\u2191/\u2193 rows \xB7 \u2318F search \xB7 Esc close");
  footer.append(footerLeft, footerRight);
  modal.appendChild(footer);
  doc.body.appendChild(overlay);
  const getActiveCols = () => grid.columns.filter((c) => visibleCols.has(c.index));
  const renderDrawer = (row) => {
    drawerList.empty?.();
    if (!drawerList.empty) drawerList.textContent = "";
    if (!row) {
      drawerTitle.textContent = t("\u65E0\u5339\u914D\u884C", "No matching row");
      return;
    }
    drawerTitle.textContent = `${t("\u7B2C", "Row #")} ${row.rowIndex + 1} ${t("\u884C", "")}`.trim();
    for (const col of grid.columns) {
      const cell = row.cells[col.index] ?? { text: "", links: [] };
      const card = doc.createElement("div");
      card.className = "qs-wb-field-card";
      const top = doc.createElement("div");
      top.className = "qs-wb-field-top";
      const keyEl = doc.createElement("span");
      keyEl.className = "qs-wb-field-k";
      keyEl.textContent = col.label;
      const copyBtn = doc.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "qs-wb-mini-copy";
      copyBtn.textContent = t("\u590D\u5236", "Copy");
      copyBtn.addEventListener("click", async () => {
        try {
          await (win.navigator?.clipboard || navigator.clipboard).writeText(cell.text);
          new import_obsidian8.Notice(t(`\u5DF2\u590D\u5236\u300C${col.label}\u300D`, `Copied "${col.label}"`));
        } catch {
          new import_obsidian8.Notice(t("\u590D\u5236\u5931\u8D25", "Copy failed"));
        }
      });
      top.append(keyEl, copyBtn);
      const valEl = doc.createElement("div");
      valEl.className = "qs-wb-field-v";
      valEl.textContent = cell.text || "\u2014";
      card.append(top, valEl);
      if (cell.links.length > 0) {
        const linksBar = doc.createElement("div");
        linksBar.className = "qs-wb-field-links";
        for (const link of cell.links) {
          const a = doc.createElement("a");
          a.className = link.isInternal ? "qs-wb-link is-internal" : "qs-wb-link is-external";
          a.textContent = link.text;
          if (link.isInternal) {
            a.href = "#";
            a.addEventListener("click", (evt) => {
              evt.preventDefault();
              close();
              onOpenInternalLink?.(link.href);
            });
          } else {
            a.href = link.href;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
          }
          linksBar.appendChild(a);
        }
        card.appendChild(linksBar);
      }
      drawerList.appendChild(card);
    }
  };
  let lastRenderedRange = "";
  const syncSelectedRowHighlight = () => {
    const prev = tbodyEl.querySelector("tr.qs-wb-data-row.is-selected");
    prev?.classList.remove("is-selected");
    const next = tbodyEl.querySelector(`tr.qs-wb-data-row[data-fidx="${selectedFilteredIdx}"]`);
    next?.classList.add("is-selected");
  };
  const renderBodyRows = (force = false) => {
    const activeCols = getActiveCols();
    const useVirtual = filteredRows.length >= settings.virtualScrollThreshold;
    const vpH = gridWrap.clientHeight || 480;
    const range = useVirtual ? computeVirtualRange(filteredRows.length, gridWrap.scrollTop, vpH, VIRTUAL_ROW_HEIGHT) : { start: 0, end: filteredRows.length, topSpacerHeight: 0, bottomSpacerHeight: 0 };
    const rangeKey = `${range.start}:${range.end}:${activeCols.map((c) => c.index).join(",")}:${filteredRows.length}`;
    if (!force && rangeKey === lastRenderedRange) {
      syncSelectedRowHighlight();
      return;
    }
    lastRenderedRange = rangeKey;
    tbodyEl.textContent = "";
    if (range.topSpacerHeight > 0) {
      const trTop = doc.createElement("tr");
      trTop.className = "qs-wb-spacer-row";
      const tdTop = doc.createElement("td");
      tdTop.colSpan = Math.max(1, activeCols.length);
      tdTop.style.height = `${range.topSpacerHeight}px`;
      trTop.appendChild(tdTop);
      tbodyEl.appendChild(trTop);
    }
    const frag = doc.createDocumentFragment();
    for (let i = range.start; i < range.end; i++) {
      const row = filteredRows[i];
      const tr = doc.createElement("tr");
      tr.className = "qs-wb-data-row";
      if (i === selectedFilteredIdx) tr.classList.add("is-selected");
      tr.dataset.fidx = String(i);
      for (const col of activeCols) {
        const td = doc.createElement("td");
        const cell = row.cells[col.index] ?? { text: "", links: [] };
        td.textContent = cell.text;
        td.title = cell.text;
        const w = colWidths.get(col.index);
        if (w) {
          td.style.width = `${w}px`;
          td.style.minWidth = `${w}px`;
          td.style.maxWidth = `${w}px`;
        }
        tr.appendChild(td);
      }
      frag.appendChild(tr);
    }
    tbodyEl.appendChild(frag);
    if (range.bottomSpacerHeight > 0) {
      const trBot = doc.createElement("tr");
      trBot.className = "qs-wb-spacer-row";
      const tdBot = doc.createElement("td");
      tdBot.colSpan = Math.max(1, activeCols.length);
      tdBot.style.height = `${range.bottomSpacerHeight}px`;
      trBot.appendChild(tdBot);
      tbodyEl.appendChild(trBot);
    }
  };
  let resizeCleanup = null;
  const renderHeader = () => {
    const activeCols = getActiveCols();
    theadEl.textContent = "";
    const headTr = doc.createElement("tr");
    for (const col of activeCols) {
      const th = doc.createElement("th");
      th.className = "qs-wb-th";
      const w = colWidths.get(col.index);
      if (w) {
        th.style.width = `${w}px`;
        th.style.minWidth = `${w}px`;
        th.style.maxWidth = `${w}px`;
      }
      const inner = doc.createElement("div");
      inner.className = "qs-wb-th-inner";
      const labelSpan = doc.createElement("span");
      labelSpan.className = "qs-wb-th-label";
      labelSpan.textContent = col.label;
      const sortSpan = doc.createElement("span");
      sortSpan.className = "qs-wb-sort-ind";
      if (sortSpec && sortSpec.colIndex === col.index) {
        sortSpan.textContent = sortSpec.direction === "asc" ? "\u25B2" : "\u25BC";
      }
      inner.append(labelSpan, sortSpan);
      th.appendChild(inner);
      if (!grid.hasSpans) {
        th.addEventListener("click", (evt) => {
          if (evt.target?.classList?.contains("qs-wb-col-resizer")) return;
          if (sortSpec && sortSpec.colIndex === col.index) {
            if (sortSpec.direction === "asc") sortSpec = { colIndex: col.index, direction: "desc" };
            else sortSpec = null;
          } else {
            sortSpec = { colIndex: col.index, direction: "asc" };
          }
          refreshData();
        });
      }
      const resizer = doc.createElement("span");
      resizer.className = "qs-wb-col-resizer";
      resizer.title = t("\u62D6\u62FD\u8C03\u6574\u5217\u5BBD\uFF0C\u53CC\u51FB\u8FD8\u539F\u9ED8\u8BA4", "Drag to resize column, double-click to reset");
      resizer.addEventListener("dblclick", (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        colWidths.delete(col.index);
        renderHeader();
        renderBodyRows(true);
      });
      resizer.addEventListener("pointerdown", (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        const startX = evt.clientX;
        const startW = th.getBoundingClientRect().width || 120;
        const onMove = (mEvt) => {
          const nextW = Math.max(64, Math.min(600, Math.round(startW + (mEvt.clientX - startX))));
          colWidths.set(col.index, nextW);
          th.style.width = `${nextW}px`;
          th.style.minWidth = `${nextW}px`;
          th.style.maxWidth = `${nextW}px`;
          renderBodyRows(true);
        };
        const onUp = () => {
          win.removeEventListener("pointermove", onMove);
          win.removeEventListener("pointerup", onUp);
          resizeCleanup = null;
        };
        resizeCleanup = onUp;
        win.addEventListener("pointermove", onMove);
        win.addEventListener("pointerup", onUp);
      });
      th.appendChild(resizer);
      headTr.appendChild(th);
    }
    theadEl.appendChild(headTr);
    if (showColFilterRow) {
      const filterTr = doc.createElement("tr");
      filterTr.className = "qs-wb-col-filter-row";
      for (const col of activeCols) {
        const th = doc.createElement("th");
        const inp = doc.createElement("input");
        inp.type = "search";
        inp.className = "qs-wb-col-filter-input";
        inp.placeholder = t("\u7B5B\u9009 (!\u6392\u9664)", "Filter (!exclude)");
        inp.value = columnFilters[col.index] ?? "";
        inp.addEventListener("input", () => {
          columnFilters[col.index] = inp.value;
          refreshData(false);
        });
        th.appendChild(inp);
        filterTr.appendChild(th);
      }
      theadEl.appendChild(filterTr);
    }
  };
  const renderColMenu = () => {
    colMenu.textContent = "";
    for (const col of grid.columns) {
      const lbl = doc.createElement("label");
      lbl.className = "qs-wb-col-item";
      const cb = doc.createElement("input");
      cb.type = "checkbox";
      cb.checked = visibleCols.has(col.index);
      cb.addEventListener("change", () => {
        if (cb.checked) visibleCols.add(col.index);
        else if (visibleCols.size > 1) visibleCols.delete(col.index);
        else {
          cb.checked = true;
          return;
        }
        renderHeader();
        renderBodyRows(true);
        updateStats();
      });
      const span = doc.createElement("span");
      span.textContent = col.label;
      lbl.append(cb, span);
      colMenu.appendChild(lbl);
    }
  };
  const updateStats = () => {
    const activeCount = visibleCols.size;
    statBadge.textContent = t(
      `${filteredRows.length} / ${grid.rows.length} \u884C \xB7 ${activeCount}/${grid.columns.length} \u5217`,
      `${filteredRows.length} / ${grid.rows.length} rows \xB7 ${activeCount}/${grid.columns.length} cols`
    );
  };
  const refreshData = (rebuildHeader = true) => {
    filteredRows = queryTableRows(grid, {
      globalQuery,
      columnFilters,
      sort: sortSpec
    });
    if (selectedFilteredIdx >= filteredRows.length) {
      selectedFilteredIdx = Math.max(0, filteredRows.length - 1);
    }
    gridWrap.scrollTop = 0;
    if (rebuildHeader) renderHeader();
    updateStats();
    renderBodyRows(true);
    renderDrawer(filteredRows[selectedFilteredIdx]);
  };
  searchInput.addEventListener("input", () => {
    globalQuery = searchInput.value;
    refreshData(false);
  });
  btnColFilter.addEventListener("click", () => {
    showColFilterRow = !showColFilterRow;
    btnColFilter.classList.toggle("is-active", showColFilterRow);
    renderHeader();
  });
  btnClear.addEventListener("click", () => {
    globalQuery = "";
    searchInput.value = "";
    for (const k of Object.keys(columnFilters)) delete columnFilters[Number(k)];
    sortSpec = null;
    refreshData(true);
  });
  btnFreeze.addEventListener("click", () => {
    freezeFirst = !freezeFirst;
    btnFreeze.classList.toggle("is-active", freezeFirst);
    tableEl.classList.toggle("is-freeze-first", freezeFirst);
  });
  btnCols.addEventListener("click", (evt) => {
    evt.stopPropagation();
    colMenu.classList.toggle("is-open");
  });
  const toggleDrawer = (open) => {
    const next = open === void 0 ? drawer.classList.contains("is-closed") : open;
    drawer.classList.toggle("is-closed", !next);
    btnDrawer.classList.toggle("is-active", next);
  };
  btnDrawer.addEventListener("click", () => toggleDrawer());
  drawerCloseBtn.addEventListener("click", () => toggleDrawer(false));
  tbodyEl.addEventListener("click", (evt) => {
    const tr = evt.target?.closest?.("tr.qs-wb-data-row");
    if (!tr || tr.dataset.fidx === void 0) return;
    selectedFilteredIdx = Number(tr.dataset.fidx);
    toggleDrawer(true);
    syncSelectedRowHighlight();
    renderDrawer(filteredRows[selectedFilteredIdx]);
  });
  const onScroll = () => {
    renderBodyRows(false);
  };
  gridWrap.addEventListener("scroll", onScroll, { passive: true });
  const safeSlug = title.replace(/[^\w\u4e00-\u9fff-]+/g, "-").replace(/^-+|-+$/g, "") || "table";
  const getVisibleIds = () => getActiveCols().map((c) => c.index);
  btnTsv.addEventListener("click", async () => {
    try {
      const tsv = serializeToTsv(grid.columns, filteredRows, getVisibleIds());
      await (win.navigator?.clipboard || navigator.clipboard).writeText(tsv);
      new import_obsidian8.Notice(t(`\u5DF2\u590D\u5236 ${filteredRows.length} \u884C TSV`, `Copied ${filteredRows.length} rows as TSV`));
    } catch {
      new import_obsidian8.Notice(t("\u590D\u5236 TSV \u5931\u8D25", "Failed to copy TSV"));
    }
  });
  btnCsv.addEventListener("click", () => {
    const csv = serializeToCsv(grid.columns, filteredRows, getVisibleIds(), true);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    triggerBlobDownload(doc, blob, `${safeSlug}.csv`);
    new import_obsidian8.Notice(t(`\u5DF2\u5BFC\u51FA ${filteredRows.length} \u884C CSV (UTF-8 BOM)`, `Exported ${filteredRows.length} rows as CSV`));
  });
  btnMd.addEventListener("click", async () => {
    try {
      const md = serializeToMarkdown(grid.columns, filteredRows, getVisibleIds());
      await (win.navigator?.clipboard || navigator.clipboard).writeText(md);
      new import_obsidian8.Notice(t(`\u5DF2\u590D\u5236 ${filteredRows.length} \u884C Markdown \u5B50\u8868`, `Copied ${filteredRows.length} rows as Markdown`));
    } catch {
      new import_obsidian8.Notice(t("\u590D\u5236 Markdown \u5931\u8D25", "Failed to copy Markdown"));
    }
  });
  const onKeyDown = (evt) => {
    if (evt.key === "Escape") {
      evt.preventDefault();
      evt.stopPropagation();
      if (colMenu.classList.contains("is-open")) {
        colMenu.classList.remove("is-open");
        return;
      }
      close();
      return;
    }
    if ((evt.metaKey || evt.ctrlKey) && evt.key.toLowerCase() === "f") {
      evt.preventDefault();
      searchInput.focus();
      searchInput.select();
      return;
    }
    const activeTag = (doc.activeElement?.tagName || "").toLowerCase();
    if (activeTag === "input" || activeTag === "textarea") return;
    const ensureSelectedVisible = () => {
      const rowTop = selectedFilteredIdx * VIRTUAL_ROW_HEIGHT;
      const rowBottom = rowTop + VIRTUAL_ROW_HEIGHT;
      const headH = theadEl.getBoundingClientRect().height || 36;
      const viewH = Math.max(VIRTUAL_ROW_HEIGHT, (gridWrap.clientHeight || 480) - headH);
      if (rowTop < gridWrap.scrollTop) {
        gridWrap.scrollTop = rowTop;
      } else if (rowBottom > gridWrap.scrollTop + viewH) {
        gridWrap.scrollTop = rowBottom - viewH;
      }
    };
    if (evt.key === "ArrowDown" && filteredRows.length > 0) {
      evt.preventDefault();
      selectedFilteredIdx = Math.min(filteredRows.length - 1, selectedFilteredIdx + 1);
      ensureSelectedVisible();
      renderBodyRows(false);
      renderDrawer(filteredRows[selectedFilteredIdx]);
    } else if (evt.key === "ArrowUp" && filteredRows.length > 0) {
      evt.preventDefault();
      selectedFilteredIdx = Math.max(0, selectedFilteredIdx - 1);
      ensureSelectedVisible();
      renderBodyRows(false);
      renderDrawer(filteredRows[selectedFilteredIdx]);
    }
  };
  const onOverlayClick = (evt) => {
    if (evt.target === overlay) close();
    else if (!evt.target?.closest?.(".qs-wb-col-menu, .qs-wb-btn")) {
      colMenu.classList.remove("is-open");
    }
  };
  win.addEventListener("keydown", onKeyDown, true);
  overlay.addEventListener("click", onOverlayClick);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    resizeCleanup?.();
    gridWrap.removeEventListener("scroll", onScroll);
    win.removeEventListener("keydown", onKeyDown, true);
    overlay.removeEventListener("click", onOverlayClick);
    overlay.remove();
    prevFocused?.focus?.();
    onClose?.();
  };
  btnClose.addEventListener("click", close);
  renderColMenu();
  refreshData(true);
  win.requestAnimationFrame(() => overlay.focus());
  return { close };
}

// src/main.ts
var WorkbenchItemPicker = class extends import_obsidian9.FuzzySuggestModal {
  items;
  onSelect;
  constructor(app, items, onSelect) {
    super(app);
    this.items = items;
    this.onSelect = onSelect;
    this.setPlaceholder(t("\u9009\u62E9\u5F53\u524D\u7B14\u8BB0\u4E2D\u7684 Mermaid \u56FE\u6216\u8868\u683C\u6253\u5F00\u5DE5\u4F5C\u53F0...", "Pick a Mermaid diagram or table in this note..."));
  }
  getItems() {
    return this.items;
  }
  getItemText(item) {
    return item.label;
  }
  onChooseItem(item) {
    this.onSelect(item);
  }
};
var QingShanWorkbenchPlugin = class extends import_obsidian9.Plugin {
  settings = { ...DEFAULT_SETTINGS };
  writeQueue = Promise.resolve();
  activeModals = /* @__PURE__ */ new Set();
  trackedDocs = /* @__PURE__ */ new Set();
  lpManager = null;
  isAlive = true;
  async onload() {
    this.isAlive = true;
    try {
      this.settings = normalizeSettings(await this.loadData());
    } catch {
      this.settings = { ...DEFAULT_SETTINGS };
    }
    if (!this.isAlive) return;
    const actions = {
      getSettings: () => this.settings,
      openMermaid: (svg, title) => this.launchMermaid(svg, title),
      openTable: (table, title, sourcePath) => this.launchTable(table, title, sourcePath)
    };
    this.registerMarkdownPostProcessor((el, ctx) => {
      processReadingSection(el, ctx, actions);
    });
    this.lpManager = new LivePreviewTriggerManager(this.app, actions);
    this.registerEvent(this.app.workspace.on("layout-change", () => {
      this.syncBodyClasses();
      this.lpManager?.refreshAll();
    }));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.lpManager?.refreshAll()));
    this.registerEvent(this.app.metadataCache.on("changed", () => this.lpManager?.refreshAll()));
    this.registerEvent(this.app.workspace.on("window-open", (workspaceWindow) => {
      this.applyBodyClassesToDoc(workspaceWindow?.doc);
    }));
    this.registerEvent(this.app.workspace.on("window-close", (workspaceWindow) => {
      this.clearBodyClassesFromDoc(workspaceWindow?.doc);
      if (workspaceWindow?.doc) this.trackedDocs.delete(workspaceWindow.doc);
    }));
    this.app.workspace.onLayoutReady(() => {
      if (!this.isAlive) return;
      this.syncBodyClasses();
      this.lpManager?.refreshAll();
    });
    this.syncBodyClasses();
    this.addSettingTab(new WorkbenchSettingsTab(this.app, this));
    this.addCommand({
      id: "open-workbench-picker",
      name: t("\u6253\u5F00\u5F53\u524D\u7B14\u8BB0\u7684\u56FE\u8868 / \u5BBD\u8868\u9009\u62E9\u5668", "Open diagram / wide-table picker for active note"),
      callback: () => this.openActiveNotePicker()
    });
    this.addCommand({
      id: "toggle-table-workbench",
      name: t("\u5207\u6362\u5BBD\u8868\u5DE5\u4F5C\u53F0\u589E\u5F3A", "Toggle wide-table workbench"),
      callback: async () => {
        await this.updateSettings({ enableTableWorkbench: !this.settings.enableTableWorkbench });
        new import_obsidian9.Notice(
          this.settings.enableTableWorkbench ? t("\u5BBD\u8868\u5DE5\u4F5C\u53F0\u5DF2\u5F00\u542F", "Wide-table workbench enabled") : t("\u5BBD\u8868\u5DE5\u4F5C\u53F0\u5DF2\u5173\u95ED", "Wide-table workbench disabled")
        );
      }
    });
    this.addCommand({
      id: "toggle-mermaid-workbench",
      name: t("\u5207\u6362 Mermaid \u6C89\u6D78\u5F0F\u706F\u7BB1", "Toggle Mermaid lightbox"),
      callback: async () => {
        await this.updateSettings({ enableMermaidWorkbench: !this.settings.enableMermaidWorkbench });
        new import_obsidian9.Notice(
          this.settings.enableMermaidWorkbench ? t("Mermaid \u706F\u7BB1\u5DF2\u5F00\u542F", "Mermaid lightbox enabled") : t("Mermaid \u706F\u7BB1\u5DF2\u5173\u95ED", "Mermaid lightbox disabled")
        );
      }
    });
  }
  applyBodyClassesToDoc(doc) {
    if (!doc || !doc.body) return;
    if (doc.defaultView === null || doc.defaultView?.closed) {
      this.trackedDocs.delete(doc);
      return;
    }
    this.trackedDocs.add(doc);
    doc.body.classList.toggle("qs-wb-mermaid-off", !this.settings.enableMermaidWorkbench);
    doc.body.classList.toggle("qs-wb-table-off", !this.settings.enableTableWorkbench);
  }
  clearBodyClassesFromDoc(doc) {
    if (!doc || !doc.body) return;
    doc.body.classList.remove("qs-wb-mermaid-off", "qs-wb-table-off");
  }
  syncBodyClasses() {
    const docs = /* @__PURE__ */ new Set([document, ...this.trackedDocs]);
    this.app.workspace.iterateAllLeaves((leaf) => {
      const doc = leaf?.view?.containerEl?.ownerDocument;
      if (doc) docs.add(doc);
    });
    for (const doc of docs) this.applyBodyClassesToDoc(doc);
  }
  launchMermaid(svg, title) {
    const handle = openMermaidLightbox(svg, this.settings, title, () => {
      this.activeModals.delete(handle);
    });
    this.activeModals.add(handle);
  }
  launchTable(table, title, sourcePath) {
    const handle = openTableWorkbench(table, this.settings, {
      title,
      onClose: () => {
        this.activeModals.delete(handle);
      },
      onOpenInternalLink: (href) => {
        void this.app.workspace.openLinkText(href, sourcePath);
      }
    });
    this.activeModals.add(handle);
  }
  openActiveNotePicker() {
    const view = this.app.workspace.getActiveViewOfType(import_obsidian9.MarkdownView);
    if (!view || !view.file) {
      new import_obsidian9.Notice(t("\u8BF7\u5148\u6253\u5F00\u4E00\u7BC7 Markdown \u7B14\u8BB0", "Open a Markdown note first"));
      return;
    }
    if (isPathExcluded(view.file.path, this.settings.excludedPaths)) {
      new import_obsidian9.Notice(t("\u5F53\u524D\u76EE\u5F55\u4F4D\u4E8E\u5B89\u5168\u6392\u9664\u540D\u5355\u5185\uFF0C\u5DE5\u4F5C\u53F0\u5DF2\u81EA\u52A8\u8DF3\u8FC7", "This folder is excluded by safety settings"));
      return;
    }
    const items = [];
    const root = view.containerEl;
    if (this.settings.enableMermaidWorkbench) {
      const svgs = Array.from(root.querySelectorAll(".mermaid svg"));
      svgs.forEach((svg, idx) => {
        if (isProtectedMermaidElement(svg)) return;
        const firstText = (svg.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
        items.push({
          kind: "mermaid",
          label: `[Mermaid #${idx + 1}] ${firstText || t("\u56FE\u8868", "Diagram")}`,
          element: svg
        });
      });
    }
    if (this.settings.enableTableWorkbench) {
      const tables = Array.from(root.querySelectorAll("table"));
      tables.forEach((tbl, idx) => {
        if (isProtectedTableElement(tbl)) return;
        const headers = Array.from(tbl.querySelectorAll("thead th, tr:first-child th")).map((th) => (th.textContent || "").trim()).filter(Boolean).slice(0, 4).join(" / ");
        const rows = tbl.querySelectorAll("tbody tr").length;
        items.push({
          kind: "table",
          label: `[${t("\u8868\u683C", "Table")} #${idx + 1} \xB7 ${rows}${t("\u884C", " rows")}] ${headers || t("\u6570\u636E\u8868", "Data table")}`,
          element: tbl
        });
      });
    }
    if (items.length === 0) {
      new import_obsidian9.Notice(t("\u5F53\u524D\u53EF\u89C1\u533A\u57DF\u672A\u68C0\u6D4B\u5230 Mermaid \u56FE\u8868\u6216\u8868\u683C", "No Mermaid diagrams or tables found in active view"));
      return;
    }
    const noteTitle = view.file.basename;
    const notePath = view.file.path;
    if (items.length === 1) {
      const only = items[0];
      if (only.kind === "mermaid") this.launchMermaid(only.element, noteTitle);
      else this.launchTable(only.element, noteTitle, notePath);
      return;
    }
    new WorkbenchItemPicker(this.app, items, (chosen) => {
      if (chosen.kind === "mermaid") this.launchMermaid(chosen.element, noteTitle);
      else this.launchTable(chosen.element, noteTitle, notePath);
    }).open();
  }
  updateSettings(patch) {
    this.settings = normalizeSettings({ ...this.settings, ...patch });
    this.syncBodyClasses();
    this.lpManager?.refreshAll();
    const snapshot = { ...this.settings };
    this.writeQueue = this.writeQueue.then(() => this.saveData(snapshot)).catch(() => {
      new import_obsidian9.Notice(t("\u9752\u5C71\u5DE5\u4F5C\u53F0\uFF1A\u8BBE\u7F6E\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u78C1\u76D8\u6743\u9650", "Qing Shan Workbench: Failed to save settings"));
    });
    return this.writeQueue;
  }
  resetSettings() {
    return this.updateSettings({ ...DEFAULT_SETTINGS });
  }
  onunload() {
    this.isAlive = false;
    for (const modal of Array.from(this.activeModals)) modal.close();
    this.activeModals.clear();
    this.lpManager?.cleanupAll();
    this.lpManager = null;
    for (const doc of this.trackedDocs) this.clearBodyClassesFromDoc(doc);
    this.trackedDocs.clear();
  }
};
