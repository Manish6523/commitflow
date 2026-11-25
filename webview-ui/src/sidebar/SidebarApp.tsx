import React, { useEffect } from 'react';
import '@vscode/codicons/dist/codicon.css';
import './sidebar.css';
import { vscode } from '../vscode';
import { useScmStore } from './scmStore';
import { CommitArea } from './CommitArea';
import { FileSections } from './FileSections';
import { GraphPane, StashPane } from './Panes';
import { Icon } from './bits';

// Changes and Graph are two views in VS Code, each running this app for its own part.
const isGraph = document.body.dataset.pane === 'graph';

/** A CommitFlow activity bar view: Changes, or the commit graph below it. */
export const SidebarApp: React.FC = () => {
  const scm = useScmStore((s) => s.scm);

  useEffect(() => {
    vscode.postMessage({ type: 'WEBVIEW_READY' });
  }, []);

  if (!scm) {
    return (
      <div className="scm">
        <div className="scm-center">
          <Icon name="loading scm-spin" />
        </div>
      </div>
    );
  }

  if (!scm.activeRoot || !scm.status) {
    return (
      <div className="scm">
        <div className="scm-center">
          <Icon name="source-control" style={{ fontSize: 32 }} />
          <span>The folder open in this window has no Git repository.</span>
        </div>
      </div>
    );
  }

  if (isGraph) {
    return (
      <div className="scm">
        <div className="scm-body" role="tree" aria-label="Commit graph">
          <GraphPane commits={scm.commits} hasMore={scm.commitsHasMore} starred={scm.starred} head={scm.status.head} />
        </div>
      </div>
    );
  }

  return (
    <div className="scm">
      <CommitArea />
      <div className="scm-body">
        <FileSections status={scm.status} />
        <StashPane stashes={scm.stashes} />
      </div>
    </div>
  );
};
