import { describe, it, expect } from 'vitest';
import { AIService } from '../services/AIService';
import { CommitDetails, GitCommit } from '../types/git';

describe('AIService', () => {
  const mockSecretStorage: any = {
    get: async () => 'test-key',
    store: async () => {},
    delete: async () => {},
  };

  const aiService = new AIService(mockSecretStorage);

  it('should summarize commits and evaluate risk level accurately', async () => {
    const commit: CommitDetails = {
      hash: 'a82f91c1234567890abcdef1234567890abcdef12',
      shortHash: 'a82f91c',
      treeHash: 'tree123',
      parentHashes: ['p1'],
      author: {
        name: 'Dev User',
        email: 'dev@example.com',
        date: '2026-11-03',
        timestamp: Date.now(),
      },
      committer: {
        name: 'Dev User',
        email: 'dev@example.com',
        date: '2026-11-03',
        timestamp: Date.now(),
      },
      subject: 'feat: add payment authentication checkout',
      body: 'Updated payment provider keys and db schema.',
      branches: ['main'],
      tags: [],
      isMerge: false,
      signatureStatus: 'G',
      filesChanged: 2,
      insertions: 80,
      deletions: 10,
      files: [
        { path: 'src/auth/payment.ts', status: 'M', insertions: 60, deletions: 5, isBinary: false },
        { path: 'package.json', status: 'M', insertions: 20, deletions: 5, isBinary: false },
      ],
    };

    const res = await aiService.summarizeCommit(commit);
    expect(res.riskLevel).toBe('High');
    expect(res.riskFactors.some((rf) => rf.includes('security') || rf.includes('payment'))).toBe(true);
    expect(res.riskFactors.some((rf) => rf.includes('dependencies'))).toBe(true);
    expect(res.keyChanges.length).toBe(2);
  });

  it('should translate natural language prompts into structured queries', async () => {
    const prompt = 'show commits by manish last week for auth';
    const query = await aiService.translateNaturalLanguageSearch(prompt);

    expect(query).toContain('author:manish');
    expect(query).toContain('after:');
    expect(query).toContain('auth');
  });

  it('should generate categorized release notes', async () => {
    const commits: GitCommit[] = [
      {
        hash: '1111111',
        shortHash: '1111111',
        treeHash: 't',
        parentHashes: [],
        author: { name: 'A', email: 'a', date: '', timestamp: 0 },
        committer: { name: 'A', email: 'a', date: '', timestamp: 0 },
        subject: 'feat: add dark theme support',
        body: '',
        branches: [],
        tags: [],
        isMerge: false,
        signatureStatus: 'N',
        filesChanged: 1,
        insertions: 10,
        deletions: 0,
      },
      {
        hash: '2222222',
        shortHash: '2222222',
        treeHash: 't',
        parentHashes: [],
        author: { name: 'B', email: 'b', date: '', timestamp: 0 },
        committer: { name: 'B', email: 'b', date: '', timestamp: 0 },
        subject: 'fix: resolve race condition in cache',
        body: '',
        branches: [],
        tags: [],
        isMerge: false,
        signatureStatus: 'N',
        filesChanged: 1,
        insertions: 5,
        deletions: 5,
      },
    ];

    const notes = await aiService.generateReleaseNotes(commits, 'v1.0.0', 'v1.1.0');
    expect(notes).toContain('Features & Enhancements');
    expect(notes).toContain('add dark theme support');
    expect(notes).toContain('Bug Fixes');
    expect(notes).toContain('resolve race condition in cache');
  });
});
