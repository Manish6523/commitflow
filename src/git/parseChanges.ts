import { FileChange, FileStatus } from '../types/git';

const NUMSTAT = /^(\d+|-)\t(\d+|-)\t([\s\S]*)$/;

function normalizeStatus(code: string): FileStatus {
  const letter = code[0];
  return letter === 'A' || letter === 'D' || letter === 'R' || letter === 'C' || letter === 'U'
    ? letter
    : 'M';
}

/**
 * Parse the NUL-delimited output of `git ... --raw --numstat -z`.
 *
 * Raw entries are `:<modes> <shas> <status>\0<path>\0`, or `...R100\0<old>\0<new>\0`
 * for renames and copies. Numstat entries are `<ins>\t<del>\t<path>\0`, or
 * `<ins>\t<del>\t\0<old>\0<new>\0` for renames.
 */
export function parseRawNumstatZ(output: string): FileChange[] {
  const tokens = output
    .split('\0')
    .map((token) => token.replace(/^\n+/, ''))
    .filter((token) => token.length > 0);

  const files = new Map<string, FileChange>();
  const entryFor = (filePath: string): FileChange => {
    let entry = files.get(filePath);
    if (!entry) {
      entry = { path: filePath, status: 'M', insertions: 0, deletions: 0, isBinary: false };
      files.set(filePath, entry);
    }
    return entry;
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.startsWith(':')) {
      const statusCode = token.split(' ').pop() || 'M';
      const status = normalizeStatus(statusCode);
      if (status === 'R' || status === 'C') {
        const oldPath = tokens[++i];
        const entry = entryFor(tokens[++i]);
        entry.status = status;
        entry.oldPath = oldPath;
      } else {
        entryFor(tokens[++i]).status = status;
      }
      continue;
    }

    const stat = token.match(NUMSTAT);
    if (stat) {
      let filePath = stat[3];
      if (!filePath) {
        i++; // Skip the old path; renames are keyed by their new path.
        filePath = tokens[++i];
      }
      const entry = entryFor(filePath);
      entry.isBinary = stat[1] === '-' || stat[2] === '-';
      entry.insertions = entry.isBinary ? 0 : parseInt(stat[1], 10);
      entry.deletions = entry.isBinary ? 0 : parseInt(stat[2], 10);
    }
  }

  return Array.from(files.values());
}
