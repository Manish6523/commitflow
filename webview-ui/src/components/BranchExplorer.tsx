import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ExternalLink,
  GitBranch,
  Plus,
  Search,
  Tag as TagIcon,
  Trash2,
} from 'lucide-react';
import { useCommitStore } from '../stores/useCommitStore';
import { Branch } from '../types';
import { Dialog, DialogButtons } from './ui/Dialog';
import { EmptyState } from './ui/EmptyState';
import { ghostButton, textInput, underlineTab } from './ui/styles';

const rowClass =
  'group relative flex items-center gap-2.5 px-3 py-1.5 hover:bg-vscode-hover transition-colors duration-100';

const hoverActions =
  'flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-100';

const BranchRow: React.FC<{ branch: Branch }> = ({ branch }) => {
  const { executeGitOp, requestConfirm } = useCommitStore();

  const checkout = () =>
    requestConfirm({
      title: `Checkout ${branch.name}?`,
      detail: 'Make sure your work is saved first.',
      label: 'Checkout',
      onConfirm: () => executeGitOp('checkout', { target: branch.name }),
    });

  const remove = () =>
    requestConfirm({
      title: `Delete ${branch.name}?`,
      detail: 'Git will refuse if the branch has unmerged commits.',
      label: 'Delete Branch',
      danger: true,
      onConfirm: () => executeGitOp('delete-branch', { name: branch.name, force: false }),
    });

  return (
    <div className={rowClass}>
      <GitBranch className={`w-3.5 h-3.5 shrink-0 ${branch.isCurrent ? 'text-blue-500' : 'text-gray-500'}`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-mono font-medium text-gray-100 truncate">{branch.name}</span>
          {branch.isCurrent && (
            <span className="px-1 rounded text-[10px] bg-blue-500/15 text-blue-500 shrink-0">current</span>
          )}
          {branch.upstream && (
            <span className="text-[11px] text-gray-400 truncate">→ {branch.upstream}</span>
          )}
        </div>
        <div className="text-[11px] text-gray-400 truncate mt-0.5">
          <span className="font-mono">{branch.lastCommitHash}</span> · {branch.lastCommitSubject}
        </div>
      </div>

      {branch.upstream && (branch.ahead > 0 || branch.behind > 0) && (
        <span className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums shrink-0">
          {branch.ahead > 0 && (
            <span className="flex items-center text-emerald-500" title={`${branch.ahead} ahead of upstream`}>
              <ArrowUp className="w-3 h-3" />
              {branch.ahead}
            </span>
          )}
          {branch.behind > 0 && (
            <span className="flex items-center text-amber-500" title={`${branch.behind} behind upstream`}>
              <ArrowDown className="w-3 h-3" />
              {branch.behind}
            </span>
          )}
        </span>
      )}

      {!branch.isCurrent && (
        <div className={hoverActions}>
          <button onClick={checkout} className={ghostButton}>
            <Check className="w-3 h-3" />
            Checkout
          </button>
          {!branch.isRemote && (
            <button
              onClick={remove}
              className="p-1.5 rounded-md text-gray-300 hover:text-rose-500 hover:bg-vscode-hover transition-colors"
              title="Delete branch"
              aria-label={`Delete branch ${branch.name}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const BranchExplorer: React.FC = () => {
  const { branches, tags, executeGitOp, loadBranchesAndTags, selectCommit } = useCommitStore();

  const [tab, setTab] = useState<'local' | 'remote' | 'tags'>('local');
  const [filter, setFilter] = useState('');
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTagMessage, setNewTagMessage] = useState('');

  const query = filter.trim().toLowerCase();
  const localBranches = useMemo(() => branches.filter((b) => !b.isRemote), [branches]);
  const remoteBranches = useMemo(() => branches.filter((b) => b.isRemote), [branches]);
  const visibleBranches = (tab === 'local' ? localBranches : remoteBranches).filter((b) =>
    b.name.toLowerCase().includes(query)
  );
  const visibleTags = tags.filter((t) => t.name.toLowerCase().includes(query));

  const closeDialogs = () => {
    setShowBranchDialog(false);
    setShowTagDialog(false);
    setNewName('');
    setNewTagMessage('');
  };

  const createBranch = async () => {
    if (!newName.trim()) return;
    await executeGitOp('create-branch', { name: newName.trim(), startPoint: 'HEAD' });
    closeDialogs();
  };

  const createTag = async () => {
    if (!newName.trim()) return;
    await executeGitOp('create-tag', {
      name: newName.trim(),
      targetHash: 'HEAD',
      message: newTagMessage.trim() || undefined,
    });
    closeDialogs();
    loadBranchesAndTags();
  };

  const tabs = [
    { id: 'local' as const, label: `Local (${localBranches.length})` },
    { id: 'remote' as const, label: `Remote (${remoteBranches.length})` },
    { id: 'tags' as const, label: `Tags (${tags.length})` },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 pl-1 pr-3 border-b border-vscode-border bg-vscode-sidebar/60 shrink-0 flex-wrap">
        <div className="flex items-center" role="tablist">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={underlineTab(tab === id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[140px] max-w-xs ml-auto">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={tab === 'tags' ? 'Filter tags' : 'Filter branches'}
            aria-label="Filter"
            className={`${textInput} pl-6`}
          />
        </div>
        <button
          onClick={() => (tab === 'tags' ? setShowTagDialog(true) : setShowBranchDialog(true))}
          className={ghostButton}
        >
          <Plus className="w-3.5 h-3.5" />
          {tab === 'tags' ? 'New Tag' : 'New Branch'}
        </button>
      </div>

      <div key={tab} className="flex-1 overflow-y-auto py-1 animate-in fade-in duration-150">
        {tab !== 'tags' &&
          (visibleBranches.length > 0 ? (
            visibleBranches.map((branch) => <BranchRow key={branch.name} branch={branch} />)
          ) : (
            <EmptyState
              icon={<GitBranch className="w-7 h-7" />}
              title={query ? 'No matching branches' : `No ${tab} branches`}
            />
          ))}

        {tab === 'tags' &&
          (visibleTags.length > 0 ? (
            visibleTags.map((tag) => (
              <div
                key={tag.name}
                onClick={() => selectCommit(tag.targetHash)}
                className={`${rowClass} cursor-pointer`}
              >
                <TagIcon className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-mono font-medium text-gray-100 truncate">{tag.name}</span>
                    {tag.isAnnotated && (
                      <span className="px-1 rounded text-[10px] bg-amber-500/15 text-amber-500 shrink-0">
                        annotated
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-400 truncate mt-0.5">
                    <span className="font-mono">{tag.targetHash.substring(0, 7)}</span>
                    {tag.taggerDate && <> · {new Date(tag.taggerDate).toLocaleDateString()}</>}
                    {tag.message && <> · {tag.message}</>}
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 shrink-0 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))
          ) : (
            <EmptyState
              icon={<TagIcon className="w-7 h-7" />}
              title={query ? 'No matching tags' : 'No tags yet'}
            />
          ))}
      </div>

      {showBranchDialog && (
        <Dialog
          title="New branch"
          icon={<GitBranch className="w-4 h-4 text-blue-500" />}
          onClose={closeDialogs}
        >
          <p className="text-xs text-gray-400">Creates a branch from the current HEAD and switches to it.</p>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createBranch()}
            placeholder="feature/auth-flow"
            aria-label="Branch name"
            className={`${textInput} font-mono`}
            autoFocus
          />
          <DialogButtons
            onCancel={closeDialogs}
            onConfirm={createBranch}
            label="Create Branch"
            disabled={!newName.trim()}
          />
        </Dialog>
      )}

      {showTagDialog && (
        <Dialog
          title="New tag"
          icon={<TagIcon className="w-4 h-4 text-amber-500" />}
          onClose={closeDialogs}
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="v1.0.0"
            aria-label="Tag name"
            className={`${textInput} font-mono`}
            autoFocus
          />
          <textarea
            value={newTagMessage}
            onChange={(e) => setNewTagMessage(e.target.value)}
            placeholder="Optional message (leave blank for a lightweight tag)"
            aria-label="Tag message"
            rows={2}
            className={`${textInput} resize-none`}
          />
          <DialogButtons
            onCancel={closeDialogs}
            onConfirm={createTag}
            label="Create Tag"
            disabled={!newName.trim()}
          />
        </Dialog>
      )}
    </div>
  );
};
