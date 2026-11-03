import { GitProcess } from './GitProcess';
import { Branch } from '../types/git';

const BRANCH_FORMAT = '%(refname)%09%(refname:short)%09%(upstream:short)%09%(objectname:short)%09%(contents:subject)%09%(committerdate:iso8601)%09%(HEAD)';

export class BranchService {
  /**
   * Get all local and remote branches with upstream tracking and ahead/behind counts.
   */
  public static async getBranches(repoRoot: string): Promise<Branch[]> {
    const branches: Branch[] = [];

    // Local branches
    const localRes = await GitProcess.exec(
      ['for-each-ref', `--format=${BRANCH_FORMAT}`, 'refs/heads/'],
      { cwd: repoRoot }
    );
    const localBranches = await this.parseBranchOutput(repoRoot, localRes.stdout, false);
    branches.push(...localBranches);

    // Remote branches
    try {
      const remoteRes = await GitProcess.exec(
        ['for-each-ref', `--format=${BRANCH_FORMAT}`, 'refs/remotes/'],
        { cwd: repoRoot }
      );
      const remoteBranches = await this.parseBranchOutput(repoRoot, remoteRes.stdout, true);
      branches.push(...remoteBranches);
    } catch {
      // No remote branches or not configured
    }

    return branches;
  }

  private static async parseBranchOutput(
    repoRoot: string,
    rawOutput: string,
    isRemote: boolean
  ): Promise<Branch[]> {
    const branches: Branch[] = [];
    const lines = rawOutput.trim().split('\n').filter(Boolean);

    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length < 6) continue;

      const fullName = parts[0].trim();
      const name = parts[1].trim();
      const upstream = parts[2]?.trim() || undefined;
      const lastCommitHash = parts[3]?.trim() || '';
      const lastCommitSubject = parts[4]?.trim() || '';
      const lastCommitDate = parts[5]?.trim() || '';
      const headMark = parts[6]?.trim() || '';
      const isCurrent = headMark === '*';

      // Calculate ahead/behind if upstream exists
      let ahead = 0;
      let behind = 0;
      if (upstream && !isRemote) {
        try {
          const abRes = await GitProcess.exec(
            ['rev-list', '--left-right', '--count', `${name}...${upstream}`],
            { cwd: repoRoot }
          );
          const [aStr, bStr] = abRes.stdout.trim().split(/\s+/);
          ahead = parseInt(aStr, 10) || 0;
          behind = parseInt(bStr, 10) || 0;
        } catch {
          // ignore tracking calculation error
        }
      }

      let remoteName: string | undefined;
      if (isRemote) {
        const slashIdx = name.indexOf('/');
        if (slashIdx !== -1) {
          remoteName = name.substring(0, slashIdx);
        }
      }

      branches.push({
        name,
        fullName,
        isCurrent,
        isRemote,
        remoteName,
        upstream,
        ahead,
        behind,
        lastCommitHash,
        lastCommitSubject,
        lastCommitDate,
      });
    }

    return branches;
  }

  /**
   * Checkout an existing branch or commit.
   */
  public static async checkout(repoRoot: string, target: string): Promise<void> {
    await GitProcess.exec(['checkout', target], { cwd: repoRoot });
  }

  /**
   * Create and checkout a new branch from a commit or base branch.
   */
  public static async createBranch(
    repoRoot: string,
    branchName: string,
    startPoint: string = 'HEAD'
  ): Promise<void> {
    await GitProcess.exec(['checkout', '-b', branchName, startPoint], { cwd: repoRoot });
  }

  /**
   * Delete a local branch safely.
   */
  public static async deleteBranch(
    repoRoot: string,
    branchName: string,
    force: boolean = false
  ): Promise<void> {
    await GitProcess.exec(['branch', force ? '-D' : '-d', branchName], { cwd: repoRoot });
  }
}
