# Contributing to CommitFlow

Thank you for your interest in contributing to **CommitFlow**!

## Architecture Overview

CommitFlow is divided into two distinct environments communicating via a strongly typed message protocol:

1. **VS Code Extension Host (`src/`)**:
   - `extension.ts`: Activation, command registration, status bar, and Activity Bar TreeDataProvider.
   - `git/`: Safe Git process execution (`GitProcess.ts`), repository discovery (`GitRepository.ts`), commit log parsing (`CommitService.ts`), branch management (`BranchService.ts`), tag handling (`TagService.ts`), diff calculations (`DiffService.ts`), file history (`FileHistoryService.ts`), and contributor aggregation (`ContributorService.ts`).
   - `services/`: Query parsing (`SearchService.ts`), analytics (`AnalyticsService.ts`), persistence (`StorageService.ts`), and AI heuristics (`AIService.ts`).
   - `webview/`: Message handling and strict Content Security Policy.

2. **Webview UI Frontend (`webview-ui/`)**:
   - Modern React 18 application built with Vite and Tailwind CSS.
   - Zustand store (`useCommitStore.ts`) managing UI state, pagination, and caching.
   - Reusable components for cards, lists, SVG DAG graphs, timeline, diffs, and Recharts analytics.

---

## Development Setup

### Prerequisites
- Node.js >= 18.0.0
- Git CLI installed in system PATH
- VS Code >= 1.85.0

### Installing Dependencies
```bash
# Install root extension dependencies
npm install

# Install webview dependencies
cd webview-ui && npm install && cd ..
```

### Building the Project
```bash
# Build both extension host and webview
npm run build

# Or watch mode for rapid extension development
npm run watch
```

### Running Tests
Vitest executes unit and real Git repository integration tests:
```bash
npm run test
```

---

## Code Quality Standards
- Preserve separation between extension-host (Node.js/VS Code API) and webview (browser DOM).
- Never pass unescaped shell strings to `child_process.exec`. Always use `GitProcess.exec` with argument arrays.
- Machine-readable Git formats (`%x1f`, `%x1e`, `--numstat`) must be used for parsing.
- Destructive operations must require explicit user confirmation.
