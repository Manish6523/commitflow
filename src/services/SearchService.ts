import { CommitSearchRecord, CommitService } from '../git/CommitService';
import { GitProcess } from '../git/GitProcess';
import { GitCommit } from '../types/git';
import { CommitFilterOptions } from '../types/protocol';

export interface ParsedSearchQuery {
  raw: string;
  /** Terms joined back together, for display. */
  freeText: string;
  /** Words and quoted phrases. A commit must match every one. */
  terms: string[];
  filters: CommitFilterOptions;
  hash?: string;
  /** True when the hash came from `hash:` rather than a word that looks like one. */
  explicitHash?: boolean;
  tag?: string;
  codeChange?: string;
}

export interface SearchResult {
  commits: GitCommit[];
  totalCount: number;
  hasMore: boolean;
}

interface Token {
  text: string;
  /** The value after `key:`, when the token has that shape. */
  key?: string;
  value?: string;
}

const OPERATORS = new Set([
  'author', 'committer', 'after', 'since', 'before', 'until', 'file', 'path',
  'branch', 'hash', 'sha', 'tag', 'is', 'message', 'code',
]);

/**
 * Split a query on whitespace. Quotes group words only where they open a token
 * or a value, so apostrophes in words like "don't" stay literal. An unclosed
 * quote runs to the end, which keeps results stable while someone is typing.
 */
function tokenize(raw: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  const readQuoted = (quote: string): string => {
    const end = raw.indexOf(quote, i + 1);
    const text = raw.slice(i + 1, end === -1 ? raw.length : end);
    i = end === -1 ? raw.length : end + 1;
    return text;
  };

  while (i < raw.length) {
    if (/\s/.test(raw[i])) {
      i++;
      continue;
    }

    if (raw[i] === '"' || raw[i] === "'") {
      tokens.push({ text: readQuoted(raw[i]) });
      continue;
    }

    const start = i;
    while (i < raw.length && !/\s/.test(raw[i]) && raw[i] !== ':') i++;

    const key = raw.slice(start, i).toLowerCase();
    if (raw[i] === ':' && OPERATORS.has(key)) {
      i++;
      if (raw[i] === '"' || raw[i] === "'") {
        tokens.push({ text: raw.slice(start, i), key, value: readQuoted(raw[i]) });
      } else {
        const valueStart = i;
        while (i < raw.length && !/\s/.test(raw[i])) i++;
        tokens.push({ text: raw.slice(start, i), key, value: raw.slice(valueStart, i) });
      }
      continue;
    }

    while (i < raw.length && !/\s/.test(raw[i])) i++;
    tokens.push({ text: raw.slice(start, i) });
  }

  return tokens;
}

/** A commit matches when every term appears in its text or starts its hash. */
export function matchesTerms(record: CommitSearchRecord, terms: string[]): boolean {
  const text = [record.message, record.authorName, record.authorEmail, record.committerName, record.refs]
    .join('\n')
    .toLowerCase();
  return terms.every((term) => {
    const needle = term.toLowerCase();
    return text.includes(needle) || record.hash.startsWith(needle);
  });
}

export function matchesTag(record: CommitSearchRecord, tag: string): boolean {
  const needle = tag.toLowerCase();
  return record.refs
    .split(',')
    .some((ref) => ref.trim().startsWith('tag: ') && ref.trim().slice(5).toLowerCase().includes(needle));
}

export class SearchService {
  /**
   * Parse a search string with GitHub-style operators:
   * e.g. author:manish after:2026-10-01 message:authentication file:src/index.ts is:merge
   */
  public static parseQuery(rawQuery: string): ParsedSearchQuery {
    const raw = rawQuery.trim();
    const parsed: ParsedSearchQuery = { raw, freeText: '', terms: [], filters: {} };
    const { filters, terms } = parsed;

    for (const { text, key, value } of tokenize(raw)) {
      if (!key) {
        if (/^[0-9a-fA-F]{7,64}$/.test(text)) {
          parsed.hash = text;
        } else if (text) {
          terms.push(text);
        }
        continue;
      }

      // `author:` with nothing after it yet: wait for the value.
      if (!value) continue;

      switch (key) {
        case 'author':
          (filters.authors ??= []).push(value);
          break;
        case 'committer':
          (filters.committers ??= []).push(value);
          break;
        case 'after':
        case 'since':
          filters.since = value;
          break;
        case 'before':
        case 'until':
          filters.until = value;
          break;
        case 'file':
        case 'path':
          filters.filePath = value;
          break;
        case 'branch':
          filters.branch = value;
          break;
        case 'hash':
        case 'sha':
          parsed.hash = value;
          parsed.explicitHash = true;
          break;
        case 'tag':
          parsed.tag = value;
          break;
        case 'code':
          parsed.codeChange = value;
          break;
        case 'is':
          if (value === 'merge') filters.isMerge = true;
          if (value === 'non-merge' || value === 'normal') filters.isMerge = false;
          break;
        case 'message':
          terms.push(value);
          break;
      }
    }

    parsed.freeText = terms.join(' ');
    return parsed;
  }

  /**
   * Run a search. Filters git can apply itself stay in git; words, tags and code
   * changes need every candidate read, then only the requested page is loaded.
   */
  public static async search(
    repoRoot: string,
    query: string,
    options: { filters?: CommitFilterOptions; page?: number; pageSize?: number } = {}
  ): Promise<SearchResult> {
    const parsed = this.parseQuery(query);
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.max(1, Math.min(200, options.pageSize ?? 30));
    const filters = { ...options.filters, ...parsed.filters };
    const terms = [...parsed.terms];
    const empty: SearchResult = { commits: [], totalCount: 0, hasMore: false };

    if (filters.branch && !(await this.resolveCommit(repoRoot, filters.branch))) {
      return empty;
    }

    if (parsed.hash) {
      const hash = await this.resolveCommit(repoRoot, parsed.hash);
      if (hash && terms.length === 0) {
        const commits = await CommitService.getCommitsByHashes(repoRoot, [hash]);
        return { commits, totalCount: commits.length, hasMore: false };
      }
      if (!hash && parsed.explicitHash) return empty;
      terms.push(parsed.hash);
    }

    if (terms.length === 0 && !parsed.tag && !parsed.codeChange) {
      return CommitService.getCommits(repoRoot, { filters, page, pageSize });
    }

    const records = await CommitService.getSearchRecords(repoRoot, {
      filters,
      codeChange: parsed.codeChange,
    });
    const matches = records.filter(
      (record) => matchesTerms(record, terms) && (!parsed.tag || matchesTag(record, parsed.tag))
    );

    const start = (page - 1) * pageSize;
    const hashes = matches.slice(start, start + pageSize).map((record) => record.hash);
    return {
      commits: await CommitService.getCommitsByHashes(repoRoot, hashes),
      totalCount: matches.length,
      hasMore: start + hashes.length < matches.length,
    };
  }

  private static async resolveCommit(repoRoot: string, revision: string): Promise<string | null> {
    if (revision.startsWith('-')) return null;
    try {
      const res = await GitProcess.exec(
        ['rev-parse', '--verify', '--quiet', `${revision}^{commit}`],
        { cwd: repoRoot }
      );
      return res.stdout.trim() || null;
    } catch {
      return null;
    }
  }
}
