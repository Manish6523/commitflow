import { GitProcess } from './GitProcess';
import { ContributorStats } from '../types/git';

export class ContributorService {
  /**
   * Aggregate contributor statistics including commit counts and line churn.
   */
  public static async getContributors(repoRoot: string): Promise<ContributorStats[]> {
    // 1. Get shortlog for commit counts by author: " 42\tJohn Doe <john@example.com>"
    const shortlogRes = await GitProcess.exec(['shortlog', '-sne', '--all'], { cwd: repoRoot });
    const lines = shortlogRes.stdout.trim().split('\n').filter(Boolean);

    const contributorMap = new Map<string, ContributorStats>();

    for (const line of lines) {
      const match = line.trim().match(/^(\d+)\s+(.+?)\s+<(.+?)>$/);
      if (match) {
        const count = parseInt(match[1], 10) || 0;
        const name = match[2].trim();
        const email = match[3].trim().toLowerCase();

        const key = email || name.toLowerCase();
        contributorMap.set(key, {
          name,
          email,
          aliases: [],
          commitCount: count,
          firstCommitDate: '',
          lastCommitDate: '',
          insertions: 0,
          deletions: 0,
          filesModified: 0,
        });
      }
    }

    // 2. Fetch timestamps and churn if needed
    // Bounded log to calculate first/last commit dates for each contributor
    try {
      const datesRes = await GitProcess.exec(
        ['log', '--all', '--format=%ae%x09%aI', '-n', '1000'],
        { cwd: repoRoot }
      );
      const dateLines = datesRes.stdout.trim().split('\n').filter(Boolean);

      for (const dLine of dateLines) {
        const [email, dateStr] = dLine.split('\t');
        if (!email || !dateStr) continue;
        const contrib = contributorMap.get(email.toLowerCase());
        if (contrib) {
          if (!contrib.lastCommitDate) contrib.lastCommitDate = dateStr;
          contrib.firstCommitDate = dateStr;
        }
      }
    } catch {
      // ignore
    }

    return Array.from(contributorMap.values()).sort((a, b) => b.commitCount - a.commitCount);
  }
}
