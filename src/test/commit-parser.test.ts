import { describe, it, expect } from 'vitest';
import { CommitService } from '../git/CommitService';

describe('CommitService Parser', () => {
  it('should parse ref names into branches and tags', () => {
    const rawRefs = 'HEAD -> main, tag: v1.0.0, origin/main, feature/auth';
    const parsed = CommitService.parseRefNames(rawRefs);

    expect(parsed.branches).toContain('main');
    expect(parsed.branches).toContain('origin/main');
    expect(parsed.branches).toContain('feature/auth');
    expect(parsed.tags).toContain('v1.0.0');
    expect(parsed.branches).not.toContain('HEAD');
  });

  it('should extract shortstat info correctly', () => {
    const raw = `feat: add authentication\n\nDetailed body explanation.\n 3 files changed, 24 insertions(+), 5 deletions(-)`;
    const { body, filesChanged, insertions, deletions } = CommitService.extractShortStat(raw);

    expect(filesChanged).toBe(3);
    expect(insertions).toBe(24);
    expect(deletions).toBe(5);
    expect(body).toContain('Detailed body explanation.');
  });

  it('should parse numstat and name-status combined output', () => {
    const raw = `10\t2\tsrc/index.ts\n-\t-\tmedia/icon.png\nM\tsrc/index.ts\nA\tmedia/icon.png\nR100\told-file.ts\tnew-file.ts\n5\t0\tnew-file.ts`;
    const files = CommitService.parseNumstatAndStatus(raw);

    expect(files.length).toBe(3);
    const indexTs = files.find((f) => f.path === 'src/index.ts');
    expect(indexTs).toBeDefined();
    expect(indexTs?.insertions).toBe(10);
    expect(indexTs?.deletions).toBe(2);
    expect(indexTs?.status).toBe('M');

    const icon = files.find((f) => f.path === 'media/icon.png');
    expect(icon?.isBinary).toBe(true);

    const renamed = files.find((f) => f.path === 'new-file.ts');
    expect(renamed?.status).toBe('R');
    expect(renamed?.oldPath).toBe('old-file.ts');
  });

  it('should parse delimited commit records with parents and signature status', () => {
    const SEP = '\x1f';
    const REC_SEP = '\x1e';
    const record = [
      'a82f91c1234567890abcdef1234567890abcdef12',
      'a82f91c',
      'tree123',
      'parent1 parent2',
      'Manish Sharma',
      'manish@example.com',
      '2026-11-03T10:42:00+05:30',
      '1793681638',
      'Manish Sharma',
      'manish@example.com',
      '2026-11-03T10:42:00+05:30',
      '1793681638',
      'HEAD -> main, tag: v2.1.0',
      'G',
      'feat: implement authentication system',
      'Implemented JWT tokens and refresh handlers.\n 2 files changed, 45 insertions(+), 3 deletions(-)',
    ].join(SEP) + REC_SEP;

    const commits = CommitService.parseCommitsWithStats(record);
    expect(commits.length).toBe(1);

    const c = commits[0];
    expect(c.hash).toBe('a82f91c1234567890abcdef1234567890abcdef12');
    expect(c.shortHash).toBe('a82f91c');
    expect(c.isMerge).toBe(true);
    expect(c.parentHashes).toEqual(['parent1', 'parent2']);
    expect(c.author.name).toBe('Manish Sharma');
    expect(c.signatureStatus).toBe('G');
    expect(c.subject).toBe('feat: implement authentication system');
    expect(c.filesChanged).toBe(2);
    expect(c.insertions).toBe(45);
    expect(c.deletions).toBe(3);
    expect(c.branches).toContain('main');
    expect(c.tags).toContain('v2.1.0');
  });
});
