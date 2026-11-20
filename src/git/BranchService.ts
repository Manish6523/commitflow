import { GitProcess } from './GitProcess';
import { Branch, RefSummary } from '../types/git';

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
  /**
   * Every branch, remote branch and tag with its latest commit, newest first,
   * in one git call. Tags show the commit they point to.
   */
  public static async listRefs(repoRoot: string): Promise<RefSummary[]> {
    const fields = [
      '%(HEAD)',
      '%(refname)',
      '%(objectname:short)',
      '%(*objectname:short)',
      '%(subject)',
      '%(*subject)',
      '%(authorname)',
      '%(*authorname)',
      '%(creatordate:iso-strict)',
    ];
    const res = await GitProcess.exec(
      ['for-each-ref', '--sort=-creatordate', `--format=${fields.join('%1f')}`, 'refs/heads/', 'refs/remotes/', 'refs/tags/'],
      { cwd: repoRoot }
    );
    const refs: RefSummary[] = [];
    for (const line of res.stdout.split('\n')) {
      if (!line) continue;
      const [head, refname, hash, peeledHash, subject, peeledSubject, author, peeledAuthor, date] = line.split('\x1f');
      const kind = refname.startsWith('refs/heads/') ? 'branch' : refname.startsWith('refs/tags/') ? 'tag' : 'remote';
      const name = refname.replace(/^refs\/(heads|tags|remotes)\//, '');
      // A remote's default-branch pointer, like origin/HEAD, isn't a branch.
      if (kind === 'remote' && (name.endsWith('/HEAD') || !name.includes('/'))) continue;
      refs.push({
        name,
        kind,
        hash: peeledHash || hash,
        subject: peeledSubject || subject,
        author: peeledAuthor || author,
        date,
        current: head === '*',
      });
    }
    // The branch you're on comes first, as in VS Code's pickers.
    return refs.sort((a, b) => Number(b.current) - Number(a.current));
  }

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
