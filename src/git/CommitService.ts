import { GitProcess } from './GitProcess';
import { parseRawNumstatZ } from './parseChanges';
import { CommitDetails, CommitFilterOptions, FileChange, FileStatus, GitCommit } from '../types/git';

const FIELD_SEP = '\x1f';
const RECORD_SEP = '\x1e';

// Delimited metadata format with RECORD_SEP at the BEGINNING of each record
// so that any trailing --shortstat belongs to the preceding commit
const COMMIT_FORMAT = RECORD_SEP + [
  '%H',
  '%h',
  '%T',
  '%P',
  '%an',
  '%ae',
  '%aI',
  '%at',
  '%cn',
  '%ce',
  '%cI',
  '%ct',
  '%D',
  '%G?',
  '%s',
  '%b',
].join(FIELD_SEP);

export class CommitService {
  /**
   * Get paginated commits for a repository with optional filters and sorting.
   */
  public static async getCommits(
    repoRoot: string,
    options: {
      page?: number;
      pageSize?: number;
      branch?: string;
      allBranches?: boolean;
      filters?: CommitFilterOptions;
      searchQuery?: string;
    } = {}
  ): Promise<{ commits: GitCommit[]; totalCount: number; hasMore: boolean }> {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.max(1, Math.min(200, options.pageSize ?? 30));
    const skip = (page - 1) * pageSize;

    const baseArgs = ['log'];

    if (options.allBranches) {
      baseArgs.push('--all');
    } else if (options.branch && options.branch !== 'HEAD') {
      baseArgs.push(options.branch);
    }

    // Apply filters
    if (options.filters) {
      const { authors, since, until, isMerge, filePath } = options.filters;

      if (authors && authors.length > 0) {
        for (const author of authors) {
          baseArgs.push(`--author=${author}`);
        }
      }

      if (since) {
        baseArgs.push(`--since=${since}`);
      }

      if (until) {
        baseArgs.push(`--until=${until}`);
      }

      if (isMerge === true) {
        baseArgs.push('--merges');
      } else if (isMerge === false) {
        baseArgs.push('--no-merges');
      }

      if (filePath) {
        baseArgs.push('--', filePath);
      }
    }

    if (options.searchQuery && options.searchQuery.trim()) {
      baseArgs.push(`--grep=${options.searchQuery.trim()}`, '-i');
    }

    // Calculate total count
    let totalCount = 0;
    try {
      const revListArgs = ['rev-list', '--count'];
      for (let i = 1; i < baseArgs.length; i++) {
        const arg = baseArgs[i];
        if (arg === '--shortstat' || arg.startsWith('--format=')) continue;
        revListArgs.push(arg);
      }
      if (revListArgs.length === 2) {
        revListArgs.push('HEAD');
      }
      const countRes = await GitProcess.exec(revListArgs, { cwd: repoRoot });
      totalCount = parseInt(countRes.stdout.trim(), 10) || 0;
    } catch {
      totalCount = 0;
    }

    // Fetch page of commits with shortstat
    const fetchArgs = [
      ...baseArgs,
      `--format=${COMMIT_FORMAT}`,
      '--shortstat',
      `-n`,
      `${pageSize}`,
      `--skip`,
      `${skip}`,
    ];

    try {
      const res = await GitProcess.exec(fetchArgs, { cwd: repoRoot });
      const commits = this.parseCommitsWithStats(res.stdout);
      const hasMore = skip + commits.length < totalCount;

      return {
        commits,
        totalCount,
        hasMore,
      };
    } catch (err: any) {
      if (err.stderr?.includes('does not have any commits yet') || err.stderr?.includes('fatal: your current branch')) {
        return { commits: [], totalCount: 0, hasMore: false };
      }
      throw err;
    }
  }

  /**
   * Parse commit log output separated by RECORD_SEP with shortstat summary.
   */
  public static parseCommitsWithStats(rawOutput: string): GitCommit[] {
    const rawRecords = rawOutput.split(RECORD_SEP);
    const commits: GitCommit[] = [];

    for (const record of rawRecords) {
      if (!record.trim()) continue;

      const parts = record.split(FIELD_SEP);
      if (parts.length < 15) continue;

      // Extract clean hexadecimal hash (SHA1 or SHA256)
      const rawHash = parts[0].trim();
      const hashMatch = rawHash.match(/[0-9a-fA-F]{7,64}/);
      const hash = hashMatch ? hashMatch[0] : rawHash;
      if (!hash || hash.length < 4) continue;

      const shortHash = parts[1].trim();
      const treeHash = parts[2].trim();
      const parentHashes = parts[3].trim() ? parts[3].trim().split(' ').filter(Boolean) : [];
      const authorName = parts[4].trim();
      const authorEmail = parts[5].trim();
      const authorDate = parts[6].trim();
      const authorTimestamp = parseInt(parts[7].trim(), 10) * 1000 || Date.now();
      const committerName = parts[8].trim();
      const committerEmail = parts[9].trim();
      const committerDate = parts[10].trim();
      const committerTimestamp = parseInt(parts[11].trim(), 10) * 1000 || Date.now();
      const refNamesRaw = parts[12].trim();
      const sigStatus = (parts[13].trim() || 'N') as GitCommit['signatureStatus'];
      const subject = parts[14].trim();

      // Last part contains the body and any trailing shortstat text
      const bodyAndStats = parts.slice(15).join(FIELD_SEP);
      const { body, filesChanged, insertions, deletions } = this.extractShortStat(bodyAndStats);

      // Parse refs (branches and tags)
      const { branches, tags } = this.parseRefNames(refNamesRaw);

      commits.push({
        hash,
        shortHash,
        treeHash,
        parentHashes,
        author: {
          name: authorName,
          email: authorEmail,
          date: authorDate,
          timestamp: authorTimestamp,
        },
        committer: {
          name: committerName,
          email: committerEmail,
          date: committerDate,
          timestamp: committerTimestamp,
        },
        subject,
        body,
        branches,
        tags,
        isMerge: parentHashes.length > 1,
        signatureStatus: sigStatus,
        filesChanged,
        insertions,
        deletions,
      });
    }

    return commits;
  }

  /**
   * Parse ref decoration string (e.g., "HEAD -> main, tag: v1.0, origin/main")
   */
  public static parseRefNames(refStr: string): { branches: string[]; tags: string[] } {
    const branches: string[] = [];
    const tags: string[] = [];
    if (!refStr) return { branches, tags };

    const items = refStr.split(',').map((s) => s.trim());
    for (const item of items) {
      if (!item) continue;
      if (item.startsWith('tag: ')) {
        tags.push(item.substring(5).trim());
      } else if (item.startsWith('HEAD -> ')) {
        branches.push(item.substring(8).trim());
      } else if (item !== 'HEAD') {
        branches.push(item);
      }
    }

    return { branches, tags };
  }

  /**
   * Extract shortstat information from commit body output.
   * e.g. "3 files changed, 24 insertions(+), 5 deletions(-)"
   */
  public static extractShortStat(rawBodyAndStats: string): {
    body: string;
    filesChanged: number;
    insertions: number;
    deletions: number;
  } {
    const lines = rawBodyAndStats.split('\n');
    let filesChanged = 0;
    let insertions = 0;
    let deletions = 0;
    const bodyLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.includes('file changed') || trimmed.includes('files changed')) {
        const filesMatch = trimmed.match(/(\d+)\s+file/);
        if (filesMatch) filesChanged = parseInt(filesMatch[1], 10) || 0;

        const insMatch = trimmed.match(/(\d+)\s+insertion/);
        if (insMatch) insertions = parseInt(insMatch[1], 10) || 0;

        const delMatch = trimmed.match(/(\d+)\s+deletion/);
        if (delMatch) deletions = parseInt(delMatch[1], 10) || 0;
      } else {
        bodyLines.push(line);
      }
    }

    return {
      body: bodyLines.join('\n').trim(),
      filesChanged,
      insertions,
      deletions,
    };
  }

  /**
   * Get full details for a commit, including changed files and full diff.
   */
  public static async getCommitDetails(repoRoot: string, hash: string): Promise<CommitDetails> {
    const hashMatch = hash.trim().match(/[0-9a-fA-F]{7,64}/);
    const cleanHash = hashMatch ? hashMatch[0] : hash.trim();

    // 1. Get commit metadata
    const formatRes = await GitProcess.exec(
      ['show', cleanHash, `--format=${COMMIT_FORMAT}`, '--no-patch'],
      { cwd: repoRoot }
    );
    const commits = this.parseCommitsWithStats(formatRes.stdout);
    if (commits.length === 0) {
      throw new Error(`Commit ${cleanHash} not found.`);
    }
    const baseCommit = commits[0];

    // 2. Get changed files with status and line counts. Merges are diffed
    // against their first parent, matching what the diff view compares.
    const numstatRes = await GitProcess.exec(
      ['show', cleanHash, '--raw', '--numstat', '-z', '--diff-merges=first-parent', '--format='],
      { cwd: repoRoot }
    );
    const files = parseRawNumstatZ(numstatRes.stdout);

    // Update stats from actual parsed files if shortstat was missing
    let totalIns = 0;
    let totalDel = 0;
    for (const f of files) {
      totalIns += f.insertions;
      totalDel += f.deletions;
    }

    // 3. Get full diff (bounded to avoid crashing on enormous diffs)
    let diff = '';
    try {
      const diffRes = await GitProcess.exec(['show', cleanHash, '--patch', '--format='], {
        cwd: repoRoot,
        maxBuffer: 20 * 1024 * 1024,
      });
      diff = diffRes.stdout;
    } catch {
      diff = 'Diff too large to display inline.';
    }

    return {
      ...baseCommit,
      hash: cleanHash,
      filesChanged: files.length > 0 ? files.length : baseCommit.filesChanged,
      insertions: totalIns > 0 ? totalIns : baseCommit.insertions,
      deletions: totalDel > 0 ? totalDel : baseCommit.deletions,
      files,
      diff,
    };
  }

  /**
   * Parse combination of --numstat and --name-status output.
   */
  public static parseNumstatAndStatus(rawOutput: string): FileChange[] {
    const lines = rawOutput.trim().split('\n').filter(Boolean);
    const fileMap = new Map<string, FileChange>();

    for (const line of lines) {
      // Check for numstat: "10\t5\tsrc/file.ts" or "-\t-\timage.png"
      const numstatMatch = line.match(/^([0-9-]+)\t([0-9-]+)\t(.+)$/);
      if (numstatMatch) {
        const [, insStr, delStr, filePath] = numstatMatch;
        const isBinary = insStr === '-' || delStr === '-';
        const insertions = isBinary ? 0 : parseInt(insStr, 10) || 0;
        const deletions = isBinary ? 0 : parseInt(delStr, 10) || 0;

        const cleanPath = filePath.trim();
        const existing = fileMap.get(cleanPath);
        if (existing) {
          existing.insertions = insertions;
          existing.deletions = deletions;
          existing.isBinary = isBinary;
        } else {
          fileMap.set(cleanPath, {
            path: cleanPath,
            status: 'M',
            insertions,
            deletions,
            isBinary,
          });
        }
        continue;
      }

      // Check for name-status: "M\tsrc/file.ts" or "R100\told.ts\tnew.ts"
      const statusParts = line.split('\t');
      if (statusParts.length >= 2) {
        const rawStatus = statusParts[0].trim();
        const statusCode = (rawStatus[0] || 'M') as FileStatus;

        if (statusCode === 'R' && statusParts.length >= 3) {
          const oldPath = statusParts[1].trim();
          const newPath = statusParts[2].trim();
          const existing = fileMap.get(newPath);
          if (existing) {
            existing.oldPath = oldPath;
            existing.status = 'R';
          } else {
            fileMap.set(newPath, {
              path: newPath,
              oldPath,
              status: 'R',
              insertions: 0,
              deletions: 0,
              isBinary: false,
            });
          }
        } else {
          const filePath = statusParts[1].trim();
          const existing = fileMap.get(filePath);
          if (existing) {
            existing.status = statusCode;
          } else {
            fileMap.set(filePath, {
              path: filePath,
              status: statusCode,
              insertions: 0,
              deletions: 0,
              isBinary: false,
            });
          }
        }
      }
    }

    return Array.from(fileMap.values());
  }

  /**
   * Get diff for a specific file in a commit.
   */
  public static async getFileDiff(repoRoot: string, hash: string, filePath?: string): Promise<string> {
    const hashMatch = hash.trim().match(/[0-9a-fA-F]{7,64}/);
    const cleanHash = hashMatch ? hashMatch[0] : hash.trim();

    const args = ['show', cleanHash, '--patch', '--format='];
    if (filePath) {
      args.push('--', filePath);
    }
    const res = await GitProcess.exec(args, { cwd: repoRoot });
    return res.stdout;
  }

  /**
   * Extract a specific file's patch from a combined git diff output.
   */
  public static extractFileDiff(fullDiff: string, targetPath: string): string {
    if (!fullDiff || !targetPath) return fullDiff;

    const lines = fullDiff.split('\n');
    const result: string[] = [];
    let capturing = false;
    const target = targetPath.replace(/\\/g, '/');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('diff --git ')) {
        const match = line.match(/^diff --git [a-z]\/(.+) [a-z]\/(.+)$/);
        if (match) {
          const pathA = match[1].trim();
          const pathB = match[2].trim();
          capturing = (pathA === target || pathB === target);
        } else {
          capturing = false;
        }
      }

      if (capturing) {
        result.push(line);
      }
    }

    return result.length > 0 ? result.join('\n') : fullDiff;
  }
}
