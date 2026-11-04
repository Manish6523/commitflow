import { DiffSide, FileContent } from '../types';
import { vscode } from '../vscode';

const MAX_CACHED_FILES = 100;
const FULL_HASH = /^[0-9a-f]{40}$/;
const EMPTY: FileContent = { content: '', exists: false, isBinary: false, tooLarge: false };

const cache = new Map<string, Promise<FileContent>>();

/**
 * Load one side of a diff. Content at a full commit hash can never change, so
 * it is cached; moving refs like HEAD and the working copy are always re-read.
 */
export function loadFileContent(side: DiffSide | null): Promise<FileContent> {
  if (!side) return Promise.resolve(EMPTY);

  const fetchContent = () =>
    vscode.request<FileContent>({ type: 'GET_FILE_CONTENT', ref: side.ref, filePath: side.path });
  if (!FULL_HASH.test(side.ref)) return fetchContent();

  const key = `${side.ref}:${side.path}`;
  let content = cache.get(key);
  if (!content) {
    content = fetchContent();
    content.catch(() => cache.delete(key));
    cache.set(key, content);
    if (cache.size > MAX_CACHED_FILES) {
      cache.delete(cache.keys().next().value!);
    }
  }
  return content;
}

export function clearFileContentCache(): void {
  cache.clear();
}
