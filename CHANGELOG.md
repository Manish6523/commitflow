# Changelog

All notable changes to the "commitflow" extension will be documented in this file.

## [0.4.2] - 2026-11-20

### Added

- **Compare picker**: Base and Target open a list of starred commits, branches, tags and recent commits. Type to filter it across your whole history, pick with the mouse or ↑ ↓ and Enter, or still type an ID, branch or `HEAD~1`. Each box shows the message of the commit it points to, and **⇄** swaps the two.
- **Check for conflicts**: tries merging Target into Base without changing anything, and lists the files that would conflict. Click one to see it with the conflict markers.
- **Only Target's own changes**: compares from where Target split from Base, so changes made on Base since then are left out. This is what merging Target would bring in.
- **Wrap long lines** in every diff, from a new button next to the whitespace one.

### Fixed

- Compare showed changes made on Base since the branches split as if Target had removed them. The new option above shows only Target's own changes.
- A Base or Target name starting with `-` was passed to git as an option. Names are now checked to be real commits first.

## [0.4.1] - 2026-11-20

### Added

- **Star commits** to mark the ones you've checked. Click the ☆ in a commit's hover buttons, on its page, or in the sidebar graph. Starred commits get a gold edge and a ★ in every view, and the **★ Starred** option in the commits filter shows only them. Stars are saved on your computer for each repository and don't change Git history.
- The commit open in the dashboard is highlighted in the sidebar graph, which scrolls to it.
- Click a commit in the sidebar graph to list the files it changed underneath it, like VS Code's own Graph. Click a file to see its diff in that commit. The button on hover still opens the commit in the dashboard.

### Changed

- Previous and Next on a commit's page now go to the commit made just before or just after it, following the current branch, wherever you opened it from. The "back to" link is gone.

## [0.4.0] - 2026-11-19

### Added

- **Source Control sidebar**: the CommitFlow activity bar view is now a full Source Control panel, laid out like VS Code's own. Write a message (or generate one with AI), commit, amend, commit and push, or undo the last commit. Stage, unstage and discard files from Staged Changes, Changes and Merge Changes, as a list or a folder tree, with multi-select and right-click menus.
- Pull, push, sync, fetch and publish a branch from the sidebar, switch branches from its branch name, and stash or pop changes.
- A commit graph under the changes, including commits coming in from the remote. Click one to open it in the dashboard.
- The sidebar updates itself when files or Git change, and shows the number of changes on the CommitFlow icon.

### Fixed

- Opening a commit while the dashboard was still starting could load forever.

## [0.3.1] - 2026-11-06

### Changed

- AI Insights keeps each result for 30 minutes, so switching tabs or reopening a commit no longer analyzes it again.
- AI requests can now take up to 3 minutes, because large commits can be slow on free or local models.

### Fixed

- Custom servers failed if the Server URL was the full `/v1/chat/completions` address. That address now works.
- With no model saved, AI features quietly used the basic analysis. CommitFlow now asks the server and picks one, preferring `auto`.
- AI failures now show a clear message, and Save warns when no model could be found.
- `<think>` reasoning blocks from some models no longer break AI replies.

## [0.3.0] - 2026-11-05

### Added

- **Bring your own AI key**: a new Settings screen connects OpenAI, Anthropic, Google Gemini or any OpenAI-compatible server. AI Insights and Smart Search now use a real model. Keys are stored in VS Code's encrypted secret storage, and files like `.env` are left out of what's sent.
- New search operators: `code:`, `committer:`, plus working `branch:`, `tag:` and `hash:`.
- Search suggestions that complete as you type, with arrow key and Tab support.

### Changed

- Plain search now matches every word, in any order, across messages, authors, emails, refs and hashes, and keeps quoted phrases together.
- `file:` accepts part of a path, a folder or a glob, in any letter case.
- Search waits briefly while you type, and ignores results from older queries.

### Fixed

- `file:` returned no results at all.
- Searching for a commit hash showed every commit.
- Next and Previous dropped the current search, and the date and merge filters were ignored during a search.
- Special characters like `[` made search fail.
- Author search was case-sensitive and reported 0 commits.
- Clicking a day on the heatmap found nothing.

## [0.2.0] - 2026-11-04

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

