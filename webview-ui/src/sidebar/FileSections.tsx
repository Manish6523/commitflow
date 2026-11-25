import React, { useMemo, useState } from 'react';
import { ScmFileGroup, WorkingFileChange, WorkingTreeStatus } from '../types';
import { fileKey, useScmStore } from './scmStore';
import { FolderNode, TreeNode, buildTree, fileName, folderOf, sortByPath } from './changeTree';
import { FileTypeIcon, Icon, IconButton, SectionHeader } from './bits';

type Row =
  | { kind: 'file'; key: string; group: ScmFileGroup; file: WorkingFileChange; depth: number }
  | { kind: 'folder'; key: string; group: ScmFileGroup; folder: FolderNode; depth: number; open: boolean };

const GROUPS: { group: ScmFileGroup; title: string; pick: (s: WorkingTreeStatus) => WorkingFileChange[] }[] = [
  { group: 'conflicts', title: 'Merge Changes', pick: (s) => s.conflicts },
  { group: 'staged', title: 'Staged Changes', pick: (s) => s.staged },
  { group: 'changes', title: 'Changes', pick: (s) => s.unstaged },
];

const LETTER_TITLES: Record<string, string> = {
  M: 'Modified',
  A: 'Added',
  D: 'Deleted',
  R: 'Renamed',
  C: 'Copied',
  U: 'Untracked',
  '!': 'Conflict',
};

const decor = (status: string) => `var(--decor-${status === '!' ? 'conflict' : status})`;

/** Staged, unstaged and conflicting files, grouped like Source Control. */
export const FileSections: React.FC<{ status: WorkingTreeStatus }> = ({ status }) => {
  const { tree, collapsed, selection, toggleSection, setTree, select, open, run } = useScmStore();
  const [closedFolders, setClosedFolders] = useState<Set<string>>(new Set());

  const groups = useMemo(
    () =>
      GROUPS.map(({ group, title, pick }) => {
        const files = pick(status);
        const rows: Row[] = [];
        if (!collapsed[group]) {
          if (tree) {
            const walk = (nodes: TreeNode[], depth: number) => {
              for (const node of nodes) {
                if (node.kind === 'file') {
                  rows.push({ kind: 'file', key: fileKey(group, node.file.path), group, file: node.file, depth });
                } else {
                  const key = `${group}/${node.path}`;
                  const isOpen = !closedFolders.has(key);
                  rows.push({ kind: 'folder', key, group, folder: node, depth, open: isOpen });
                  if (isOpen) walk(node.children, depth + 1);
                }
              }
            };
            walk(buildTree(files), 0);
          } else {
            for (const file of sortByPath(files)) {
              rows.push({ kind: 'file', key: fileKey(group, file.path), group, file, depth: 0 });
            }
          }
        }
        return { group, title, files, rows };
      }),
    [status, tree, collapsed, closedFolders]
  );

  // Shift-click selects across the rows as they appear.
  const order = groups.flatMap((g) => g.rows.filter((r) => r.kind === 'file').map((r) => r.key));
  const selected = new Set(selection);

  /** The files an action on this row applies to: the whole selection if the row is part of it. */
  const targets = (group: ScmFileGroup, file: WorkingFileChange): WorkingFileChange[] => {
    const key = fileKey(group, file.path);
    if (!selected.has(key) || selection.length < 2) return [file];
    const files = groups.find((g) => g.group === group)!.files;
    return files.filter((f) => selected.has(fileKey(group, f.path)));
  };

  const stage = (files: WorkingFileChange[]) => run({ kind: 'stage', paths: files.map((f) => f.path) });
  const unstage = (files: WorkingFileChange[]) => run({ kind: 'unstage', paths: files.map((f) => f.path) });
  const discard = (files: WorkingFileChange[]) => run({ kind: 'discard', changes: files });

  const fileActions = (group: ScmFileGroup, files: WorkingFileChange[], single?: WorkingFileChange) => (
    <>
      {single && (
        <IconButton icon="go-to-file" label="Open File" onClick={() => open(single, group, 'file')} />
      )}
      {group === 'changes' && <IconButton icon="discard" label="Discard Changes" onClick={() => discard(files)} />}
      {group === 'staged' ? (
        <IconButton icon="remove" label="Unstage Changes" onClick={() => unstage(files)} />
      ) : (
        <IconButton icon="add" label={group === 'conflicts' ? 'Mark as Resolved' : 'Stage Changes'} onClick={() => stage(files)} />
      )}
    </>
  );

  const visible = groups.filter((g) => g.files.length > 0 || g.group === 'changes');

  return (
    <div role="tree" aria-label="Changes" aria-multiselectable="true">
      {visible.map(({ group, title, files, rows }) => (
        <div key={group} role="group">
          <SectionHeader title={title} count={files.length} open={!collapsed[group]} onToggle={() => toggleSection(group)}>
            {group === 'changes' && (
              <IconButton
                icon={tree ? 'list-flat' : 'list-tree'}
                label={tree ? 'View as List' : 'View as Tree'}
                onClick={() => setTree(!tree)}
              />
            )}
            {files.length > 0 && group === 'changes' && (
              <IconButton icon="discard" label="Discard All Changes" onClick={() => run({ kind: 'discardAll' })} />
            )}
            {files.length > 0 && group === 'staged' && (
              <IconButton icon="remove" label="Unstage All Changes" onClick={() => run({ kind: 'unstageAll' })} />
            )}
            {files.length > 0 && group === 'changes' && (
              <IconButton icon="add" label="Stage All Changes" onClick={() => run({ kind: 'stageAll' })} />
            )}
            {files.length > 0 && group === 'conflicts' && (
              <IconButton icon="add" label="Stage All Merge Changes" onClick={() => stage(files)} />
            )}
          </SectionHeader>

          {!collapsed[group] && files.length === 0 && <div className="scm-empty">No changes</div>}

          {rows.map((row) =>
            row.kind === 'folder' ? (
              <div
                key={row.key}
                className="scm-row"
                role="treeitem"
                aria-expanded={row.open}
                tabIndex={0}
                style={{ paddingLeft: 20 + row.depth * 16 }}
                title={row.folder.path}
                onClick={() =>
                  setClosedFolders((prev) => {
                    const next = new Set(prev);
                    if (next.has(row.key)) next.delete(row.key);
                    else next.add(row.key);
                    return next;
                  })
                }
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && e.key === 'Enter') (e.currentTarget as HTMLElement).click();
                }}
              >
                <Icon name={row.open ? 'chevron-down' : 'chevron-right'} style={{ marginLeft: -20 }} />
                <Icon name={row.open ? 'folder-opened' : 'folder'} />
                <span className="scm-name scm-truncate" style={{ flex: 1 }}>
                  {row.folder.name}
                </span>
                <span className="scm-actions">{fileActions(group, row.folder.files)}</span>
              </div>
            ) : (
              <FileRow
                key={row.key}
                row={row}
                showDir={!tree}
                selected={selected.has(row.key)}
                contextFiles={targets(group, row.file)}
                onSelect={(e) => select(row.key, e, order)}
                onOpen={() => open(row.file, group, group === 'conflicts' ? 'file' : 'diff')}
                onToggleStage={() => (group === 'staged' ? unstage : stage)(targets(group, row.file))}
                actions={fileActions(group, targets(group, row.file), row.file)}
              />
            )
          )}
        </div>
      ))}
    </div>
  );
};

const FileRow: React.FC<{
  row: Extract<Row, { kind: 'file' }>;
  showDir: boolean;
  selected: boolean;
  contextFiles: WorkingFileChange[];
  onSelect: (e: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => void;
  onOpen: () => void;
  onToggleStage: () => void;
  actions: React.ReactNode;
}> = ({ row, showDir, selected, contextFiles, onSelect, onOpen, onToggleStage, actions }) => {
  const { file, group } = row;
  const dir = folderOf(file.path);
  const color = decor(file.status);
  // Read by VS Code to build the native right-click menu for this row.
  const context = JSON.stringify({
    webviewSection: `file-${group}`,
    group,
    files: contextFiles,
    preventDefaultContextMenuItems: true,
  });

  return (
    <div
      className={`scm-row${selected ? ' is-selected' : ''}${file.status === 'D' ? ' is-deleted' : ''}`}
      role="treeitem"
      aria-selected={selected}
      tabIndex={0}
      data-vscode-context={context}
      style={{ paddingLeft: (showDir ? 20 : 36) + row.depth * 16 }}
      title={`${file.oldPath ? `${file.oldPath} → ` : ''}${file.path} • ${LETTER_TITLES[file.status] ?? file.status}`}
      onClick={(e) => {
        onSelect(e);
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) onOpen();
      }}
      onContextMenu={(e) => {
        if (!selected) onSelect({ ctrlKey: false, metaKey: false, shiftKey: false });
        e.currentTarget.focus();
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          onOpen();
        } else if (e.key === ' ') {
          e.preventDefault();
          onToggleStage();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const rows = [...document.querySelectorAll<HTMLElement>('.scm-body [role="treeitem"]')];
          rows[rows.indexOf(e.currentTarget) + (e.key === 'ArrowDown' ? 1 : -1)]?.focus();
        }
      }}
    >
      <FileTypeIcon path={file.path} />
      <span className="scm-name scm-truncate" style={{ color, flexShrink: 0, maxWidth: showDir ? '70%' : undefined, flex: showDir ? undefined : 1 }}>
        {fileName(file.path)}
      </span>
      {showDir && <span className="scm-dir scm-truncate">{dir}</span>}
      <span className="scm-actions">{actions}</span>
      <span className="scm-letter" style={{ color }} aria-label={LETTER_TITLES[file.status]}>
        {file.status}
      </span>
    </div>
  );
};
