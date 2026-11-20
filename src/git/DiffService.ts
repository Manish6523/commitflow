import { GitProcess, GitProcessError } from './GitProcess';
import { CommitComparisonResult, CompareMode, FileChange, MergeCheckResult } from '../types/git';
import { parseRawNumstatZ } from './parseChanges';

export class DiffService {
  /**
   * Find the commit a name refers to, such as a hash, branch, tag or HEAD~1.
   * The name never reaches git as an option, so "--output=x" is just a bad name.
   */
  public static async resolveCommit(repoRoot: string, ref: string): Promise<string> {
    const name = ref.trim();
    try {
      const res = await GitProcess.exec(['rev-parse', '--verify', '--quiet', '--end-of-options', `${name}^{commit}`], {
        cwd: repoRoot,
      });
      const hash = res.stdout.trim();
      if (/^[0-9a-f]{40,64}$/.test(hash)) return hash;
    } catch {
      // Reported below.
    }
    throw new Error(`"${name}" isn't a commit, branch or tag in this repository.`);
  }

  /**
   * Compare two revisions. "direct" compares them as they are. "branch" shows
   * only what Target changed since it split from Base, which is what merging
   * Target into Base would bring in.
   */
  public static async compareCommits(
    repoRoot: string,
    baseCommit: string,
    targetCommit: string,
    mode: CompareMode = 'direct'
  ): Promise<CommitComparisonResult> {
    const run = async (args: string[]) => (await GitProcess.exec(args, { cwd: repoRoot })).stdout;
    const [base, target] = await Promise.all([
      this.resolveCommit(repoRoot, baseCommit),
      this.resolveCommit(repoRoot, targetCommit),
    ]);

    let from = base;
    if (mode === 'branch') {
      from = (await run(['merge-base', base, target]).catch(() => '')).trim();
      if (!from) throw new Error(`${baseCommit} and ${targetCommit} have no history in common.`);
    }

    const [counts, numstat, subjects] = await Promise.all([
      run(['rev-list', '--left-right', '--count', `${base}...${target}`]).catch(() => '0 0'),
      run(['diff', '--raw', '--numstat', '-z', from, target, '--']),
      run(['log', '--no-walk=unsorted', '--format=%s', from, target, '--']),
    ]);
    const [behind, ahead] = counts.trim().split(/\s+/).map((n) => parseInt(n, 10) || 0);
    const [baseSubject = '', targetSubject = baseSubject] = subjects.split('\n');
    const files: FileChange[] = parseRawNumstatZ(numstat);

    return {
      baseCommit,
      targetCommit,
      baseHash: from,
      targetHash: target,
      baseSubject,
      targetSubject: from === target ? baseSubject : targetSubject,
      mode,
      ahead,
      behind,
      files,
      totalInsertions: files.reduce((sum, f) => sum + f.insertions, 0),
      totalDeletions: files.reduce((sum, f) => sum + f.deletions, 0),
    };
  }

  /**
   * Try merging Target into Base without touching the working tree, index or
   * any branch, and report the files that would conflict.
   */
  public static async checkMerge(repoRoot: string, baseCommit: string, targetCommit: string): Promise<MergeCheckResult> {
    const [base, target] = await Promise.all([
      this.resolveCommit(repoRoot, baseCommit),
      this.resolveCommit(repoRoot, targetCommit),
    ]);
    const args = ['merge-tree', '--write-tree', '--name-only', '--no-messages', '-z', base, target];
    let output: string;
    let clean = true;
    try {
      output = (await GitProcess.exec(args, { cwd: repoRoot })).stdout;
    } catch (err) {
      // Exit status 1 means the merge has conflicts; anything else is a real failure.
      if (err instanceof GitProcessError && err.exitCode === 1 && err.stdout) {
        output = err.stdout;
        clean = false;
      } else if (err instanceof GitProcessError && /refusing to merge unrelated histories/i.test(err.stderr)) {
        throw new Error(`${baseCommit} and ${targetCommit} have no history in common, so they can't be merged.`);
      } else {
        throw err;
      }
    }
    const [tree, ...rest] = output.split('\0');
    const end = rest.indexOf('');
    const conflicts = clean ? [] : [...new Set(rest.slice(0, end === -1 ? rest.length : end))];
    return { clean, tree: tree.trim(), conflicts };
  }

  /**
   * Cherry-pick a commit safely.
   */
  public static async cherryPick(repoRoot: string, hash: string): Promise<void> {
    // Check if working tree has changes
    const statusRes = await GitProcess.exec(['status', '--porcelain'], { cwd: repoRoot });
    if (statusRes.stdout.trim().length > 0) {
      throw new Error('Working directory has uncommitted changes. Stash or commit before cherry-picking.');
    }

    await GitProcess.exec(['cherry-pick', hash], { cwd: repoRoot });
  }

  /**
   * Revert a commit safely.
   */
  public static async revert(repoRoot: string, hash: string, isMerge: boolean = false): Promise<void> {
    const statusRes = await GitProcess.exec(['status', '--porcelain'], { cwd: repoRoot });
    if (statusRes.stdout.trim().length > 0) {
      throw new Error('Working directory has uncommitted changes. Stash or commit before reverting.');
    }

    const args = ['revert', '--no-edit'];
    if (isMerge) {
      args.push('-m', '1');
    }
    args.push(hash);

    await GitProcess.exec(args, { cwd: repoRoot });
  }
}

