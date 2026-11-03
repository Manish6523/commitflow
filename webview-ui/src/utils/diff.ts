/**
 * Extract a specific file's patch from a combined multi-file git diff output.
 */
export function extractFileDiff(fullDiff: string, targetPath: string): string {
  if (!fullDiff || !targetPath) return fullDiff;

  const lines = fullDiff.split('\n');
  const result: string[] = [];
  let capturing = false;
  const target = targetPath.replace(/\\/g, '/');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('diff --git ')) {
      // e.g. "diff --git a/home/views.py b/home/views.py"
      const match = line.match(/^diff --git [a-z]\/(.+) [a-z]\/(.+)$/);
      if (match) {
        const pathA = match[1].trim();
        const pathB = match[2].trim();
        capturing = pathA === target || pathB === target;
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
