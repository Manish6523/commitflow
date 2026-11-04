# Changelog

All notable changes to the "commitflow" extension will be documented in this file.

## [Unreleased]

### Added

- **File History**: pick a file from the new File History tab, the Explorer context menu, the editor title button or a commit's file list to see every commit that changed it, following renames.
- **Version comparison**: click a commit to see what it changed, or mark any two versions as A and B, including the working copy.
- **Full-page diff**: commit details and Compare now use a Monaco diff editor with split and inline views, word-level highlights, collapsible unchanged regions, next/previous change (F7 / Shift+F7) and a whitespace toggle.

### Changed

- Commit details open as a full page instead of a popup.
- Every screen now shares one flat, compact design, with commit actions in a toolbar that appears on hover.
- Timeline and Graph now have page controls, and Branches & Tags has a filter.
- Added view transitions, loading skeletons and reduced-motion support. Colors follow the VS Code theme, so text stays readable in light themes.

### Fixed

- "Open in VS Code" diffs no longer depend on the Git extension's URI format, and work for renamed, added and deleted files.
- Line counts in commit and compare file lists were always zero.
- Compare, Branches, Analytics and Search commands now switch the dashboard view, even when they open it.
- Switching repository no longer leaves the dashboard stuck on loading.
- Checkout, Cherry-pick, Revert, Delete Branch and Smart Search now use in-app dialogs, because webviews block browser confirm and prompt popups.
- The branch list refreshes after a branch operation.
- Heatmap month labels line up with their weeks, and the heatmap opens at the newest dates.

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

