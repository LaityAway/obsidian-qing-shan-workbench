export interface IndexedDiagramNode {
  element: Element;
  text: string;
  normalized: string;
}

export function extractDiagramSearchNodes(svg: SVGSVGElement): IndexedDiagramNode[] {
  const candidates = new Map<Element, string[]>();
  const labelEls = svg.querySelectorAll('text, foreignObject');

  for (const el of Array.from(labelEls)) {
    const raw = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!raw) continue;
    const host =
      el.closest('g.node, g.cluster, g.actor, g.classGroup, g.statediagram-state, g[id]') || el;
    const existing = candidates.get(host);
    if (existing) existing.push(raw);
    else candidates.set(host, [raw]);
  }

  const out: IndexedDiagramNode[] = [];
  for (const [element, parts] of candidates.entries()) {
    const text = parts.join(' ').trim();
    if (!text) continue;
    out.push({
      element,
      text,
      normalized: text.toLowerCase(),
    });
  }
  return out;
}

export function filterDiagramNodes(
  nodes: readonly IndexedDiagramNode[],
  query: string,
): IndexedDiagramNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  return nodes.filter(node => terms.every(term => node.normalized.includes(term)));
}

export function getNodeCenterInSvg(
  node: Element,
  svg: SVGSVGElement,
  contentWidth: number,
  contentHeight: number,
): { x: number; y: number } {
  try {
    const graphics = node as SVGGraphicsElement;
    if (typeof graphics.getBBox === 'function') {
      const box = graphics.getBBox();
      if (Number.isFinite(box.width) && (box.width > 0 || box.height > 0)) {
        const vb = svg.viewBox?.baseVal;
        const offsetX = vb && vb.width > 0 ? vb.x : 0;
        const offsetY = vb && vb.height > 0 ? vb.y : 0;
        const scaleX = vb && vb.width > 0 ? contentWidth / vb.width : 1;
        const scaleY = vb && vb.height > 0 ? contentHeight / vb.height : 1;
        return {
          x: (box.x + box.width / 2 - offsetX) * scaleX,
          y: (box.y + box.height / 2 - offsetY) * scaleY,
        };
      }
    }
  } catch {
    // Fall back to bounding client rect below
  }
  const svgRect = svg.getBoundingClientRect();
  const nodeRect = node.getBoundingClientRect();
  if (svgRect.width > 0 && svgRect.height > 0) {
    return {
      x: ((nodeRect.left + nodeRect.width / 2 - svgRect.left) / svgRect.width) * contentWidth,
      y: ((nodeRect.top + nodeRect.height / 2 - svgRect.top) / svgRect.height) * contentHeight,
    };
  }
  return { x: contentWidth / 2, y: contentHeight / 2 };
}
