import esbuild from 'esbuild';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function loadTsModule(relPath, extraMocks = {}) {
  const result = esbuild.buildSync({
    entryPoints: [path.join(root, relPath)],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    external: ['obsidian', 'electron'],
  });
  const code = result.outputFiles[0].text;
  const mod = { exports: {} };
  const fakeRequire = id => {
    if (id in extraMocks) return extraMocks[id];
    if (id === 'obsidian') {
      return {
        getLanguage: () => 'zh',
        Notice: class { constructor(msg) { this.msg = msg; } },
        setIcon: () => {},
        Plugin: class {},
        PluginSettingTab: class {},
        Setting: class {},
        MarkdownRenderChild: class {
          constructor(el) { this.containerEl = el; this._cbs = []; }
          register(cb) { this._cbs.push(cb); }
          registerDomEvent(el, ev, fn) { el.addEventListener(ev, fn); this._cbs.push(() => el.removeEventListener(ev, fn)); }
          unload() { while (this._cbs.length) this._cbs.pop()(); }
        },
      };
    }
    throw new Error(`Unexpected require in unit test: ${id}`);
  };
  const fn = vm.runInThisContext(`(function(module, exports, require) {\n${code}\n})`);
  fn(mod, mod.exports, fakeRequire);
  return mod.exports;
}
