import React, { useEffect, useState } from 'react';
import { isLatestCommitQuery, useCommitStore } from './stores/useCommitStore';
import { Header } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { CommitCard } from './components/CommitCard';
import { CommitListView } from './components/CommitListView';
import { CommitTimelineView } from './components/CommitTimelineView';
import { CommitGraphView } from './components/CommitGraphView';
import { BranchExplorer } from './components/BranchExplorer';
import { CommitCompareView } from './components/CommitCompareView';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { CommitDetailPage } from './components/CommitDetailPage';
import { FileHistoryView } from './components/FileHistoryView';
import { SettingsView } from './components/SettingsView';
import { CommitCardsSkeleton, CommitRowsSkeleton } from './components/ui/Skeletons';
import { EmptyState } from './components/ui/EmptyState';
import { ConfirmDialog } from './components/ui/Dialog';
import { iconButton } from './components/ui/styles';
import { vscode } from './vscode';
import { ViewMode } from './types';
import {
  ChevronLeft,
  ChevronRight,
  GitCommit,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';

const PAGED_VIEWS: ViewMode[] = ['grid', 'list', 'timeline', 'graph'];

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
    loadingDetails,
    searchQuery,
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
          const previous = useCommitStore.getState().activeRepo;
          useCommitStore.setState({
            repositories: msg.repositories,
            activeRepo: msg.activeRepo,
          });
          if (previous && previous.rootUri !== msg.activeRepo?.rootUri) {
            useCommitStore.getState().resetRepositoryState();
          }
          break;
        }

        case 'COMMITS_LOADED':
        case 'SEARCH_RESULTS': {
          if (!isLatestCommitQuery(msg.seq)) break;
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

        case 'SWITCH_VIEW': {
          useCommitStore.getState().setViewMode(msg.view as ViewMode);
          break;
        }

        case 'OPEN_FILE_HISTORY': {
          useCommitStore.getState().openFileHistory(msg.filePath);
          break;
        }

        case 'OPEN_COMMIT': {
          useCommitStore.getState().selectCommit(msg.hash);
          break;
        }

        case 'FOCUS_SEARCH': {
          useCommitStore.getState().setViewMode('grid');
          requestAnimationFrame(() => {
            document.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
          });
          break;
        }

        case 'GIT_OP_SUCCESS': {
          setNotification({ type: 'success', message: msg.message });
          setTimeout(() => setNotification(null), 4000);
          const store = useCommitStore.getState();
          store.loadCommits(store.page);
          if (store.viewMode === 'branches') store.loadBranchesAndTags();
          break;
        }

        case 'GIT_OP_ERROR':
        case 'ERROR': {
          setNotification({ type: 'error', message: msg.message || msg.error });
          setTimeout(() => setNotification(null), 6000);
          useCommitStore.setState({ loading: false, loadingDetails: false, comparing: false });
          break;
        }
      }
    };

    window.addEventListener('message', handleExtensionMessage);
    vscode.postMessage({ type: 'WEBVIEW_READY' });
    return () => window.removeEventListener('message', handleExtensionMessage);
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const commitView = (skeleton: React.ReactNode, content: React.ReactNode) => {
    if (commits.length > 0) {
      return (
        <div className={`h-full transition-opacity duration-150 ${loading ? 'opacity-60' : ''}`}>
          {content}
        </div>
      );
    }
    return loading ? (
      skeleton
    ) : (
      <EmptyState
        icon={<GitCommit className="w-8 h-8" />}
        title={searchQuery.trim() ? 'No commits match your search' : 'No commits found'}
        detail="Try fewer words, or adjust your filters."
      />
    );
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-vscode-bg text-vscode-fg select-none">
      {/* Top Header */}
      <Header />

      {/* Toast Notification */}
      {notification && (
        <div className="absolute top-14 right-4 z-[60] flex items-center gap-2 pl-3 pr-1.5 py-1.5 max-w-md rounded-xl border border-vscode-border bg-vscode-sidebar shadow-xl text-xs text-gray-100 animate-in fade-in slide-in-from-top-2 duration-200">
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          )}
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className={iconButton} aria-label="Dismiss">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="relative flex-1 flex flex-col overflow-hidden">
        {/* Render SearchBar for card, list, timeline, graph */}
        {PAGED_VIEWS.includes(viewMode) && <SearchBar />}

        {/* View Switcher */}
        <div className="flex-1 overflow-y-auto">
          <div key={viewMode} className="h-full animate-in fade-in duration-200">
            {viewMode === 'grid' &&
              commitView(
                <CommitCardsSkeleton />,
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                  {commits.map((commit) => (
                    <CommitCard key={commit.hash} commit={commit} />
                  ))}
                </div>
              )}

            {viewMode === 'list' && commitView(<CommitRowsSkeleton />, <CommitListView commits={commits} />)}

            {viewMode === 'timeline' &&
              commitView(<CommitRowsSkeleton />, <CommitTimelineView commits={commits} />)}

            {viewMode === 'graph' && commitView(<CommitRowsSkeleton />, <CommitGraphView commits={commits} />)}

            {viewMode === 'branches' && <BranchExplorer />}

            {viewMode === 'fileHistory' && <FileHistoryView />}

            {viewMode === 'compare' && <CommitCompareView />}

            {viewMode === 'analytics' && <AnalyticsDashboard />}

            {viewMode === 'settings' && <SettingsView />}
          </div>
        </div>

        {/* Bottom Pagination Bar */}
        {PAGED_VIEWS.includes(viewMode) && totalCount > 0 && (
          <div className="border-t border-vscode-border bg-vscode-sidebar/60 px-3 py-1 flex items-center justify-between text-[11px] text-gray-400 shrink-0">
            <span className="tabular-nums">
              Page {page} of {totalPages}
            </span>

            <div className="flex items-center gap-0.5">
              <button
                onClick={() => loadCommits(Math.max(1, page - 1))}
                disabled={page <= 1 || loading}
                className={iconButton}
                title="Previous page"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => loadCommits(page + 1)}
                disabled={!hasMore || loading}
                className={iconButton}
                title="Next page"
                aria-label="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Full-page commit details, layered over the view it was opened from */}
        {(selectedCommitDetails || loadingDetails) && <CommitDetailPage />}
      </div>

      <ConfirmDialog />
    </div>
  );
};

