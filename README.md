# CommitFlow — Visual Git Commit Explorer & Repository Management

> **"Your entire Git history. Organized, searchable, visual, and actionable."**

**CommitFlow** transforms the traditional Git commit history into a modern, interactive, card-based workspace embedded natively inside Visual Studio Code.

Explore your entire repository history, search commits with GitHub-style operators, inspect file diffs, compare arbitrary revisions, visualize DAG branch swimlanes, understand team velocity, and perform common Git operations without switching between the terminal and external GUI tools.

---

## 🌟 Key Features

### 1. Card-First Commit Discovery & View Modes
- **Grid View (Card-First)**: Modern, responsive commit cards featuring author avatars with initials, relative and exact timestamps, branch/tag badges, commit subject/body snippets, lines added (`+`) and deleted (`-`), verified cryptographic signatures, and merge indicators.
- **List View**: Dense tabular view optimized for scanning extensive histories with sortable columns and rapid SHA/message copying.
- **Timeline View**: Chronologically grouped commits (*Today*, *Yesterday*, *This Month*, *Previous Months*) with expandable sections and visual vertical connectors.
- **Graph View**: Interactive SVG Git DAG visualization with real parent-child relationship swimlanes, merge nodes, branch heads, and zoom/pan controls.

### 2. Powerful Search & Operator Engine
Case-insensitive structured search that operates completely locally without requiring external services or cloud APIs:
- `author:<name>` — Filter by commit author (e.g., `author:manish`)
- `message:<query>` — Search commit subject and body (e.g., `message:authentication`)
- `after:<YYYY-MM-DD>` / `since:` — Commits created after a date
- `before:<YYYY-MM-DD>` / `until:` — Commits created before a date
- `file:<path>` — Commits modifying a specific file
- `is:merge` / `is:non-merge` — Filter merge commits
- `hash:<sha>` — Match 7-40 hex SHA

### 3. Rich Commit Inspector & Diff Viewer
- **Unified & Side-by-Side Diff Viewer**: Clean syntax coloring (additions in green, deletions in red, hunk headers in cyan), line number tracking, and single-click diff copying.
- **Changed Files Breakdown**: View all modified files with status codes (`A` Added, `M` Modified, `D` Deleted, `R` Renamed) and additions/deletions counts.
- **Native VS Code Diff Integration**: Jump directly into VS Code's native diff editor with one click.
- **Parent Navigation**: Click parent hashes to traverse merge commits and branching histories.

### 4. Commit Comparison Engine
- Compare arbitrary commits, branches, tags, or `HEAD`.
- Inspect commits ahead and behind.
- Cumulative file-level diffs and additions/deletions totals.

### 5. Branch & Tag Explorer
- **Local & Remote Branches**: Inspect tracking branches, ahead/behind counters relative to upstream, and last commit dates.
- **Branch Operations**: Checkout, create branch from commit, and delete local branches safely.
- **Tag Management**: Inspect lightweight and annotated tags with tagger dates and messages.

### 6. Contributor & Repository Analytics
- **52-Week GitHub-style Activity Heatmap**: Interactive calendar tiles with commit density levels (0–4) and date-click filtering.
- **Commit Velocity Charts**: Daily and weekly commit trends powered by Recharts.
- **Contributor Leaderboard**: Rankings by total commits, first/last activity dates, and line churn.
- **Frequently Modified Files**: Identifies hotspots and high-churn code paths across history.

### 7. Optional AI Intelligence (Local-First & Private)
- **Commit Impact Summary**: Automated evaluation of blast radius, configuration impacts, and risk factors (*Low*, *Medium*, *High*).
- **Natural Language Search Translation**: Convert queries like *"commits by alex last week fixing auth"* into structured operators.
- **Automated Release Notes Generator**: Categorize commits into Features, Bug Fixes, and Maintenance.
- **Strict Privacy**: Operates offline by default with local heuristics. External API keys are stored exclusively in VS Code `SecretStorage`. No source code is transmitted in the background.

---

## 🚀 Quick Start

1. Open any workspace containing a Git repository in VS Code.
2. Click the **CommitFlow** icon in the Activity Bar or press `Ctrl+Shift+P` (`Cmd+Shift+P` on macOS) and run:
   ```
   CommitFlow: Open Commit Dashboard
   ```
3. Use the top navigation bar to toggle between **Cards**, **List**, **Timeline**, **Graph**, **Branches**, **Compare**, and **Analytics**.

---

## ⌨️ Extension Commands

| Command | Title | Description |
|---------|-------|-------------|
| `commitflow.openDashboard` | Open Commit Dashboard | Opens the main interactive CommitFlow dashboard |
| `commitflow.refresh` | Refresh Repository | Refreshes repository metadata, commits, and branches |
| `commitflow.search` | Search Commits | Focuses the search input in CommitFlow |
| `commitflow.clearFilters` | Clear All Filters | Resets all active date, author, and branch filters |
| `commitflow.openFileHistory` | Open File History | Opens commit history for current editor file |
| `commitflow.compareCommits` | Compare Commits | Opens the revision comparison workspace |
| `commitflow.viewBranches` | View Branches & Tags | Opens the branch and tag explorer |
| `commitflow.viewAnalytics` | View Analytics | Displays repository velocity and heatmaps |
| `commitflow.checkoutCommit` | Checkout Commit | Prompts and checks out a commit or branch |
| `commitflow.cherryPick` | Cherry-Pick Commit | Cherry-picks a commit into current HEAD |
| `commitflow.revertCommit` | Revert Commit | Safely reverts a commit |
| `commitflow.createBranch` | Create Branch from Commit | Creates a new branch from a selected revision |
| `commitflow.createTag` | Create Tag from Commit | Creates lightweight or annotated tags |
| `commitflow.openSettings` | Open Settings | Configures CommitFlow options |

---

## ⚙️ Configuration Settings

Customize CommitFlow in VS Code Settings (`Ctrl+,`):

```json
{
  "commitflow.pageSize": 30,
  "commitflow.defaultViewMode": "grid",
  "commitflow.dateFormat": "relative",
  "commitflow.enableAI": false,
  "commitflow.aiProvider": "openai"
}
```

---

## 🔒 Security & Data Privacy

- **Safe Process Execution**: All Git commands execute via bounded argument arrays (`execFile`) rather than shell interpolation, eliminating command injection vulnerabilities.
- **Strict Content Security Policy (CSP)**: The Webview enforces strict nonces, restricted local resource roots, and prevents untrusted script execution.
- **Local-First Architecture**: Your Git repository remains the single source of truth. No accounts or telemetry services required.

---

## 📄 License

MIT License. Built for modern software development teams.
