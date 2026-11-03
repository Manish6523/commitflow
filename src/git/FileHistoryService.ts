import { GitProcess } from './GitProcess';
import { FileHistoryCommit, FileStatus } from '../types/git';

const SEP = '\x1f';
const REC_SEP = '\x1e';
const FILE_LOG_FORMAT = ['%H', '%h', '%an', '%ae', '%aI', '%at', '%s'].join(SEP) + REC_SEP;

export class FileHistoryService {
  /**
   * Get complete commit history for an individual file with rename tracking (--follow).
   */
  public static async getFileHistory(
    repoRoot: string,
    filePath: string,
    limit: number = 100
  ): Promise<FileHistoryCommit[]> {
    const commits: FileHistoryCommit[] = [];

    try {
      const res = await GitProcess.exec(
        [
          'log',
          '--follow',
          `--format=${FILE_LOG_FORMAT}`,
          '--numstat',
          '-n',
          `${limit}`,
          '--',
          filePath,
        ],
        { cwd: repoRoot }
      );

      const records = res.stdout.split(REC_SEP);
      for (const record of records) {
        if (!record.trim()) continue;

        const parts = record.split(SEP);
        if (parts.length < 7) continue;

        const hash = parts[0].trim();
        const shortHash = parts[1].trim();
        const authorName = parts[2].trim();
        const authorEmail = parts[3].trim();
        const authorDate = parts[4].trim();
        const authorTimestamp = parseInt(parts[5].trim(), 10) * 1000 || Date.now();
        const subjectAndStats = parts.slice(6).join(SEP);

        const lines = subjectAndStats.split('\n');
        const subject = lines[0].trim();

        let insertions = 0;
        let deletions = 0;
        let status: FileStatus = 'M';

        for (let i = 1; i < lines.length; i++) {
          const l = lines[i].trim();
          const match = l.match(/^([0-9-]+)\t([0-9-]+)\t(.+)$/);
          if (match) {
            insertions = match[1] === '-' ? 0 : parseInt(match[1], 10) || 0;
            deletions = match[2] === '-' ? 0 : parseInt(match[2], 10) || 0;
            break;
          }
        }

        commits.push({
          hash,
          shortHash,
          author: {
            name: authorName,
            email: authorEmail,
            date: authorDate,
            timestamp: authorTimestamp,
          },
          subject,
          status,
          insertions,
          deletions,
        });
      }
    } catch {
      // File history error or new untracked file
    }

    return commits;
  }
}
