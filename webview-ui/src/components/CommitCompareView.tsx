import React, { useEffect, useState } from 'react';
import { useCommitStore } from '../stores/useCommitStore';
import { AlertTriangle, ArrowLeftRight, CheckCircle2, Equal, FileWarning, GitCompare, GitMerge, Search } from 'lucide-react';
import { CompareMode, MergeCheckResult } from '../types';
import { vscode } from '../vscode';
import { DiffWorkspace } from './diff/DiffWorkspace';
import { EmptyState } from './ui/EmptyState';
import { ghostButton, primaryButton } from './ui/styles';
import { RefPicker } from './compare/RefPicker';

const short = (ref: string) => (/^[0-9a-f]{40,64}$/.test(ref) ? ref.slice(0, 7) : ref);

type MergeCheck =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'done'; base: string; target: string; result: MergeCheckResult }
  | { state: 'failed'; message: string };

export const CommitCompareView: React.FC = () => {
  const { compareCommits, compareResult, comparing, commits, openFileHistory } = useCommitStore();
  const [baseInput, setBaseInput] = useState('HEAD~1');
  const [targetInput, setTargetInput] = useState('HEAD');
  const [mode, setMode] = useState<CompareMode>('direct');
  const [mergeCheck, setMergeCheck] = useState<MergeCheck>({ state: 'idle' });

  // A comparison can start elsewhere, like a commit's Compare with HEAD action.
  useEffect(() => {
    if (compareResult) {
      setBaseInput(compareResult.baseCommit);
      setTargetInput(compareResult.targetCommit);
      setMode(compareResult.mode);
    }
  }, [compareResult]);

  // A conflict check answers for the two names it ran on, so drop it when they change.
  useEffect(() => {
    setMergeCheck((check) =>
      check.state === 'done' && (check.base !== baseInput.trim() || check.target !== targetInput.trim()) ? { state: 'idle' } : check
    );
  }, [baseInput, targetInput]);

  const ready = Boolean(baseInput.trim() && targetInput.trim());
  const run = (base = baseInput, target = targetInput, withMode = mode) => {
    if (base.trim() && target.trim()) compareCommits(base.trim(), target.trim(), withMode);
  };

  const swap = () => {
    setBaseInput(targetInput);
    setTargetInput(baseInput);
    if (compareResult) run(targetInput, baseInput);
  };

  const changeMode = (next: CompareMode) => {
    setMode(next);
    if (compareResult) run(baseInput, targetInput, next);
  };

  const checkConflicts = async () => {
    const base = baseInput.trim();
    const target = targetInput.trim();
    setMergeCheck({ state: 'checking' });
    try {
      const res = await vscode.request<{ result: MergeCheckResult }>({ type: 'CHECK_MERGE', base, target }, 120000);
      setMergeCheck({ state: 'done', base, target, result: res.result });
    } catch (err: any) {
      setMergeCheck({ state: 'failed', message: err.message });
    }
  };

  // Show what each box resolved to, once a comparison of exactly these names has run.
  const resultMatches =
    compareResult && compareResult.baseCommit === baseInput.trim() && compareResult.targetCommit === targetInput.trim();
  const baseSummary = resultMatches
    ? `${compareResult!.mode === 'branch' ? 'Split point ' : ''}${short(compareResult!.baseHash)} · ${compareResult!.baseSubject}`
    : undefined;
  const targetSummary = resultMatches ? `${short(compareResult!.targetHash)} · ${compareResult!.targetSubject}` : undefined;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-vscode-bg select-none">
      <div className="px-3 py-2 border-b border-vscode-border bg-vscode-sidebar/60 flex flex-col gap-2 shrink-0">
        <div className="flex items-start gap-2 flex-wrap">
          <RefPicker
            label="Base"
            value={baseInput}
            onChange={setBaseInput}
            onSubmit={() => run()}
            summary={baseSummary}
            placeholder="e.g. main, HEAD~1, a82f91c"
          />
          <button onClick={swap} className={`${ghostButton} mt-0.5`} title="Swap Base and Target" aria-label="Swap Base and Target">
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>
          <RefPicker
            label="Target"
            value={targetInput}
            onChange={setTargetInput}
            onSubmit={() => run()}
            summary={targetSummary}
            placeholder="e.g. HEAD, feature-branch, b93e11a"
          />
          <button onClick={() => run()} disabled={comparing || !ready} className={primaryButton}>
            <Search className="w-3.5 h-3.5" />
            <span>{comparing ? 'Comparing…' : 'Compare'}</span>
          </button>
          <button
            onClick={checkConflicts}
            disabled={mergeCheck.state === 'checking' || !ready}
            className={ghostButton}
            title="Try merging Target into Base, without changing anything, and list the files that would conflict"
          >
            <GitMerge className="w-3.5 h-3.5" />
            <span>{mergeCheck.state === 'checking' ? 'Checking…' : 'Check for conflicts'}</span>
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap text-[11px] text-gray-400">
          <label className="flex items-center gap-1.5 cursor-pointer" title="Compare from where Target split off from Base, so changes made on Base since then are left out">
            <input
              type="checkbox"
              checked={mode === 'branch'}
              onChange={(e) => changeMode(e.target.checked ? 'branch' : 'direct')}
              className="accent-blue-500"
            />
            Only Target’s own changes (since it split from Base)
          </label>
          {commits.length >= 2 && (
            <span className="flex items-center gap-2">
              <span>Quick:</span>
              <button
                onClick={() => {
                  setBaseInput(commits[1].shortHash);
                  setTargetInput(commits[0].shortHash);
                  run(commits[1].shortHash, commits[0].shortHash);
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
                  run('HEAD~1', 'HEAD');
                }}
                className="text-blue-500 hover:underline"
              >
                HEAD~1 ↔ HEAD
              </button>
            </span>
          )}
          {resultMatches && (compareResult!.ahead > 0 || compareResult!.behind > 0) && (
            <span className="ml-auto">
              Target is {compareResult!.ahead} commit{compareResult!.ahead === 1 ? '' : 's'} ahead and {compareResult!.behind} behind Base
            </span>
          )}
        </div>

        {mergeCheck.state === 'done' &&
          (mergeCheck.result.clean ? (
            <div role="status" className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-emerald-500/10 text-xs text-gray-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>
                <b>{mergeCheck.target}</b> merges into <b>{mergeCheck.base}</b> cleanly. No conflicts.
              </span>
            </div>
          ) : (
            <div role="alert" className="flex flex-col gap-1.5 px-2.5 py-1.5 rounded-md bg-rose-500/10 text-xs text-gray-200">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                Merging <b>{mergeCheck.target}</b> into <b>{mergeCheck.base}</b> would conflict in {mergeCheck.result.conflicts.length}{' '}
                file{mergeCheck.result.conflicts.length === 1 ? '' : 's'}. Click one to see the clashing lines.
              </span>
              <span className="flex flex-wrap gap-1.5 pl-6">
                {mergeCheck.result.conflicts.map((file) => (
                  <button
                    key={file}
                    onClick={() => vscode.postMessage({ type: 'OPEN_MERGE_CONFLICT', tree: mergeCheck.result.tree, path: file })}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 font-mono text-[11px] hover:bg-rose-500/25"
                    title={`Open ${file} as it would be after the merge, with conflict markers`}
                  >
                    <FileWarning className="w-3 h-3" />
                    {file}
                  </button>
                ))}
              </span>
              <span className="pl-6 text-[11px] text-gray-400">Nothing was changed. This was a trial merge only.</span>
            </div>
          ))}
        {mergeCheck.state === 'failed' && (
          <div role="alert" className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-rose-500/10 text-xs text-gray-200">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            {mergeCheck.message}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 relative">
        {comparing && <div className="cf-progress" role="progressbar" aria-label="Comparing" />}
        {compareResult ? (
          compareResult.files.length > 0 ? (
            <div className="h-full animate-in fade-in duration-200">
              <DiffWorkspace
                files={compareResult.files}
                baseRef={compareResult.baseHash}
                targetRef={compareResult.targetHash}
                baseLabel={short(compareResult.baseHash)}
                targetLabel={short(compareResult.targetHash)}
                onOpenHistory={openFileHistory}
              />
            </div>
          ) : (
            <EmptyState
              icon={<Equal className="w-7 h-7" />}
              title="No differences"
              detail={
                compareResult.mode === 'branch'
                  ? 'Target has no changes of its own since it split from Base.'
                  : 'These two revisions have identical files.'
              }
            />
          )
        ) : (
          !comparing && (
            <EmptyState
              icon={<GitCompare className="w-7 h-7" />}
              title="Choose two revisions to compare"
              detail="Pick a commit, branch or tag in each box, or type one, then press Compare."
            />
          )
        )}
      </div>
    </div>
  );
};
