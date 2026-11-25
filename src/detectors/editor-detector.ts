import { App, MarkdownView } from 'obsidian';
import {
  hasExemptCssClass,
  isPathExcluded,
  isProtectedMermaidElement,
  isProtectedTableElement,
} from '../guard';
import { t } from '../i18n';
import { createIconButton } from '../ui/icons';
import { DetectorActions } from './reading-detector';

const LP_TRIGGER_CLASS = 'qs-wb-lp-trigger';

interface ObservedRoot {
  view: MarkdownView;
  observer: MutationObserver;
}

export class LivePreviewTriggerManager {
  private readonly app: App;
  private readonly actions: DetectorActions;
  private readonly mounted = new Set<HTMLElement>();
  private readonly observers = new Map<HTMLElement, ObservedRoot>();

  constructor(app: App, actions: DetectorActions) {
    this.app = app;
    this.actions = actions;
  }

  refreshAll(): void {
    this.pruneDisconnected();
    const settings = this.actions.getSettings();
    if (!settings.enableLivePreviewTriggers || (!settings.enableMermaidWorkbench && !settings.enableTableWorkbench)) {
      this.cleanupAll();
      return;
    }

    const liveRoots = new Set<HTMLElement>();
    this.app.workspace.iterateAllLeaves(leaf => {
      const view = leaf?.view;
      if (!(view instanceof MarkdownView)) return;
      const lpRoot = view.containerEl.querySelector<HTMLElement>('.markdown-source-view.mod-cm6.is-live-preview');
      if (!lpRoot) return;
      const sourcePath = view.file?.path || '';
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

  private pruneDisconnected(): void {
    for (const el of Array.from(this.mounted)) {
      if (!el.isConnected) this.mounted.delete(el);
    }
  }

  private removeTriggersIn(root: HTMLElement): void {
    for (const el of Array.from(root.querySelectorAll<HTMLElement>(`.${LP_TRIGGER_CLASS}`))) {
      const parent = el.parentElement;
      if (parent && parent.dataset.qsWbLp) delete parent.dataset.qsWbLp;
      el.remove();
      this.mounted.delete(el);
    }
  }

  private ensureObserver(lpRoot: HTMLElement, view: MarkdownView): void {
    const existing = this.observers.get(lpRoot);
    if (existing) {
      existing.view = view;
      return;
    }
    if (typeof MutationObserver !== 'function') return;
    let scheduled = false;
    const entry: ObservedRoot = {
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
      }),
    };
    entry.observer.observe(lpRoot, { childList: true, subtree: true });
    this.observers.set(lpRoot, entry);
  }

  private scanRoot(lpRoot: HTMLElement, view: MarkdownView): void {
    const settings = this.actions.getSettings();
    const sourcePath = view.file?.path || '';
    const title = view.file?.basename || 'Note';

    if (!settings.enableLivePreviewTriggers || isPathExcluded(sourcePath, settings.excludedPaths) || hasExemptCssClass(lpRoot)) {
      this.removeTriggersIn(lpRoot);
      return;
    }

    if (settings.enableMermaidWorkbench) {
      const mermaidEmbeds = lpRoot.querySelectorAll<HTMLElement>('.cm-embed-block .mermaid');
      for (const box of Array.from(mermaidEmbeds)) {
        if (isProtectedMermaidElement(box)) continue;
        const svg = box.querySelector('svg');
        const embed = box.closest<HTMLElement>('.cm-embed-block');
        if (!svg || !embed || embed.dataset.qsWbLp === '1') continue;
        this.mountTrigger(embed, 'mermaid', () => {
          const liveSvg = embed.querySelector('svg');
          if (liveSvg) this.actions.openMermaid(liveSvg, view.file?.basename || title);
        });
      }
    }

    if (settings.enableTableWorkbench) {
      const tableWidgets = lpRoot.querySelectorAll<HTMLElement>('.cm-embed-block.cm-table-widget');
      for (const widget of Array.from(tableWidgets)) {
        const table = widget.querySelector<HTMLTableElement>('table');
        if (!table || isProtectedTableElement(table) || widget.dataset.qsWbLp === '1') continue;
        this.mountTrigger(widget, 'table', () => {
          const liveTable = widget.querySelector<HTMLTableElement>('table');
          if (liveTable) {
            this.actions.openTable(liveTable, view.file?.basename || title, view.file?.path || '');
          }
        });
      }
    }
  }

  private mountTrigger(
    host: HTMLElement,
    kind: 'mermaid' | 'table',
    onClick: () => void,
  ): void {
    host.dataset.qsWbLp = '1';
    const doc = host.ownerDocument;
    const wrap = doc.createElement('div');
    wrap.className = `${LP_TRIGGER_CLASS} is-${kind}`;

    const label = kind === 'mermaid'
      ? t('在 Mermaid 灯箱中打开', 'Open in Mermaid lightbox')
      : t('在宽表工作台打开（只读）', 'Open in wide-table workbench (read-only)');
    const text = kind === 'mermaid' ? t('灯箱', 'Zoom') : t('工作台', 'Workbench');
    const btn = createIconButton(doc, 'maximize-2', label, text, 'qs-wb-inline-btn is-primary');
    btn.addEventListener('click', evt => {
      evt.preventDefault();
      evt.stopPropagation();
      onClick();
    });

    wrap.appendChild(btn);
    host.appendChild(wrap);
    this.mounted.add(wrap);
  }

  cleanupAll(): void {
    for (const entry of this.observers.values()) entry.observer.disconnect();
    this.observers.clear();
    for (const el of this.mounted) {
      const parent = el.parentElement;
      if (parent && parent.dataset.qsWbLp) delete parent.dataset.qsWbLp;
      el.remove();
    }
    this.mounted.clear();
  }
}
