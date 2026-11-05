import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { CommitService } from '../git/CommitService';
import { SearchService } from '../services/SearchService';

describe('SearchService.parseQuery', () => {
  it('keeps quoted phrases whole and words separate', () => {
    expect(SearchService.parseQuery('fix "login page" cache').terms).toEqual(['fix', 'login page', 'cache']);
  });

  it('treats apostrophes as part of a word', () => {
    expect(SearchService.parseQuery("don't crash").terms).toEqual(["don't", 'crash']);
  });

  it('keeps an unclosed quote stable while typing', () => {
    expect(SearchService.parseQuery('"login pa').terms).toEqual(['login pa']);
  });

  it('waits for a value after an operator', () => {
    const parsed = SearchService.parseQuery('author: after: fix');
    expect(parsed.filters).toEqual({});
    expect(parsed.terms).toEqual(['fix']);
  });

  it('leaves conventional commit prefixes as words', () => {
    expect(SearchService.parseQuery('fix: login').terms).toEqual(['fix:', 'login']);
  });

  it('reads every operator', () => {
    const parsed = SearchService.parseQuery(
      'committer:"Sam Lee" branch:dev tag:v1 code:useMemo hash:abc1234 is:non-merge'
    );
    expect(parsed.filters).toEqual({ committers: ['Sam Lee'], branch: 'dev', isMerge: false });
    expect(parsed).toMatchObject({ tag: 'v1', codeChange: 'useMemo', hash: 'abc1234', explicitHash: true });
  });
});

describe('search against a real repository', () => {
  let repo: string;
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  const commit = (message: string, file: string, text: string, author = 'Ada Lovelace', date?: string) => {
    mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    writeFileSync(path.join(repo, file), text);
    git('add', '-A');
    execFileSync('git', ['commit', '-q', '-m', message, `--author=${author} <${author.split(' ')[0].toLowerCase()}@example.com>`], {
      cwd: repo,
      env: { ...process.env, ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}) },
    });
    return git('rev-parse', 'HEAD');
  };
  const subjects = async (query: string, options = {}) =>
    (await SearchService.search(repo, query, options)).commits.map((c) => c.subject);
  let loginHash: string;

  beforeAll(() => {
    repo = mkdtempSync(path.join(tmpdir(), 'commitflow-search-'));
    git('init', '-q', '-b', 'main');
    git('config', 'user.name', 'Committer Bot');
    git('config', 'user.email', 'bot@example.com');

    commit('feat: add login page', 'src/auth/Login.tsx', 'const a = 1;\n', 'Ada Lovelace', '2026-01-10T12:00:00');
    loginHash = git('rev-parse', 'HEAD');
    commit('fix(auth): stop token [refresh] loop', 'src/auth/token.ts', 'useMemo();\n', 'Grace Hopper', '2026-01-15T12:00:00');
    git('tag', 'v1.0.0');
    commit('docs: explain the login flow\n\nCovers the session cookie.', 'README.md', '# Hi\n', 'Ada Lovelace', '2026-02-01T12:00:00');
    git('checkout', '-q', '-b', 'dev');
    commit('feat: dark mode', 'src/theme.ts', 'x\n', 'Grace Hopper', '2026-02-05T12:00:00');
    git('checkout', '-q', 'main');
  });

  afterAll(() => rmSync(repo, { recursive: true, force: true }));

  it('matches words in any order, across subject and body', async () => {
    expect(await subjects('page login')).toEqual(['feat: add login page']);
    expect(await subjects('session flow')).toEqual(['docs: explain the login flow']);
  });

  it('combines a message word with an author name in plain text', async () => {
    expect(await subjects('grace token')).toEqual(['fix(auth): stop token [refresh] loop']);
  });

  it('treats regex characters literally', async () => {
    expect(await subjects('[refresh]')).toEqual(['fix(auth): stop token [refresh] loop']);
    expect(await subjects('fix(auth)')).toEqual(['fix(auth): stop token [refresh] loop']);
    expect(await subjects('(((')).toEqual([]);
  });

  it('is case-insensitive for words and authors', async () => {
    expect(await subjects('LOGIN PAGE')).toEqual(['feat: add login page']);
    expect(await subjects('author:grace')).toEqual(['fix(auth): stop token [refresh] loop']);
  });

  it('finds a commit by full or short hash, even on another branch', async () => {
    expect(await subjects(loginHash)).toEqual(['feat: add login page']);
    expect(await subjects(`hash:${loginHash.slice(0, 8)}`)).toEqual(['feat: add login page']);
    const devHash = git('rev-parse', 'dev');
    expect(await subjects(devHash.slice(0, 10))).toEqual(['feat: dark mode']);
  });

  it('returns nothing for an unknown hash, and treats hex-like words as text', async () => {
    expect(await subjects('hash:deadbeef')).toEqual([]);
    expect(await subjects('defaced')).toEqual([]);
  });

  it('filters by partial, case-insensitive paths, folders and globs', async () => {
    const expected = ['fix(auth): stop token [refresh] loop', 'feat: add login page'];
    expect(await subjects('file:src/auth')).toEqual(expected);
    expect(await subjects('file:AUTH/')).toEqual(expected);
    expect(await subjects('file:login')).toEqual(['feat: add login page']);
    expect(await subjects('file:*.tsx')).toEqual(['feat: add login page']);
  });

  it('combines file with words', async () => {
    expect(await subjects('file:auth token')).toEqual(['fix(auth): stop token [refresh] loop']);
  });

  it('filters by tag, branch and code change', async () => {
    expect(await subjects('tag:v1')).toEqual(['fix(auth): stop token [refresh] loop']);
    expect(await subjects('branch:dev dark')).toEqual(['feat: dark mode']);
    expect(await subjects('dark')).toEqual([]);
    expect(await subjects('code:useMemo')).toEqual(['fix(auth): stop token [refresh] loop']);
  });

  it('returns nothing for a branch that does not exist', async () => {
    expect(await subjects('branch:nope')).toEqual([]);
    expect(await subjects('branch:--all')).toEqual([]);
  });

  it('includes the whole day in a single-day date range', async () => {
    expect(await subjects('after:2026-01-15 before:2026-01-15')).toEqual([
      'fix(auth): stop token [refresh] loop',
    ]);
  });

  it('applies dropdown filters together with a query', async () => {
    const filters = { since: '2026-01-12' };
    expect(await subjects('login', { filters })).toEqual(['docs: explain the login flow']);
    expect(await subjects('login', { filters: { isMerge: true } })).toEqual([]);
  });

  it('pages through matches with accurate totals', async () => {
    const first = await SearchService.search(repo, 'author:ada login', { page: 1, pageSize: 1 });
    expect(first).toMatchObject({ totalCount: 2, hasMore: true });
    expect(first.commits[0].subject).toBe('docs: explain the login flow');

    const second = await SearchService.search(repo, 'author:ada login', { page: 2, pageSize: 1 });
    expect(second).toMatchObject({ totalCount: 2, hasMore: false });
    expect(second.commits[0].subject).toBe('feat: add login page');
  });

  it('handles a repository with no commits', async () => {
    const empty = mkdtempSync(path.join(tmpdir(), 'commitflow-empty-'));
    try {
      execFileSync('git', ['init', '-q'], { cwd: empty });
      const none = { commits: [], totalCount: 0, hasMore: false };
      expect(await CommitService.getCommits(empty)).toEqual(none);
      expect(await SearchService.search(empty, 'author:ada')).toEqual(none);
      await expect(SearchService.search(empty, 'login')).resolves.toEqual(none);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it('reports totals for filters without search text', async () => {
    const byAuthor = await CommitService.getCommits(repo, { filters: { authors: ['ada'] }, pageSize: 1 });
    expect(byAuthor).toMatchObject({ totalCount: 2, hasMore: true });

    const byFile = await CommitService.getCommits(repo, { filters: { filePath: 'README' } });
    expect(byFile.commits.map((c) => c.subject)).toEqual(['docs: explain the login flow']);
    expect(byFile.commits[0].filesChanged).toBe(1);
  });
});
