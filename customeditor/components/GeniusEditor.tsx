import React, { useEffect, useMemo, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { GeniusFormatting } from '../extensions/GeniusFormatting';

type ParentMessage =
  | { type: 'init'; text?: string; selectionStart?: number; selectionEnd?: number; focus?: boolean; fontSize?: string; lineHeight?: string; fontFamily?: string; fontWeight?: string; editorId?: string }
  | { type: 'set-content'; text: string; editorId?: string }
  | { type: 'set-selection'; selectionStart: number; selectionEnd: number; editorId?: string }
  | { type: 'focus'; editorId?: string };

const GeniusEditor: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorId = useMemo(() => window.name || 'scribetools-custom-editor', []);

  const editor = useEditor({
    extensions: [
      // We disable default marks (bold, italic) because we are handling them via raw text syntax
      StarterKit.configure({
        bold: false,
        italic: false,
        code: false,
        codeBlock: false,
        strike: false,
      }),
      Placeholder.configure({
        placeholder: 'Start typing lyrics...',
      }),
      GeniusFormatting,
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'genius-editor',
        spellcheck: 'false',
      },
    },
    onCreate({ editor }) {
      // Signal readiness as soon as the editor is constructed
      window.parent?.postMessage({
        source: 'scribetools-custom-editor',
        type: 'ready',
        editorId,
      }, '*');

      // Send an initial height so the parent can size the iframe immediately
      const element = containerRef.current;
      if (element) {
        const rect = element.getBoundingClientRect();
        window.parent?.postMessage({
          source: 'scribetools-custom-editor',
          type: 'height-change',
          height: rect.height,
          editorId,
        }, '*');
      }
    },
    onUpdate({ editor }) {
      postContentUpdate(editor);
    },
    onSelectionUpdate({ editor }) {
      postSelectionUpdate(editor);
    },
  });

  // Binary search to translate a plain-text offset to the closest ProseMirror position
  const offsetToPos = (target: number) => {
    if (!editor) return 0;
    const docSize = editor.state.doc.content.size;
    let low = 0;
    let high = docSize;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const len = editor.state.doc.textBetween(0, mid, '\n', '\n').length;
      if (len < target) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return low;
  };

  const plainTextToDoc = (text: string) => {
    const paragraphs = text.split(/\r?\n/);
    const content = paragraphs.map(line => ({
      type: 'paragraph',
      content: line.length === 0 ? [] : [{ type: 'text', text: line }],
    }));
    return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
  };

  const setPlainTextContent = (text: string) => {
    editor?.commands.setContent(plainTextToDoc(text), false);
  };

  const docToPlainText = (doc: ProseMirrorNode) => {
    return doc.textBetween(0, doc.content.size, '\n', '\n');
  };

  const postContentUpdate = (activeEditor: typeof editor | null) => {
    if (!activeEditor) return;
    const text = docToPlainText(activeEditor.state.doc);
    const html = activeEditor.getHTML();
    const { from, to } = activeEditor.state.selection;
    const selectionStart = activeEditor.state.doc.textBetween(0, from, '\n', '\n').length;
    const selectionEnd = activeEditor.state.doc.textBetween(0, to, '\n', '\n').length;

    window.parent?.postMessage({
      source: 'scribetools-custom-editor',
      type: 'content-change',
      text,
      html,
      selectionStart,
      selectionEnd,
      editorId,
    }, '*');
  };

  const postSelectionUpdate = (activeEditor: typeof editor | null) => {
    if (!activeEditor) return;
    const { from, to } = activeEditor.state.selection;
    const selectionStart = activeEditor.state.doc.textBetween(0, from, '\n', '\n').length;
    const selectionEnd = activeEditor.state.doc.textBetween(0, to, '\n', '\n').length;

    window.parent?.postMessage({
      source: 'scribetools-custom-editor',
      type: 'selection-change',
      selectionStart,
      selectionEnd,
      editorId,
    }, '*');
  };

  // Keep the parent frame up to date with the editor's height
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      window.parent?.postMessage({
        source: 'scribetools-custom-editor',
        type: 'height-change',
        height: entry.contentRect.height,
        editorId,
      }, '*');
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [editorId]);

  // Listen for parent -> iframe messages
  useEffect(() => {
    if (!editor) return;

    const handler = (event: MessageEvent<ParentMessage & { source?: string }>) => {
      if (!event.data || event.data.source !== 'scribetools-parent') return;
      if (event.data.editorId && event.data.editorId !== editorId) return;

      if (event.data.type === 'init' && event.data.text !== undefined) {
        setPlainTextContent(event.data.text);
        if (typeof event.data.selectionStart === 'number' && typeof event.data.selectionEnd === 'number') {
          const from = offsetToPos(event.data.selectionStart);
          const to = offsetToPos(event.data.selectionEnd);
          editor.commands.setTextSelection({ from, to });
        }
        if (event.data.focus) {
          editor.commands.focus('end');
        }

        // Apply any font tweaks requested by the parent
        const root = containerRef.current;
        if (root) {
          if (event.data.fontFamily) root.style.fontFamily = event.data.fontFamily;
          if (event.data.lineHeight) root.style.lineHeight = event.data.lineHeight;
          if (event.data.fontSize) root.style.fontSize = event.data.fontSize;
          if (event.data.fontWeight) root.style.fontWeight = event.data.fontWeight;
        }

        postContentUpdate(editor);
      }

      if (event.data.type === 'set-content') {
        setPlainTextContent(event.data.text);
        postContentUpdate(editor);
      }

      if (event.data.type === 'set-selection') {
        const from = offsetToPos(event.data.selectionStart);
        const to = offsetToPos(event.data.selectionEnd);
        editor.commands.setTextSelection({ from, to });
        postSelectionUpdate(editor);
      }

      if (event.data.type === 'focus') {
        editor.commands.focus();
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [editor, editorId]);

  if (!editor) {
    return null;
  }

  return (
    <div ref={containerRef} className="w-full">
      <EditorContent editor={editor} className="w-full" />
    </div>
  );
};

export default GeniusEditor;