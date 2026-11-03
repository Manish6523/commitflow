import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { GitRepository } from '../git/GitRepository';
import { CommitService } from '../git/CommitService';
import { BranchService } from '../git/BranchService';
import { TagService } from '../git/TagService';
import { DiffService } from '../git/DiffService';
import { AnalyticsService } from '../services/AnalyticsService';

describe('Real Repository Git Integration', () => {
  const repoRoot = path.resolve(__dirname, '../../');

  it('should discover repository info accurately', async () => {
    const isGit = await GitRepository.isGitRepository(repoRoot);
    expect(isGit).toBe(true);

    const info = await GitRepository.getRepositoryInfo(repoRoot);
    expect(info.name).toBe('git-commit-extension');
    expect(info.currentBranch).toBe('master');
    expect(info.headHash.length).toBe(40);
  });

  it('should retrieve commits with accurate metadata and merge detection', async () => {
    const res = await CommitService.getCommits(repoRoot, { pageSize: 10 });
    expect(res.commits.length).toBeGreaterThan(0);
    expect(res.totalCount).toBeGreaterThanOrEqual(5);

    // Latest commit is the merge commit
    const mergeCommit = res.commits[0];
    expect(mergeCommit.isMerge).toBe(true);
    expect(mergeCommit.parentHashes.length).toBe(2);
    expect(mergeCommit.subject).toContain("Merge branch 'feature/dark-theme'");
  });

  it('should retrieve local and remote branches', async () => {
    const branches = await BranchService.getBranches(repoRoot);
    const names = branches.map((b) => b.name);
    expect(names).toContain('master');
    expect(names).toContain('feature/dark-theme');

    const master = branches.find((b) => b.name === 'master');
    expect(master?.isCurrent).toBe(true);
  });

  it('should retrieve created tags', async () => {
    const tags = await TagService.getTags(repoRoot);
    const tag = tags.find((t) => t.name === 'v0.1.0');
    expect(tag).toBeDefined();
    expect(tag?.isAnnotated).toBe(true);
    expect(tag?.message).toContain('Release version 0.1.0');
  });

  it('should fetch commit details with parsed file changes and diff', async () => {
    const res = await CommitService.getCommits(repoRoot, { pageSize: 5 });
    // Find non-merge commit
    const nonMerge = res.commits.find((c) => !c.isMerge);
    expect(nonMerge).toBeDefined();

    const details = await CommitService.getCommitDetails(repoRoot, nonMerge!.hash);
    expect(details.hash).toBe(nonMerge!.hash);
    expect(details.files.length).toBeGreaterThan(0);
    expect(details.diff).toBeDefined();
  });

  it('should compare revisions (HEAD~1 vs HEAD)', async () => {
    const comparison = await DiffService.compareCommits(repoRoot, 'HEAD~1', 'HEAD');
    expect(comparison.baseCommit).toBe('HEAD~1');
    expect(comparison.targetCommit).toBe('HEAD');
    expect(comparison.diff).toBeDefined();
  });

  it('should calculate repository analytics', async () => {
    const analytics = await AnalyticsService.getAnalytics(repoRoot);
    expect(analytics.totalCommits).toBeGreaterThanOrEqual(5);
    expect(analytics.branchCount).toBeGreaterThanOrEqual(2);
    expect(analytics.activeContributors).toBeGreaterThanOrEqual(1);
    expect(analytics.activityHeatmap.length).toBe(365);
  });
});
