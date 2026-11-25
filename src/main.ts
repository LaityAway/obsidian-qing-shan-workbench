import { FuzzySuggestModal, MarkdownView, Notice, Plugin } from 'obsidian';
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  SettingsHost,
  WorkbenchSettings,
  WorkbenchSettingsTab,
} from './settings';
import { t } from './i18n';
import { isPathExcluded, isProtectedMermaidElement, isProtectedTableElement } from './guard';
import { processReadingSection } from './detectors/reading-detector';
import { LivePreviewTriggerManager } from './detectors/editor-detector';
import { MermaidModalHandle, openMermaidLightbox } from './mermaid/mermaid-modal';
import { openTableWorkbench, TableModalHandle } from './table/table-modal';

interface PickerItem {
  kind: 'mermaid' | 'table';
  label: string;
  element: SVGSVGElement | HTMLTableElement;
}

class WorkbenchItemPicker extends FuzzySuggestModal<PickerItem> {
  private readonly items: PickerItem[];
  private readonly onSelect: (item: PickerItem) => void;

  constructor(app: Plugin['app'], items: PickerItem[], onSelect: (item: PickerItem) => void) {
    super(app);
    this.items = items;
    this.onSelect = onSelect;
    this.setPlaceholder(t('选择当前笔记中的 Mermaid 图或表格打开工作台...', 'Pick a Mermaid diagram or table in this note...'));
  }

  getItems(): PickerItem[] {
    return this.items;
  }

  getItemText(item: PickerItem): string {
    return item.label;
  }

  onChooseItem(item: PickerItem): void {
    this.onSelect(item);
  }
}

export default class QingShanWorkbenchPlugin extends Plugin implements SettingsHost {
  settings: WorkbenchSettings = { ...DEFAULT_SETTINGS };
  private writeQueue: Promise<void> = Promise.resolve();
  private activeModals = new Set<MermaidModalHandle | TableModalHandle>();
  private trackedDocs = new Set<Document>();
  private lpManager: LivePreviewTriggerManager | null = null;
  private isAlive = true;

  async onload(): Promise<void> {
    this.isAlive = true;
    try {
      this.settings = normalizeSettings(await this.loadData());
    } catch {
      this.settings = { ...DEFAULT_SETTINGS };
    }
    if (!this.isAlive) return;

    const actions = {
      getSettings: () => this.settings,
      openMermaid: (svg: SVGSVGElement, title: string) => this.launchMermaid(svg, title),
      openTable: (table: HTMLTableElement, title: string, sourcePath: string) =>
        this.launchTable(table, title, sourcePath),
    };

    this.registerMarkdownPostProcessor((el, ctx) => {
      processReadingSection(el, ctx, actions);
    });

    this.lpManager = new LivePreviewTriggerManager(this.app, actions);
    this.registerEvent(this.app.workspace.on('layout-change', () => {
      this.syncBodyClasses();
      this.lpManager?.refreshAll();
    }));
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.lpManager?.refreshAll()));
    this.registerEvent(this.app.metadataCache.on('changed', () => this.lpManager?.refreshAll()));
    this.registerEvent(this.app.workspace.on('window-open', workspaceWindow => {
      this.applyBodyClassesToDoc(workspaceWindow?.doc);
    }));
    this.registerEvent(this.app.workspace.on('window-close', workspaceWindow => {
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
      id: 'open-workbench-picker',
      name: t('打开当前笔记的图表 / 宽表选择器', 'Open diagram / wide-table picker for active note'),
      callback: () => this.openActiveNotePicker(),
    });

    this.addCommand({
      id: 'toggle-table-workbench',
      name: t('切换宽表工作台增强', 'Toggle wide-table workbench'),
      callback: async () => {
        await this.updateSettings({ enableTableWorkbench: !this.settings.enableTableWorkbench });
        new Notice(
          this.settings.enableTableWorkbench
            ? t('宽表工作台已开启', 'Wide-table workbench enabled')
            : t('宽表工作台已关闭', 'Wide-table workbench disabled'),
        );
      },
    });

    this.addCommand({
      id: 'toggle-mermaid-workbench',
      name: t('切换 Mermaid 沉浸式灯箱', 'Toggle Mermaid lightbox'),
      callback: async () => {
        await this.updateSettings({ enableMermaidWorkbench: !this.settings.enableMermaidWorkbench });
        new Notice(
          this.settings.enableMermaidWorkbench
            ? t('Mermaid 灯箱已开启', 'Mermaid lightbox enabled')
            : t('Mermaid 灯箱已关闭', 'Mermaid lightbox disabled'),
        );
      },
    });
  }

  private applyBodyClassesToDoc(doc: Document | null | undefined): void {
    if (!doc || !doc.body) return;
    if (doc.defaultView === null || doc.defaultView?.closed) {
      this.trackedDocs.delete(doc);
      return;
    }
    this.trackedDocs.add(doc);
    doc.body.classList.toggle('qs-wb-mermaid-off', !this.settings.enableMermaidWorkbench);
    doc.body.classList.toggle('qs-wb-table-off', !this.settings.enableTableWorkbench);
  }

  private clearBodyClassesFromDoc(doc: Document | null | undefined): void {
    if (!doc || !doc.body) return;
    doc.body.classList.remove('qs-wb-mermaid-off', 'qs-wb-table-off');
  }

  private syncBodyClasses(): void {
    const docs = new Set<Document>([document, ...this.trackedDocs]);
    this.app.workspace.iterateAllLeaves(leaf => {
      const doc = leaf?.view?.containerEl?.ownerDocument;
      if (doc) docs.add(doc);
    });
    for (const doc of docs) this.applyBodyClassesToDoc(doc);
  }

  private launchMermaid(svg: SVGSVGElement, title: string): void {
    const handle = openMermaidLightbox(svg, this.settings, title, () => {
      this.activeModals.delete(handle);
    });
    this.activeModals.add(handle);
  }

  private launchTable(table: HTMLTableElement, title: string, sourcePath: string): void {
    const handle = openTableWorkbench(table, this.settings, {
      title,
      onClose: () => {
        this.activeModals.delete(handle);
      },
      onOpenInternalLink: href => {
        void this.app.workspace.openLinkText(href, sourcePath);
      },
    });
    this.activeModals.add(handle);
  }

  private openActiveNotePicker(): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || !view.file) {
      new Notice(t('请先打开一篇 Markdown 笔记', 'Open a Markdown note first'));
      return;
    }
    if (isPathExcluded(view.file.path, this.settings.excludedPaths)) {
      new Notice(t('当前目录位于安全排除名单内，工作台已自动跳过', 'This folder is excluded by safety settings'));
      return;
    }

    const items: PickerItem[] = [];
    const root = view.containerEl;

    if (this.settings.enableMermaidWorkbench) {
      const svgs = Array.from(root.querySelectorAll<SVGSVGElement>('.mermaid svg'));
      svgs.forEach((svg, idx) => {
        if (isProtectedMermaidElement(svg)) return;
        const firstText = (svg.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
        items.push({
          kind: 'mermaid',
          label: `[Mermaid #${idx + 1}] ${firstText || t('图表', 'Diagram')}`,
          element: svg,
        });
      });
    }

    if (this.settings.enableTableWorkbench) {
      const tables = Array.from(root.querySelectorAll<HTMLTableElement>('table'));
      tables.forEach((tbl, idx) => {
        if (isProtectedTableElement(tbl)) return;
        const headers = Array.from(tbl.querySelectorAll('thead th, tr:first-child th'))
          .map(th => (th.textContent || '').trim())
          .filter(Boolean)
          .slice(0, 4)
          .join(' / ');
        const rows = tbl.querySelectorAll('tbody tr').length;
        items.push({
          kind: 'table',
          label: `[${t('表格', 'Table')} #${idx + 1} · ${rows}${t('行', ' rows')}] ${headers || t('数据表', 'Data table')}`,
          element: tbl,
        });
      });
    }

    if (items.length === 0) {
      new Notice(t('当前可见区域未检测到 Mermaid 图表或表格', 'No Mermaid diagrams or tables found in active view'));
      return;
    }

    const noteTitle = view.file.basename;
    const notePath = view.file.path;
    if (items.length === 1) {
      const only = items[0];
      if (only.kind === 'mermaid') this.launchMermaid(only.element as SVGSVGElement, noteTitle);
      else this.launchTable(only.element as HTMLTableElement, noteTitle, notePath);
      return;
    }

    new WorkbenchItemPicker(this.app, items, chosen => {
      if (chosen.kind === 'mermaid') this.launchMermaid(chosen.element as SVGSVGElement, noteTitle);
      else this.launchTable(chosen.element as HTMLTableElement, noteTitle, notePath);
    }).open();
  }

  updateSettings(patch: Partial<WorkbenchSettings>): Promise<void> {
    this.settings = normalizeSettings({ ...this.settings, ...patch });
    this.syncBodyClasses();
    this.lpManager?.refreshAll();
    const snapshot = { ...this.settings };
    this.writeQueue = this.writeQueue
      .then(() => this.saveData(snapshot))
      .catch(() => {
        new Notice(t('青山工作台：设置保存失败，请检查磁盘权限', 'Qing Shan Workbench: Failed to save settings'));
      });
    return this.writeQueue;
  }

  resetSettings(): Promise<void> {
    return this.updateSettings({ ...DEFAULT_SETTINGS });
  }

  onunload(): void {
    this.isAlive = false;
    for (const modal of Array.from(this.activeModals)) modal.close();
    this.activeModals.clear();
    this.lpManager?.cleanupAll();
    this.lpManager = null;
    for (const doc of this.trackedDocs) this.clearBodyClassesFromDoc(doc);
    this.trackedDocs.clear();
  }
}
