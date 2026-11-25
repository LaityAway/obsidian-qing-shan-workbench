export const BUILTIN_EXCLUDED_PATHS: readonly string[] = Object.freeze([]);
export const EXEMPT_CSSCLASSES: readonly string[] = Object.freeze(['qs-off', 'qs-no-workbench']);

export function normalizePathPrefix(raw: string): string {
  return raw
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
}

export function mergeExcludedPaths(userPaths: readonly string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of [...BUILTIN_EXCLUDED_PATHS, ...(userPaths ?? [])]) {
    const cleaned = normalizePathPrefix(String(item || ''));
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
  }
  return out;
}

export function isPathExcluded(sourcePath: string | null | undefined, userPaths?: readonly string[]): boolean {
  if (!sourcePath) return false;
  const normalized = normalizePathPrefix(sourcePath);
  if (!normalized) return false;
  const prefixes = mergeExcludedPaths(userPaths);
  for (const prefix of prefixes) {
    if (prefix.endsWith('/')) {
      if (normalized.startsWith(prefix) || normalized === prefix.slice(0, -1)) return true;
    } else if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      return true;
    }
  }
  return false;
}

export function extractFrontmatterCssClasses(frontmatter: Record<string, unknown> | null | undefined): string[] {
  if (!frontmatter || typeof frontmatter !== 'object') return [];
  const raw = frontmatter.cssclasses ?? frontmatter.cssclass;
  if (typeof raw === 'string') {
    return raw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
  }
  if (Array.isArray(raw)) {
    return raw.flatMap(item =>
      typeof item === 'string' ? item.split(/[\s,]+/).map(s => s.trim()).filter(Boolean) : [],
    );
  }
  return [];
}

export function hasExemptFrontmatterClass(
  frontmatter: Record<string, unknown> | null | undefined,
  extraExempt: readonly string[] = [],
): boolean {
  const classes = extractFrontmatterCssClasses(frontmatter);
  if (classes.length === 0) return false;
  const exemptSet = new Set([...EXEMPT_CSSCLASSES, ...extraExempt]);
  return classes.some(c => exemptSet.has(c));
}

export function hasExemptCssClass(element: Element | null | undefined): boolean {
  if (!element || typeof element.closest !== 'function') return false;
  const selector = EXEMPT_CSSCLASSES.map(cls => `.${cls}`).join(', ');
  return Boolean(element.closest(selector));
}

export function isPrintSurface(element: Element | null | undefined): boolean {
  if (!element || typeof element.closest !== 'function') return false;
  return Boolean(element.closest('.print'));
}

export function isProtectedTableElement(table: Element | null | undefined): boolean {
  if (!table || typeof table.closest !== 'function') return true;
  if (isPrintSurface(table) || hasExemptCssClass(table)) return true;
  if (table.closest('.bases-view, .qs-wb-overlay, .qs-wb-modal, .qs-home')) return true;
  if (table.querySelector('[data-password-toggle], .account-secret-toolbar, .account-password-value')) return true;
  return false;
}

export function isProtectedMermaidElement(container: Element | null | undefined): boolean {
  if (!container || typeof container.closest !== 'function') return true;
  if (isPrintSurface(container) || hasExemptCssClass(container)) return true;
  if (container.closest('.qs-wb-overlay, .qs-wb-modal, .qs-wb-minimap')) return true;
  return false;
}

export function shouldEnhanceTableInline(
  colCount: number,
  rowCount: number,
  minCols: number,
  minRows: number,
): boolean {
  if (colCount <= 0 || rowCount <= 0) return false;
  return colCount >= minCols || rowCount >= minRows;
}
