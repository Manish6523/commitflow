import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  GitMerge,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { useCommitStore } from '../stores/useCommitStore';
import { vscode } from '../vscode';
import { AiInsightsPanel } from './AiInsightsPanel';
import { DiffWorkspace } from './diff/DiffWorkspace';
import { CommitRowsSkeleton } from './ui/Skeletons';
import { underlineTab } from './ui/styles';

export const CommitDetailPage: React.FC = () => {
  const {
    selectedCommitDetails: commit,
    selectCommit,
    openFileHistory,
    commitNavHistory,
    commitNavIndex,
    navigateCommitHistory,
    commits,
  } = useCommitStore();
  const [tab, setTab] = useState<'changes' | 'ai'>('changes');
  const [copied, setCopied] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);

  const close = () => {
    useCommitStore.setState({ loadingDetails: false });
    selectCommit(null);
  };

  const canGoBackHistory = commitNavIndex > 0;
  const canGoForwardHistory = commitNavIndex < commitNavHistory.length - 1;

  const currentIndex = commit ? commits.findIndex((c) => c.hash === commit.hash) : -1;
  const canGoNewer = currentIndex > 0;
  const canGoOlder =
    currentIndex !== -1
      ? currentIndex < commits.length - 1
      : (commit?.parentHashes.length ?? 0) > 0;

  const previousCommitHash = canGoBackHistory
    ? commitNavHistory[commitNavIndex - 1]
    : canGoNewer
    ? commits[currentIndex - 1]?.hash
    : null;

  const nextCommitHash = canGoForwardHistory
    ? commitNavHistory[commitNavIndex + 1]
    : canGoOlder
    ? currentIndex !== -1 && currentIndex < commits.length - 1
      ? commits[currentIndex + 1]?.hash
      : commit?.parentHashes[0] ?? null
    : commit?.parentHashes[0] ?? null;

  useEffect(() => {
    setTab('changes');
    setMessageOpen(false);
  }, [commit?.hash]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const inEditor = (event.target as HTMLElement).closest?.('.monaco-editor');
      if (event.key === 'Escape' && !inEditor) close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const copySha = () => {
    if (!commit) return;
    vscode.postMessage({ type: 'COPY_TO_CLIPBOARD', text: commit.hash });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNavigatePrevious = () => {
    if (canGoBackHistory) {
      navigateCommitHistory('back');
    } else if (previousCommitHash) {
      selectCommit(previousCommitHash);
    }
  };

  const handleNavigateNext = () => {
    if (canGoForwardHistory) {
      navigateCommitHistory('forward');
    } else if (nextCommitHash) {
      selectCommit(nextCommitHash);
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-vscode-bg animate-in fade-in slide-in-from-right-2 duration-200">
      <div className="px-3 pt-2 border-b border-vscode-border bg-vscode-sidebar/60 shrink-0">
        <div className="flex items-start gap-2">
          {/* Navigation & Back Controls */}
          <div className="flex items-center gap-0.5 mt-0.5 shrink-0 bg-vscode-input/50 rounded-lg p-0.5 border border-vscode-border">
            <button
              onClick={close}
              className="p-1.5 rounded-md text-gray-300 hover:text-vscode-fg hover:bg-vscode-hover transition-colors"
              title="Close Commit View (Esc)"
              aria-label="Close"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="h-3.5 w-[1px] bg-vscode-border mx-0.5" />

            <button
              onClick={handleNavigatePrevious}
              disabled={!previousCommitHash && !canGoBackHistory}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-300 hover:text-vscode-fg hover:bg-vscode-hover disabled:opacity-30 disabled:pointer-events-none transition font-medium"
              title={
                previousCommitHash
                  ? `Navigate to previous commit (${previousCommitHash.substring(0, 7)})`
                  : 'No previous commit'
              }
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <button
              onClick={handleNavigateNext}
              disabled={!nextCommitHash && !canGoForwardHistory}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-300 hover:text-vscode-fg hover:bg-vscode-hover disabled:opacity-30 disabled:pointer-events-none transition font-medium"
              title={
                nextCommitHash
                  ? `Navigate to next commit (${nextCommitHash.substring(0, 7)})`
                  : 'No next commit'
              }
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 min-w-0">
            {commit ? (
              <>
                <h2 className="text-sm font-semibold text-gray-100 truncate select-text" title={commit.subject}>
                  {commit.subject}
                </h2>
                <div className="flex items-center gap-x-2 gap-y-0.5 flex-wrap text-[11px] text-gray-400 mt-0.5">
                  <button
                    onClick={copySha}
                    className="flex items-center gap-1 font-mono text-blue-500 hover:underline"
                    title="Copy full SHA"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    {commit.shortHash}
                  </button>
                  <span className="flex items-center gap-1" title={commit.author.email}>
                    <User className="w-3 h-3" />
                    {commit.author.name}
                  </span>
                  <span>{new Date(commit.author.timestamp).toLocaleString()}</span>
                  {commit.parentHashes.length > 0 && (
                    <span className="flex items-center gap-1">
                      Parent
                      {commit.parentHashes.map((parent) => (
                        <button
                          key={parent}
                          onClick={() => selectCommit(parent)}
                          className="font-mono text-blue-500 hover:underline cursor-pointer"
                          title={`Navigate to parent commit ${parent.substring(0, 7)}`}
                        >
                          {parent.substring(0, 7)}
                        </button>
                      ))}
                    </span>
                  )}
                  {previousCommitHash && (
                    <button
                      onClick={handleNavigatePrevious}
                      className="font-mono text-xs text-blue-400 hover:underline flex items-center gap-0.5 ml-1"
                      title={`Back to previous commit (${previousCommitHash.substring(0, 7)})`}
                    >
                      <span>(← back to {previousCommitHash.substring(0, 7)})</span>
                    </button>
                  )}
                  {commit.isMerge && (
                    <span className="inline-flex items-center gap-1 px-1.5 rounded bg-purple-500/20 text-purple-500">
                      <GitMerge className="w-3 h-3" />
                      Merge
                    </span>
                  )}
                  {commit.signatureStatus === 'G' && (
                    <span className="inline-flex items-center gap-1 px-1.5 rounded bg-emerald-500/20 text-emerald-500">
                      <ShieldCheck className="w-3 h-3" />
                      Verified
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-2 py-1">
                <div className="cf-skeleton rounded h-3.5 w-1/2" />
                <div className="cf-skeleton rounded h-2.5 w-1/3" />
              </div>
            )}
          </div>

          <button
            onClick={close}
            className="p-1.5 rounded-md text-gray-400 hover:text-vscode-fg hover:bg-vscode-hover transition"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {commit?.body && messageOpen && (
          <p className="ml-9 mt-2 mb-1 max-h-40 overflow-y-auto text-xs text-gray-300 whitespace-pre-wrap leading-relaxed select-text animate-in fade-in duration-150">
            {commit.body}
          </p>
        )}

        <div className="flex items-center gap-1 ml-8 mt-1" role="tablist">
          <button role="tab" aria-selected={tab === 'changes'} onClick={() => setTab('changes')} className={underlineTab(tab === 'changes')}>
            Changes
          </button>
          <button role="tab" aria-selected={tab === 'ai'} onClick={() => setTab('ai')} className={underlineTab(tab === 'ai')}>
            <Sparkles className="w-3.5 h-3.5" />
            AI Insights
          </button>
          {commit?.body && (
            <button
              onClick={() => setMessageOpen((open) => !open)}
              aria-expanded={messageOpen}
              className="ml-auto mb-1 flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-200 transition-colors"
            >
              Full message
              <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${messageOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {!commit ? (
          <CommitRowsSkeleton />
        ) : tab === 'changes' ? (
          <DiffWorkspace
            files={commit.files}
            baseRef={commit.parentHashes[0] ?? null}
            targetRef={commit.hash}
            baseLabel={commit.parentHashes[0]?.substring(0, 7) ?? 'none'}
            targetLabel={commit.shortHash}
            onOpenHistory={openFileHistory}
          />
        ) : (
          <AiInsightsPanel key={commit.hash} commit={commit} />
        )}
      </div>
    </div>
  );
};
