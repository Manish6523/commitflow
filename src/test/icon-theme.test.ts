import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { IconTheme, IconThemeJson, buildLanguageMap } from '../services/iconTheme';

const temps: string[] = [];
afterEach(() => temps.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

const languages = buildLanguageMap([
  { id: 'python', extensions: ['.py'] },
  { id: 'html', extensions: ['.html', '.HTM'] },
  { id: 'makefile', filenames: ['Makefile'] },
]);

function theme(json: IconThemeJson, variant: 'dark' | 'light' | 'highContrast' = 'dark') {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'commitflow-icons-'));
  temps.push(parent);
  const root = path.join(parent, 'ext');
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.mkdirSync(path.join(root, 'icons'));
  fs.writeFileSync(path.join(root, 'icons', 'py.svg'), '<svg/>');
  fs.writeFileSync(path.join(root, 'icons', 'font.woff'), 'font');
  fs.writeFileSync(path.join(parent, 'outside.svg'), '<svg>secret</svg>');
  return new IconTheme(json, path.join(root, 'dist'), root, languages, variant);
}

describe('icon themes', () => {
  it('prefers the name, then the longest extension, then the language, then the default', () => {
    const t = theme({
      file: 'default',
      fileNames: { 'Package.json': 'npm', '.github/labeler.yml': 'labeler' },
      fileExtensions: { ts: 'ts', 'test.ts': 'test', json: 'json' },
      languageIds: { python: 'py', makefile: 'make', html: 'html' },
      light: { fileExtensions: { ts: 'ts-light' } },
    });
    const pick = (p: string) => t.definitionFor(p);
    expect(pick('web/package.json')).toBe('npm');
    expect(pick('x/.github/labeler.yml')).toBe('labeler');
    expect(pick('a.test.ts')).toBe('test');
    expect(pick('a.ts')).toBe('ts');
    expect(pick('A.PY')).toBe('py');
    expect(pick('index.htm')).toBe('html');
    expect(pick('src/Makefile')).toBe('make');
    expect(pick('LICENSE')).toBe('default');
    expect(pick('constructor')).toBe('default');
  });

  it('uses a light theme’s own choices over the base ones', () => {
    const json = { fileExtensions: { ts: 'ts', js: 'js' }, light: { fileExtensions: { ts: 'ts-light' } } };
    expect(theme(json, 'light').definitionFor('a.ts')).toBe('ts-light');
    expect(theme(json, 'light').definitionFor('a.js')).toBe('js');
    expect(theme(json).definitionFor('a.ts')).toBe('ts');
  });

  it('embeds images, and never reads outside the theme’s extension', () => {
    const t = theme({
      fileExtensions: { py: 'py', bad: 'bad', gone: 'gone' },
      iconDefinitions: {
        py: { iconPath: '../icons/py.svg' },
        bad: { iconPath: '../../outside.svg' },
        gone: { iconPath: '../icons/none.svg' },
      },
    });
    expect(t.iconFor('a.py')).toEqual({ image: `data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}` });
    expect(t.iconFor('a.bad')).toBeUndefined();
    expect(t.iconFor('a.gone')).toBeUndefined();
    expect(t.iconFor('unknown')).toBeUndefined();
  });

  it('supports themes that draw icons with a font', () => {
    const t = theme({
      fonts: [{ id: 'seti', src: [{ path: '../icons/font.woff', format: 'woff' }], size: '150%' }],
      languageIds: { python: 'py' },
      iconDefinitions: { py: { fontCharacter: '\\E07B', fontColor: '#519aba' } },
    });
    expect(t.iconFor('a.py')).toEqual({ character: '', color: '#519aba', font: 'seti', size: '150%' });
    expect(t.fonts()).toEqual([{ id: 'seti', src: `data:font/woff;base64,${Buffer.from('font').toString('base64')}` }]);
  });
});
