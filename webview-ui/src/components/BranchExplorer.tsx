import React, { useState } from 'react';
import { useCommitStore } from '../stores/useCommitStore';
import {
  GitBranch,
  Tag as TagIcon,
  ArrowUp,
  ArrowDown,
  Check,
  Trash2,
  Plus,
  ExternalLink,
} from 'lucide-react';

export const BranchExplorer: React.FC = () => {
  const {
    branches,
    tags,
    executeGitOp,
    loadBranchesAndTags,
    selectCommit,
  } = useCommitStore();

  const [tab, setTab] = useState<'local' | 'remote' | 'tags'>('local');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [showTagModal, setShowTagModal] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagMessage, setNewTagMessage] = useState('');

  const localBranches = branches.filter((b) => !b.isRemote);
  const remoteBranches = branches.filter((b) => b.isRemote);

  const handleCheckout = (target: string) => {
    if (window.confirm(`Checkout '${target}'?`)) {
      executeGitOp('checkout', { target });
    }
  };

  const handleDeleteBranch = (name: string) => {
    if (window.confirm(`Are you sure you want to delete branch '${name}'?`)) {
      executeGitOp('delete-branch', { name, force: false });
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    await executeGitOp('create-branch', { name: newBranchName.trim(), startPoint: 'HEAD' });
    setNewBranchName('');
    setShowCreateModal(false);
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    await executeGitOp('create-tag', {
      name: newTagName.trim(),
      targetHash: 'HEAD',
      message: newTagMessage.trim() || undefined,
    });
    setNewTagName('');
    setNewTagMessage('');
    setShowTagModal(false);
    loadBranchesAndTags();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-vscode-bg p-4 max-w-5xl mx-auto w-full">
      {/* Top Header & Tabs */}
      <div className="flex items-center justify-between pb-3 border-b border-vscode-border flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="flex bg-vscode-sidebar border border-vscode-border rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setTab('local')}
              className={`px-3 py-1 rounded-md font-medium transition ${
                tab === 'local' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Local Branches ({localBranches.length})
            </button>
            <button
              onClick={() => setTab('remote')}
              className={`px-3 py-1 rounded-md font-medium transition ${
                tab === 'remote' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Remote Branches ({remoteBranches.length})
            </button>
            <button
              onClick={() => setTab('tags')}
              className={`px-3 py-1 rounded-md font-medium transition ${
                tab === 'tags' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Tags ({tags.length})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {tab !== 'tags' ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md shadow transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Branch</span>
            </button>
          ) : (
            <button
              onClick={() => setShowTagModal(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded-md shadow transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Tag</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto py-3 space-y-2">
        {/* Local Branches Tab */}
        {tab === 'local' && (
          <div className="space-y-2">
            {localBranches.map((br) => (
              <div
                key={br.name}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                  br.isCurrent
                    ? 'bg-blue-900/15 border-blue-500/50'
                    : 'bg-vscode-sidebar/50 border-vscode-border hover:bg-vscode-sidebar'
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div
                    className={`p-2 rounded-lg ${
                      br.isCurrent ? 'bg-blue-500 text-white' : 'bg-vscode-input text-gray-400'
                    }`}
                  >
                    <GitBranch className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-gray-100 font-mono">
                        {br.name}
                      </span>
                      {br.isCurrent && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-400 font-medium border border-blue-500/30">
                          Current HEAD
                        </span>
                      )}
                      {br.upstream && (
                        <span className="text-[11px] text-gray-400 font-mono">
                          tracks <span className="text-gray-300">{br.upstream}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5 truncate">
                      <span className="font-mono text-blue-400">{br.lastCommitHash}</span>
                      <span className="truncate">{br.lastCommitSubject}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Ahead/behind counters */}
                  {br.upstream && (
                    <div className="flex items-center gap-2 text-xs font-mono">
                      {br.ahead > 0 && (
                        <span
                          className="flex items-center text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20"
                          title={`${br.ahead} commits ahead of upstream`}
                        >
                          <ArrowUp className="w-3 h-3 mr-0.5" />
                          {br.ahead}
                        </span>
                      )}
                      {br.behind > 0 && (
                        <span
                          className="flex items-center text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20"
                          title={`${br.behind} commits behind upstream`}
                        >
                          <ArrowDown className="w-3 h-3 mr-0.5" />
                          {br.behind}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  {!br.isCurrent && (
                    <button
                      onClick={() => handleCheckout(br.name)}
                      className="px-2.5 py-1 rounded bg-vscode-input hover:bg-blue-600 hover:text-white border border-vscode-border text-xs font-medium text-gray-300 transition flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Checkout</span>
                    </button>
                  )}

                  {!br.isCurrent && (
                    <button
                      onClick={() => handleDeleteBranch(br.name)}
                      className="p-1.5 rounded hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 transition"
                      title="Delete Branch"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Remote Branches Tab */}
        {tab === 'remote' && (
          <div className="space-y-2">
            {remoteBranches.map((br) => (
              <div
                key={br.name}
                className="p-3 rounded-xl border border-vscode-border bg-vscode-sidebar/50 hover:bg-vscode-sidebar flex items-center justify-between gap-3 transition"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2 rounded-lg bg-vscode-input text-gray-400">
                    <GitBranch className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="font-semibold text-xs text-gray-200 font-mono">
                      {br.name}
                    </span>
                    <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5 truncate">
                      <span className="font-mono text-blue-400">{br.lastCommitHash}</span>
                      <span className="truncate">{br.lastCommitSubject}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleCheckout(br.name)}
                  className="px-2.5 py-1 rounded bg-vscode-input hover:bg-blue-600 hover:text-white border border-vscode-border text-xs font-medium text-gray-300 transition flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Checkout</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Tags Tab */}
        {tab === 'tags' && (
          <div className="space-y-2">
            {tags.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">
                No tags found in this repository.
              </div>
            ) : (
              tags.map((tag) => (
                <div
                  key={tag.name}
                  className="p-3 rounded-xl border border-vscode-border bg-vscode-sidebar/50 hover:bg-vscode-sidebar flex items-center justify-between gap-3 transition"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <TagIcon className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-amber-300 font-mono">
                          {tag.name}
                        </span>
                        {tag.isAnnotated && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Annotated
                          </span>
                        )}
                      </div>
                      {tag.message && (
                        <p className="text-xs text-gray-300 mt-0.5">{tag.message}</p>
                      )}
                      <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                        <span className="font-mono text-blue-400">
                          {tag.targetHash.substring(0, 7)}
                        </span>
                        {tag.taggerDate && (
                          <span>· {new Date(tag.taggerDate).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => selectCommit(tag.targetHash)}
                    className="p-1.5 rounded hover:bg-blue-600/20 text-gray-400 hover:text-blue-400 transition"
                    title="View Tagged Commit"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Create Branch Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-vscode-sidebar border border-vscode-border rounded-xl p-4 max-w-sm w-full shadow-2xl flex flex-col gap-3">
            <h3 className="font-semibold text-sm text-gray-100 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-blue-400" />
              Create New Branch
            </h3>
            <p className="text-xs text-gray-400">
              Create a new branch from current HEAD.
            </p>
            <input
              type="text"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              placeholder="e.g. feature/auth-flow"
              className="bg-vscode-input text-vscode-fg border border-vscode-inputBorder rounded px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1 text-xs text-gray-400 hover:text-white rounded hover:bg-vscode-hover"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBranch}
                disabled={!newBranchName.trim()}
                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded font-medium disabled:opacity-50"
              >
                Create Branch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Tag Modal */}
      {showTagModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-vscode-sidebar border border-vscode-border rounded-xl p-4 max-w-sm w-full shadow-2xl flex flex-col gap-3">
            <h3 className="font-semibold text-sm text-gray-100 flex items-center gap-2">
              <TagIcon className="w-4 h-4 text-amber-400" />
              Create Tag
            </h3>
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Tag name (e.g. v1.0.0)"
              className="bg-vscode-input text-vscode-fg border border-vscode-inputBorder rounded px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <textarea
              value={newTagMessage}
              onChange={(e) => setNewTagMessage(e.target.value)}
              placeholder="Optional tag message (leave blank for lightweight tag)"
              rows={2}
              className="bg-vscode-input text-vscode-fg border border-vscode-inputBorder rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowTagModal(false)}
                className="px-3 py-1 text-xs text-gray-400 hover:text-white rounded hover:bg-vscode-hover"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTag}
                disabled={!newTagName.trim()}
                className="px-3 py-1 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded font-medium disabled:opacity-50"
              >
                Create Tag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
