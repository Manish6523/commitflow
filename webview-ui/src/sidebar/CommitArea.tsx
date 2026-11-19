import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ScmAction } from '../types';
import { vscode } from '../vscode';
import { useScmStore } from './scmStore';
import { Icon, Menu, MenuEntry } from './bits';

/** The branch line, message box and Commit button at the top of the sidebar. */
export const CommitArea: React.FC = () => {
  const { scm, message, amend, busy, generating, run, setMessage, generateMessage, startAmend, cancelAmend } = useScmStore();
  const [invalid, setInvalid] = useState(false);
  const [menu, setMenu] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const status = scm?.status;

  // Grow with the message, like Source Control's input.
  useLayoutEffect(() => {
    const box = input.current;
    if (!box) return;
    box.style.height = 'auto';
    box.style.height = `${Math.min(box.scrollHeight + 2, 180)}px`;
  }, [message]);

  useEffect(() => {
    if (message.trim()) setInvalid(false);
  }, [message]);

  if (!status) return null;

  const hasChanges = status.staged.length + status.unstaged.length + status.conflicts.length > 0;
  const branchLabel = status.branch ?? (status.head ? `detached at ${status.head}` : 'no commits yet');

  const commit = async (then?: 'push' | 'sync', forceAmend = amend) => {
    if (!message.trim()) {
      setInvalid(true);
      input.current?.focus();
      return;
    }
    await run({ kind: 'commit', message, amend: forceAmend, then });
  };

  // With nothing to commit, the button offers the next useful step, as VS Code's does.
  let primary: { label: string; icon: string; action: () => void; disabled?: boolean; busyKind: ScmAction['kind'] };
  if (hasChanges || amend || message.trim()) {
    primary = { label: amend ? 'Commit (Amend)' : 'Commit', icon: 'check', action: () => commit(), busyKind: 'commit' };
  } else if (status.branch && !status.upstream && status.hasRemote && status.head) {
    primary = { label: 'Publish Branch', icon: 'cloud-upload', action: () => run({ kind: 'push' }), busyKind: 'push' };
  } else if (status.ahead || status.behind) {
    const counts = `${status.behind ? `${status.behind}↓ ` : ''}${status.ahead ? `${status.ahead}↑` : ''}`.trim();
    primary = { label: `Sync Changes ${counts}`, icon: 'sync', action: () => run({ kind: 'sync' }), busyKind: 'sync' };
  } else {
    primary = { label: 'Commit', icon: 'check', action: () => commit(), disabled: true, busyKind: 'commit' };
  }
  const working = busy === primary.busyKind;

  const menuItems: MenuEntry[] = [
    { label: 'Commit', run: () => commit(undefined, false) },
    { label: 'Commit (Amend)', run: () => (amend ? commit(undefined, true) : startAmend()), disabled: !status.head },
    { label: 'Commit & Push', run: () => commit('push') },
    { label: 'Commit & Sync', run: () => commit('sync') },
    'separator',
    { label: 'Undo Last Commit', run: () => run({ kind: 'undoLastCommit' }), disabled: !status.head },
  ];

  return (
    <div className="scm-top">
      <div className="scm-branchbar">
        {scm!.repositories.length > 1 && (
          <select
            className="scm-select"
            value={scm!.activeRoot ?? ''}
            onChange={(e) => vscode.postMessage({ type: 'SCM_SELECT_REPOSITORY', root: e.target.value })}
            aria-label="Repository"
          >
            {scm!.repositories.map((r) => (
              <option key={r.root} value={r.root}>
                {r.name}
              </option>
            ))}
          </select>
        )}
        <button
          className="scm-chip"
          onClick={() => run({ kind: 'switchBranch' })}
          title={`${branchLabel}. Click to switch branch.`}
          aria-label={`Branch ${branchLabel}. Switch branch`}
        >
          <Icon name={status.branch ? 'git-branch' : 'git-commit'} />
          <span className="scm-truncate">{branchLabel}</span>
        </button>
        <span style={{ flex: 1 }} />
        {status.upstream && (status.ahead > 0 || status.behind > 0) && (
          <button
            className="scm-chip scm-muted"
            onClick={() => run({ kind: 'sync' })}
            title={`${status.behind} to pull, ${status.ahead} to push. Click to sync.`}
            aria-label="Sync changes"
          >
            <Icon name={busy === 'sync' ? 'sync scm-spin' : 'sync'} />
            <span>
              {status.behind}↓ {status.ahead}↑
            </span>
          </button>
        )}
      </div>

      {status.operation && (
        <div className="scm-banner" role="status">
          <Icon name="warning" />
          <span style={{ flex: 1 }}>
            {status.operation === 'rebase'
              ? 'Rebasing. Resolve conflicts and stage them, then run git rebase --continue in a terminal.'
              : `${status.operation === 'merge' ? 'Merging' : status.operation === 'revert' ? 'Reverting' : 'Cherry-picking'}. Resolve conflicts and stage them, then commit.`}
          </span>
          <button className="scm-chip" onClick={() => run({ kind: 'abortOperation' })}>
            Abort
          </button>
        </div>
      )}

      <div className="scm-input-wrap">
        <textarea
          ref={input}
          className={`scm-input${invalid ? ' is-invalid' : ''}`}
          rows={1}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
          placeholder={invalid ? 'Write a commit message first' : `Message (Ctrl+Enter to commit on "${status.branch ?? 'HEAD'}")`}
          aria-label="Commit message"
          aria-invalid={invalid}
          spellCheck
        />
        <button
          className="scm-icon-button scm-input-action"
          onClick={generateMessage}
          disabled={generating || !hasChanges}
          title="Generate commit message"
          aria-label="Generate commit message"
        >
          <Icon name={generating ? 'loading scm-spin' : 'sparkle'} />
        </button>
      </div>

      {amend && (
        <div className="scm-amend scm-muted">
          <Icon name="history" />
          <span style={{ flex: 1 }}>Amending the last commit</span>
          <button className="scm-icon-button" onClick={cancelAmend} title="Stop amending" aria-label="Stop amending">
            <Icon name="close" />
          </button>
        </div>
      )}

      <div className="scm-button-row" style={{ position: 'relative' }}>
        <button
          className="scm-button is-main"
          onClick={primary.action}
          disabled={primary.disabled || busy !== null}
          aria-busy={working}
        >
          <Icon name={working ? 'loading scm-spin' : primary.icon} />
          <span className="scm-truncate">{primary.label}</span>
        </button>
        <button
          className="scm-button is-split"
          onClick={() => setMenu(!menu)}
          disabled={busy !== null}
          title="More commit actions"
          aria-label="More commit actions"
          aria-haspopup="menu"
          aria-expanded={menu}
        >
          <Icon name="chevron-down" />
        </button>
        {menu && <Menu items={menuItems} onClose={() => setMenu(false)} style={{ top: 30, right: 0 }} />}
      </div>
    </div>
  );
};
