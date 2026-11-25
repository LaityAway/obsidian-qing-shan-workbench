import { getLanguage } from 'obsidian';

export function isZh(): boolean {
  try {
    if (typeof getLanguage === 'function') {
      const lang = getLanguage();
      if (lang) return String(lang).toLowerCase().startsWith('zh');
    }
    if (typeof activeDocument !== 'undefined' && activeDocument?.documentElement?.lang) {
      return activeDocument.documentElement.lang.toLowerCase().startsWith('zh');
    }
    return false;
  } catch {
    return false;
  }
}

export function t(zh: string, en: string): string {
  return isZh() ? zh : en;
}
