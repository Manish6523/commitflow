import { WorkingFileChange } from '../types';

export interface FolderNode {
  kind: 'folder';
  /** The folder's label, which may join several folders, like "src/git". */
  name: string;
  path: string;
  children: TreeNode[];
  /** Every file inside, at any depth. */
  files: WorkingFileChange[];
}

export interface FileNode {
  kind: 'file';
  file: WorkingFileChange;
}

export type TreeNode = FolderNode | FileNode;

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

export function fileName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

export function folderOf(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash === -1 ? '' : path.slice(0, slash);
}

/** Files in path order, the way Source Control lists them. */
export function sortByPath(files: WorkingFileChange[]): WorkingFileChange[] {
  return [...files].sort((a, b) => byName(a.path, b.path));
}

/**
 * Group files by folder, folders first. A folder holding only one other folder
 * is shown with it, as "src/git", like VS Code's compact folders.
 */
export function buildTree(files: WorkingFileChange[]): TreeNode[] {
  const root: FolderNode = { kind: 'folder', name: '', path: '', children: [], files: [] };

  for (const file of files) {
    const parts = file.path.split('/');
    let folder = root;
    folder.files.push(file);
    for (let i = 0; i < parts.length - 1; i++) {
      const path = parts.slice(0, i + 1).join('/');
      let next = folder.children.find((c): c is FolderNode => c.kind === 'folder' && c.path === path);
      if (!next) {
        next = { kind: 'folder', name: parts[i], path, children: [], files: [] };
        folder.children.push(next);
      }
      next.files.push(file);
      folder = next;
    }
    folder.children.push({ kind: 'file', file });
  }

  const finish = (nodes: TreeNode[]): TreeNode[] =>
    nodes
      .map((node) => {
        if (node.kind === 'file') return node;
        let folder = node;
        while (folder.children.length === 1 && folder.children[0].kind === 'folder') {
          const only = folder.children[0];
          folder = { ...only, name: `${folder.name}/${only.name}` };
        }
        return { ...folder, children: finish(folder.children) };
      })
      .sort((a, b) =>
        a.kind !== b.kind
          ? a.kind === 'folder'
            ? -1
            : 1
          : byName(a.kind === 'folder' ? a.name : fileName(a.file.path), b.kind === 'folder' ? b.name : fileName(b.file.path))
      );

  return finish(root.children);
}
