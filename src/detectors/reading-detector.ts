import { MarkdownPostProcessorContext, MarkdownRenderChild, Notice } from 'obsidian';
import {
  hasExemptCssClass,
  hasExemptFrontmatterClass,
  isPathExcluded,
  isPrintSurface,
  isProtectedMermaidElement,
  isProtectedTableElement,
} from '../guard';
import { WorkbenchSettings } from '../settings';
import { t } from '../i18n';
import { createIconButton } from '../ui/icons';
import {
  buildStandaloneSvgString,
  copyPngBlobToClipboard,
  renderSvgToPngBlob,
  triggerBlobDownload,
} from '../mermaid/mermaid-export';
import { enhanceInlineTable } from '../table/table-inline';

export interface DetectorActions {
  getSettings(): WorkbenchSettings;
  openMermaid(svg: SVGSVGElement, title: string): void;
  openTable(table: HTMLTableElement, title: string, sourcePath: string): void;
}

function noteTitleFromPath(sourcePath: string): string {
  const base = sourcePath.split('/').pop() || 'Note';
  return base.replace(/\.md$/i, '') || 'Note';
}

function attachMermaidTrigger(
  mermaidBox: HTMLElement,
  child: MarkdownRenderChild,
  title: string,
  actions: DetectorActions,
): boolean {
  if (mermaidBox.dataset.qsWbMermaid === '1') return false;
  if (isProtectedMermaidElement(mermaidBox)) return false;

  const doc = mermaidBox.ownerDocument || document;
  const win = doc.defaultView || window;

  const mountForSvg = (svg: SVGSVGElement): void => {
    if (mermaidBox.dataset.qsWbMermaid === '1') return;
    if (isProtectedMermaidElement(mermaidBox)) return;
    mermaidBox.dataset.qsWbMermaid = '1';
    mermaidBox.classList.add('qs-wb-mermaid-host');

    const bar = doc.createElement('div');
    bar.className = 'qs-wb-float-bar qs-wb-mermaid-bar';

    const btnZoom = createIconButton(
      doc,
      'maximize-2',
      t('打开 Mermaid 沉浸式灯箱', 'Open Mermaid lightbox'),
      t('灯箱', 'Zoom'),
      'qs-wb-inline-btn is-primary',
    );
    const btnPng = createIconButton(
      doc,
      'copy',
      t('复制高清 PNG 到剪贴板', 'Copy Retina PNG to clipboard'),
      'PNG',
      'qs-wb-inline-btn',
    );
    const btnSvg = createIconButton(
      doc,
      'download',
      t('导出高保真 SVG', 'Export styled SVG'),
      'SVG',
      'qs-wb-inline-btn',
    );

    bar.append(btnZoom, btnPng, btnSvg);
    mermaidBox.appendChild(bar);

    const getLiveSvg = (): SVGSVGElement | null => mermaidBox.querySelector('svg');

    child.registerDomEvent(btnZoom, 'click', evt => {
      evt.preventDefault();
      evt.stopPropagation();
      const target = getLiveSvg() || svg;
      actions.openMermaid(target, title);
    });

    child.registerDomEvent(btnPng, 'click', async evt => {
      evt.preventDefault();
      evt.stopPropagation();
      const target = getLiveSvg() || svg;
      const cur = actions.getSettings();
      try {
        const { blob, scale } = await renderSvgToPngBlob(target, cur.defaultExportBg, cur.pngScale);
        const copied = await copyPngBlobToClipboard(win, blob);
        if (copied) {
          new Notice(t(`已复制 ${scale}× 高清 PNG`, `Copied ${scale}x PNG`));
        } else {
          triggerBlobDownload(doc, blob, `${title}-${scale}x.png`);
          new Notice(t('剪贴板不可用，已自动下载 PNG', 'Clipboard unavailable; downloaded PNG'));
        }
      } catch {
        new Notice(t('PNG 导出受限，请改用 SVG', 'PNG export restricted; try SVG'));
      }
    });

    child.registerDomEvent(btnSvg, 'click', evt => {
      evt.preventDefault();
      evt.stopPropagation();
      const target = getLiveSvg() || svg;
      const cur = actions.getSettings();
      try {
        const { svgString } = buildStandaloneSvgString(target, cur.defaultExportBg);
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        triggerBlobDownload(doc, blob, `${title}.svg`);
        new Notice(t('已导出高保真 SVG', 'Exported styled SVG'));
      } catch {
        new Notice(t('SVG 导出失败', 'Failed to export SVG'));
      }
    });

    child.registerDomEvent(mermaidBox, 'dblclick', evt => {
      if (!actions.getSettings().doubleClickToOpen) return;
      if (!actions.getSettings().enableMermaidWorkbench) return;
      if ((evt.target as Element)?.closest?.('.qs-wb-float-bar')) return;
      const target = getLiveSvg() || svg;
      actions.openMermaid(target, title);
    });

    child.register(() => {
      bar.remove();
      mermaidBox.classList.remove('qs-wb-mermaid-host');
      delete mermaidBox.dataset.qsWbMermaid;
    });
  };

  const existingSvg = mermaidBox.querySelector('svg');
  if (existingSvg) {
    mountForSvg(existingSvg);
    return true;
  }

  if (typeof MutationObserver !== 'function') return false;
  const observer = new MutationObserver(() => {
    const svg = mermaidBox.querySelector('svg');
    if (svg) {
      observer.disconnect();
      mountForSvg(svg);
    }
  });
  observer.observe(mermaidBox, { childList: true, subtree: true });
  child.register(() => observer.disconnect());
  return true;
}

class GuardedSectionChild extends MarkdownRenderChild {
  private readonly checkAfterMount: () => boolean;

  constructor(containerEl: HTMLElement, checkAfterMount: () => boolean) {
    super(containerEl);
    this.checkAfterMount = checkAfterMount;
  }

  onload(): void {
    // Obsidian mounts section elements into .markdown-preview-view / .print / .markdown-source-view
    // AFTER post-processors run; re-verify ancestors once mounted and cleanly rollback if exempt.
    const verify = (): void => {
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
}

export function processReadingSection(
  element: HTMLElement,
  context: MarkdownPostProcessorContext,
  actions: DetectorActions,
): void {
  const settings = actions.getSettings();
  if (!settings.enableMermaidWorkbench && !settings.enableTableWorkbench) return;
  if (isPathExcluded(context.sourcePath, settings.excludedPaths)) return;
  if (hasExemptFrontmatterClass(context.frontmatter as Record<string, unknown> | undefined)) return;
  if (element.closest('.markdown-source-view')) return;

  const title = noteTitleFromPath(context.sourcePath);
  const child = new GuardedSectionChild(element, () => {
    if (!element.isConnected) return true;
    if (isPrintSurface(element) || hasExemptCssClass(element)) return false;
    if (element.closest('.markdown-source-view, .bases-view, .qs-home')) return false;
    if (element.querySelector('[data-password-toggle], .account-secret-toolbar')) return false;
    return true;
  });

  let attached = false;

  if (settings.enableMermaidWorkbench) {
    const mermaidContainers = element.matches('.mermaid')
      ? [element]
      : Array.from(element.querySelectorAll<HTMLElement>('.mermaid'));
    for (const box of mermaidContainers) {
      if (isProtectedMermaidElement(box)) continue;
      if (attachMermaidTrigger(box, child, title, actions)) {
        attached = true;
      }
    }
  }

  if (settings.enableTableWorkbench && !hasExemptFrontmatterClass(context.frontmatter as Record<string, unknown> | undefined, ['qs-home'])) {
    const tables = element.matches('table')
      ? [element as HTMLTableElement]
      : Array.from(element.querySelectorAll<HTMLTableElement>('table'));
    for (const table of tables) {
      if (isProtectedTableElement(table)) continue;
      if (enhanceInlineTable(table, child, settings, {
        onOpenWorkbench: target => actions.openTable(target, title, context.sourcePath),
      })) {
        attached = true;
      }
    }
  }

  if (attached) {
    context.addChild(child);
  }
}
