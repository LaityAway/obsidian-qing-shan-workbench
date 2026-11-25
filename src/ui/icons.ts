import { setIcon } from 'obsidian';

export function attachIcon(el: HTMLElement, iconName: string, fallbackText = ''): void {
  try {
    if (typeof setIcon === 'function') {
      setIcon(el, iconName);
      if (el.childNodes.length > 0) return;
    }
  } catch {
    // Fallback below
  }
  if (fallbackText) el.textContent = fallbackText;
}

export function createIconButton(
  doc: Document,
  iconName: string,
  label: string,
  text?: string,
  cls = 'qs-wb-btn',
): HTMLButtonElement {
  const btn = doc.createElement('button');
  btn.type = 'button';
  btn.className = cls;
  btn.setAttribute('aria-label', label);
  btn.title = label;
  const iconWrap = doc.createElement('span');
  iconWrap.className = 'qs-wb-icon';
  attachIcon(iconWrap, iconName);
  btn.appendChild(iconWrap);
  if (text) {
    const span = doc.createElement('span');
    span.className = 'qs-wb-btn-label';
    span.textContent = text;
    btn.appendChild(span);
  }
  return btn;
}
