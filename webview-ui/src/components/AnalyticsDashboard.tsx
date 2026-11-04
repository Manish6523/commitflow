import React, { useEffect, useMemo, useRef } from 'react';
import { useCommitStore } from '../stores/useCommitStore';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

const LEVEL_COLORS = [
  'bg-gray-900',
  'bg-emerald-500/30',
  'bg-emerald-500/50',
  'bg-emerald-500/75',
  'bg-emerald-500',
];

// One heatmap column: a 12px cell plus its 4px gap.
const WEEK_WIDTH = 16;
const DAY_LABELS_WIDTH = 34;

const axisTick = { fill: 'var(--vscode-descriptionForeground, #999999)', fontSize: 10 };
const axisLine = 'var(--vscode-panel-border, #333333)';

const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="px-4 py-3 min-w-0">
    <div className="text-[11px] text-gray-400 truncate">{label}</div>
    <div className="text-xl font-semibold text-gray-100 tabular-nums mt-0.5">{value}</div>
  </div>
);

const Section: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({
  title,
  hint,
  children,
}) => (
  <section className="px-4 py-3 border-b border-vscode-border min-w-0">
    <div className="flex items-center justify-between gap-3 mb-2">
      <h4 className="text-xs font-semibold text-gray-200">{title}</h4>
      {hint && <span className="text-[11px] text-gray-400 truncate">{hint}</span>}
    </div>
    {children}
  </section>
);

const rankedRow =
  'flex items-center gap-2 -mx-2 px-2 py-1 rounded-md cursor-pointer text-xs hover:bg-vscode-hover transition-colors duration-100';

export const AnalyticsDashboard: React.FC = () => {
  const { analytics, loadingAnalytics, setFilters, setViewMode } = useCommitStore();

  const heatmapRef = useRef<HTMLDivElement>(null);

  const handleHeatmapDateClick = (date: string) => {
    setFilters({ since: date, until: date });
    setViewMode('grid');
  };

  // Group 365 days into 52-53 weekly columns of 7 days (Sunday - Saturday)
  const heatmapGrid = useMemo(() => {
    if (!analytics?.activityHeatmap) return { weeks: [], monthLabels: [] };

    const items = analytics.activityHeatmap;
    const weeks: { date: string; count: number; level: number; dayOfWeek: number }[][] = [];
    const monthLabels: { label: string; colIndex: number }[] = [];

    let currentWeek: { date: string; count: number; level: number; dayOfWeek: number }[] = [];
    let lastMonth = '';

    items.forEach((item) => {
      const d = new Date(item.date);
      const dayOfWeek = d.getDay(); // 0 is Sunday
      const monthName = d.toLocaleDateString(undefined, { month: 'short' });

      if (dayOfWeek === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      if (monthName !== lastMonth) {
        monthLabels.push({ label: monthName, colIndex: weeks.length });
        lastMonth = monthName;
      }

      currentWeek.push({
        ...item,
        dayOfWeek,
      });
    });

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return { weeks, monthLabels };
  }, [analytics?.activityHeatmap]);

  // The newest weeks are the ones people look for, so start at the right edge.
  useEffect(() => {
    const heatmap = heatmapRef.current;
    if (heatmap) heatmap.scrollLeft = heatmap.scrollWidth;
  }, [heatmapGrid, loadingAnalytics]);

  if (loadingAnalytics || !analytics) {
    return (
      <div aria-label="Loading analytics">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-vscode-border border-b border-vscode-border">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="px-4 py-3 space-y-2">
              <div className="cf-skeleton rounded h-2.5 w-1/2" />
              <div className="cf-skeleton rounded h-5 w-1/3" />
            </div>
          ))}
        </div>
        <div className="p-4 space-y-3">
          <div className="cf-skeleton rounded h-24 w-full" />
          <div className="cf-skeleton rounded h-48 w-full" />
        </div>
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
  } = analytics;

  return (
    <div className="h-full overflow-y-auto">
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-vscode-border border-b border-vscode-border bg-vscode-sidebar/30 [&>*:nth-child(3)]:border-l-0 lg:[&>*:nth-child(3)]:border-l">
        <Stat label="Total commits" value={totalCommits.toLocaleString()} />
        <Stat label="Active contributors" value={activeContributors} />
        <Stat label="Active branches" value={branchCount} />
        <Stat
          label="Avg commits / day"
          value={(totalCommits / Math.max(1, dailyActivity.length)).toFixed(1)}
        />
      </div>

      <Section title="Commit activity, last 365 days" hint="Click a day to filter commits">
        <div ref={heatmapRef} className="overflow-x-auto pb-2">
          <div className="w-max flex flex-col gap-1">
            <div className="relative h-4 text-[10px] text-gray-400">
              {heatmapGrid.monthLabels.map((month, index) => (
                <span
                  key={index}
                  style={{ left: month.colIndex * WEEK_WIDTH + DAY_LABELS_WIDTH }}
                  className="absolute"
                >
                  {month.label}
                </span>
              ))}
            </div>

            <div className="flex items-start gap-1.5">
              <div className="flex flex-col gap-1 w-7 text-[9px] text-gray-500">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <span key={day} className="h-3 leading-3">
                    {day}
                  </span>
                ))}
              </div>

              <div className="flex gap-1">
                {heatmapGrid.weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col gap-1">
                    {[0, 1, 2, 3, 4, 5, 6].map((dayNumber) => {
                      const day = week.find((d) => d.dayOfWeek === dayNumber);
                      if (!day) {
                        return <div key={dayNumber} className="w-3 h-3" />;
                      }
                      return (
                        <button
                          key={day.date}
                          onClick={() => handleHeatmapDateClick(day.date)}
                          title={`${day.date}: ${day.count} commit${day.count === 1 ? '' : 's'}`}
                          aria-label={`${day.date}: ${day.count} commits`}
                          className={`w-3 h-3 rounded-sm transition-transform duration-100 hover:scale-125 ${
                            LEVEL_COLORS[day.level]
                          }`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-1 text-[10px] text-gray-400 pt-1">
          <span className="mr-0.5">Less</span>
          {LEVEL_COLORS.map((color) => (
            <div key={color} className={`w-3 h-3 rounded-sm ${color}`} />
          ))}
          <span className="ml-0.5">More</span>
        </div>
      </Section>

      <Section title="Daily commits, last 30 days">
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyActivity} margin={{ top: 8, right: 0, bottom: 0, left: -24 }}>
              <CartesianGrid stroke={axisLine} strokeOpacity={0.5} vertical={false} />
              <XAxis
                dataKey="date"
                stroke={axisLine}
                tick={axisTick}
                tickLine={false}
                tickFormatter={(value) => value.slice(5)}
              />
              <YAxis stroke={axisLine} tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: 'var(--vscode-list-hoverBackground, #2a2d2e)' }}
                contentStyle={{
                  backgroundColor: 'var(--vscode-sideBar-background, #252526)',
                  borderColor: axisLine,
                  borderRadius: '6px',
                  color: 'var(--vscode-foreground, #cccccc)',
                  fontSize: '11px',
                }}
                itemStyle={{ color: 'var(--vscode-foreground, #cccccc)' }}
              />
              <Bar dataKey="commits" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-vscode-border">
        <Section title="Top contributors">
          <div className="max-h-64 overflow-y-auto">
            {contributorStats.map((contributor, index) => (
              <div
                key={contributor.email || contributor.name}
                onClick={() => {
                  setFilters({ authors: [contributor.name] });
                  setViewMode('grid');
                }}
                className={rankedRow}
              >
                <span className="w-4 shrink-0 text-[11px] text-gray-500 tabular-nums">{index + 1}</span>
                <span className="flex-1 min-w-0 truncate">
                  <span className="font-medium text-gray-200">{contributor.name}</span>{' '}
                  <span className="text-[11px] text-gray-400">{contributor.email}</span>
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-gray-300">
                  {contributor.commitCount}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Most changed files">
          <div className="max-h-64 overflow-y-auto">
            {topFiles.map((file, index) => (
              <div
                key={file.path}
                onClick={() => {
                  setFilters({ filePath: file.path });
                  setViewMode('grid');
                }}
                className={rankedRow}
              >
                <span className="w-4 shrink-0 text-[11px] text-gray-500 tabular-nums">{index + 1}</span>
                <span className="flex-1 min-w-0 truncate text-gray-200" title={file.path}>
                  {file.path}
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-gray-300">
                  {file.changes}
                </span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
};
