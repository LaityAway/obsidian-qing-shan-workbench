import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { BUILTIN_EXCLUDED_PATHS, normalizePathPrefix } from './guard';
import { t } from './i18n';

export type WheelZoomMode = 'direct' | 'ctrl';
export type ExportBgMode = 'theme' | 'white' | 'transparent';
export type PngScale = 2 | 3;

export interface WorkbenchSettings {
  enableMermaidWorkbench: boolean;
  enableTableWorkbench: boolean;
  enableLivePreviewTriggers: boolean;
  wheelZoomMode: WheelZoomMode;
  defaultExportBg: ExportBgMode;
  pngScale: PngScale;
  showMinimap: boolean;
  doubleClickToOpen: boolean;
  inlineMinColumns: number;
  inlineMinRows: number;
  inlineMaxHeight: number;
  defaultFreezeFirstCol: boolean;
  virtualScrollThreshold: number;
  excludedPaths: string[];
}

export const DEFAULT_SETTINGS: Readonly<WorkbenchSettings> = Object.freeze({
  enableMermaidWorkbench: true,
  enableTableWorkbench: true,
  enableLivePreviewTriggers: true,
  wheelZoomMode: 'direct',
  defaultExportBg: 'theme',
  pngScale: 2,
  showMinimap: true,
  doubleClickToOpen: true,
  inlineMinColumns: 5,
  inlineMinRows: 12,
  inlineMaxHeight: 560,
  defaultFreezeFirstCol: true,
  virtualScrollThreshold: 100,
  excludedPaths: [...BUILTIN_EXCLUDED_PATHS],
});

const WHEEL_MODES: readonly WheelZoomMode[] = ['direct', 'ctrl'];
const BG_MODES: readonly ExportBgMode[] = ['theme', 'white', 'transparent'];

function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  return Math.round(Math.min(max, Math.max(min, raw)));
}

export function normalizeSettings(raw: unknown): WorkbenchSettings {
  const data = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  const bool = (key: keyof WorkbenchSettings): boolean =>
    typeof data[key] === 'boolean' ? (data[key] as boolean) : (DEFAULT_SETTINGS[key] as boolean);

  const rawExcluded = Array.isArray(data.excludedPaths)
    ? data.excludedPaths.map(v => normalizePathPrefix(String(v || ''))).filter(Boolean)
    : [];
  const mergedExcluded = Array.from(new Set([...BUILTIN_EXCLUDED_PATHS, ...rawExcluded]));

  const wheelZoomMode = WHEEL_MODES.includes(data.wheelZoomMode as WheelZoomMode)
    ? (data.wheelZoomMode as WheelZoomMode)
    : DEFAULT_SETTINGS.wheelZoomMode;
  const defaultExportBg = BG_MODES.includes(data.defaultExportBg as ExportBgMode)
    ? (data.defaultExportBg as ExportBgMode)
    : DEFAULT_SETTINGS.defaultExportBg;
  const pngScale: PngScale = data.pngScale === 3 ? 3 : 2;

  return {
    enableMermaidWorkbench: bool('enableMermaidWorkbench'),
    enableTableWorkbench: bool('enableTableWorkbench'),
    enableLivePreviewTriggers: bool('enableLivePreviewTriggers'),
    wheelZoomMode,
    defaultExportBg,
    pngScale,
    showMinimap: bool('showMinimap'),
    doubleClickToOpen: bool('doubleClickToOpen'),
    inlineMinColumns: clampInt(data.inlineMinColumns, DEFAULT_SETTINGS.inlineMinColumns, 1, 30),
    inlineMinRows: clampInt(data.inlineMinRows, DEFAULT_SETTINGS.inlineMinRows, 1, 200),
    inlineMaxHeight: clampInt(data.inlineMaxHeight, DEFAULT_SETTINGS.inlineMaxHeight, 260, 1200),
    defaultFreezeFirstCol: bool('defaultFreezeFirstCol'),
    virtualScrollThreshold: clampInt(data.virtualScrollThreshold, DEFAULT_SETTINGS.virtualScrollThreshold, 30, 500),
    excludedPaths: mergedExcluded,
  };
}

export interface SettingsHost extends Plugin {
  settings: WorkbenchSettings;
  updateSettings(patch: Partial<WorkbenchSettings>): Promise<void>;
  resetSettings(): Promise<void>;
}

export class WorkbenchSettingsTab extends PluginSettingTab {
  private readonly host: SettingsHost;

  constructor(app: App, plugin: SettingsHost) {
    super(app, plugin);
    this.host = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('p', {
      cls: 'qs-wb-settings-desc',
      text: t(
        '青山 · 图表与宽表工作台：不修改任何笔记原文，为复杂 Mermaid 图提供 GPU 缩放/小地图/节点搜索/高保真导图，为超宽超长表格提供页内冻结与千行级虚拟滚动工作台。',
        'Qing Shan Workbench: Zero-mutation interactive Mermaid lightbox (GPU zoom, minimap, node search, styled SVG/PNG export) and virtualized wide-table workbench.',
      ),
    });

    const heading = (title: string): void => {
      const s = new Setting(containerEl).setName(title);
      if (typeof s.setHeading === 'function') s.setHeading();
    };

    heading(t('核心开关', 'Core toggles'));

    new Setting(containerEl)
      .setName(t('启用 Mermaid 沉浸式灯箱', 'Enable Mermaid lightbox'))
      .setDesc(t('为阅读视图和实时预览中的 Mermaid 图表添加缩放、小地图、节点搜索与高清导出。', 'Add zoom, minimap, node search, and styled SVG/PNG export to Mermaid diagrams.'))
      .addToggle(ctrl => ctrl
        .setValue(this.host.settings.enableMermaidWorkbench)
        .onChange(v => this.host.updateSettings({ enableMermaidWorkbench: v })));

    new Setting(containerEl)
      .setName(t('启用宽表页内增强与全屏工作台', 'Enable wide-table workbench'))
      .setDesc(t('在阅读视图按阈值挂载冻结与筛查入口，并支持千行级全屏虚拟滚动工作台与导出。', 'Enhance wide/tall tables in Reading view and provide a virtualized fullscreen table workbench.'))
      .addToggle(ctrl => ctrl
        .setValue(this.host.settings.enableTableWorkbench)
        .onChange(v => this.host.updateSettings({ enableTableWorkbench: v })));

    new Setting(containerEl)
      .setName(t('在实时预览显示只读工作台入口', 'Show read-only triggers in Live Preview'))
      .setDesc(t('在 Live Preview 的 Mermaid 与表格右上角避让位置挂载只读入口，绝不干涉表格编辑。', 'Attach non-intrusive read-only triggers on Mermaid blocks and tables in Live Preview.'))
      .addToggle(ctrl => ctrl
        .setValue(this.host.settings.enableLivePreviewTriggers)
        .onChange(v => this.host.updateSettings({ enableLivePreviewTriggers: v })));

    heading(t('Mermaid 灯箱设置', 'Mermaid lightbox'));

    new Setting(containerEl)
      .setName(t('滚轮缩放方式', 'Wheel zoom behavior'))
      .setDesc(t('直接滚轮缩放体验最流畅；若常在灯箱内滚屏可改为按住 Ctrl/Cmd + 滚轮。', 'Zoom directly with mouse wheel or require Ctrl/Cmd modifier.'))
      .addDropdown(ctrl => ctrl
        .addOption('direct', t('直接滚轮缩放（推荐）', 'Direct wheel zoom (Recommended)'))
        .addOption('ctrl', t('按住 Ctrl / Cmd + 滚轮', 'Hold Ctrl / Cmd + wheel'))
        .setValue(this.host.settings.wheelZoomMode)
        .onChange(v => this.host.updateSettings({ wheelZoomMode: v as WheelZoomMode })));

    new Setting(containerEl)
      .setName(t('默认导出画布底色', 'Default export background'))
      .setDesc(t('导出 PNG/SVG 时的默认背景模式，灯箱内随时可一键切换。', 'Default canvas background for exported PNG/SVG (toggleable inside lightbox).'))
      .addDropdown(ctrl => ctrl
        .addOption('theme', t('跟随当前主题底色', 'Follow active theme'))
        .addOption('white', t('纯白纸底（汇报文档推荐）', 'Pure white paper'))
        .addOption('transparent', t('透明底', 'Transparent'))
        .setValue(this.host.settings.defaultExportBg)
        .onChange(v => this.host.updateSettings({ defaultExportBg: v as ExportBgMode })));

    new Setting(containerEl)
      .setName(t('PNG 导出清晰度', 'PNG export resolution'))
      .setDesc(t('2× 适合日常分享与文档，3× 适合高分大屏 PPT 汇报。', '2x for general sharing, 3x for crisp HiDPI slides.'))
      .addDropdown(ctrl => ctrl
        .addOption('2', '2× Retina')
        .addOption('3', '3× Ultra HD')
        .setValue(String(this.host.settings.pngScale))
        .onChange(v => this.host.updateSettings({ pngScale: v === '3' ? 3 : 2 })));

    new Setting(containerEl)
      .setName(t('显示缩略小地图（Minimap）', 'Show minimap'))
      .setDesc(t('在灯箱右下角显示实时缩略图与视口定位框，适合大型 ER 图和流程图漫游。', 'Display a draggable viewport minimap in the bottom-right corner.'))
      .addToggle(ctrl => ctrl
        .setValue(this.host.settings.showMinimap)
        .onChange(v => this.host.updateSettings({ showMinimap: v })));

    new Setting(containerEl)
      .setName(t('双击图表直接打开灯箱', 'Double-click diagram to open lightbox'))
      .setDesc(t('在阅读视图双击 Mermaid SVG 即可快速进入沉浸灯箱。', 'Double-click a rendered Mermaid SVG in Reading view to launch the lightbox.'))
      .addToggle(ctrl => ctrl
        .setValue(this.host.settings.doubleClickToOpen)
        .onChange(v => this.host.updateSettings({ doubleClickToOpen: v })));

    heading(t('宽表工作台设置', 'Wide-table workbench'));

    new Setting(containerEl)
      .setName(t('页内增强最小列数阈值', 'Inline enhancement min columns'))
      .setDesc(t('阅读视图表格列数达到该值（或行数达标）时自动挂载页内增强，小表保持纯净。', 'Enhance tables in Reading view when columns meet this threshold.'))
      .addSlider(ctrl => ctrl
        .setLimits(1, 15, 1)
        .setValue(this.host.settings.inlineMinColumns)
        .setDynamicTooltip()
        .onChange(v => this.host.updateSettings({ inlineMinColumns: v })));

    new Setting(containerEl)
      .setName(t('页内增强最小行数阈值', 'Inline enhancement min rows'))
      .setDesc(t('阅读视图表格数据行数达到该值时自动挂载页内冻结与筛选入口。', 'Enhance tables in Reading view when body rows meet this threshold.'))
      .addSlider(ctrl => ctrl
        .setLimits(1, 50, 1)
        .setValue(this.host.settings.inlineMinRows)
        .setDynamicTooltip()
        .onChange(v => this.host.updateSettings({ inlineMinRows: v })));

    new Setting(containerEl)
      .setName(t('页内冻结容器最大高度 (px)', 'Inline sticky table max height (px)'))
      .setDesc(t('在阅读视图开启冻结表头时，表格滚动区域的最大高度。', 'Maximum scroll height when sticky header is toggled inline.'))
      .addSlider(ctrl => ctrl
        .setLimits(260, 1000, 20)
        .setValue(this.host.settings.inlineMaxHeight)
        .setDynamicTooltip()
        .onChange(v => this.host.updateSettings({ inlineMaxHeight: v })));

    new Setting(containerEl)
      .setName(t('工作台默认冻结首列', 'Freeze first column by default'))
      .setDesc(t('打开宽表全屏工作台时默认固定第一列，便于横向核对多列字段。', 'Keep the first column sticky when opening the fullscreen table workbench.'))
      .addToggle(ctrl => ctrl
        .setValue(this.host.settings.defaultFreezeFirstCol)
        .onChange(v => this.host.updateSettings({ defaultFreezeFirstCol: v })));

    heading(t('安全隔离与豁免', 'Safety & exclusions'));

    new Setting(containerEl)
      .setName(t('排除目录（每行一个路径前缀）', 'Excluded folders (one path prefix per line)'))
      .setDesc(t('命中前缀的笔记与嵌入块将完全跳过工作台增强（如 Secrets/、Credentials/ 等敏感目录）。', 'Notes and embeds under these path prefixes are completely skipped (e.g. Secrets/, Credentials/).'))
      .addTextArea(ctrl => {
        ctrl.inputEl.rows = 3;
        ctrl.setPlaceholder(t('Secrets/\nCredentials/', 'Secrets/\nCredentials/'));
        ctrl
          .setValue(this.host.settings.excludedPaths.join('\n'))
          .onChange(async val => {
            const list = val.split('\n').map(s => normalizePathPrefix(s)).filter(Boolean);
            await this.host.updateSettings({ excludedPaths: list });
          });
      });

    new Setting(containerEl)
      .setName(t('恢复默认设置', 'Reset defaults'))
      .setDesc(t('将全部工作台配置恢复为推荐默认值。', 'Restore all workbench settings to recommended defaults.'))
      .addButton(btn => btn
        .setButtonText(t('恢复默认', 'Reset'))
        .onClick(async () => {
          await this.host.resetSettings();
          this.display();
        }));
  }
}
