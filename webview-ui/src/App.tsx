import React, { useEffect, useState } from 'react';
import { useCommitStore } from './stores/useCommitStore';
import { Header } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { CommitCard } from './components/CommitCard';
import { CommitListView } from './components/CommitListView';
import { CommitTimelineView } from './components/CommitTimelineView';
import { CommitGraphView } from './components/CommitGraphView';
import { BranchExplorer } from './components/BranchExplorer';
import { CommitCompareView } from './components/CommitCompareView';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { CommitInspectorModal } from './components/CommitInspectorModal';
import {
  ChevronLeft,
  ChevronRight,
  GitCommit,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';

export const App: React.FC = () => {
  const {
    loadRepositories,
    loadCommits,
    commits,
    totalCount,
    page,
    pageSize,
    hasMore,
    loading,
    viewMode,
    selectedCommitDetails,
  } = useCommitStore();

  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    // Initial fetch
    loadRepositories();
    loadCommits(1);

    // Message listener from extension host
    const handleExtensionMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg) return;

      switch (msg.type) {
        case 'REPOSITORIES_LOADED': {
          useCommitStore.setState({
            repositories: msg.repositories,
            activeRepo: msg.activeRepo,
          });
          break;
        }

        case 'COMMITS_LOADED':
        case 'SEARCH_RESULTS': {
          useCommitStore.setState({
            commits: msg.commits,
            totalCount: msg.totalCount,
            page: msg.page,
            hasMore: msg.hasMore,
            loading: false,
          });
          break;
        }

        case 'COMMIT_DETAILS_LOADED': {
          useCommitStore.setState({
            selectedCommitDetails: msg.details,
            loadingDetails: false,
          });
          break;
        }

        case 'BRANCHES_TAGS_LOADED': {
          useCommitStore.setState({
            branches: msg.branches,
            tags: msg.tags,
          });
          break;
        }

        case 'ANALYTICS_LOADED': {
          useCommitStore.setState({
            analytics: msg.analytics,
            loadingAnalytics: false,
          });
          break;
        }

        case 'COMPARE_RESULT_LOADED': {
          useCommitStore.setState({
            compareResult: msg.result,
            comparing: false,
          });
          break;
        }

        case 'SAVED_FILTERS_LOADED': {
          useCommitStore.setState({
            savedFilters: msg.filters,
          });
          break;
        }

        case 'GIT_OP_SUCCESS': {
          setNotification({ type: 'success', message: msg.message });
          setTimeout(() => setNotification(null), 4000);
          loadCommits(page);
          break;
        }

        case 'GIT_OP_ERROR':
        case 'ERROR': {
          setNotification({ type: 'error', message: msg.message || msg.error });
          setTimeout(() => setNotification(null), 6000);
          useCommitStore.setState({ loading: false });
          break;
        }
      }
    };

    window.addEventListener('message', handleExtensionMessage);
    return () => window.removeEventListener('message', handleExtensionMessage);
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-vscode-bg text-vscode-fg select-none">
      {/* Top Header */}
      <Header />

      {/* Toast Notification */}
      {notification && (
        <div
          className={`absolute top-14 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl border shadow-xl text-xs font-medium animate-in slide-in-from-top-2 ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40'
              : 'bg-rose-950/90 text-rose-200 border-rose-500/40'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Render SearchBar for card, list, timeline, graph */}
        {['grid', 'list', 'timeline', 'graph'].includes(viewMode) && <SearchBar />}

        {/* View Switcher */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === 'grid' && (
            <div className="p-4 flex flex-col justify-between min-h-full">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
                  <GitCommit className="w-8 h-8 animate-spin text-blue-400" />
                  <span className="text-xs">Loading commits...</span>
                </div>
              ) : commits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
                  <GitCommit className="w-8 h-8 text-gray-600" />
                  <span className="text-sm font-semibold">No commits found</span>
                  <span className="text-xs text-gray-500">
                    Try adjusting your search query or filters.
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {commits.map((commit) => (
                    <CommitCard key={commit.hash} commit={commit} />
                  ))}
                </div>
              )}
            </div>
          )}

          {viewMode === 'list' && (
            <div className="p-2 flex flex-col justify-between min-h-full">
              {loading ? (
                <div className="flex items-center justify-center py-20 text-gray-400 text-xs">
                  Loading commits...
                </div>
              ) : commits.length === 0 ? (
                <div className="text-center py-20 text-gray-400 text-xs">No commits found</div>
              ) : (
                <CommitListView commits={commits} />
              )}
            </div>
          )}

          {viewMode === 'timeline' && (
            <div className="p-4">
              <CommitTimelineView commits={commits} />
            </div>
          )}

          {viewMode === 'graph' && <CommitGraphView commits={commits} />}

          {viewMode === 'branches' && <BranchExplorer />}

          {viewMode === 'compare' && <CommitCompareView />}

          {viewMode === 'analytics' && <AnalyticsDashboard />}
        </div>

        {/* Bottom Pagination Bar (for Grid & List views) */}
        {['grid', 'list'].includes(viewMode) && totalCount > 0 && (
          <div className="border-t border-vscode-border bg-vscode-sidebar/90 px-4 py-2 flex items-center justify-between text-xs text-gray-400 shrink-0">
            <div className="flex items-center gap-2">
              <span>
                Showing page <span className="font-semibold text-gray-200">{page}</span> of{' '}
                <span className="font-semibold text-gray-200">{totalPages}</span>
              </span>
              <span className="text-[11px] text-gray-500">
                ({totalCount.toLocaleString()} total commits)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => loadCommits(Math.max(1, page - 1))}
                disabled={page <= 1 || loading}
                className="px-2.5 py-1 rounded bg-vscode-input hover:bg-vscode-hover border border-vscode-border text-gray-200 disabled:opacity-40 transition flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              <button
                onClick={() => loadCommits(page + 1)}
                disabled={!hasMore || loading}
                className="px-2.5 py-1 rounded bg-vscode-input hover:bg-vscode-hover border border-vscode-border text-gray-200 disabled:opacity-40 transition flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Commit Detail Inspector Modal */}
      {selectedCommitDetails && <CommitInspectorModal />}
    </div>
  );
};
