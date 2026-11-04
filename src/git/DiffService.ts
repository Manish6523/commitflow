import { GitProcess } from './GitProcess';
import { CommitComparisonResult, FileChange } from '../types/git';
import { parseRawNumstatZ } from './parseChanges';

export class DiffService {
  /**
   * Compare two revisions (commits, branches, or tags).
   */
  public static async compareCommits(
    repoRoot: string,
    baseCommit: string,
    targetCommit: string
  ): Promise<CommitComparisonResult> {
    // 1. Calculate ahead / behind count
    let ahead = 0;
    let behind = 0;
    try {
      const countRes = await GitProcess.exec(
        ['rev-list', '--left-right', '--count', `${baseCommit}...${targetCommit}`],
        { cwd: repoRoot }
      );
      const [behindStr, aheadStr] = countRes.stdout.trim().split(/\s+/);
      behind = parseInt(behindStr, 10) || 0;
      ahead = parseInt(aheadStr, 10) || 0;
    } catch {
      // Direct commit compare without merge base fallback
    }

    // 2. Changed files and numstat between base and target
    const numstatRes = await GitProcess.exec(
      ['diff', '--raw', '--numstat', '-z', `${baseCommit}..${targetCommit}`],
      { cwd: repoRoot }
    );
    const files: FileChange[] = parseRawNumstatZ(numstatRes.stdout);

    let totalInsertions = 0;
    let totalDeletions = 0;
    for (const f of files) {
      totalInsertions += f.insertions;
      totalDeletions += f.deletions;
    }

    // 3. Diff content (bounded)
    let diff = '';
    try {
      const diffRes = await GitProcess.exec(
        ['diff', `${baseCommit}..${targetCommit}`],
        { cwd: repoRoot, maxBuffer: 20 * 1024 * 1024 }
      );
      diff = diffRes.stdout;
    } catch {
      diff = 'Diff output exceeded maximum buffer.';
    }

    return {
      baseCommit,
      targetCommit,
      ahead,
      behind,
      files,
      totalInsertions,
      totalDeletions,
      diff,
    };
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

