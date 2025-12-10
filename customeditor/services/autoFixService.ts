
// This file is kept for future reference or expansion but simplified 
// as logic has been moved to the Smart Format handler in the component
// to support direct Tiptap transaction manipulation.

export interface Rule {
  id: string;
  find: string | RegExp;
  replace: string;
  description: string;
}

export const COMMON_REPLACEMENTS: Rule[] = [
  {
    id: 'smart_quote_double',
    find: "\"",
    replace: "”",
    description: "Smart double quotes"
  },
  {
    id: 'smart_quote_single',
    find: "'",
    replace: "’",
    description: "Smart single quotes"
  }
];
