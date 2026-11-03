# Changelog

All notable changes to the "commitflow" extension will be documented in this file.

## [0.1.0] - 2026-11-03

### Initial Release of CommitFlow

#### Features
- **Visual Commit Explorer**:
  - Responsive card-first commit discovery with author avatars, initials, relative & exact timestamps, branch badges, tag chips, and change statistics (+/-).
  - Compact List View for dense history scanning.
  - Chronological Timeline View with grouping by Today, Yesterday, and Months.
  - Interactive SVG Git DAG Graph View with real parent-child relationship swimlanes and zoom/pan controls.
- **Advanced Search & Filtering**:
  - GitHub-style search operators: `author:`, `message:`, `after:`, `before:`, `file:`, `is:merge`, `hash:`.
  - Operator autocomplete hints with interactive syntax guide.
  - Date presets (Today, 7 days, 30 days, 90 days).
  - Saved filters with workspace and global persistence.
- **Commit Inspection & Diffing**:
  - Full inspector modal with parent commit links and containing references.
  - Changed files breakdown with status codes (A, M, D, R).
  - Inline Unified and Side-by-Side Diff Viewer with syntax coloring.
  - One-click transition to native VS Code Diff Editor.
- **Branch & Tag Explorer**:
  - Local and remote branch lists with upstream ahead/behind counters.
  - Safe checkout, branch creation, and branch deletion with confirmation.
  - Lightweight and annotated tag explorer with tag creation.
- **Repository Analytics**:
  - 52-week GitHub-style commit activity heatmap with click-to-filter.
  - Daily and weekly commit velocity charts powered by Recharts.
  - Contributor leaderboard with line churn and commit counts.
  - Most frequently modified files report.
- **Git Operations**:
  - Checkout, cherry-pick, revert, create branch, create tag, compare with HEAD.
  - Uncommitted changes detection and safety checks.
- **Optional AI Intelligence**:
  - Local heuristic commit impact evaluation (Low, Medium, High risk scoring).
  - Natural language search query translation.
  - Conventional commit release notes generator.
  - VS Code `SecretStorage` protection for credentials.
