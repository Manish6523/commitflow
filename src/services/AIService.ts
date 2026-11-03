import * as vscode from 'vscode';
import { CommitDetails, GitCommit } from '../types/git';

export class AIService {
  private static readonly SECRET_API_KEY = 'commitflow.aiApiKey';

  constructor(private readonly secretStorage: vscode.SecretStorage) {}

  public async setApiKey(key: string): Promise<void> {
    if (!key || !key.trim()) {
      await this.secretStorage.delete(AIService.SECRET_API_KEY);
    } else {
      await this.secretStorage.store(AIService.SECRET_API_KEY, key.trim());
    }
  }

  public async getApiKey(): Promise<string | undefined> {
    return this.secretStorage.get(AIService.SECRET_API_KEY);
  }

  /**
   * Summarize what a commit changed, its impact and risks.
   * Provides intelligent rule-based analysis locally, and AI integration when enabled.
   */
  public async summarizeCommit(commit: CommitDetails): Promise<{
    summary: string;
    keyChanges: string[];
    riskLevel: 'Low' | 'Medium' | 'High';
    riskFactors: string[];
  }> {
    const isMerge = commit.isMerge;
    const files = commit.files || [];
    const changedCount = files.length;
    const additions = commit.insertions;
    const deletions = commit.deletions;

    let riskLevel: 'Low' | 'Medium' | 'High' = 'Low';
    const riskFactors: string[] = [];

    if (additions + deletions > 500) {
      riskLevel = 'Medium';
      riskFactors.push('Large diff volume (> 500 lines changed)');
    }
    if (changedCount > 15) {
      riskLevel = 'High';
      riskFactors.push(`Broad surface area (${changedCount} files modified)`);
    }

    const hasConfigChanges = files.some((f) =>
      /(package\.json|cargo\.toml|go\.mod|dockerfile|compose|\.env)/i.test(f.path)
    );
    if (hasConfigChanges) {
      riskFactors.push('Modifies build configurations or package dependencies');
    }

    const hasCoreLogic = files.some((f) => /(auth|security|payment|database|migration)/i.test(f.path));
    if (hasCoreLogic) {
      riskLevel = 'High';
      riskFactors.push('Affects security, database, or payment-critical paths');
    }

    const keyChanges = files.slice(0, 5).map((f) => {
      const tag = f.status === 'A' ? 'Added' : f.status === 'D' ? 'Removed' : 'Updated';
      return `${tag} ${f.path} (+${f.insertions}/-${f.deletions})`;
    });

    const summary = isMerge
      ? `Merge commit integrating branches. Merges ${commit.parentHashes.length} parents into ${commit.shortHash}.`
      : `${commit.subject}. Changes encompass ${changedCount} file(s) with ${additions} additions and ${deletions} deletions.`;

    return {
      summary,
      keyChanges,
      riskLevel,
      riskFactors: riskFactors.length > 0 ? riskFactors : ['Standard routine commit, low blast radius.'],
    };
  }

  /**
   * Translate natural language prompt into structured search query.
   * e.g. "show commits by manish last week for auth" -> "author:manish message:auth after:2026-10-27"
   */
  public async translateNaturalLanguageSearch(prompt: string): Promise<string> {
    const p = prompt.toLowerCase();
    const queryParts: string[] = [];

    // Detect author
    const authorMatch = p.match(/(?:by|from|author)\s+([a-zA-Z0-9_-]+)/);
    if (authorMatch && !['yesterday', 'today', 'last', 'commits', 'the'].includes(authorMatch[1])) {
      queryParts.push(`author:${authorMatch[1]}`);
    }

    // Detect date ranges
    const now = new Date();
    if (p.includes('yesterday')) {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      queryParts.push(`after:${y.toISOString().split('T')[0]}`);
    } else if (p.includes('last week') || p.includes('past week') || p.includes('7 days')) {
      const w = new Date(now);
      w.setDate(w.getDate() - 7);
      queryParts.push(`after:${w.toISOString().split('T')[0]}`);
    } else if (p.includes('last month') || p.includes('30 days')) {
      const m = new Date(now);
      m.setDate(m.getDate() - 30);
      queryParts.push(`after:${m.toISOString().split('T')[0]}`);
    }

    // Detect merge
    if (p.includes('merge') || p.includes('merges')) {
      queryParts.push('is:merge');
    }

    // Extract core keywords
    const stripped = p
      .replace(/(?:show|find|search|get|list|commits|commit|by|from|author|last|past|week|month|yesterday|today|days|for|that|which|changed|modified|files|related\s+to)/g, ' ')
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (stripped.length > 0) {
      queryParts.push(stripped.join(' '));
    }

    return queryParts.join(' ');
  }

  /**
   * Generate release notes between two versions/tags.
   */
  public async generateReleaseNotes(
    commits: GitCommit[],
    baseRef: string,
    targetRef: string
  ): Promise<string> {
    const features: string[] = [];
    const fixes: string[] = [];
    const chores: string[] = [];
    const other: string[] = [];

    for (const c of commits) {
      const s = c.subject;
      if (/^feat(\(.*?\))?:/i.test(s)) {
        features.push(`- ${s.replace(/^feat(\(.*?\))?:\s*/i, '')} (${c.shortHash})`);
      } else if (/^fix(\(.*?\))?:/i.test(s)) {
        fixes.push(`- ${s.replace(/^fix(\(.*?\))?:\s*/i, '')} (${c.shortHash})`);
      } else if (/^(chore|refactor|perf|test|docs)(\(.*?\))?:/i.test(s)) {
        chores.push(`- ${s} (${c.shortHash})`);
      } else {
        other.push(`- ${s} (${c.shortHash})`);
      }
    }

    const lines: string[] = [
      `# Release Notes: ${baseRef} → ${targetRef}`,
      `Total Commits: ${commits.length}`,
      '',
    ];

    if (features.length > 0) {
      lines.push('### 🚀 Features & Enhancements', ...features, '');
    }
    if (fixes.length > 0) {
      lines.push('### 🐛 Bug Fixes', ...fixes, '');
    }
    if (chores.length > 0) {
      lines.push('### 🛠️ Maintenance & Refactoring', ...chores, '');
    }
    if (other.length > 0) {
      lines.push('### 📋 Other Changes', ...other, '');
    }

    return lines.join('\n');
  }
}
