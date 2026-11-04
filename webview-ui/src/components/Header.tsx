import React from 'react';
import { useCommitStore } from '../stores/useCommitStore';
import { ViewMode } from '../types';
import {
  GitCommit,
  GitBranch,
  RefreshCw,
  LayoutGrid,
  List,
  Clock,
  GitFork,
  BarChart2,
  GitCompare,
  History,
  FolderGit2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    repositories,
    activeRepo,
    selectRepo,
    viewMode,
    setViewMode,
    loadCommits,
    loading,
    fileHistory,
    openFileHistory,
  } = useCommitStore();

  const refresh = () => {
    loadCommits();
    if (viewMode === 'fileHistory' && fileHistory.filePath) {
      openFileHistory(fileHistory.filePath);
    }
  };

  const navItems: { mode: ViewMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'grid', label: 'Cards', icon: <LayoutGrid className="w-4 h-4" /> },
    { mode: 'list', label: 'List', icon: <List className="w-4 h-4" /> },
    { mode: 'timeline', label: 'Timeline', icon: <Clock className="w-4 h-4" /> },
    { mode: 'graph', label: 'Graph', icon: <GitFork className="w-4 h-4" /> },
    { mode: 'branches', label: 'Branches & Tags', icon: <GitBranch className="w-4 h-4" /> },
    { mode: 'fileHistory', label: 'File History', icon: <History className="w-4 h-4" /> },
    { mode: 'compare', label: 'Compare', icon: <GitCompare className="w-4 h-4" /> },
    { mode: 'analytics', label: 'Analytics', icon: <BarChart2 className="w-4 h-4" /> },
  ];

  return (
    <header className="border-b border-vscode-border bg-vscode-sidebar/80 backdrop-blur px-4 py-2.5 flex items-center justify-between gap-4 flex-wrap shrink-0">
      {/* Brand & Repository Context */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 font-semibold text-sm tracking-wide text-blue-500">
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <GitCommit className="w-5 h-5" />
          </div>
          <span className="hidden sm:inline font-bold text-base text-gray-100">CommitFlow</span>
        </div>

        <div className="h-4 w-[1px] bg-vscode-border hidden sm:block" />

        {/* Repository selector */}
        {repositories.length > 0 ? (
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-4 h-4 text-gray-400" />
            <select
              value={activeRepo?.rootUri || ''}
              onChange={(e) => selectRepo(e.target.value)}
              className="bg-vscode-input text-vscode-fg border border-vscode-inputBorder rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              {repositories.map((repo) => (
                <option key={repo.rootUri} value={repo.rootUri}>
                  {repo.name} ({repo.currentBranch})
                </option>
              ))}
            </select>

            {activeRepo && (
              <div className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-vscode-input border border-vscode-border">
                <GitBranch className="w-3.5 h-3.5 text-blue-500" />
                <span className="font-mono text-gray-300">{activeRepo.currentBranch}</span>
                {activeRepo.isClean ? (
                  <span title="Working tree clean">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 ml-1" />
                  </span>
                ) : (
                  <span className="flex items-center text-amber-500 ml-1 text-[11px]" title={`${activeRepo.uncommittedCount} uncommitted changes`}>
                    <AlertCircle className="w-3 h-3 mr-0.5" />
                    {activeRepo.uncommittedCount}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-400">Discovering Git repositories...</span>
        )}
      </div>

      {/* Navigation Modes */}
      <div className="flex items-center gap-1 bg-vscode-input/60 p-0.5 rounded-lg border border-vscode-border">
        {navItems.map((item) => (
          <button
            key={item.mode}
            onClick={() => setViewMode(item.mode)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150 ${
              viewMode === item.mode
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-vscode-hover'
            }`}
          >
            {item.icon}
            <span className="hidden md:inline">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={refresh}
          disabled={loading}
          title="Refresh Git Commits"
          className="p-1.5 rounded-md hover:bg-vscode-hover text-gray-300 hover:text-vscode-fg transition border border-vscode-border disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-500' : ''}`} />
        </button>
      </div>
    </header>
  );
};
