import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, renameSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { FileHistoryService } from '../git/FileHistoryService';
import { FileContentService, MAX_DIFF_FILE_BYTES, WORKING_COPY_REF } from '../git/FileContentService';
import { CommitService } from '../git/CommitService';
import { DiffService } from '../git/DiffService';
import { parseRawNumstatZ } from '../git/parseChanges';

describe('parseRawNumstatZ', () => {
  it('merges raw status with numstat counts, including renames and binaries', () => {
    const output = [
      ':100644 100644 aaa bbb M', 'src/a.ts',
      ':100644 100644 aaa bbb R090', 'old name.ts', 'new name.ts',
      ':000000 100644 000 ccc A', 'logo.png',
      '3\t1\tsrc/a.ts',
      '2\t2\t', 'old name.ts', 'new name.ts',
      '-\t-\tlogo.png',
      '',
    ].join('\0');

    expect(parseRawNumstatZ(output)).toEqual([
      { path: 'src/a.ts', status: 'M', insertions: 3, deletions: 1, isBinary: false },
      { path: 'new name.ts', oldPath: 'old name.ts', status: 'R', insertions: 2, deletions: 2, isBinary: false },
      { path: 'logo.png', status: 'A', insertions: 0, deletions: 0, isBinary: true },
    ]);
  });
});

describe('file history against a real repository', () => {
  let repo: string;
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  const commit = (message: string) => {
    git('add', '-A');
    git('commit', '-q', '-m', message);
    return git('rev-parse', 'HEAD');
  };
  const write = (name: string, text: string | Buffer) => writeFileSync(path.join(repo, name), text);
  let added: string;
  let renamed: string;
  let edited: string;

  beforeAll(() => {
    repo = mkdtempSync(path.join(tmpdir(), 'commitflow-test-'));
    git('init', '-q');
    git('config', 'user.name', 'Test');
    git('config', 'user.email', 'test@example.com');

    const body = Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n');
    mkdirSync(path.join(repo, 'src'));
    write('src/old.ts', `${body}\n`);
    write('unrelated.txt', 'x\n');
    added = commit('add old');
    write('unrelated.txt', 'y\n');
    commit('touch unrelated');
    renameSync(path.join(repo, 'src/old.ts'), path.join(repo, 'src/new.ts'));
    renamed = commit('rename');
    write('src/new.ts', `${body}\nextra\n`);
    edited = commit('edit');
  });

  afterAll(() => rmSync(repo, { recursive: true, force: true }));

  it('returns clean records with status, stats and parents', async () => {
    const { commits, hasMore, isModified } = await FileHistoryService.getFileHistory(repo, 'src/new.ts');

    expect(commits.map((c) => c.subject)).toEqual(['edit', 'rename', 'add old']);
    expect(commits.map((c) => c.hash)).toEqual([edited, renamed, added]);
    expect(commits.map((c) => c.status)).toEqual(['M', 'R', 'A']);
    expect(commits[0].insertions).toBe(1);
    expect(commits[2].parentHash).toBeNull();
    expect(commits[0].author.name).toBe('Test');
    expect(hasMore).toBe(false);
    expect(isModified).toBe(false);
  });

  it('records the path the file had at each commit across a rename', async () => {
    const { commits } = await FileHistoryService.getFileHistory(repo, 'src/new.ts');

    expect(commits.map((c) => c.path)).toEqual(['src/new.ts', 'src/new.ts', 'src/old.ts']);
    expect(commits[1].oldPath).toBe('src/old.ts');

    const original = await FileContentService.getContent(repo, added, commits[2].path);
    expect(original.exists).toBe(true);
    expect(original.content).toContain('line 29');
  });

  it('pages through history despite --follow ignoring --skip', async () => {
    const first = await FileHistoryService.getFileHistory(repo, 'src/new.ts', 0, 2);
    const second = await FileHistoryService.getFileHistory(repo, 'src/new.ts', 2, 2);

    expect(first.commits.map((c) => c.subject)).toEqual(['edit', 'rename']);
    expect(first.hasMore).toBe(true);
    expect(second.commits.map((c) => c.subject)).toEqual(['add old']);
    expect(second.hasMore).toBe(false);
  });

  it('reports uncommitted changes and reads the working copy', async () => {
    write('src/new.ts', 'changed on disk\n');
    try {
      const { isModified } = await FileHistoryService.getFileHistory(repo, 'src/new.ts');
      expect(isModified).toBe(true);
      const file = await FileContentService.getContent(repo, WORKING_COPY_REF, 'src/new.ts');
      expect(file.content).toBe('changed on disk\n');
    } finally {
      git('checkout', '--', 'src/new.ts');
    }
  });

  it('reports missing, binary and oversized files instead of failing', async () => {
    expect((await FileContentService.getContent(repo, added, 'src/new.ts')).exists).toBe(false);
    expect((await FileContentService.getContent(repo, WORKING_COPY_REF, 'nope.ts')).exists).toBe(false);

    write('blob.bin', Buffer.from([1, 0, 2, 0]));
    write('big.txt', 'a'.repeat(MAX_DIFF_FILE_BYTES + 1));
    const hash = commit('add binary and big');
    expect((await FileContentService.getContent(repo, hash, 'blob.bin')).isBinary).toBe(true);
    expect((await FileContentService.getContent(repo, hash, 'big.txt')).tooLarge).toBe(true);
    expect((await FileContentService.getContent(repo, WORKING_COPY_REF, 'big.txt')).tooLarge).toBe(true);
  });

  it('refuses to read outside the repository or take an option as a ref', async () => {
    await expect(FileContentService.getContent(repo, WORKING_COPY_REF, '../secret')).rejects.toThrow('outside');
    await expect(FileContentService.getContent(repo, '--output=x', 'a')).rejects.toThrow('Invalid revision');
  });

  it('lists tracked files', async () => {
    expect(await FileContentService.listTrackedFiles(repo)).toContain('src/new.ts');
  });

  it('reports line counts for commit details and comparisons', async () => {
    const details = await CommitService.getCommitDetails(repo, edited);
    expect(details.files).toEqual([
      { path: 'src/new.ts', status: 'M', insertions: 1, deletions: 0, isBinary: false },
    ]);

    const comparison = await DiffService.compareCommits(repo, added, renamed);
    const file = comparison.files.find((f) => f.path === 'src/new.ts');
    expect(file?.status).toBe('R');
    expect(file?.oldPath).toBe('src/old.ts');
  });
});
