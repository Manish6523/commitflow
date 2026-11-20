import React, { useEffect } from 'react';
import '@vscode/codicons/dist/codicon.css';
import './sidebar.css';
import { vscode } from '../vscode';
import { useScmStore } from './scmStore';
import { CommitArea } from './CommitArea';
import { FileSections } from './FileSections';
import { GraphPane, StashPane } from './Panes';
import { Icon } from './bits';

/** The CommitFlow activity bar view: Source Control plus a commit graph. */
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

  return (
    <div className="scm">
      <CommitArea />
      <div className="scm-body">
        <FileSections status={scm.status} />
        <StashPane stashes={scm.stashes} />
        <GraphPane commits={scm.commits} hasMore={scm.commitsHasMore} starred={scm.starred} />
      </div>
    </div>
  );
};
