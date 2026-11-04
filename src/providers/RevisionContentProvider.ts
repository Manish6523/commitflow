import * as vscode from 'vscode';
import { FileContentService } from '../git/FileContentService';

export const REVISION_SCHEME = 'commitflow-rev';

/**
 * Serves a file at a revision to VS Code's native diff editor. A null ref is an
 * empty document, for a side of the diff where the file does not exist.
 */
export class RevisionContentProvider implements vscode.TextDocumentContentProvider {
  public static toUri(repoRoot: string, ref: string | null, filePath: string): vscode.Uri {
    return vscode.Uri.from({
      scheme: REVISION_SCHEME,
      path: `/${filePath.replace(/\\/g, '/')}`,
      query: JSON.stringify({ repoRoot, ref }),
    });
  }

  public async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const { repoRoot, ref } = JSON.parse(uri.query) as { repoRoot: string; ref: string | null };
    if (!ref) return '';

    const file = await FileContentService.getContent(repoRoot, ref, uri.path.slice(1));
    if (file.isBinary) return '(binary file)';
    if (file.tooLarge) return '(file too large to display)';
    return file.content;
  }
}
