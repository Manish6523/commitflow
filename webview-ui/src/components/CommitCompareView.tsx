import React, { useEffect, useState } from 'react';
import { useCommitStore } from '../stores/useCommitStore';
import { GitCompare, ArrowRight, Equal, Search } from 'lucide-react';
import { DiffWorkspace } from './diff/DiffWorkspace';
import { EmptyState } from './ui/EmptyState';
import { primaryButton, textInput } from './ui/styles';

const shortRef = (ref: string) => (/^[0-9a-f]{40}$/.test(ref) ? ref.slice(0, 7) : ref);

export const CommitCompareView: React.FC = () => {
  const { compareCommits, compareResult, comparing, commits, openFileHistory } = useCommitStore();
  const [baseInput, setBaseInput] = useState('HEAD~1');
  const [targetInput, setTargetInput] = useState('HEAD');

  // A comparison can start elsewhere, like a commit's Compare with HEAD action.
  useEffect(() => {
    if (compareResult) {
      setBaseInput(compareResult.baseCommit);
      setTargetInput(compareResult.targetCommit);
    }
  }, [compareResult]);

  const handleRunCompare = () => {
    if (baseInput.trim() && targetInput.trim()) {
      compareCommits(baseInput.trim(), targetInput.trim());
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-vscode-bg select-none">
      {/* Header and Compare Input Form */}
      <div className="px-3 py-2 border-b border-vscode-border bg-vscode-sidebar/60 flex flex-col gap-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
            <span className="text-xs text-gray-400 font-medium">Base:</span>
            <input
              type="text"
              value={baseInput}
              onChange={(e) => setBaseInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRunCompare()}
              placeholder="e.g. main, HEAD~1, a82f91c"
              className={`${textInput} flex-1 font-mono`}
            />
          </div>

          <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />

          <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
            <span className="text-xs text-gray-400 font-medium">Target:</span>
            <input
              type="text"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRunCompare()}
              placeholder="e.g. HEAD, feature-branch, b93e11a"
              className={`${textInput} flex-1 font-mono`}
            />
          </div>

          <button
            onClick={handleRunCompare}
            disabled={comparing || !baseInput.trim() || !targetInput.trim()}
            className={primaryButton}
          >
            <Search className="w-3.5 h-3.5" />
            <span>{comparing ? 'Comparing...' : 'Compare'}</span>
          </button>
        </div>

        {/* Quick select presets from recent commits */}
        {commits.length >= 2 && (
          <div className="flex items-center gap-2 text-[11px] text-gray-400 pt-1">
            <span>Quick:</span>
            <button
              onClick={() => {
                setBaseInput(commits[1].hash);
                setTargetInput(commits[0].hash);
                          compareCommits(commits[1].hash, commits[0].hash);
              }}
              className="text-blue-500 hover:underline"
            >
              Latest 2 Commits ({commits[1].shortHash} ↔ {commits[0].shortHash})
            </button>
            <span>·</span>
            <button
              onClick={() => {
                setBaseInput('HEAD~1');
                setTargetInput('HEAD');
                          compareCommits('HEAD~1', 'HEAD');
              }}
              className="text-blue-500 hover:underline"
            >
              HEAD~1 ↔ HEAD
            </button>
          </div>
        )}
      </div>

      {/* Comparison Results */}
      <div className="flex-1 min-h-0 relative">
        {comparing && <div className="cf-progress" role="progressbar" aria-label="Comparing" />}
        {compareResult ? (
          compareResult.files.length > 0 ? (
            <div className="h-full animate-in fade-in duration-200">
              <DiffWorkspace
                files={compareResult.files}
                baseRef={compareResult.baseCommit}
                targetRef={compareResult.targetCommit}
                baseLabel={shortRef(compareResult.baseCommit)}
                targetLabel={shortRef(compareResult.targetCommit)}
                onOpenHistory={openFileHistory}
              />
            </div>
          ) : (
            <EmptyState
              icon={<Equal className="w-7 h-7" />}
              title="No differences"
              detail="These two revisions have identical files."
            />
          )
        ) : (
          !comparing && (
            <EmptyState
              icon={<GitCompare className="w-7 h-7" />}
              title="Choose two revisions to compare"
              detail="Enter any commit, branch or tag above, then press Compare."
            />
          )
        )}
      </div>
    </div>
  );
};
