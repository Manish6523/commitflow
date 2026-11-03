import { GitProcess } from './GitProcess';
import { Tag } from '../types/git';

const TAG_FORMAT = '%(refname:short)%09%(objectname)%09%(*objectname)%09%(taggername)%09%(taggerdate:iso8601)%09%(contents)';

export class TagService {
  /**
   * Get all tags with their target commit hashes and annotation metadata.
   */
  public static async getTags(repoRoot: string): Promise<Tag[]> {
    const tags: Tag[] = [];

    try {
      const res = await GitProcess.exec(['for-each-ref', `--format=${TAG_FORMAT}`, 'refs/tags/'], {
        cwd: repoRoot,
      });

      const lines = res.stdout.trim().split('\n').filter(Boolean);
      for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length < 3) continue;

        const name = parts[0].trim();
        const hash = parts[1].trim();
        const derefHash = parts[2].trim(); // %(*objectname) if annotated tag
        const taggerName = parts[3]?.trim() || undefined;
        const taggerDate = parts[4]?.trim() || undefined;
        const message = parts[5]?.trim() || undefined;

        const isAnnotated = Boolean(derefHash && derefHash !== hash);
        const targetHash = isAnnotated ? derefHash : hash;

        tags.push({
          name,
          hash,
          targetHash,
          isAnnotated,
          taggerName,
          taggerDate,
          message,
        });
      }
    } catch {
      // No tags or error
    }

    return tags;
  }

  /**
   * Create a new tag on a target commit.
   */
  public static async createTag(
    repoRoot: string,
    tagName: string,
    targetHash: string = 'HEAD',
    message?: string
  ): Promise<void> {
    const args = ['tag'];
    if (message && message.trim()) {
      args.push('-a', tagName, '-m', message.trim(), targetHash);
    } else {
      args.push(tagName, targetHash);
    }
    await GitProcess.exec(args, { cwd: repoRoot });
  }

  /**
   * Delete a tag.
   */
  public static async deleteTag(repoRoot: string, tagName: string): Promise<void> {
    await GitProcess.exec(['tag', '-d', tagName], { cwd: repoRoot });
  }
}

