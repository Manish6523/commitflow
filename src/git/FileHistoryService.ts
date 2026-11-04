import { GitProcess } from './GitProcess';
import { parseRawNumstatZ } from './parseChanges';
import { FileHistoryCommit, FileHistoryResult } from '../types/git';

const SEP = '\x1f';
const REC_SEP = '\x1e';
// The record separator leads each record so the stats git prints after the
// formatted header stay with the commit they belong to.
const FILE_LOG_FORMAT = REC_SEP + ['%H', '%h', '%P', '%an', '%ae', '%aI', '%at', '%s', ''].join(SEP);

export class FileHistoryService {
  /**
   * Get one page of a file's history, following renames.
   *
   * `git log --follow` applies `--skip` before filtering to the file, so paging
   * asks for everything up to the end of the page and slices it here.
   */
  public static async getFileHistory(
    repoRoot: string,
    filePath: string,
    offset: number = 0,
    limit: number = 100
  ): Promise<FileHistoryResult> {
    const [logRes, statusRes] = await Promise.all([
      GitProcess.exec(
        [
          'log',
          '--follow',
          '-M',
          '-z',
          '--raw',
          '--numstat',
          `--format=${FILE_LOG_FORMAT}`,
          '-n',
          `${offset + limit + 1}`,
          '--',
          filePath,
        ],
        { cwd: repoRoot }
      ),
      GitProcess.exec(['status', '--porcelain', '--', filePath], { cwd: repoRoot }),
    ]);

    const all = this.parseLog(logRes.stdout, filePath);
    return {
      commits: all.slice(offset, offset + limit),
      hasMore: all.length > offset + limit,
      isModified: statusRes.stdout.trim().length > 0,
    };
  }

  /**
   * Parse the log newest-first, tracking the file's path back through renames.
   */
  public static parseLog(output: string, filePath: string): FileHistoryCommit[] {
    const commits: FileHistoryCommit[] = [];
    let currentPath = filePath;

    for (const record of output.split(REC_SEP)) {
      if (!record.trim()) continue;

      const parts = record.split(SEP);
      if (parts.length < 9) continue;

      const [hash, shortHash, parents, name, email, date, timestamp, subject] = parts;
      const change = parseRawNumstatZ(parts.slice(8).join(SEP))[0];
      const path = change?.path ?? currentPath;

      commits.push({
        hash: hash.replace(/\0/g, '').trim(),
        shortHash,
        parentHash: parents.split(' ')[0] || null,
        author: { name, email, date, timestamp: parseInt(timestamp, 10) * 1000 },
        subject,
        status: change?.status ?? 'M',
        path,
        oldPath: change?.oldPath,
        insertions: change?.insertions ?? 0,
        deletions: change?.deletions ?? 0,
        isBinary: change?.isBinary ?? false,
      });

      currentPath = change?.oldPath ?? path;
    }

    return commits;
  }
}
