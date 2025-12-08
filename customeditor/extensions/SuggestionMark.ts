
import { Mark, mergeAttributes } from '@tiptap/core';

export interface SuggestionAttributes {
  id: string;
  original: string;
  replacement: string;
  ruleId: string;
  description?: string;
  status: 'pending' | 'accepted' | 'rejected';
}

/*
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    suggestion: {
      setSuggestion: (attributes: any) => ReturnType;
      acceptSuggestion: (id: string) => ReturnType;
      rejectSuggestion: (id: string) => ReturnType;
    }
  }
}
*/

export const SuggestionMark = Mark.create({
  name: 'suggestion',

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'suggestion-highlight',
      },
    };
  },

  addAttributes() {
    return {
      id: {
        default: null,
      },
      original: {
        default: null,
      },
      replacement: {
        default: null,
      },
      ruleId: {
        default: null,
      },
      description: {
        default: null,
      },
      status: {
        default: 'pending',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-suggestion]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-suggestion': '' }), 0];
  },

  addCommands() {
    return {
      setSuggestion:
        (attributes: any) =>
        ({ commands }: any) => {
          return commands.setMark(this.name, attributes);
        },
      
      acceptSuggestion:
        (id: string) =>
        ({ tr, state, dispatch }: any) => {
          if (dispatch) {
            const { doc } = state;
            let applied = false;
            
            doc.descendants((node: any, pos: number) => {
              if (applied) return false;
              if (!node.marks) return true;
              
              const marks = node.marks.filter((m: any) => m.type.name === this.name && m.attrs.id === id);
              
              if (marks.length > 0) {
                const mark = marks[0];
                const replacement = mark.attrs.replacement;
                
                // Replace the content
                if (replacement !== null) {
                    tr.insertText(replacement, pos, pos + node.nodeSize);
                }
                applied = true; 
              }
              return true;
            });
          }
          return true;
        },

      rejectSuggestion:
        (id: string) =>
        ({ tr, state, dispatch }: any) => {
          if (dispatch) {
            const { doc } = state;
            
            doc.descendants((node: any, pos: number) => {
              if (!node.marks) return true;
              const mark = node.marks.find((m: any) => m.type.name === this.name && m.attrs.id === id);
              if (mark) {
                tr.removeMark(pos, pos + node.nodeSize, mark.type);
              }
              return true;
            });
          }
          return true;
        },
    };
  },
});
