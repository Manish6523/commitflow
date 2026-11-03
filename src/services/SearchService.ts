import { CommitFilterOptions } from '../types/protocol';

export interface ParsedSearchQuery {
  raw: string;
  freeText: string;
  filters: CommitFilterOptions;
  hash?: string;
  tag?: string;
}

export class SearchService {
  /**
   * Parse a search string with GitHub-style operators:
   * e.g. author:manish after:2026-10-01 message:authentication file:src/index.ts is:merge
   */
  public static parseQuery(rawQuery: string): ParsedSearchQuery {
    const raw = rawQuery.trim();
    if (!raw) {
      return { raw: '', freeText: '', filters: {} };
    }

    const filters: CommitFilterOptions = {};
    const freeTextParts: string[] = [];
    let hash: string | undefined;
    let tag: string | undefined;

    // Tokenize respecting quotes
    const regex = /(?:[^\s"']+|"[^"]*"|'[^']*')+/g;
    const tokens = raw.match(regex) || [];

    for (const token of tokens) {
      // Clean surrounding quotes if present
      const cleanToken = token.replace(/^["']|["']$/g, '');
      const colonIdx = cleanToken.indexOf(':');

      if (colonIdx > 0) {
        const key = cleanToken.substring(0, colonIdx).toLowerCase();
        const rawValue = cleanToken.substring(colonIdx + 1).trim();
        const value = rawValue.replace(/^["']|["']$/g, '');

        switch (key) {
          case 'author':
            filters.authors = filters.authors || [];
            filters.authors.push(value);
            break;
          case 'committer':
            // Can be filtered or mapped
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
            hash = value;
            break;
          case 'tag':
            tag = value;
            break;
          case 'is':
            if (value === 'merge') {
              filters.isMerge = true;
            } else if (value === 'non-merge' || value === 'normal') {
              filters.isMerge = false;
            }
            break;
          case 'message':
            freeTextParts.push(value);
            break;
          default:
            freeTextParts.push(cleanToken);
            break;
        }
      } else {
        // Direct hash check (if 7-40 hex chars)
        if (/^[0-9a-fA-F]{7,40}$/.test(cleanToken)) {
          hash = cleanToken;
        } else {
          freeTextParts.push(cleanToken);
        }
      }
    }

    return {
      raw,
      freeText: freeTextParts.join(' ').trim(),
      filters,
      hash,
      tag,
    };
  }
}
