import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const GeniusFormatting = Extension.create({
  name: 'geniusFormatting',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('genius-syntax'),
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, old) {
            // We re-scan the document on every transaction to ensure state (bold/italic) 
            // propagates correctly through the text.
            const doc = tr.doc;
            const decorations: Decoration[] = [];
            
            let boldActive = false;
            let italicActive = false;

            // Regex to find tags: <b>, </b>, <i>, </i>
            // AND annotations strictly in the format [text](id)
            // We purposely DO NOT match [Verse 1] so it remains plain text.
            const tokenRegex = /<b>|<\/b>|<i>|<\/i>|\[[^\]]+\]\(\d+\)/gi;

            doc.descendants((node, pos) => {
              if (!node.isText) return true;

              const text = node.text || '';
              let lastIndex = 0;
              let match;

              while ((match = tokenRegex.exec(text)) !== null) {
                // 1. Handle text BEFORE the match (apply current active styles)
                if (match.index > lastIndex) {
                  const from = pos + lastIndex;
                  const to = pos + match.index;
                  if (boldActive) decorations.push(Decoration.inline(from, to, { class: 'st-bold' }));
                  if (italicActive) decorations.push(Decoration.inline(from, to, { class: 'st-italic' }));
                }

                // 2. Handle the TOKEN itself
                const token = match[0];
                const tokenStart = pos + match.index;
                const tokenEnd = tokenStart + token.length;

                const lowerToken = token.toLowerCase();

                if (lowerToken === '<b>') {
                  boldActive = true;
                  decorations.push(Decoration.inline(tokenStart, tokenEnd, { class: 'st-tag' }));
                } else if (lowerToken === '</b>') {
                  boldActive = false;
                  decorations.push(Decoration.inline(tokenStart, tokenEnd, { class: 'st-tag' }));
                } else if (lowerToken === '<i>') {
                  italicActive = true;
                  decorations.push(Decoration.inline(tokenStart, tokenEnd, { class: 'st-tag' }));
                } else if (lowerToken === '</i>') {
                  italicActive = false;
                  decorations.push(Decoration.inline(tokenStart, tokenEnd, { class: 'st-tag' }));
                } else if (token.startsWith('[')) {
                  // Handle Annotations: [text](123)
                  // The regex ensures we only get here if it matches [..](digits)
                  const annotMatch = /^\[([^\]]+)\]\((\d+)\)$/.exec(token);
                  
                  if (annotMatch) {
                    const innerText = annotMatch[1];
                    
                    // Highlight [
                    const openBracketEnd = tokenStart + 1;
                    decorations.push(Decoration.inline(tokenStart, openBracketEnd, { class: 'st-tag' }));

                    // Highlight Inner Text (respects bold/italic)
                    const textStart = openBracketEnd;
                    const textEnd = textStart + innerText.length;
                    if (boldActive) decorations.push(Decoration.inline(textStart, textEnd, { class: 'st-bold' }));
                    if (italicActive) decorations.push(Decoration.inline(textStart, textEnd, { class: 'st-italic' }));

                    // Highlight ](123)
                    decorations.push(Decoration.inline(textEnd, tokenEnd, { class: 'st-tag' }));
                  } else {
                    // Fallback (should not be reached given the regex, but safe practice)
                    decorations.push(Decoration.inline(tokenStart, tokenEnd, { class: 'st-tag' }));
                  }
                }

                lastIndex = match.index + token.length;
              }

              // 3. Handle remaining text in the node
              if (lastIndex < text.length) {
                const from = pos + lastIndex;
                const to = pos + text.length;
                if (boldActive) decorations.push(Decoration.inline(from, to, { class: 'st-bold' }));
                if (italicActive) decorations.push(Decoration.inline(from, to, { class: 'st-italic' }));
              }
            });

            return DecorationSet.create(doc, decorations);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});