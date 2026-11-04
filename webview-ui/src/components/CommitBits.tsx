import React, { useState } from 'react';
import {
  Check,
  CheckCheck,
  Copy,
  GitBranch,
  GitCompare,
  GitMerge,
  GitPullRequest,
  RotateCcw,
  ShieldCheck,
  Tag as TagIcon,
} from 'lucide-react';
import { useCommitStore } from '../stores/useCommitStore';
import { GitCommit } from '../types';
import { vscode } from '../vscode';

const badge = 'inline-flex items-center gap-1 px-1 rounded text-[10px] font-mono max-w-[140px] shrink-0';

export const RefBadges: React.FC<{ commit: GitCommit; limit?: number }> = ({ commit, limit = 2 }) => (
  <>
    {commit.isMerge && (
      <span className={`${badge} bg-purple-500/15 text-purple-500`} title="Merge commit">
        <GitMerge className="w-2.5 h-2.5 shrink-0" />
        merge
      </span>
    )}
    {commit.signatureStatus === 'G' && (
      <span className={`${badge} bg-emerald-500/15 text-emerald-500`} title="Verified signature">
        <ShieldCheck className="w-2.5 h-2.5 shrink-0" />
        signed
      </span>
    )}
    {commit.branches.slice(0, limit).map((branch) => (
      <span key={branch} className={`${badge} bg-blue-500/15 text-blue-500`} title={`Branch: ${branch}`}>
        <GitBranch className="w-2.5 h-2.5 shrink-0" />
        <span className="truncate">{branch}</span>
      </span>
    ))}
    {commit.tags.slice(0, limit).map((tag) => (
      <span key={tag} className={`${badge} bg-amber-500/15 text-amber-500`} title={`Tag: ${tag}`}>
        <TagIcon className="w-2.5 h-2.5 shrink-0" />
        <span className="truncate">{tag}</span>
      </span>
    ))}
  </>
);

export const CommitStats: React.FC<{ commit: GitCommit }> = ({ commit }) => (
  <span className="font-mono text-[10px] tabular-nums shrink-0 transition-opacity group-hover:opacity-0 group-focus-within:opacity-0">
    <span className="text-emerald-500">+{commit.insertions}</span>{' '}
    <span className="text-rose-500">-{commit.deletions}</span>
  </span>
);

const actionButton =
  'p-1 rounded text-gray-300 hover:text-vscode-fg hover:bg-vscode-hover transition-colors';

/** Toolbar that floats over the row's right edge on hover. */
export const CommitActions: React.FC<{ commit: GitCommit }> = ({ commit }) => {
  const { compareCommits, executeGitOp, requestConfirm, setViewMode } = useCommitStore();
  const [copied, setCopied] = useState(false);

  const copySha = () => {
    vscode.postMessage({ type: 'COPY_TO_CLIPBOARD', text: commit.hash });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const compareWithHead = () => {
    compareCommits(commit.hash, 'HEAD');
    setViewMode('compare');
  };

  const checkout = () =>
    requestConfirm({
      title: `Checkout ${commit.shortHash}?`,
      detail: 'This puts the repository in a detached HEAD state at this commit.',
      label: 'Checkout',
      onConfirm: () => executeGitOp('checkout', { target: commit.hash }),
    });

  const cherryPick = () =>
    requestConfirm({
      title: `Cherry-pick ${commit.shortHash}?`,
      detail: 'This applies the commit on top of your current branch.',
      label: 'Cherry-pick',
      onConfirm: () => executeGitOp('cherry-pick', { hash: commit.hash }),
    });

  const revert = () =>
    requestConfirm({
      title: `Revert ${commit.shortHash}?`,
      detail: 'This creates a new commit that undoes these changes.',
      label: 'Revert',
      danger: true,
      onConfirm: () => executeGitOp('revert', { hash: commit.hash, isMerge: commit.isMerge }),
    });

  const buttons: { label: string; icon: React.ReactNode; onClick: () => void }[] = [
    {
      label: 'Copy SHA',
      icon: copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />,
      onClick: copySha,
    },
    { label: 'Compare with HEAD', icon: <GitCompare className="w-3.5 h-3.5" />, onClick: compareWithHead },
    { label: 'Checkout', icon: <CheckCheck className="w-3.5 h-3.5" />, onClick: checkout },
    { label: 'Cherry-pick', icon: <GitPullRequest className="w-3.5 h-3.5" />, onClick: cherryPick },
    { label: 'Revert', icon: <RotateCcw className="w-3.5 h-3.5" />, onClick: revert },
  ];

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex items-center gap-0.5 p-0.5 rounded-md border border-vscode-border bg-vscode-sidebar shadow-sm opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto transition-opacity duration-100"
    >
      {buttons.map((button) => (
        <button
          key={button.label}
          onClick={button.onClick}
          className={actionButton}
          title={button.label}
          aria-label={`${button.label} ${commit.shortHash}`}
        >
          {button.icon}
        </button>
      ))}
    </div>
  );
};
