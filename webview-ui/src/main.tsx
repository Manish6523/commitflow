import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// The activity bar view and the dashboard share one bundle; the extension marks which is which.
const isSidebar = document.body.dataset.view === 'sidebar';
const root = ReactDOM.createRoot(document.getElementById('root')!);

if (isSidebar) {
  import('./sidebar/SidebarApp').then(({ SidebarApp }) =>
    root.render(
      <React.StrictMode>
        <SidebarApp />
      </React.StrictMode>
    )
  );
} else {
  import('./App').then(({ App }) =>
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    )
  );
}
