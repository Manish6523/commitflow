import * as path from 'path';
import * as fs from 'fs';
import { GitProcess } from './GitProcess';
import { RepositoryInfo } from '../types/git';

export class GitRepository {
  /**
   * Check if a folder is inside a Git work tree.
   */
  public static async isGitRepository(folderPath: string): Promise<boolean> {
    try {
      const res = await GitProcess.exec(['rev-parse', '--is-inside-work-tree'], { cwd: folderPath });
      return res.stdout.trim() === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Get the root directory of the Git repository.
   */
  public static async getRepositoryRoot(folderPath: string): Promise<string | null> {
    try {
      const res = await GitProcess.exec(['rev-parse', '--show-toplevel'], { cwd: folderPath });
      return res.stdout.trim();
    } catch {
      return null;
    }
  }

  /**
   * Get comprehensive metadata for a repository.
   */
  public static async getRepositoryInfo(repoRoot: string): Promise<RepositoryInfo> {
    const name = path.basename(repoRoot);

    // Current branch & detached status
    let currentBranch = 'HEAD';
    let isDetached = false;
    try {
      const branchRes = await GitProcess.exec(['symbolic-ref', '--short', 'HEAD'], { cwd: repoRoot });
      currentBranch = branchRes.stdout.trim();
    } catch {
      isDetached = true;
      try {
        const headRes = await GitProcess.exec(['rev-parse', '--short', 'HEAD'], { cwd: repoRoot });
        currentBranch = `detached at ${headRes.stdout.trim()}`;
      } catch {
        currentBranch = 'empty';
      }
    }

    // HEAD SHA
    let headHash = '';
    try {
      const hashRes = await GitProcess.exec(['rev-parse', 'HEAD'], { cwd: repoRoot });
      headHash = hashRes.stdout.trim();
    } catch {
      headHash = '';
    }

    // Remotes
    const remotes: { name: string; fetchUrl?: string; pushUrl?: string }[] = [];
    try {
      const remoteRes = await GitProcess.exec(['remote', '-v'], { cwd: repoRoot });
      const lines = remoteRes.stdout.trim().split('\n');
      const remoteMap = new Map<string, { fetchUrl?: string; pushUrl?: string }>();

      for (const line of lines) {
        if (!line) continue;
        const match = line.match(/^(\S+)\t(\S+)\s+\((fetch|push)\)$/);
        if (match) {
          const [, rName, rUrl, rType] = match;
          const entry = remoteMap.get(rName) || {};
          if (rType === 'fetch') entry.fetchUrl = rUrl;
          if (rType === 'push') entry.pushUrl = rUrl;
          remoteMap.set(rName, entry);
        }
      }

      for (const [rName, urls] of remoteMap.entries()) {
        remotes.push({ name: rName, ...urls });
      }
    } catch {
      // No remotes or error
    }

    // Uncommitted status
    let isClean = true;
    let uncommittedCount = 0;
    try {
      const statusRes = await GitProcess.exec(['status', '--porcelain'], { cwd: repoRoot });
      const statusLines = statusRes.stdout.trim().split('\n').filter(Boolean);
      uncommittedCount = statusLines.length;
      isClean = statusLines.length === 0;
    } catch {
      isClean = true;
    }

    return {
      rootUri: repoRoot,
      name,
      currentBranch,
      isDetached,
      remotes,
      headHash,
      isClean,
      uncommittedCount,
    };
  }

  /**
   * Discover all git repositories in given workspace folder paths.
   */
  public static async discoverRepositories(folderPaths: string[]): Promise<RepositoryInfo[]> {
    const repos: RepositoryInfo[] = [];
    const discoveredRoots = new Set<string>();

    for (const folder of folderPaths) {
      if (!fs.existsSync(folder)) continue;
      const root = await this.getRepositoryRoot(folder);
      if (root && !discoveredRoots.has(root)) {
        discoveredRoots.add(root);
        try {
          const info = await this.getRepositoryInfo(root);
          repos.push(info);
        } catch {
          // Ignore failing repos
        }
      }
    }

    return repos;
  }
}
