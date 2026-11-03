import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface GitExecOptions {
  cwd: string;
  maxBuffer?: number;
  timeout?: number;
  signal?: AbortSignal;
}

export interface GitExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class GitProcessError extends Error {
  constructor(
    message: string,
    public readonly args: string[],
    public readonly stderr: string,
    public readonly exitCode: number
  ) {
    super(message);
    this.name = 'GitProcessError';
  }
}

export class GitProcess {
  private static gitPath = 'git';

  public static setGitPath(path: string): void {
    if (path && path.trim()) {
      this.gitPath = path.trim();
    }
  }

  public static getGitPath(): string {
    return this.gitPath;
  }

  /**
   * Safely execute git using argument arrays to prevent shell injection.
   */
  public static async exec(
    args: string[],
    options: GitExecOptions
  ): Promise<GitExecResult> {
    const maxBuffer = options.maxBuffer ?? 50 * 1024 * 1024; // 50MB
    const timeout = options.timeout ?? 60000; // 60s timeout

    try {
      const { stdout, stderr } = await execFileAsync(this.gitPath, args, {
        cwd: options.cwd,
        maxBuffer,
        timeout,
        signal: options.signal,
        windowsHide: true,
        env: {
          ...process.env,
          // Force deterministic English output for Git messages and standard date formats
          LANG: 'C',
          LC_ALL: 'C',
          GIT_TERMINAL_PROMPT: '0',
        },
      });

      return {
        stdout: typeof stdout === 'string' ? stdout : stdout.toString('utf-8'),
        stderr: typeof stderr === 'string' ? stderr : stderr.toString('utf-8'),
        exitCode: 0,
      };
    } catch (err: any) {
      const exitCode = typeof err.code === 'number' ? err.code : 1;
      const stderr = err.stderr ? err.stderr.toString('utf-8').trim() : err.message || '';
      const stdout = err.stdout ? err.stdout.toString('utf-8') : '';

      // Some commands like git diff return exitCode 1 on differences or similar,
      // but for errors:
      throw new GitProcessError(
        `Git command failed: git ${args.join(' ')}\n${stderr}`,
        args,
        stderr,
        exitCode
      );
    }
  }
}
