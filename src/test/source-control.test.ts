import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { SourceControlService, describeGitError, parseStatus } from '../git/SourceControlService';
import { GitProcess, GitProcessError } from '../git/GitProcess';
import { localCommitMessage } from '../services/AIService';
import { CommitService } from '../git/CommitService';
import { BranchService } from '../git/BranchService';
import { DiffService } from '../git/DiffService';
import { StorageService } from '../services/StorageService';
import { SearchService } from '../services/SearchService';

const svc = SourceControlService;
const temps: string[] = [];

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'commitflow-scm-'));
  temps.push(dir);
  return dir;
}

async function git(cwd: string, ...args: string[]): Promise<string> {
  return (await GitProcess.exec(args, { cwd })).stdout.trim();
}

async function newRepo(withCommit = true): Promise<string> {
  const repo = tempDir();
  await git(repo, 'init', '-q', '-b', 'main');
  await git(repo, 'config', 'user.name', 'Test User');
  await git(repo, 'config', 'user.email', 'test@example.com');
  await git(repo, 'config', 'commit.gpgsign', 'false');
  if (withCommit) {
    write(repo, 'README.md', '# Project\n');
    await git(repo, 'add', '.');
    await git(repo, 'commit', '-q', '-m', 'chore: initial commit');
  }
  return repo;
}

function write(repo: string, file: string, content: string): void {
  fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
  fs.writeFileSync(path.join(repo, file), content);
}

afterEach(() => {
  for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('working tree status', () => {
  let repo: string;
  beforeEach(async () => {
    repo = await newRepo();
  });

  it('reports a clean repository on its branch', async () => {
    const status = await svc.getStatus(repo);
    expect(status).toMatchObject({ staged: [], unstaged: [], conflicts: [], branch: 'main', upstream: null, hasRemote: false });
    expect(status.head).toMatch(/^[0-9a-f]{7}$/);
    expect(status.operation).toBeUndefined();
  });

  it('separates staged, unstaged and untracked changes, including one file in both', async () => {
    write(repo, 'README.md', '# Staged\n');
    await git(repo, 'add', 'README.md');
    write(repo, 'README.md', '# Staged then edited\n');
    write(repo, 'notes/new file.txt', 'new');

    const status = await svc.getStatus(repo);
    expect(status.staged).toEqual([{ path: 'README.md', status: 'M' }]);
    expect(status.unstaged).toEqual([
      { path: 'README.md', status: 'M' },
      { path: 'notes/new file.txt', status: 'U' },
    ]);
  });

  it('keeps unusual file names intact and reports staged renames', async () => {
    write(repo, 'späce & ünïcode.txt', 'x');
    write(repo, ':colon*.txt', 'x');
    await git(repo, 'mv', 'README.md', 'docs.md');

    const status = await svc.getStatus(repo);
    expect(status.staged).toEqual([{ path: 'docs.md', oldPath: 'README.md', status: 'R' }]);
    expect(status.unstaged.map((f) => f.path).sort()).toEqual([':colon*.txt', 'späce & ünïcode.txt']);
  });

  it('parses porcelain v2 output', () => {
    const output = [
      '# branch.oid 1234567890abcdef',
      '# branch.head feature/x',
      '# branch.upstream origin/feature/x',
      '# branch.ab +2 -3',
      '2 R. N... 100644 100644 100644 aaa bbb R100 new name.ts',
      'old name.ts',
      'u UU N... 100644 100644 100644 100644 a b c conflicted.ts',
      '? untracked.ts',
      '',
    ].join('\0');
    expect(parseStatus(output)).toEqual({
      staged: [{ path: 'new name.ts', oldPath: 'old name.ts', status: 'R' }],
      unstaged: [{ path: 'untracked.ts', status: 'U' }],
      conflicts: [{ path: 'conflicted.ts', status: '!' }],
      branch: 'feature/x',
      head: '1234567',
      upstream: 'origin/feature/x',
      ahead: 2,
      behind: 3,
    });
  });

  it('handles a repository with no commits yet', async () => {
    const empty = await newRepo(false);
    write(empty, 'a.txt', 'a');
    await svc.stage(empty, ['a.txt']);
    expect((await svc.getStatus(empty)).head).toBeNull();
    expect((await svc.getStatus(empty)).staged).toEqual([{ path: 'a.txt', status: 'A' }]);

    await svc.unstage(empty, ['a.txt']);
    expect((await svc.getStatus(empty)).unstaged).toEqual([{ path: 'a.txt', status: 'U' }]);
  });
});

describe('staging and discarding', () => {
  let repo: string;
  beforeEach(async () => {
    repo = await newRepo();
  });

  it('stages and unstages only the named files, taking names literally', async () => {
    write(repo, '*.txt', 'star');
    write(repo, 'other.txt', 'other');
    await svc.stage(repo, ['*.txt']);
    expect((await svc.getStatus(repo)).staged).toEqual([{ path: '*.txt', status: 'A' }]);

    await svc.stageAll(repo);
    expect((await svc.getStatus(repo)).staged).toHaveLength(2);
    await svc.unstage(repo, ['other.txt']);
    expect((await svc.getStatus(repo)).staged).toEqual([{ path: '*.txt', status: 'A' }]);
    await svc.unstageAll(repo);
    expect((await svc.getStatus(repo)).staged).toEqual([]);
  });

  it('stages deletions', async () => {
    fs.rmSync(path.join(repo, 'README.md'));
    await svc.stage(repo, ['README.md']);
    expect((await svc.getStatus(repo)).staged).toEqual([{ path: 'README.md', status: 'D' }]);
  });

  it('discards edits and new files but leaves staged work and ignored files alone', async () => {
    write(repo, '.gitignore', 'build/\n');
    await git(repo, 'add', '.gitignore');
    await git(repo, 'commit', '-q', '-m', 'ignore build');
    write(repo, 'build/out.js', 'ignored');
    write(repo, 'staged.txt', 'keep me');
    await svc.stage(repo, ['staged.txt']);
    write(repo, 'README.md', 'edited');
    write(repo, 'scratch.txt', 'throw away');

    await svc.discard(repo, (await svc.getStatus(repo)).unstaged);

    expect(fs.readFileSync(path.join(repo, 'README.md'), 'utf8')).toBe('# Project\n');
    expect(fs.existsSync(path.join(repo, 'scratch.txt'))).toBe(false);
    expect(fs.existsSync(path.join(repo, 'build/out.js'))).toBe(true);
    expect((await svc.getStatus(repo)).staged).toEqual([{ path: 'staged.txt', status: 'A' }]);
  });
});

describe('committing', () => {
  let repo: string;
  beforeEach(async () => {
    repo = await newRepo();
  });

  it('commits staged changes and amends the last commit', async () => {
    await expect(svc.commit(repo, '  ')).rejects.toThrow('Write a commit message first.');

    write(repo, 'a.txt', 'a');
    await svc.stage(repo, ['a.txt']);
    await svc.commit(repo, 'feat: add a\n\nWith a body.');
    expect(await git(repo, 'log', '-1', '--format=%B')).toBe('feat: add a\n\nWith a body.');

    await svc.commit(repo, 'feat: add file a', { amend: true });
    expect(await git(repo, 'rev-list', '--count', 'HEAD')).toBe('2');
    expect(await svc.getLastCommitMessage(repo)).toBe('feat: add file a');
  });

  it('undoes the last commit, keeping its changes staged', async () => {
    write(repo, 'a.txt', 'a');
    await svc.stage(repo, ['a.txt']);
    await svc.commit(repo, 'feat: add a');

    expect(await svc.undoLastCommit(repo)).toBe('feat: add a');
    expect(await git(repo, 'rev-list', '--count', 'HEAD')).toBe('1');
    expect((await svc.getStatus(repo)).staged).toEqual([{ path: 'a.txt', status: 'A' }]);
  });

  it('undoes the very first commit', async () => {
    const fresh = await newRepo(false);
    write(fresh, 'a.txt', 'a');
    await svc.stage(fresh, ['a.txt']);
    await svc.commit(fresh, 'first');

    expect(await svc.undoLastCommit(fresh)).toBe('first');
    const status = await svc.getStatus(fresh);
    expect(status.head).toBeNull();
    expect(status.staged).toEqual([{ path: 'a.txt', status: 'A' }]);
  });

  it('describes staged changes for a message, or all changes when nothing is staged', async () => {
    write(repo, 'README.md', 'changed');
    write(repo, 'new.ts', 'new');
    let changes = await svc.getChangesForMessage(repo);
    expect(changes.files.map((f) => f.path)).toEqual(['README.md', 'new.ts']);
    expect(changes.diff).toContain('+changed');

    await svc.stage(repo, ['new.ts']);
    changes = await svc.getChangesForMessage(repo);
    expect(changes.files).toEqual([{ path: 'new.ts', status: 'A' }]);
    expect(changes.diff).toContain('+new');
  });
});

describe('merges and stashes', () => {
  let repo: string;
  beforeEach(async () => {
    repo = await newRepo();
  });

  it('reports merge conflicts and aborts the merge', async () => {
    await git(repo, 'checkout', '-q', '-b', 'other');
    write(repo, 'README.md', 'other side\n');
    await git(repo, 'commit', '-q', '-am', 'other');
    await git(repo, 'checkout', '-q', 'main');
    write(repo, 'README.md', 'main side\n');
    await git(repo, 'commit', '-q', '-am', 'main');
    await expect(git(repo, 'merge', 'other')).rejects.toThrow();

    const status = await svc.getStatus(repo);
    expect(status.conflicts).toEqual([{ path: 'README.md', status: '!' }]);
    expect(status.operation).toBe('merge');

    await svc.abortOperation(repo);
    const after = await svc.getStatus(repo);
    expect(after.conflicts).toEqual([]);
    expect(after.operation).toBeUndefined();
  });

  it('stashes with and without new files, lists, pops and drops', async () => {
    write(repo, 'README.md', 'edit');
    write(repo, 'new.txt', 'new');

    await svc.stash(repo, { message: 'tracked only' });
    expect((await svc.getStatus(repo)).unstaged).toEqual([{ path: 'new.txt', status: 'U' }]);
    await svc.stash(repo, { includeUntracked: true, message: 'with new files' });
    expect((await svc.getStatus(repo)).unstaged).toEqual([]);

    const stashes = await svc.getStashes(repo);
    expect(stashes.map((s) => [s.index, s.message])).toEqual([
      [0, 'On main: with new files'],
      [1, 'On main: tracked only'],
    ]);

    await svc.stashAction(repo, 'pop', 0);
    expect(fs.existsSync(path.join(repo, 'new.txt'))).toBe(true);
    await svc.stashAction(repo, 'drop', 0);
    expect(await svc.getStashes(repo)).toEqual([]);
  });
});

describe('remotes', () => {
  it('publishes a branch, then pushes, pulls and syncs', async () => {
    const remote = tempDir();
    await git(remote, 'init', '-q', '--bare', '-b', 'main');
    const repo = await newRepo();
    await git(repo, 'remote', 'add', 'origin', remote);

    expect((await svc.getStatus(repo)).hasRemote).toBe(true);
    await svc.push(repo); // No upstream yet, so this publishes.
    expect((await svc.getStatus(repo)).upstream).toBe('origin/main');

    // Someone else pushes a commit.
    const other = tempDir();
    await git(other, 'clone', '-q', remote, '.');
    await git(other, 'config', 'user.name', 'Other');
    await git(other, 'config', 'user.email', 'other@example.com');
    write(other, 'theirs.txt', 'theirs');
    await git(other, 'add', '.');
    await git(other, 'commit', '-q', '-m', 'theirs');
    await git(other, 'push', '-q');

    write(repo, 'mine.txt', 'mine');
    await svc.stage(repo, ['mine.txt']);
    await svc.commit(repo, 'mine');
    await svc.fetch(repo);
    expect(await svc.getStatus(repo)).toMatchObject({ ahead: 1, behind: 1 });

    await expect(svc.push(repo)).rejects.toSatisfy(
      (err: unknown) => describeGitError(err) === 'The remote has commits you don’t have. Pull first, then push again.'
    );

    await git(repo, 'config', 'pull.rebase', 'true');
    await svc.sync(repo);
    expect(await svc.getStatus(repo)).toMatchObject({ ahead: 0, behind: 0 });
    expect(fs.existsSync(path.join(repo, 'theirs.txt'))).toBe(true);
  });

  it('refuses to push without a remote', async () => {
    const repo = await newRepo();
    await expect(svc.push(repo)).rejects.toThrow('This repository has no remote to publish to.');
  });
});

describe('messages', () => {
  it('turns git errors into plain sentences', () => {
    const error = (stderr: string) => new GitProcessError('Git command failed', [], stderr, 1);
    expect(describeGitError(error('fatal: The current branch x has no upstream branch.'))).toContain('Publish Branch');
    expect(describeGitError(error('fatal: Could not resolve host: github.com'))).toBe('Couldn’t reach the remote. Check your connection.');
    expect(describeGitError(error('error: pathspec did not match\nhint: try again'))).toBe('pathspec did not match');
  });

  it('writes a basic commit message from file names', () => {
    expect(localCommitMessage([{ path: 'docs/guide.md', status: 'M' }])).toBe('docs: update guide.md');
    expect(localCommitMessage([{ path: 'src/a.test.ts', status: 'A' }, { path: 'src/b.test.ts', status: 'U' }])).toBe(
      'test: add a.test.ts and b.test.ts'
    );
    expect(
      localCommitMessage([
        { path: 'src/a.ts', status: 'M' },
        { path: 'src/b.ts', status: 'D' },
        { path: 'src/c.ts', status: 'M' },
      ])
    ).toBe('chore: update a.ts and 2 other files');
    expect(localCommitMessage([])).toBe('');
  });
});

describe('commit neighbours and files', () => {
  it('finds the older and newer commit, staying on the same line through a merge', async () => {
    const repo = await newRepo();
    const commit = async (file: string, message: string) => {
      write(repo, file, message);
      await git(repo, 'add', '.');
      await git(repo, 'commit', '-q', '-m', message);
      return git(repo, 'rev-parse', 'HEAD');
    };
    const first = await git(repo, 'rev-parse', 'HEAD');
    const second = await commit('a.txt', 'second');
    await git(repo, 'checkout', '-q', '-b', 'side');
    const side = await commit('side.txt', 'side');
    await git(repo, 'checkout', '-q', 'main');
    const third = await commit('b.txt', 'third');
    await git(repo, 'merge', '-q', '--no-ff', 'side', '-m', 'merge side');
    const merge = await git(repo, 'rev-parse', 'HEAD');

    expect(await CommitService.getAdjacentCommits(repo, first)).toEqual({ older: null, newer: second });
    // second has two children; "next" follows main, not the side branch.
    expect(await CommitService.getAdjacentCommits(repo, second)).toEqual({ older: first, newer: third });
    expect(await CommitService.getAdjacentCommits(repo, side)).toEqual({ older: second, newer: merge });
    expect(await CommitService.getAdjacentCommits(repo, merge)).toEqual({ older: third, newer: null });

    // A commit only on another branch still finds its newer commit there.
    await git(repo, 'checkout', '-q', '-b', 'later', side);
    const later = await commit('later.txt', 'later');
    await git(repo, 'checkout', '-q', 'main');
    expect((await CommitService.getAdjacentCommits(repo, later)).newer).toBeNull();
    expect((await CommitService.getAdjacentCommits(repo, side.slice(0, 7))).older).toBe(second);
  });

  it('lists the files a commit changed, including renames, deletions and the first commit', async () => {
    const repo = await newRepo();
    expect(await svc.getCommitFiles(repo, 'HEAD')).toEqual([{ path: 'README.md', status: 'A' }]);

    write(repo, 'keep.txt', 'keep');
    write(repo, 'gone.txt', 'gone');
    await git(repo, 'add', '.');
    await git(repo, 'commit', '-q', '-m', 'add');
    await git(repo, 'mv', 'README.md', 'docs file.md');
    fs.rmSync(path.join(repo, 'gone.txt'));
    write(repo, 'keep.txt', 'changed');
    await git(repo, 'add', '-A');
    await git(repo, 'commit', '-q', '-m', 'change');

    const files = await svc.getCommitFiles(repo, 'HEAD');
    expect(files).toEqual(
      expect.arrayContaining([
        { path: 'docs file.md', oldPath: 'README.md', status: 'R' },
        { path: 'gone.txt', status: 'D' },
        { path: 'keep.txt', status: 'M' },
      ])
    );
    expect(files).toHaveLength(3);
  });
});

describe('starred commits', () => {
  const memento = () => {
    const data = new Map<string, unknown>();
    return {
      get: (key: string, fallback?: unknown) => (data.has(key) ? data.get(key) : fallback),
      update: async (key: string, value: unknown) => void data.set(key, value),
      keys: () => [...data.keys()],
    } as any;
  };

  it('stars and unstars per repository and tells listeners', async () => {
    const storage = new StorageService(memento(), memento());
    const changed: string[] = [];
    const stop = storage.onStarsChanged((root) => changed.push(root));

    expect(await storage.toggleStar('/repo/a', 'h1')).toEqual(['h1']);
    await storage.toggleStar('/repo/a', 'h2');
    await storage.toggleStar('/repo/b', 'h1');
    expect(storage.getStarred('/repo/a')).toEqual(['h1', 'h2']);
    expect(await storage.toggleStar('/repo/a', 'h1')).toEqual(['h2']);
    expect(storage.getStarred('/repo/b')).toEqual(['h1']);
    expect(changed).toEqual(['/repo/a', '/repo/a', '/repo/b', '/repo/a']);

    stop();
    await storage.toggleStar('/repo/a', 'h3');
    expect(changed).toHaveLength(4);
  });

  it('keeps every star when several are clicked before the first is saved', async () => {
    const data = new Map<string, unknown>();
    const slow = {
      get: (key: string, fallback?: unknown) => data.get(key) ?? fallback,
      update: (key: string, value: unknown) =>
        new Promise<void>((resolve) => setTimeout(() => resolve(void data.set(key, value)), 5)),
      keys: () => [...data.keys()],
    } as any;
    const storage = new StorageService(memento(), slow);

    await Promise.all(['h1', 'h2', 'h3', 'h4'].map((hash) => storage.toggleStar('/repo', hash)));
    expect(storage.getStarred('/repo')).toEqual(['h1', 'h2', 'h3', 'h4']);
  });

  it('limits listing and search to starred commits', async () => {
    const repo = await newRepo();
    const hashes: string[] = [];
    for (const name of ['alpha', 'beta', 'gamma']) {
      write(repo, `${name}.txt`, name);
      await git(repo, 'add', '.');
      await git(repo, 'commit', '-q', '-m', `feat: add ${name}`);
      hashes.push(await git(repo, 'rev-parse', 'HEAD'));
    }
    const starred = new Set([hashes[0], hashes[2]]);

    const all = await SearchService.search(repo, '', { onlyHashes: starred });
    expect(all.commits.map((c) => c.subject)).toEqual(['feat: add gamma', 'feat: add alpha']);
    expect(all.totalCount).toBe(2);

    const search = await SearchService.search(repo, 'gamma', { onlyHashes: starred });
    expect(search.commits.map((c) => c.subject)).toEqual(['feat: add gamma']);
    expect((await SearchService.search(repo, 'beta', { onlyHashes: starred })).commits).toEqual([]);
    expect((await SearchService.search(repo, '', { onlyHashes: new Set() })).totalCount).toBe(0);

    const paged = await SearchService.search(repo, '', { onlyHashes: starred, page: 2, pageSize: 1 });
    expect(paged.commits.map((c) => c.subject)).toEqual(['feat: add alpha']);
    expect(paged.hasMore).toBe(false);
  });
});

describe('compare and merge check', () => {
  async function branchedRepo() {
    const repo = await newRepo();
    write(repo, 'shared.txt', 'line 1\nline 2\n');
    await git(repo, 'add', '.');
    await git(repo, 'commit', '-q', '-m', 'base');
    await git(repo, 'checkout', '-q', '-b', 'feature');
    write(repo, 'feature.txt', 'feature work\n');
    write(repo, 'shared.txt', 'line 1 from feature\nline 2\n');
    await git(repo, 'add', '.');
    await git(repo, 'commit', '-q', '-m', 'feature work');
    await git(repo, 'checkout', '-q', 'main');
    write(repo, 'main-only.txt', 'main moved on\n');
    await git(repo, 'add', '.');
    await git(repo, 'commit', '-q', '-m', 'main moves on');
    return repo;
  }

  it('rejects names that are not commits, including ones shaped like options', async () => {
    const repo = await newRepo();
    const out = path.join(repo, 'written.txt');
    await expect(DiffService.compareCommits(repo, `--output=${out}`, 'HEAD')).rejects.toThrow("isn't a commit, branch or tag");
    expect(fs.existsSync(out)).toBe(false);
    await expect(DiffService.compareCommits(repo, 'no-such-branch', 'HEAD')).rejects.toThrow('"no-such-branch"');
  });

  it('shows only the branch’s own changes in branch mode', async () => {
    const repo = await branchedRepo();

    const direct = await DiffService.compareCommits(repo, 'main', 'feature');
    expect(direct.files.map((f) => f.path).sort()).toEqual(['feature.txt', 'main-only.txt', 'shared.txt']);

    const branch = await DiffService.compareCommits(repo, 'main', 'feature', 'branch');
    expect(branch.files.map((f) => f.path).sort()).toEqual(['feature.txt', 'shared.txt']);
    expect(branch.baseSubject).toBe('base');
    expect(branch.targetSubject).toBe('feature work');
    expect(branch).toMatchObject({ ahead: 1, behind: 1, mode: 'branch' });
  });

  it('predicts conflicts without touching the repository', async () => {
    const repo = await branchedRepo();
    expect(await DiffService.checkMerge(repo, 'main', 'feature')).toMatchObject({ clean: true, conflicts: [] });

    write(repo, 'shared.txt', 'line 1 from main\nline 2\n');
    await git(repo, 'commit', '-q', '-am', 'main edits the same line');
    const head = await git(repo, 'rev-parse', 'HEAD');

    const result = await DiffService.checkMerge(repo, 'main', 'feature');
    expect(result.clean).toBe(false);
    expect(result.conflicts).toEqual(['shared.txt']);
    const merged = await git(repo, 'cat-file', 'blob', `${result.tree}:shared.txt`);
    expect(merged).toContain('<<<<<<<');

    expect(await git(repo, 'rev-parse', 'HEAD')).toBe(head);
    expect(await git(repo, 'status', '--porcelain')).toBe('');
  });
});

describe('listing branches and tags', () => {
  it('lists every branch and tag newest first, current branch on top, tags peeled to their commit', async () => {
    const repo = await newRepo();
    for (let i = 1; i <= 15; i++) await git(repo, 'branch', `b${i}`);
    write(repo, 'x.txt', 'x');
    await git(repo, 'add', '.');
    await git(repo, 'commit', '-q', '-m', 'feat: newest work');
    await git(repo, 'tag', '-a', 'v1', '-m', 'release one');
    const head = await git(repo, 'rev-parse', '--short', 'HEAD');

    const refs = await BranchService.listRefs(repo);
    expect(refs.filter((r) => r.kind === 'branch')).toHaveLength(16);
    expect(refs[0]).toMatchObject({ name: 'main', kind: 'branch', current: true, subject: 'feat: newest work', author: 'Test User' });
    const tag = refs.find((r) => r.name === 'v1')!;
    expect(tag).toMatchObject({ kind: 'tag', hash: head, subject: 'feat: newest work', current: false });
  });
});
