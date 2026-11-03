import { describe, it, expect } from 'vitest';
import { SearchService } from '../services/SearchService';

describe('SearchService', () => {
  it('should parse complex GitHub-style search operators', () => {
    const query = 'author:manish after:2026-10-01 before:2026-11-01 file:src/app.tsx is:merge payment processing';
    const parsed = SearchService.parseQuery(query);

    expect(parsed.filters.authors).toEqual(['manish']);
    expect(parsed.filters.since).toBe('2026-10-01');
    expect(parsed.filters.until).toBe('2026-11-01');
    expect(parsed.filters.filePath).toBe('src/app.tsx');
    expect(parsed.filters.isMerge).toBe(true);
    expect(parsed.freeText).toBe('payment processing');
  });

  it('should recognize direct commit SHAs in query', () => {
    const query = 'a82f91c981273918237192837192837192837123';
    const parsed = SearchService.parseQuery(query);

    expect(parsed.hash).toBe('a82f91c981273918237192837192837192837123');
  });

  it('should handle quoted values and empty queries gracefully', () => {
    const query = 'author:"Alex Doe" message:"fix critical bug"';
    const parsed = SearchService.parseQuery(query);

    expect(parsed.filters.authors).toEqual(['Alex Doe']);
    expect(parsed.freeText).toBe('fix critical bug');

    const empty = SearchService.parseQuery('   ');
    expect(empty.raw).toBe('');
    expect(empty.freeText).toBe('');
  });
});
