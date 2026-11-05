import { describe, it, expect } from 'vitest';
import { SEARCH_OPERATORS, applyOperator, matchingOperators } from './searchSuggestions';

describe('search suggestions', () => {
  it('shows every operator for an empty query or a new word', () => {
    expect(matchingOperators('')).toHaveLength(SEARCH_OPERATORS.length);
    expect(matchingOperators('fix ')).toHaveLength(SEARCH_OPERATORS.length);
  });

  it('completes the word being typed', () => {
    expect(matchingOperators('fix au').map((o) => o.label)).toEqual(['author:']);
    expect(matchingOperators('is:').map((o) => o.label)).toEqual(['is:merge', 'is:non-merge']);
  });

  it('stays quiet for finished operators, plain words and open quotes', () => {
    expect(matchingOperators('author:')).toEqual([]);
    expect(matchingOperators('author:ada')).toEqual([]);
    expect(matchingOperators('login')).toEqual([]);
    expect(matchingOperators('"a')).toEqual([]);
  });

  it('replaces only the word being typed', () => {
    expect(applyOperator('fix au', 'author:')).toBe('fix author:');
    expect(applyOperator('fix ', 'is:merge')).toBe('fix is:merge ');
    expect(applyOperator('', 'file:')).toBe('file:');
  });
});
