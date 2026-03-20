import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

interface DecorationRange {
  from: number;  // Offset in fullText
  to: number;    // Offset in fullText
  class: string;
}

interface TextNodeInfo {
  pos: number;      // ProseMirror position
  startOffset: number; // Offset in fullText where this node starts
  length: number;   // Length of text in this node
}

// Export annotation range info for other parts of the system
export interface AnnotationInfo {
  start: number;      // Doc position of '['
  innerStart: number; // Doc position after '['
  innerEnd: number;   // Doc position of ']'
  end: number;        // Doc position after ')'
  textStart: number;  // Text offset of '['
  textInnerStart: number;
  textInnerEnd: number;
  textEnd: number;
}

// Plugin key for accessing annotation data
export const geniusFormattingKey = new PluginKey<{
  decorations: DecorationSet;
  annotations: AnnotationInfo[];
  annotationsVisible: boolean;
}>('genius-syntax');

// Storage for annotation visibility state (shared between plugin instances)
let annotationsVisibleState = true;

export function setAnnotationsVisible(visible: boolean) {
  annotationsVisibleState = visible;
}

export function getAnnotationsVisible(): boolean {
  return annotationsVisibleState;
}

export const GeniusFormatting = Extension.create({
  name: 'geniusFormatting',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: geniusFormattingKey,
        state: {
          init() {
            return {
              decorations: DecorationSet.empty,
              annotations: [],
              annotationsVisible: annotationsVisibleState,
            };
          },
          apply(tr, old) {
            const doc = tr.doc;
            const decorations: Decoration[] = [];
            const annotationsVisible = annotationsVisibleState;

            // Step 1: Build full document text and track node positions
            let fullText = '';
            const textNodes: TextNodeInfo[] = [];

            doc.descendants((node, pos) => {
              if (node.isText) {
                const text = node.text || '';
                textNodes.push({
                  pos,
                  startOffset: fullText.length,
                  length: text.length,
                });
                fullText += text;
              }
              return true;
            });

            if (fullText.length === 0) {
              return {
                decorations: DecorationSet.empty,
                annotations: [],
                annotationsVisible,
              };
            }

            // Step 2: Find all annotations [content](digits)
            const annotationTextRanges: { start: number; innerStart: number; innerEnd: number; end: number }[] = [];
            const annotRegex = /\[([^\]]*)\]\((\d+)\)/g;
            let annotMatch;
            
            while ((annotMatch = annotRegex.exec(fullText)) !== null) {
              annotationTextRanges.push({
                start: annotMatch.index,
                innerStart: annotMatch.index + 1,
                innerEnd: annotMatch.index + 1 + annotMatch[1].length,
                end: annotMatch.index + annotMatch[0].length,
              });
            }

            // Convert text offset to doc position
            const offsetToDocPos = (offset: number): number => {
              for (const node of textNodes) {
                if (offset >= node.startOffset && offset <= node.startOffset + node.length) {
                  return node.pos + (offset - node.startOffset);
                }
              }
              if (textNodes.length > 0) {
                const last = textNodes[textNodes.length - 1];
                return last.pos + last.length;
              }
              return 0;
            };

            // Build annotation info with doc positions
            const annotations: AnnotationInfo[] = annotationTextRanges.map(a => ({
              start: offsetToDocPos(a.start),
              innerStart: offsetToDocPos(a.innerStart),
              innerEnd: offsetToDocPos(a.innerEnd),
              end: offsetToDocPos(a.end),
              textStart: a.start,
              textInnerStart: a.innerStart,
              textInnerEnd: a.innerEnd,
              textEnd: a.end,
            }));

            // Step 3: Calculate all decoration ranges in fullText coordinates
            const ranges: DecorationRange[] = [];

            // Helper: check if offset is in annotation bracket part (not inner content)
            const isInAnnotationBracket = (offset: number): boolean => {
              for (const annot of annotationTextRanges) {
                if ((offset >= annot.start && offset < annot.innerStart) ||
                    (offset >= annot.innerEnd && offset < annot.end)) {
                  return true;
                }
              }
              return false;
            };

            // Add annotation bracket decorations
            for (const annot of annotationTextRanges) {
              // Opening bracket '['
              ranges.push({ 
                from: annot.start, 
                to: annot.innerStart, 
                class: annotationsVisible ? 'st-tag' : 'st-hidden-annotation' 
              });
              // Closing bracket and ID '](12345)'
              ranges.push({ 
                from: annot.innerEnd, 
                to: annot.end, 
                class: annotationsVisible ? 'st-tag' : 'st-hidden-annotation' 
              });
            }

            // Step 4: Find all formatting tags and calculate styled ranges
            const tagRegex = /<b>|<\/b>|<i>|<\/i>/gi;
            
            interface TagInfo {
              index: number;
              length: number;
              type: 'b' | '/b' | 'i' | '/i';
            }
            const tags: TagInfo[] = [];
            let tagMatch;
            
            while ((tagMatch = tagRegex.exec(fullText)) !== null) {
              const lower = tagMatch[0].toLowerCase();
              let type: TagInfo['type'];
              if (lower === '<b>') type = 'b';
              else if (lower === '</b>') type = '/b';
              else if (lower === '<i>') type = 'i';
              else type = '/i';
              
              tags.push({
                index: tagMatch.index,
                length: tagMatch[0].length,
                type,
              });
            }

            // Add tag decorations (gray styling for the tags themselves)
            for (const tag of tags) {
              const tagStart = tag.index;
              const tagEnd = tag.index + tag.length;
              // Only add st-tag if not inside annotation bracket part
              if (!isInAnnotationBracket(tagStart)) {
                ranges.push({ from: tagStart, to: tagEnd, class: 'st-tag' });
              }
            }

            // Step 5: Calculate styled text ranges
            let boldActive = false;
            let italicActive = false;
            let currentPos = 0;

            for (let i = 0; i <= tags.length; i++) {
              const segmentEnd = i < tags.length ? tags[i].index : fullText.length;
              
              if (segmentEnd > currentPos) {
                let segStart = currentPos;
                
                for (let j = currentPos; j <= segmentEnd; j++) {
                  const inBracket = j < segmentEnd && isInAnnotationBracket(j);
                  
                  if (j === segmentEnd || inBracket) {
                    if (j > segStart) {
                      if (boldActive) {
                        ranges.push({ from: segStart, to: j, class: 'st-bold' });
                      }
                      if (italicActive) {
                        ranges.push({ from: segStart, to: j, class: 'st-italic' });
                      }
                    }
                    segStart = j + 1;
                  }
                }
              }

              if (i < tags.length) {
                const tag = tags[i];
                if (tag.type === 'b') boldActive = true;
                else if (tag.type === '/b') boldActive = false;
                else if (tag.type === 'i') italicActive = true;
                else if (tag.type === '/i') italicActive = false;
                
                currentPos = tag.index + tag.length;
              }
            }

            // Step 6: Convert to ProseMirror decorations
            for (const range of ranges) {
              const from = offsetToDocPos(range.from);
              const to = offsetToDocPos(range.to);
              
              if (from < to) {
                decorations.push(Decoration.inline(from, to, { class: range.class }));
              }
            }

            return {
              decorations: DecorationSet.create(doc, decorations),
              annotations,
              annotationsVisible,
            };
          },
        },
        props: {
          decorations(state) {
            const pluginState = this.getState(state);
            return pluginState?.decorations || DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

// Helper to get annotations from editor state
export function getAnnotations(state: any): AnnotationInfo[] {
  const pluginState = geniusFormattingKey.getState(state);
  return pluginState?.annotations || [];
}
