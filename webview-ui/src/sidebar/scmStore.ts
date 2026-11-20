import { create } from 'zustand';
import { vscode } from '../vscode';
import { ScmAction, ScmFileGroup, ScmState, WorkingFileChange } from '../types';

// Pulls and pushes wait on the network, and commit hooks can be slow.
const ACTION_TIMEOUT_MS = 10 * 60 * 1000;
const GENERATE_TIMEOUT_MS = 200000;

/** What the sidebar remembers across reloads, kept in the webview's own state. */
interface Saved {
  message: string;
  amend: boolean;
  collapsed: Record<string, boolean>;
  tree: boolean;
}

interface ScmStore extends Saved {
  scm: ScmState | null;
  /** The commit open in the dashboard, highlighted in the graph. */
  openCommit: string | null;
  /** The action in progress, so its button can show it's working. */
  busy: ScmAction['kind'] | null;
  generating: boolean;
  /** Selected rows, as `group:path` keys, plus the row a Shift-click extends from. */
  selection: string[];
  anchor: string | null;

  receive: (state: ScmState) => void;
  run: (action: ScmAction) => Promise<boolean>;
  open: (file: WorkingFileChange, group: ScmFileGroup, mode?: 'diff' | 'file') => void;
  generateMessage: () => Promise<void>;
  setMessage: (message: string) => void;
  startAmend: () => Promise<void>;
  cancelAmend: () => void;
  toggleSection: (id: string) => void;
  setTree: (tree: boolean) => void;
  select: (key: string, event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }, order: string[]) => void;
}

const saved: Partial<Saved> = vscode.getState<Partial<Saved>>() ?? {};

export const fileKey = (group: ScmFileGroup, path: string) => `${group}:${path}`;

export const useScmStore = create<ScmStore>((set, get) => {
  const persist = () => {
    const { message, amend, collapsed, tree } = get();
    vscode.setState({ message, amend, collapsed, tree });
  };

  return {
    scm: null,
    openCommit: null,
    busy: null,
    generating: false,
    selection: [],
    anchor: null,
    message: saved.message ?? '',
    amend: saved.amend ?? false,
    collapsed: saved.collapsed ?? { stashes: true },
    tree: saved.tree ?? false,

    receive: (scm) => {
      // Drop selected rows that no longer exist, such as files just committed.
      const keys = new Set<string>();
      const status = scm.status;
      if (status) {
        status.conflicts.forEach((f) => keys.add(fileKey('conflicts', f.path)));
        status.staged.forEach((f) => keys.add(fileKey('staged', f.path)));
        status.unstaged.forEach((f) => keys.add(fileKey('changes', f.path)));
      }
      set((state) => ({ scm, selection: state.selection.filter((key) => keys.has(key)) }));
    },

    run: async (action) => {
      set({ busy: action.kind });
      try {
        const result = await vscode.request<{ commitMessage?: string }>({ type: 'SCM_ACTION', action }, ACTION_TIMEOUT_MS);
        if (result?.commitMessage !== undefined) {
          set({ message: result.commitMessage, amend: action.kind === 'lastCommitMessage' ? get().amend : false });
          persist();
        }
        return true;
      } catch {
        return false; // The extension already showed what went wrong.
      } finally {
        set({ busy: null });
      }
    },

    open: (file, group, mode = 'diff') => {
      vscode.postMessage({ type: 'SCM_OPEN', file, group, mode });
    },

    generateMessage: async () => {
      if (get().generating) return;
      set({ generating: true });
      try {
        const result = await vscode.request<{ message: string }>({ type: 'SCM_GENERATE_MESSAGE' }, GENERATE_TIMEOUT_MS);
        set({ message: result.message });
        persist();
      } catch {
        // Shown by the extension.
      } finally {
        set({ generating: false });
      }
    },

    setMessage: (message) => {
      set({ message });
      persist();
    },

    startAmend: async () => {
      set({ amend: true });
      if (!get().message.trim()) await get().run({ kind: 'lastCommitMessage' });
      persist();
    },

    cancelAmend: () => {
      set({ amend: false });
      persist();
    },

    toggleSection: (id) => {
      set((state) => ({ collapsed: { ...state.collapsed, [id]: !state.collapsed[id] } }));
      persist();
    },

    setTree: (tree) => {
      set({ tree });
      persist();
    },

    select: (key, event, order) => {
      const { selection, anchor } = get();
      if (event.shiftKey && anchor && order.includes(anchor)) {
        const [from, to] = [order.indexOf(anchor), order.indexOf(key)].sort((a, b) => a - b);
        set({ selection: order.slice(from, to + 1) });
      } else if (event.ctrlKey || event.metaKey) {
        set({
          selection: selection.includes(key) ? selection.filter((k) => k !== key) : [...selection, key],
          anchor: key,
        });
      } else {
        set({ selection: [key], anchor: key });
      }
    },
  };
});

// The extension pushes fresh state whenever the repository changes.
window.addEventListener('message', (event) => {
  if (event.data?.type === 'SCM_STATE') useScmStore.getState().receive(event.data.state);
  if (event.data?.type === 'SCM_OPEN_COMMIT') useScmStore.setState({ openCommit: event.data.hash });
});
