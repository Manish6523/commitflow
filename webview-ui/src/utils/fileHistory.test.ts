import { describe, it, expect } from 'vitest';
import { FileHistoryCommit } from '../types';
import { filterFiles, pickSide, resolveComparison, timeAgo, WORKING_COPY } from './fileHistory';
import { cssVariableFor, toHexColor } from '../monaco/themeColors';

const commit = (hash: string, overrides: Partial<FileHistoryCommit> = {}): FileHistoryCommit => ({
  hash,
  shortHash: hash.slice(0, 3),
  parentHash: `${hash}-parent`,
  author: { name: 'a', email: 'e', date: '', timestamp: 0 },
  subject: hash,
  status: 'M',
  path: 'new.ts',
  insertions: 0,
  deletions: 0,
  isBinary: false,
  ...overrides,
});

const commits = [
  commit('ccc'),
  commit('bbb', { status: 'R', oldPath: 'old.ts' }),
  commit('aaa', { status: 'A', path: 'old.ts', parentHash: null }),
];
const none = { activeKey: 'ccc', pickA: null, pickB: null };

describe('resolveComparison', () => {
  it('shows a commit against its parent', () => {
    const result = resolveComparison('new.ts', commits, none)!;
    expect(result.base?.ref).toBe('ccc-parent');
    expect(result.target?.ref).toBe('ccc');
  });

  it('uses the old path on the parent side of a rename', () => {
    const result = resolveComparison('new.ts', commits, { ...none, activeKey: 'bbb' })!;
    expect(result.base?.path).toBe('old.ts');
    expect(result.target?.path).toBe('new.ts');
  });

  it('has no base when the commit added the file', () => {
    expect(resolveComparison('new.ts', commits, { ...none, activeKey: 'aaa' })!.base).toBeNull();
  });

  it('has no target when the commit deleted the file', () => {
    const deleted = [commit('ddd', { status: 'D' })];
    const result = resolveComparison('new.ts', deleted, { ...none, activeKey: 'ddd' })!;
    expect(result.target).toBeNull();
    expect(result.base?.ref).toBe('ddd-parent');
  });

  it('compares the working copy against HEAD', () => {
    const result = resolveComparison('new.ts', commits, { ...none, activeKey: WORKING_COPY })!;
    expect(result.base?.ref).toBe('HEAD');
    expect(result.target?.ref).toBe(WORKING_COPY);
  });

  it('compares picked versions using each commit’s own path', () => {
    const result = resolveComparison('new.ts', commits, { ...none, pickA: 'aaa', pickB: WORKING_COPY })!;
    expect(result.base).toMatchObject({ ref: 'aaa', path: 'old.ts' });
    expect(result.target).toMatchObject({ ref: WORKING_COPY, path: 'new.ts' });
  });
});

describe('pickSide', () => {
  it('pairs the first pick with the active row', () => {
    expect(pickSide(none, 'A', 'aaa', commits)).toMatchObject({ pickA: 'aaa', pickB: 'ccc' });
  });

  it('falls back to a neighbour when picking the active row', () => {
    expect(pickSide(none, 'B', 'ccc', commits)).toMatchObject({ pickA: 'bbb', pickB: 'ccc' });
    expect(pickSide(none, 'A', 'ccc', commits)).toMatchObject({ pickA: 'ccc', pickB: WORKING_COPY });
  });

  it('replaces one side and keeps the other', () => {
    const picked = { ...none, pickA: 'aaa', pickB: 'ccc' };
    expect(pickSide(picked, 'B', 'bbb', commits)).toMatchObject({ pickA: 'aaa', pickB: 'bbb' });
  });

  it('swaps when picking the version on the other side', () => {
    const picked = { ...none, pickA: 'aaa', pickB: 'ccc' };
    expect(pickSide(picked, 'A', 'ccc', commits)).toMatchObject({ pickA: 'ccc', pickB: 'aaa' });
  });

  it('clears the comparison when a pick is clicked again', () => {
    const picked = { ...none, pickA: 'aaa', pickB: 'ccc' };
    expect(pickSide(picked, 'A', 'aaa', commits)).toMatchObject({ pickA: null, pickB: null });
  });
});

describe('filterFiles', () => {
  const files = ['src/git/DiffService.ts', 'src/git/CommitService.ts', 'docs/service-notes.md', 'README.md'];

  it('returns the start of the list without a query', () => {
    expect(filterFiles(files, ' ', 2)).toEqual(files.slice(0, 2));
  });

  it('ranks file-name prefixes above other matches', () => {
    expect(filterFiles(files, 'diff', 10)[0]).toBe('src/git/DiffService.ts');
    expect(filterFiles(['diffs/a.ts', 'src/diff.ts'], 'diff', 10)[0]).toBe('src/diff.ts');
  });

  it('matches characters in order', () => {
    expect(filterFiles(files, 'cmtsvc', 10)).toEqual(['src/git/CommitService.ts']);
    expect(filterFiles(files, 'zzz', 10)).toEqual([]);
  });

  it('respects the limit', () => {
    expect(filterFiles(files, 's', 1)).toHaveLength(1);
  });
});

describe('timeAgo', () => {
  it('formats elapsed time', () => {
    const minute = 60000;
    expect(timeAgo(0, 30000)).toBe('just now');
    expect(timeAgo(0, 5 * minute)).toBe('5m ago');
    expect(timeAgo(0, 3 * 60 * minute)).toBe('3h ago');
    expect(timeAgo(0, 2 * 1440 * minute)).toBe('2d ago');
    expect(timeAgo(0, 400 * 1440 * minute)).toBe('1y ago');
  });
});

describe('theme colors', () => {
  it('passes hex through and converts rgb() and rgba()', () => {
    expect(toHexColor(' #1e1e1e ')).toBe('#1e1e1e');
    expect(toHexColor('#000')).toBe('#000000');
    expect(toHexColor('#f0a8')).toBe('#ff00aa88');
    expect(toHexColor('rgb(255, 0, 16)')).toBe('#ff0010');
    expect(toHexColor('rgba(255, 255, 255, 0.5)')).toBe('#ffffff80');
  });

  it('rejects values Monaco can’t use', () => {
    expect(toHexColor('')).toBeUndefined();
    expect(toHexColor('var(--x)')).toBeUndefined();
  });

  it('maps theme keys to VS Code variables', () => {
    expect(cssVariableFor('diffEditor.insertedTextBackground')).toBe(
      '--vscode-diffEditor-insertedTextBackground'
    );
  });
});
