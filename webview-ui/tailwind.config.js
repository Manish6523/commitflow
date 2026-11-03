/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        vscode: {
          bg: 'var(--vscode-editor-background, #1e1e1e)',
          fg: 'var(--vscode-editor-foreground, #cccccc)',
          border: 'var(--vscode-panel-border, #333333)',
          sidebar: 'var(--vscode-sideBar-background, #252526)',
          hover: 'var(--vscode-list-hoverBackground, #2a2d2e)',
          active: 'var(--vscode-list-activeSelectionBackground, #094771)',
          input: 'var(--vscode-input-background, #3c3c3c)',
          inputBorder: 'var(--vscode-input-border, #3c3c3c)',
          badge: 'var(--vscode-badge-background, #4d4d4d)',
          badgeFg: 'var(--vscode-badge-foreground, #ffffff)',
          button: 'var(--vscode-button-background, #0e639c)',
          buttonHover: 'var(--vscode-button-hoverBackground, #1177bb)',
        },
      },
      fontFamily: {
        mono: ['var(--vscode-editor-font-family, monospace)', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
        sans: ['var(--vscode-font-family, sans-serif)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

