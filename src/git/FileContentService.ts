import { promises as fs } from 'fs';
import * as path from 'path';
import { GitProcess } from './GitProcess';
import { FileContent } from '../types/git';

/** Pseudo-ref for the file as it currently exists on disk. */
export const WORKING_COPY_REF = 'WORKING_COPY';

export const MAX_DIFF_FILE_BYTES = 5 * 1024 * 1024;

const BINARY_SNIFF_LENGTH = 8000;
const MISSING: FileContent = { content: '', exists: false, isBinary: false, tooLarge: false };

export class FileContentService {
  /**
   * Read a file at a revision, or from disk for WORKING_COPY_REF. A file that
   * does not exist at that revision is reported rather than thrown, because
   * either side of a diff may legitimately be absent.
   */
  public static async getContent(
    repoRoot: string,
    ref: string,
    filePath: string
  ): Promise<FileContent> {
    return ref === WORKING_COPY_REF
      ? this.readWorkingCopy(repoRoot, filePath)
      : this.readRevision(repoRoot, ref, filePath);
  }

  public static async listTrackedFiles(repoRoot: string): Promise<string[]> {
    const res = await GitProcess.exec(['ls-files', '-z'], { cwd: repoRoot });
    return res.stdout.split('\0').filter(Boolean);
  }

  private static async readRevision(
    repoRoot: string,
    ref: string,
    filePath: string
  ): Promise<FileContent> {
    if (ref.startsWith('-')) {
      throw new Error(`Invalid revision: ${ref}`);
    }

    const object = `${ref}:${filePath.replace(/\\/g, '/')}`;
    let size: number;
    try {
      const res = await GitProcess.exec(['cat-file', '-s', object], { cwd: repoRoot });
      size = parseInt(res.stdout.trim(), 10);
    } catch {
      return MISSING;
    }

    if (size > MAX_DIFF_FILE_BYTES) {
      return { ...MISSING, exists: true, tooLarge: true };
    }

    const res = await GitProcess.exec(['cat-file', 'blob', object], { cwd: repoRoot });
    return this.toContent(res.stdout);
  }

  private static async readWorkingCopy(repoRoot: string, filePath: string): Promise<FileContent> {
    const fullPath = path.resolve(repoRoot, filePath);
    const relative = path.relative(repoRoot, fullPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Path is outside the repository: ${filePath}`);
    }

    try {
      const stat = await fs.stat(fullPath);
      if (!stat.isFile()) return MISSING;
      if (stat.size > MAX_DIFF_FILE_BYTES) {
        return { ...MISSING, exists: true, tooLarge: true };
      }
      return this.toContent(await fs.readFile(fullPath, 'utf8'));
    } catch (err: any) {
      if (err.code === 'ENOENT') return MISSING;
      throw err;
    }
  }

  private static toContent(text: string): FileContent {
    const isBinary = text.slice(0, BINARY_SNIFF_LENGTH).includes('\0');
    return { content: isBinary ? '' : text, exists: true, isBinary, tooLarge: false };
  }
}
