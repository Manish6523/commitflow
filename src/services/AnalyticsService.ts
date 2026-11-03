import { GitProcess } from '../git/GitProcess';
import { ContributorService } from '../git/ContributorService';
import { AnalyticsData } from '../types/protocol';

export class AnalyticsService {
  public static async getAnalytics(repoRoot: string): Promise<AnalyticsData> {
    // 1. Total commits
    let totalCommits = 0;
    try {
      const countRes = await GitProcess.exec(['rev-list', '--count', 'HEAD'], { cwd: repoRoot });
      totalCommits = parseInt(countRes.stdout.trim(), 10) || 0;
    } catch {
      totalCommits = 0;
    }

    // 2. Branch count
    let branchCount = 0;
    try {
      const brRes = await GitProcess.exec(['branch', '-a'], { cwd: repoRoot });
      branchCount = brRes.stdout.trim().split('\n').filter(Boolean).length;
    } catch {
      branchCount = 1;
    }

    // 3. Contributor stats
    const contributorStats = await ContributorService.getContributors(repoRoot);
    const activeContributors = contributorStats.length;

    // 4. Activity dates (last 365 days for heatmap, daily, weekly)
    const dailyMap = new Map<string, { commits: number; additions: number; deletions: number }>();
    const heatmapMap = new Map<string, number>();

    try {
      const logRes = await GitProcess.exec(
        ['log', '--format=%aI', '--since=1 year ago', '-n', '2000'],
        { cwd: repoRoot }
      );
      const dateLines = logRes.stdout.trim().split('\n').filter(Boolean);

      for (const d of dateLines) {
        // e.g. "2026-11-03T10:42:00+05:30"
        const dayStr = d.split('T')[0];
        if (!dayStr) continue;

        heatmapMap.set(dayStr, (heatmapMap.get(dayStr) || 0) + 1);

        const current = dailyMap.get(dayStr) || { commits: 0, additions: 0, deletions: 0 };
        current.commits += 1;
        dailyMap.set(dayStr, current);
      }
    } catch {
      // ignore
    }

    // Convert daily map to sorted list (last 30 days)
    const sortedDays = Array.from(dailyMap.keys()).sort();
    const dailyActivity = sortedDays.slice(-30).map((date) => ({
      date,
      commits: dailyMap.get(date)?.commits || 0,
      additions: dailyMap.get(date)?.additions || 0,
      deletions: dailyMap.get(date)?.deletions || 0,
    }));

    // Weekly activity
    const weeklyMap = new Map<string, number>();
    for (const [date, entry] of dailyMap.entries()) {
      const d = new Date(date);
      // Rough week key: YYYY-WW
      const year = d.getFullYear();
      const firstDayOfYear = new Date(year, 0, 1);
      const pastDaysOfYear = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
      const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
      const weekKey = `${year}-W${weekNum < 10 ? '0' : ''}${weekNum}`;
      weeklyMap.set(weekKey, (weeklyMap.get(weekKey) || 0) + entry.commits);
    }
    const weeklyActivity = Array.from(weeklyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-16)
      .map(([week, commits]) => ({ week, commits }));

    // Generate full 365-day heatmap
    const today = new Date();
    const activityHeatmap: { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 }[] = [];
    
    // Find max count for relative level scaling
    let maxDayCount = 1;
    for (const count of heatmapMap.values()) {
      if (count > maxDayCount) maxDayCount = count;
    }

    for (let i = 364; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = heatmapMap.get(dateStr) || 0;

      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (count > 0) {
        const ratio = count / maxDayCount;
        if (ratio > 0.75) level = 4;
        else if (ratio > 0.5) level = 3;
        else if (ratio > 0.25) level = 2;
        else level = 1;
      }

      activityHeatmap.push({ date: dateStr, count, level });
    }

    // Top modified files
    const topFiles: { path: string; changes: number }[] = [];
    try {
      const filesRes = await GitProcess.exec(
        ['log', '--name-only', '--format=', '-n', '500'],
        { cwd: repoRoot }
      );
      const fileCountMap = new Map<string, number>();
      for (const f of filesRes.stdout.trim().split('\n')) {
        const clean = f.trim();
        if (!clean) continue;
        fileCountMap.set(clean, (fileCountMap.get(clean) || 0) + 1);
      }
      const sortedFiles = Array.from(fileCountMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      for (const [path, changes] of sortedFiles) {
        topFiles.push({ path, changes });
      }
    } catch {
      // ignore
    }

    return {
      totalCommits,
      activeContributors,
      branchCount,
      totalInsertions: 0,
      totalDeletions: 0,
      dailyActivity,
      weeklyActivity,
      contributorStats,
      topFiles,
      activityHeatmap,
    };
  }
}

