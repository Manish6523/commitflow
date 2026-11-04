import { DiffSide, FileHistoryCommit } from '../types';

export const WORKING_COPY = 'WORKING_COPY';

export interface HistorySelection {
  /** The row showing its own change when no comparison is picked. */
  activeKey: string | null;
  pickA: string | null;
  pickB: string | null;
}

export interface Comparison {
  base: DiffSide | null;
  target: DiffSide | null;
}

function sideFor(key: string, filePath: string, commits: FileHistoryCommit[]): DiffSide | null {
  if (key === WORKING_COPY) {
    return { ref: WORKING_COPY, path: filePath, label: 'Working copy' };
  }
  const commit = commits.find((c) => c.hash === key);
  return commit ? { ref: commit.hash, path: commit.path, label: commit.shortHash } : null;
}

/** Decide which two versions of the file the current selection compares. */
export function resolveComparison(
  filePath: string,
  commits: FileHistoryCommit[],
  { activeKey, pickA, pickB }: HistorySelection
): Comparison | null {
  if (pickA && pickB) {
    return { base: sideFor(pickA, filePath, commits), target: sideFor(pickB, filePath, commits) };
  }

  if (activeKey === WORKING_COPY) {
    return {
      base: { ref: 'HEAD', path: filePath, label: 'HEAD' },
      target: sideFor(WORKING_COPY, filePath, commits),
    };
  }

  const commit = commits.find((c) => c.hash === activeKey);
  if (!commit) return null;

  return {
    base:
      commit.parentHash && commit.status !== 'A'
        ? {
            ref: commit.parentHash,
            path: commit.oldPath ?? commit.path,
            label: commit.parentHash.slice(0, 7),
          }
        : null,
    target: commit.status === 'D' ? null : sideFor(commit.hash, filePath, commits),
  };
}

/**
 * Apply a click on a row's A or B button. A comparison always has both sides,
 * so picking one fills the other from the active row or a neighbouring version.
 */
export function pickSide(
  selection: HistorySelection,
  side: 'A' | 'B',
  key: string,
  commits: FileHistoryCommit[]
): HistorySelection {
  const mine = side === 'A' ? 'pickA' : 'pickB';
  const other = side === 'A' ? 'pickB' : 'pickA';

  if (selection[mine] === key) {
    return { ...selection, pickA: null, pickB: null };
  }
  if (selection[other] === key) {
    return { ...selection, pickA: selection.pickB, pickB: selection.pickA };
  }
  if (selection[other]) {
    return { ...selection, [mine]: key };
  }

  const keys = [WORKING_COPY, ...commits.map((c) => c.hash)];
  const index = keys.indexOf(key);
  const neighbour =
    side === 'A' ? keys[index - 1] ?? keys[index + 1] : keys[index + 1] ?? keys[index - 1];
  const partner =
    selection.activeKey && selection.activeKey !== key ? selection.activeKey : neighbour;

  return partner ? { ...selection, [mine]: key, [other]: partner } : selection;
}

function scoreMatch(path: string, query: string): number | null {
  const lowerPath = path.toLowerCase();
  const nameStart = lowerPath.lastIndexOf('/') + 1;
  const substring = lowerPath.indexOf(query);
  if (substring >= nameStart) return substring === nameStart ? 0 : 1;
  if (substring >= 0) return 2;

  let position = nameStart > 0 && lowerPath.slice(nameStart).includes(query[0]) ? nameStart : 0;
  for (const char of query) {
    position = lowerPath.indexOf(char, position);
    if (position < 0) return null;
    position++;
  }
  return 3;
}

/** Rank paths for the file picker: file-name matches, then path, then fuzzy. */
export function filterFiles(files: string[], query: string, limit: number): string[] {
  const needle = query.trim().toLowerCase().replace(/\s+/g, '');
  if (!needle) return files.slice(0, limit);

  return files
    .map((path) => ({ path, score: scoreMatch(path, needle) }))
    .filter((match): match is { path: string; score: number } => match.score !== null)
    .sort((a, b) => a.score - b.score || a.path.length - b.path.length)
    .slice(0, limit)
    .map((match) => match.path);
}

export function timeAgo(timestamp: number, now: number = Date.now()): string {
  const minutes = Math.floor((now - timestamp) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
