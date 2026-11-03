import React, { useState } from 'react';
import { GitCommit } from '../types';
import { useCommitStore } from '../stores/useCommitStore';
import {
  Copy,
  Check,
  GitBranch,
  Tag as TagIcon,
  GitMerge,
  ShieldCheck,
  FileCode2,
  Plus,
  Minus,
  ExternalLink,
  GitPullRequest,
  RotateCcw,
  CheckCheck,
} from 'lucide-react';
import { vscode } from '../vscode';

interface CommitCardProps {
  commit: GitCommit;
  isSelected?: boolean;
}

// Generate consistent avatar color based on author name
const getAvatarColor = (name: string): string => {
  const colors = [
    'bg-blue-600',
    'bg-purple-600',
    'bg-emerald-600',
    'bg-amber-600',
    'bg-rose-600',
    'bg-indigo-600',
    'bg-teal-600',
    'bg-cyan-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const getInitials = (name: string): string => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatRelativeTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years}y ago`;
  if (months > 0) return `${months}mo ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
};

export const CommitCard: React.FC<CommitCardProps> = ({ commit, isSelected }) => {
  const { selectCommit, executeGitOp, compareCommits } = useCommitStore();
  const [copiedSha, setCopiedSha] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);

  const copySha = (e: React.MouseEvent) => {
    e.stopPropagation();
    vscode.postMessage({ type: 'COPY_TO_CLIPBOARD', text: commit.hash });
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 2000);
  };

  const copyMessage = (e: React.MouseEvent) => {
    e.stopPropagation();
    vscode.postMessage({ type: 'COPY_TO_CLIPBOARD', text: commit.subject });
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 2000);
  };

  const handleCheckout = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Checkout commit ${commit.shortHash}?`)) {
      executeGitOp('checkout', { target: commit.hash });
    }
  };

  const handleCherryPick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Cherry-pick commit ${commit.shortHash} into current branch?`)) {
      executeGitOp('cherry-pick', { hash: commit.hash });
    }
  };

  const handleRevert = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Revert commit ${commit.shortHash}? A new commit reversing changes will be created.`)) {
      executeGitOp('revert', { hash: commit.hash, isMerge: commit.isMerge });
    }
  };

  const handleCompareWithHead = (e: React.MouseEvent) => {
    e.stopPropagation();
    compareCommits(commit.hash, 'HEAD');
    useCommitStore.getState().setViewMode('compare');
  };

  const formattedDate = new Date(commit.author.timestamp).toLocaleString();

  return (
    <div
      onClick={() => selectCommit(commit.hash)}
      className={`group relative rounded-xl border p-4 transition-all duration-150 flex flex-col justify-between cursor-pointer ${
        isSelected
          ? 'bg-blue-900/10 border-blue-500 shadow-md ring-1 ring-blue-500'
          : 'bg-vscode-sidebar/50 hover:bg-vscode-sidebar border-vscode-border hover:border-gray-600 shadow-sm'
      }`}
    >
      {/* Top Header: SHA, Refs, Indicators */}
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* SHA pill */}
          <button
            onClick={copySha}
            title={`Full SHA: ${commit.hash}\nClick to copy`}
            className="flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded bg-vscode-input border border-vscode-inputBorder text-gray-300 hover:text-white hover:border-blue-400 transition"
          >
            {copiedSha ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-gray-400" />}
            <span>{commit.shortHash}</span>
          </button>

          {/* Merge badge */}
          {commit.isMerge && (
            <span
              title={`Merge commit with parents: ${commit.parentHashes.map((p) => p.substring(0, 7)).join(', ')}`}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/15 text-purple-300 border border-purple-500/30"
            >
              <GitMerge className="w-3 h-3" />
              Merge
            </span>
          )}

          {/* Signature badge */}
          {commit.signatureStatus === 'G' && (
            <span
              title="Verified Cryptographic Signature"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
            >
              <ShieldCheck className="w-3 h-3" />
              Signed
            </span>
          )}

          {/* Branches */}
          {commit.branches.slice(0, 2).map((br) => (
            <span
              key={br}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 max-w-[120px] truncate"
              title={`Branch: ${br}`}
            >
              <GitBranch className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{br}</span>
            </span>
          ))}

          {/* Tags */}
          {commit.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30 max-w-[100px] truncate"
              title={`Tag: ${tag}`}
            >
              <TagIcon className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{tag}</span>
            </span>
          ))}
        </div>

        {/* Timestamp */}
        <div
          title={formattedDate}
          className="text-[11px] text-gray-400 font-mono tracking-tight cursor-help"
        >
          {formatRelativeTime(commit.author.timestamp)}
        </div>
      </div>

      {/* Commit Message */}
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-gray-100 group-hover:text-blue-300 transition line-clamp-2 leading-snug">
          {commit.subject}
        </h4>
        {commit.body && (
          <p className="text-xs text-gray-400 mt-1 line-clamp-2 font-mono whitespace-pre-wrap leading-relaxed">
            {commit.body}
          </p>
        )}
      </div>

      {/* Footer: Author Info & Changes Stats */}
      <div className="pt-2.5 border-t border-vscode-border flex items-center justify-between gap-3 flex-wrap">
        {/* Author */}
        <div className="flex items-center gap-2">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm ${getAvatarColor(
              commit.author.name
            )}`}
            title={`${commit.author.name} <${commit.author.email}>`}
          >
            {getInitials(commit.author.name)}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-gray-200 line-clamp-1">
              {commit.author.name}
            </span>
          </div>
        </div>

        {/* Change stats */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="flex items-center gap-1 text-gray-400" title="Files modified">
            <FileCode2 className="w-3.5 h-3.5" />
            <span>{commit.filesChanged}</span>
          </div>
          <div className="flex items-center text-emerald-400 font-medium" title="Lines inserted">
            <Plus className="w-3 h-3" />
            <span>{commit.insertions}</span>
          </div>
          <div className="flex items-center text-rose-400 font-medium" title="Lines deleted">
            <Minus className="w-3 h-3" />
            <span>{commit.deletions}</span>
          </div>
        </div>
      </div>

      {/* Hover Action Strip */}
      <div className="mt-2.5 pt-2 border-t border-vscode-border/60 flex items-center justify-between gap-1 text-[11px] text-gray-400">
        <div className="flex items-center gap-1">
          <button
            onClick={copyMessage}
            title="Copy commit message"
            className="px-2 py-0.5 rounded hover:bg-vscode-hover hover:text-white transition"
          >
            {copiedMsg ? 'Copied' : 'Copy Msg'}
          </button>
          <button
            onClick={handleCompareWithHead}
            title="Compare with HEAD"
            className="px-2 py-0.5 rounded hover:bg-vscode-hover hover:text-white transition"
          >
            Compare HEAD
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleCheckout}
            title="Checkout this commit"
            className="p-1 rounded hover:bg-vscode-hover hover:text-blue-400 transition"
          >
            <CheckCheck className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleCherryPick}
            title="Cherry-pick this commit"
            className="p-1 rounded hover:bg-vscode-hover hover:text-purple-400 transition"
          >
            <GitPullRequest className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleRevert}
            title="Revert this commit"
            className="p-1 rounded hover:bg-vscode-hover hover:text-rose-400 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => selectCommit(commit.hash)}
            title="Inspect commit details and diff"
            className="px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30 transition flex items-center gap-1 font-medium"
          >
            <span>Inspect</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
