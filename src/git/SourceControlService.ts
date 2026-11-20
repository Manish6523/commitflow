import * as fs from 'fs';
import * as path from 'path';
import { GitProcess, GitProcessError } from './GitProcess';
import { ChangeStatus, StashEntry, WorkingFileChange, WorkingTreeStatus } from '../types/git';

// Network commands can wait on a slow remote or a credential helper.
const NETWORK_TIMEOUT_MS = 5 * 60 * 1000;
// Keep each command line well under Windows' length limit.
const PATHS_PER_COMMAND = 100;

/** Run git with pathspec magic turned off, so a file named ":x" or "*" means itself. */
async function git(repoRoot: string, args: string[], timeout?: number): Promise<string> {
  const res = await GitProcess.exec(['--literal-pathspecs', ...args], { cwd: repoRoot, timeout });
  return res.stdout;
}

/**
 * Run git as is. Stash takes no file names, and with --literal-pathspecs
 * `stash --include-untracked` leaves new files behind (seen in git 2.56).
 */
async function gitStash(repoRoot: string, args: string[]): Promise<string> {
  return (await GitProcess.exec(['stash', ...args], { cwd: repoRoot })).stdout;
}

async function gitForPaths(repoRoot: string, args: string[], paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += PATHS_PER_COMMAND) {
    await git(repoRoot, [...args, '--', ...paths.slice(i, i + PATHS_PER_COMMAND)]);
  }
}

/** The text after the first `count` space-separated fields. */
function afterFields(line: string, count: number): string {
  let index = 0;
  for (let i = 0; i < count; i++) {
    index = line.indexOf(' ', index) + 1;
  }
  return line.slice(index);
}

function toStatus(code: string): ChangeStatus {
  if (code === 'T') return 'M'; // A type change, such as a file becoming a symlink.
  return code as ChangeStatus;
}

/** Parse `git status --porcelain=v2 --branch -z`. */
export function parseStatus(output: string): Omit<WorkingTreeStatus, 'hasRemote' | 'operation'> {
  const status: Omit<WorkingTreeStatus, 'hasRemote' | 'operation'> = {
    staged: [],
    unstaged: [],
    conflicts: [],
    branch: null,
    head: null,
    upstream: null,
    ahead: 0,
    behind: 0,
  };

  const fields = output.split('\0');
  for (let i = 0; i < fields.length; i++) {
    const line = fields[i];
    if (!line) continue;

    if (line.startsWith('# ')) {
      const [, key, ...rest] = line.split(' ');
      const value = rest.join(' ');
      if (key === 'branch.oid') status.head = value === '(initial)' ? null : value.slice(0, 7);
      if (key === 'branch.head') status.branch = value === '(detached)' ? null : value;
      if (key === 'branch.upstream') status.upstream = value;
      if (key === 'branch.ab') {
        const match = value.match(/^\+(\d+) -(\d+)$/);
        if (match) {
          status.ahead = Number(match[1]);
          status.behind = Number(match[2]);
        }
      }
      continue;
    }

    const kind = line[0];
    if (kind === '?') {
      status.unstaged.push({ path: line.slice(2), status: 'U' });
      continue;
    }
    if (kind === 'u') {
      status.conflicts.push({ path: afterFields(line, 10), status: '!' });
      continue;
    }
    if (kind !== '1' && kind !== '2') continue;

    const [x, y] = [line[2], line[3]];
    const filePath = afterFields(line, kind === '1' ? 8 : 9);
    // A rename's original path is the next NUL-separated field.
    const oldPath = kind === '2' ? fields[++i] : undefined;

    if (x !== '.') status.staged.push({ path: filePath, oldPath, status: toStatus(x) });
    if (y !== '.') status.unstaged.push({ path: filePath, status: toStatus(y) });
  }

  return status;
}

/** Turn common git failures into a sentence someone can act on. */
export function describeGitError(err: unknown): string {
  const stderr = err instanceof GitProcessError ? err.stderr : String((err as Error)?.message ?? err);
  const rules: [RegExp, string][] = [
    [/rejected[\s\S]*(fetch first|non-fast-forward)/i, 'The remote has commits you don’t have. Pull first, then push again.'],
    [/no upstream branch|no tracking information/i, 'This branch isn’t on a remote yet. Use Publish Branch.'],
    [/Need to specify how to reconcile divergent branches|divergent branches/i, 'Your branch and the remote have both changed. Run Pull with rebase or merge from the terminal, or set git config pull.rebase.'],
    [/would be overwritten by (merge|checkout)|Please commit your changes or stash them/i, 'Your local changes would be overwritten. Commit or stash them first.'],
    [/CONFLICT|fix conflicts|unmerged files/i, 'There are merge conflicts. Resolve them in Merge Changes, then commit.'],
    [/Authentication failed|could not read Username|Permission denied \(publickey\)|terminal prompts disabled/i, 'Git couldn’t sign in to the remote. Check your credentials in a terminal.'],
    [/Could not resolve host|unable to access|Connection (timed out|refused)/i, 'Couldn’t reach the remote. Check your connection.'],
    [/nothing to commit|no changes added to commit/i, 'There is nothing to commit.'],
    [/Please tell me who you are|empty ident/i, 'Git doesn’t know your name and email yet. Set user.name and user.email.'],
    [/No stash entries found/i, 'There are no stashes.'],
    [/No local changes to save/i, 'There are no changes to stash.'],
  ];
  for (const [pattern, message] of rules) {
    if (pattern.test(stderr)) return message;
  }
  const lines = stderr.split('\n').map((l) => l.replace(/^(error|fatal|hint):\s*/i, '').trim());
  return lines.find((l) => l && !l.startsWith('Git command failed')) || 'Git reported an error.';
}

export class SourceControlService {
  public static async getStatus(repoRoot: string): Promise<WorkingTreeStatus> {
    const [output, remotes, operation] = await Promise.all([
      git(repoRoot, ['status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all']),
      git(repoRoot, ['remote']).catch(() => ''),
      this.getOperation(repoRoot),
    ]);
    return { ...parseStatus(output), hasRemote: remotes.trim().length > 0, operation };
  }

  /** A merge, rebase, cherry-pick or revert that stopped part way. */
  private static async getOperation(repoRoot: string): Promise<WorkingTreeStatus['operation']> {
    try {
      const gitDir = path.resolve(repoRoot, (await git(repoRoot, ['rev-parse', '--git-dir'])).trim());
      const has = (name: string) => fs.existsSync(path.join(gitDir, name));
      if (has('rebase-merge') || has('rebase-apply')) return 'rebase';
      if (has('MERGE_HEAD')) return 'merge';
      if (has('CHERRY_PICK_HEAD')) return 'cherry-pick';
      if (has('REVERT_HEAD')) return 'revert';
    } catch {
      // Not a repository any more; status will report that.
    }
    return undefined;
  }

  public static async stage(repoRoot: string, paths: string[]): Promise<void> {
    await gitForPaths(repoRoot, ['add', '-A'], paths);
  }

  public static async stageAll(repoRoot: string): Promise<void> {
    await git(repoRoot, ['add', '-A']);
  }

  public static async unstage(repoRoot: string, paths: string[]): Promise<void> {
    if (await this.hasCommits(repoRoot)) {
      await gitForPaths(repoRoot, ['restore', '--staged'], paths);
    } else {
      await gitForPaths(repoRoot, ['rm', '--cached', '-r', '-q'], paths);
    }
  }

  public static async unstageAll(repoRoot: string): Promise<void> {
    const { staged } = await this.getStatus(repoRoot);
    await this.unstage(repoRoot, staged.map((f) => f.path));
  }

  /** Throw away unstaged changes. New files are deleted, so callers confirm first. */
  public static async discard(repoRoot: string, changes: WorkingFileChange[]): Promise<void> {
    const untracked = changes.filter((c) => c.status === 'U').map((c) => c.path);
    const tracked = changes.filter((c) => c.status !== 'U').map((c) => c.path);
    if (tracked.length) await gitForPaths(repoRoot, ['restore', '--worktree'], tracked);
    if (untracked.length) await gitForPaths(repoRoot, ['clean', '-f', '-q'], untracked);
  }

  public static async commit(repoRoot: string, message: string, options: { amend?: boolean } = {}): Promise<void> {
    if (!message.trim()) throw new Error('Write a commit message first.');
    const args = ['commit', '--cleanup=strip', '-m', message.trim()];
    if (options.amend) args.push('--amend');
    await git(repoRoot, args);
  }

  /** Move the last commit's changes back to staged, and return its message. */
  public static async undoLastCommit(repoRoot: string): Promise<string> {
    const message = (await git(repoRoot, ['log', '-1', '--format=%B'])).trim();
    const parents = (await git(repoRoot, ['rev-list', '--parents', '-n', '1', 'HEAD'])).trim().split(' ');
    if (parents.length > 2) throw new Error('The last commit is a merge, so it can’t be undone here.');
    if (parents.length === 2) {
      await git(repoRoot, ['reset', '--soft', 'HEAD~1']);
    } else {
      await git(repoRoot, ['update-ref', '-d', 'HEAD']); // The first commit: keep its files staged.
    }
    return message;
  }

  public static async getLastCommitMessage(repoRoot: string): Promise<string> {
    if (!(await this.hasCommits(repoRoot))) return '';
    return (await git(repoRoot, ['log', '-1', '--format=%B'])).trim();
  }

  public static async pull(repoRoot: string): Promise<void> {
    await git(repoRoot, ['pull'], NETWORK_TIMEOUT_MS);
  }

  /** Push, publishing the branch to a remote first if it has no upstream. */
  public static async push(repoRoot: string, options: { force?: boolean } = {}): Promise<void> {
    const status = await this.getStatus(repoRoot);
    if (!status.branch) throw new Error('You’re not on a branch, so there’s nothing to push.');
    const args = ['push'];
    if (options.force) args.push('--force-with-lease');
    if (!status.upstream) {
      args.push('-u', await this.defaultRemote(repoRoot), status.branch);
    }
    await git(repoRoot, args, NETWORK_TIMEOUT_MS);
  }

  /** Pull then push, like the Sync button in VS Code. */
  public static async sync(repoRoot: string): Promise<void> {
    const status = await this.getStatus(repoRoot);
    if (!status.upstream) return this.push(repoRoot);
    await this.pull(repoRoot);
    await this.push(repoRoot);
  }

  public static async fetch(repoRoot: string): Promise<void> {
    await git(repoRoot, ['fetch', '--all', '--prune'], NETWORK_TIMEOUT_MS);
  }

  public static async abortOperation(repoRoot: string): Promise<void> {
    const { operation } = await this.getStatus(repoRoot);
    if (!operation) return;
    await git(repoRoot, [operation, '--abort']);
  }

  public static async getStashes(repoRoot: string): Promise<StashEntry[]> {
    const output = await gitStash(repoRoot, ['list', '-z', '--format=%gd%x1f%h%x1f%cI%x1f%s']).catch(() => '');
    return output
      .split('\0')
      .filter(Boolean)
      .map((entry) => {
        const [ref, hash, date, message] = entry.split('\x1f');
        return { index: Number(ref.match(/\{(\d+)\}/)?.[1] ?? 0), hash, date, message };
      });
  }

  public static async stash(repoRoot: string, options: { message?: string; includeUntracked?: boolean } = {}): Promise<void> {
    const args = ['push'];
    if (options.includeUntracked) args.push('--include-untracked');
    if (options.message?.trim()) args.push('-m', options.message.trim());
    await gitStash(repoRoot, args);
  }

  public static async stashAction(repoRoot: string, action: 'pop' | 'apply' | 'drop', index: number): Promise<void> {
    await gitStash(repoRoot, [action, `stash@{${index}}`]);
  }

  /** The changes a commit message should describe: staged ones, or everything if nothing is staged. */
  public static async getChangesForMessage(repoRoot: string): Promise<{ files: WorkingFileChange[]; diff: string }> {
    const status = await this.getStatus(repoRoot);
    if (status.staged.length) {
      return { files: status.staged, diff: await git(repoRoot, ['diff', '--cached', '--no-color']) };
    }
    const diff = status.unstaged.some((f) => f.status !== 'U') ? await git(repoRoot, ['diff', '--no-color']) : '';
    return { files: status.unstaged, diff };
  }

  /** The files a commit changed, compared with its first parent. */
  public static async getCommitFiles(repoRoot: string, hash: string): Promise<WorkingFileChange[]> {
    const output = await git(repoRoot, ['log', '-1', '--format=', '--name-status', '-z', '-M', '--diff-merges=first-parent', hash, '--']);
    const fields = output.split('\0');
    const files: WorkingFileChange[] = [];
    for (let i = 0; i < fields.length; ) {
      const code = fields[i++]?.trim();
      if (!code) continue;
      const letter = code[0];
      if (letter === 'R' || letter === 'C') {
        const oldPath = fields[i++];
        files.push({ path: fields[i++], oldPath, status: letter });
      } else {
        files.push({ path: fields[i++], status: toStatus(letter === 'T' ? 'M' : letter) });
      }
    }
    return files.filter((f) => f.path);
  }

  private static async hasCommits(repoRoot: string): Promise<boolean> {
    return git(repoRoot, ['rev-parse', '--verify', '-q', 'HEAD']).then(
      () => true,
      () => false
    );
  }

  private static async defaultRemote(repoRoot: string): Promise<string> {
    const remotes = (await git(repoRoot, ['remote'])).split('\n').filter(Boolean);
    if (!remotes.length) throw new Error('This repository has no remote to publish to.');
    return remotes.includes('origin') ? 'origin' : remotes[0];
  }
}
