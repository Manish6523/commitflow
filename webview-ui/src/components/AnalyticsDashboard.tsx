import React from 'react';
import { useCommitStore } from '../stores/useCommitStore';
import {
  BarChart2,
  Users,
  GitBranch,
  GitCommit,
  TrendingUp,
  FileCode2,
  Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export const AnalyticsDashboard: React.FC = () => {
  const { analytics, loadingAnalytics, setFilters, setViewMode } = useCommitStore();

  if (loadingAnalytics || !analytics) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 text-gray-400 gap-2">
        <BarChart2 className="w-8 h-8 animate-pulse text-blue-400" />
        <span className="text-xs">Calculating repository analytics and velocity...</span>
      </div>
    );
  }

  const {
    totalCommits,
    activeContributors,
    branchCount,
    dailyActivity,
    contributorStats,
    topFiles,
    activityHeatmap,
  } = analytics;

  const handleHeatmapDateClick = (date: string) => {
    setFilters({ since: date, until: date });
    setViewMode('grid');
  };

  const LEVEL_COLORS = [
    'bg-vscode-input/50',
    'bg-emerald-900/60',
    'bg-emerald-700/80',
    'bg-emerald-500',
    'bg-emerald-300',
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 max-w-6xl mx-auto w-full space-y-6">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-vscode-border bg-vscode-sidebar/50 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs text-gray-400 font-medium">Total Commits</span>
            <h3 className="text-2xl font-bold text-gray-100 mt-1 font-mono">
              {totalCommits.toLocaleString()}
            </h3>
          </div>
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <GitCommit className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-vscode-border bg-vscode-sidebar/50 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs text-gray-400 font-medium">Active Contributors</span>
            <h3 className="text-2xl font-bold text-gray-100 mt-1 font-mono">
              {activeContributors}
            </h3>
          </div>
          <div className="p-3 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-vscode-border bg-vscode-sidebar/50 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs text-gray-400 font-medium">Active Branches</span>
            <h3 className="text-2xl font-bold text-gray-100 mt-1 font-mono">
              {branchCount}
            </h3>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <GitBranch className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-vscode-border bg-vscode-sidebar/50 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs text-gray-400 font-medium">Avg Commits / Day</span>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1 font-mono">
              {(totalCommits / Math.max(1, dailyActivity.length)).toFixed(1)}
            </h3>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 52-Week GitHub-style Activity Heatmap */}
      <div className="p-4 rounded-xl border border-vscode-border bg-vscode-sidebar/40 shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-xs text-gray-200 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            Commit Activity Heatmap (Last 365 Days)
          </h4>
          <span className="text-[11px] text-gray-400">Click a cell to filter commits</span>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="flex gap-1 min-w-[700px] justify-start flex-wrap">
            {activityHeatmap.map((item) => (
              <button
                key={item.date}
                onClick={() => handleHeatmapDateClick(item.date)}
                title={`${item.date}: ${item.count} commit${item.count === 1 ? '' : 's'}`}
                className={`w-3 h-3 rounded-sm transition hover:ring-1 hover:ring-white ${
                  LEVEL_COLORS[item.level]
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-1.5 text-[10px] text-gray-400 pt-1">
          <span>Less</span>
          {LEVEL_COLORS.map((c, i) => (
            <div key={i} className={`w-2.5 h-2.5 rounded-sm ${c}`} />
          ))}
          <span>More</span>
        </div>
      </div>

      {/* Daily Commit Velocity Chart */}
      <div className="p-4 rounded-xl border border-vscode-border bg-vscode-sidebar/40 shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-xs text-gray-200 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-blue-400" />
            Daily Commit Velocity (Last 30 Days)
          </h4>
        </div>

        <div className="h-56 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyActivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333333" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#888888"
                fontSize={10}
                tickFormatter={(val) => val.slice(5)}
              />
              <YAxis stroke="#888888" fontSize={10} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--vscode-sideBar-background, #252526)',
                  borderColor: 'var(--vscode-panel-border, #333333)',
                  borderRadius: '8px',
                  fontSize: '11px',
                }}
              />
              <Bar dataKey="commits" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Grid: Contributor Leaderboard & Top Modified Files */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Contributor Leaderboard */}
        <div className="p-4 rounded-xl border border-vscode-border bg-vscode-sidebar/40 shadow-sm flex flex-col gap-3">
          <h4 className="font-semibold text-xs text-gray-200 flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            Top Contributors
          </h4>

          <div className="space-y-2 overflow-y-auto max-h-64">
            {contributorStats.map((contrib, idx) => (
              <div
                key={contrib.email || contrib.name}
                onClick={() => {
                  setFilters({ authors: [contrib.name] });
                  setViewMode('grid');
                }}
                className="p-2.5 rounded-lg border border-vscode-border bg-vscode-sidebar/60 hover:bg-vscode-hover flex items-center justify-between cursor-pointer transition"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <span className="font-mono text-xs font-bold text-gray-500 w-4">
                    #{idx + 1}
                  </span>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-xs font-semibold text-gray-100 truncate">
                      {contrib.name}
                    </span>
                    <span className="text-[11px] text-gray-400 truncate font-mono">
                      {contrib.email}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0 font-mono text-xs">
                  <span className="text-blue-400 font-bold">{contrib.commitCount}</span>
                  <span className="text-[10px] text-gray-500 ml-1">commits</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Modified Files */}
        <div className="p-4 rounded-xl border border-vscode-border bg-vscode-sidebar/40 shadow-sm flex flex-col gap-3">
          <h4 className="font-semibold text-xs text-gray-200 flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-amber-400" />
            Most Frequently Modified Files
          </h4>

          <div className="space-y-2 overflow-y-auto max-h-64">
            {topFiles.map((file, idx) => (
              <div
                key={file.path}
                onClick={() => {
                  setFilters({ filePath: file.path });
                  setViewMode('grid');
                }}
                className="p-2.5 rounded-lg border border-vscode-border bg-vscode-sidebar/60 hover:bg-vscode-hover flex items-center justify-between cursor-pointer transition text-xs font-mono"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-gray-500 w-4 font-bold text-[11px]">#{idx + 1}</span>
                  <span className="truncate text-gray-200">{file.path}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-amber-400 font-semibold">{file.changes}</span>
                  <span className="text-[10px] text-gray-500 ml-1">edits</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

