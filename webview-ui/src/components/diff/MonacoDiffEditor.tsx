import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { editorFont, languageForPath, monaco } from '../../monaco/setup';

export interface MonacoDiffHandle {
  goToChange: (direction: 'next' | 'previous') => void;
}

interface MonacoDiffEditorProps {
  original: string;
  modified: string;
  originalPath: string;
  modifiedPath: string;
  layout: 'split' | 'inline';
  ignoreWhitespace: boolean;
  onChangeCount: (count: number) => void;
}

const MonacoDiffEditor = forwardRef<MonacoDiffHandle, MonacoDiffEditorProps>(
  ({ original, modified, originalPath, modifiedPath, layout, ignoreWhitespace, onChangeCount }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
    const onChangeCountRef = useRef(onChangeCount);
    onChangeCountRef.current = onChangeCount;

    useImperativeHandle(ref, () => ({
      goToChange: (direction) => editorRef.current?.goToDiff(direction),
    }));

    useEffect(() => {
      const editor = monaco.editor.createDiffEditor(containerRef.current!, {
        ...editorFont(),
        readOnly: true,
        originalEditable: false,
        automaticLayout: true,
        renderOverviewRuler: true,
        useInlineViewWhenSpaceIsLimited: true,
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        minimap: { enabled: false },
        stickyScroll: { enabled: true },
        hideUnchangedRegions: {
          enabled: true,
          contextLineCount: 3,
          minimumLineCount: 5,
          revealLineCount: 20,
        },
      });
      editorRef.current = editor;

      const subscription = editor.onDidUpdateDiff(() => {
        onChangeCountRef.current(editor.getLineChanges()?.length ?? 0);
      });

      return () => {
        subscription.dispose();
        const models = editor.getModel();
        editor.dispose();
        models?.original.dispose();
        models?.modified.dispose();
        editorRef.current = null;
      };
    }, []);

    useEffect(() => {
      const editor = editorRef.current!;
      const previous = editor.getModel();
      editor.setModel({
        original: monaco.editor.createModel(original, languageForPath(originalPath)),
        modified: monaco.editor.createModel(modified, languageForPath(modifiedPath)),
      });
      previous?.original.dispose();
      previous?.modified.dispose();
    }, [original, modified, originalPath, modifiedPath]);

    useEffect(() => {
      editorRef.current!.updateOptions({
        renderSideBySide: layout === 'split',
        ignoreTrimWhitespace: ignoreWhitespace,
      });
    }, [layout, ignoreWhitespace]);

    return <div ref={containerRef} className="h-full w-full" />;
  }
);

export default MonacoDiffEditor;
