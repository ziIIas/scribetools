import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { GeniusFormatting } from '../extensions/GeniusFormatting';

const GeniusEditor: React.FC = () => {
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
    content: `[Intro]
Yeah, yeah

[Verse 1]
I don't know why they actin like dat
The glock go <b>pow-pow-pow</b>
It's crazy 'cuz they fake [friends](12345)
`,
    editorProps: {
      attributes: {
        class: 'genius-editor',
        spellcheck: 'false',
      },
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <EditorContent editor={editor} className="w-full h-full" />
  );
};

export default GeniusEditor;