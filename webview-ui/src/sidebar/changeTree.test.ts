import { describe, expect, it } from 'vitest';
import { buildTree, sortByPath } from './changeTree';

const file = (path: string) => ({ path, status: 'M' as const });

describe('buildTree', () => {
  it('puts folders first, joins single-folder chains, and counts files at any depth', () => {
    const tree = buildTree([file('README.md'), file('src/git/a.ts'), file('src/git/b.ts'), file('docs/x/y/z.md')]);

    expect(tree.map((n) => (n.kind === 'folder' ? `${n.name}/ (${n.files.length})` : n.file.path))).toEqual([
      'docs/x/y/ (1)',
      'src/git/ (2)',
      'README.md',
    ]);
    const src = tree[1];
    expect(src.kind === 'folder' && src.children.map((c) => (c.kind === 'file' ? c.file.path : c.name))).toEqual([
      'src/git/a.ts',
      'src/git/b.ts',
    ]);
  });

  it('keeps a folder that has both files and subfolders', () => {
    const [src] = buildTree([file('src/a.ts'), file('src/lib/b.ts')]);
    expect(src.kind === 'folder' && src.name).toBe('src');
    expect(src.kind === 'folder' && src.children.map((c) => (c.kind === 'file' ? 'file' : c.name))).toEqual(['lib', 'file']);
  });
});

describe('sortByPath', () => {
  it('sorts naturally and ignores case', () => {
    expect(sortByPath([file('b10.ts'), file('B2.ts'), file('a.ts')]).map((f) => f.path)).toEqual(['a.ts', 'B2.ts', 'b10.ts']);
  });
});
