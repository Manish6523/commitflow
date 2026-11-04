export const iconButton =
  'p-1.5 rounded-md text-gray-300 hover:text-vscode-fg hover:bg-vscode-hover transition-colors disabled:opacity-40 disabled:pointer-events-none';

export const ghostButton =
  'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-gray-300 hover:text-vscode-fg hover:bg-vscode-hover transition-colors disabled:opacity-40 disabled:pointer-events-none';

export const primaryButton =
  'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 disabled:pointer-events-none';

export const dangerButton =
  'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white transition-colors';

export const textInput =
  'w-full bg-vscode-input text-vscode-fg border border-vscode-inputBorder rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500';

export const inlineSelect =
  'flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-gray-300 hover:bg-vscode-hover transition-colors';

export const underlineTab = (active: boolean): string =>
  `px-3 py-1.5 text-xs font-medium border-b-2 transition-colors duration-150 flex items-center gap-1.5 ${
    active ? 'border-blue-500 text-gray-100' : 'border-transparent text-gray-400 hover:text-gray-200'
  }`;
