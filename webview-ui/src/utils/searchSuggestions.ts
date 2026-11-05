export interface SearchOperator {
  label: string;
  desc: string;
}

export const SEARCH_OPERATORS: SearchOperator[] = [
  { label: 'author:', desc: 'Author name or email' },
  { label: 'file:', desc: 'Part of a path, a folder or a glob like *.tsx' },
  { label: 'after:', desc: 'On or after a date, like 2026-10-01' },
  { label: 'before:', desc: 'On or before a date' },
  { label: 'branch:', desc: 'Commits on a branch' },
  { label: 'tag:', desc: 'Commits with a matching tag' },
  { label: 'code:', desc: 'Commits that added or removed this text' },
  { label: 'hash:', desc: 'Full or short commit hash' },
  { label: 'committer:', desc: 'Committer name or email' },
  { label: 'is:merge', desc: 'Only merge commits' },
  { label: 'is:non-merge', desc: 'Exclude merge commits' },
];

/** The token being typed: everything after the last space, outside any quotes. */
function currentToken(query: string): { start: number; text: string } | null {
  const quotes = (query.match(/"/g) ?? []).length;
  if (quotes % 2 === 1) return null;
  const start = query.search(/\S*$/);
  return { start, text: query.slice(start) };
}

/** Operators that complete the token being typed. */
export function matchingOperators(query: string): SearchOperator[] {
  const token = currentToken(query);
  if (!token) return [];
  const text = token.text.toLowerCase();
  return SEARCH_OPERATORS.filter(({ label }) => label.startsWith(text) && label !== text);
}

/** Replace the token being typed with an operator. */
export function applyOperator(query: string, label: string): string {
  const start = currentToken(query)?.start ?? query.length;
  return `${query.slice(0, start)}${label}${label.endsWith(':') ? '' : ' '}`;
}
