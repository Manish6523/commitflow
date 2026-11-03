import React from 'react';
import { GitCommit } from '../types';
import { useCommitStore } from '../stores/useCommitStore';
import {
  Copy,
  GitMerge,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { vscode } from '../vscode';

interface CommitListViewProps {
  commits: GitCommit[];
}

export const CommitListView: React.FC<CommitListViewProps> = ({ commits }) => {
  const { selectCommit } = useCommitStore();

  const copySha = (sha: string, e: React.MouseEvent) => {
    e.stopPropagation();
    vscode.postMessage({ type: 'COPY_TO_CLIPBOARD', text: sha });
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-vscode-border bg-vscode-sidebar/80 text-gray-400 font-mono text-[11px]">
            <th className="py-2 px-3 w-24">SHA</th>
            <th className="py-2 px-3">Subject</th>
            <th className="py-2 px-3 w-40">Author</th>
            <th className="py-2 px-3 w-32">Date</th>
            <th className="py-2 px-3 w-28 text-right">Changes</th>
            <th className="py-2 px-3 w-20 text-center">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-vscode-border/50 font-mono">
          {commits.map((commit) => (
            <tr
              key={commit.hash}
              onClick={() => selectCommit(commit.hash)}
              className="hover:bg-vscode-hover transition cursor-pointer group"
            >
              <td className="py-2 px-3 font-mono text-blue-400">
                <div className="flex items-center gap-1.5">
                  <span>{commit.shortHash}</span>
                  <button
                    onClick={(e) => copySha(commit.hash, e)}
                    className="opacity-0 group-hover:opacity-100 hover:text-white transition p-0.5"
                    title="Copy SHA"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  {commit.isMerge && (
                    <span title="Merge commit">
                      <GitMerge className="w-3 h-3 text-purple-400" />
                    </span>
                  )}
                  {commit.signatureStatus === 'G' && (
                    <span title="Signed commit">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    </span>
                  )}
                </div>
              </td>
              <td className="py-2 px-3 font-sans text-gray-200">
                <div className="flex items-center gap-2">
                  <span className="line-clamp-1 font-medium">{commit.subject}</span>
                  {commit.branches.slice(0, 1).map((b) => (
                    <span
                      key={b}
                      className="px-1.5 py-0.2 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono shrink-0"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </td>
              <td className="py-2 px-3 text-gray-300 font-sans truncate">{commit.author.name}</td>
              <td className="py-2 px-3 text-gray-400 text-[11px]">
                {new Date(commit.author.timestamp).toLocaleDateString()}
              </td>
              <td className="py-2 px-3 text-right">
                <div className="flex items-center justify-end gap-1.5 text-[11px]">
                  <span className="text-emerald-400 font-medium">+{commit.insertions}</span>
                  <span className="text-rose-400 font-medium">-{commit.deletions}</span>
                </div>
              </td>
              <td className="py-2 px-3 text-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    selectCommit(commit.hash);
                  }}
                  className="p-1 rounded hover:bg-blue-600/20 text-gray-400 hover:text-blue-400 transition"
                  title="Inspect Commit"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
