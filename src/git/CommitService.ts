import { GitProcess } from './GitProcess';
import { parseRawNumstatZ } from './parseChanges';
import { CommitDetails, FileChange, FileStatus, GitCommit } from '../types/git';
import { CommitFilterOptions } from '../types/protocol';

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

// Enough for the messages of a very large repository, which search reads in one pass.
const SEARCH_MAX_BUFFER = 512 * 1024 * 1024;
const SEARCH_TIMEOUT_MS = 120000;

/** The fields search matches against, for one commit. */
export interface CommitSearchRecord {
  hash: string;
  authorName: string;
  authorEmail: string;
  committerName: string;
  refs: string;
  message: string;
}

interface CommitQueryOptions {
  branch?: string;
  allBranches?: boolean;
  filters?: CommitFilterOptions;
}

/**
 * Git compares a bare date against the current time of day, so a one-day range
 * would be empty. Expand plain dates to the start or end of that day.
 */
function toGitDate(value: string, edge: 'start' | 'end'): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return `${value} ${edge === 'start' ? '00:00:00' : '23:59:59'}`;
}

/** Match a partial, case-insensitive path, or a glob if the value contains one. */
export function toPathspecs(value: string): string[] {
  const path = value.replace(/\\/g, '/').replace(/\/+$/, '');
  if (/[*?[]/.test(path)) {
    return [`:(glob,icase)${path}`, `:(glob,icase)**/${path}`];
  }
  return [`:(glob,icase)**/*${path}*`, `:(glob,icase)**/*${path}*/**`];
}

/** Git reports a missing HEAD differently depending on the command. */
function isEmptyRepositoryError(err: any): boolean {
  const stderr: string = err.stderr ?? '';
  return (
    stderr.includes('does not have any commits yet') ||
    stderr.includes('fatal: your current branch') ||
    stderr.includes("bad revision 'HEAD'") ||
    stderr.includes("ambiguous argument 'HEAD'")
  );
}

export class CommitService {
  /** Options shared by `git log` and `git rev-list`. Paths go last, after `--`. */
  private static buildQueryArgs(options: CommitQueryOptions): string[] {
    const { authors, committers, since, until, isMerge, filePath, branch } = options.filters ?? {};
    const args = ['--regexp-ignore-case', '--fixed-strings'];

    for (const author of authors ?? []) args.push(`--author=${author}`);
    for (const committer of committers ?? []) args.push(`--committer=${committer}`);
    if (since) args.push(`--since=${toGitDate(since, 'start')}`);
    if (until) args.push(`--until=${toGitDate(until, 'end')}`);
    if (isMerge === true) args.push('--merges');
    if (isMerge === false) args.push('--no-merges');

    const revision = branch ?? options.branch;
    if (options.allBranches) {
      args.push('--all');
    } else {
      args.push(revision || 'HEAD');
    }

    args.push('--');
    if (filePath) args.push(...toPathspecs(filePath));
    return args;
  }

  /**
   * Get paginated commits for a repository with optional filters.
   */
  public static async getCommits(
    repoRoot: string,
    options: CommitQueryOptions & { page?: number; pageSize?: number } = {}
  ): Promise<{ commits: GitCommit[]; totalCount: number; hasMore: boolean }> {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.max(1, Math.min(200, options.pageSize ?? 30));
    const skip = (page - 1) * pageSize;
    const queryArgs = this.buildQueryArgs(options);

    try {
      const [countRes, res] = await Promise.all([
        GitProcess.exec(['rev-list', '--count', ...queryArgs], { cwd: repoRoot }),
        GitProcess.exec(
          [
            'log',
            `--format=${COMMIT_FORMAT}`,
            '--shortstat',
            '-n',
            `${pageSize}`,
            '--skip',
            `${skip}`,
            ...queryArgs,
          ],
          { cwd: repoRoot }
        ),
      ]);
      const totalCount = parseInt(countRes.stdout.trim(), 10) || 0;
      const commits = this.parseCommitsWithStats(res.stdout);

      return { commits, totalCount, hasMore: skip + commits.length < totalCount };
    } catch (err: any) {
      if (isEmptyRepositoryError(err)) {
        return { commits: [], totalCount: 0, hasMore: false };
      }
      throw err;
    }
  }

  /** Load full commits by hash, keeping the given order. */
  public static async getCommitsByHashes(repoRoot: string, hashes: string[]): Promise<GitCommit[]> {
    if (hashes.length === 0) return [];
    const res = await GitProcess.exec(
      ['log', '--no-walk=unsorted', `--format=${COMMIT_FORMAT}`, '--shortstat', ...hashes, '--'],
      { cwd: repoRoot }
    );
    return this.parseCommitsWithStats(res.stdout);
  }

  /**
   * Read the searchable fields of every commit matching the filters. `codeChange`
   * also limits this to commits that add or remove that text, which `rev-list`
   * can't do, so it is only available here.
   */
  public static async getSearchRecords(
    repoRoot: string,
    options: CommitQueryOptions & { codeChange?: string }
  ): Promise<CommitSearchRecord[]> {
    const format = `${RECORD_SEP}%H${FIELD_SEP}%an${FIELD_SEP}%ae${FIELD_SEP}%cn${FIELD_SEP}%D${FIELD_SEP}%B`;
    const args = ['log', `--format=${format}`];
    if (options.codeChange) args.push(`-S${options.codeChange}`);

    let stdout: string;
    try {
      const res = await GitProcess.exec([...args, ...this.buildQueryArgs(options)], {
        cwd: repoRoot,
        maxBuffer: SEARCH_MAX_BUFFER,
        timeout: SEARCH_TIMEOUT_MS,
      });
      stdout = res.stdout;
    } catch (err) {
      if (isEmptyRepositoryError(err)) return [];
      throw err;
    }

    const records: CommitSearchRecord[] = [];
    for (const record of stdout.split(RECORD_SEP)) {
      const [hash, authorName, authorEmail, committerName, refs, ...message] = record.split(FIELD_SEP);
      if (hash?.trim()) {
        records.push({
          hash: hash.trim(),
          authorName,
          authorEmail,
          committerName,
          refs,
          message: message.join(FIELD_SEP),
        });
      }
    }
    return records;
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
