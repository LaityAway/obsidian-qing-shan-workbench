import { getLanguage } from 'obsidian';

export function isZh(): boolean {
  try {
    if (typeof getLanguage === 'function') {
      const lang = getLanguage();
      if (lang) return String(lang).toLowerCase().startsWith('zh');
    }
    if (typeof globalThis.localStorage?.getItem === 'function') {
      const stored = globalThis.localStorage.getItem('language');
      if (stored) return String(stored).toLowerCase().startsWith('zh');
      const docLang = globalThis.document?.documentElement?.lang;
      if (docLang) return String(docLang).toLowerCase().startsWith('zh');
      return false;
    }
    const docLang = globalThis.document?.documentElement?.lang;
    if (docLang) return String(docLang).toLowerCase().startsWith('zh');
    return false;
  } catch {
    return false;
  }
}

export function t(zh: string, en: string): string {
  return isZh() ? zh : en;
}
