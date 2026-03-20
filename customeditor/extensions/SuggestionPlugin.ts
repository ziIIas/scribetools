import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// Suggestion interface
export interface Suggestion {
  id: string;
  from: number;      // Doc position start
  to: number;        // Doc position end
  original: string;
  replacement: string;
  ruleDescription: string;
  ruleId: string;
}

// Plugin state interface
interface SuggestionPluginState {
  decorations: DecorationSet;
  suggestions: Suggestion[];
  activeSuggestionId: string | null;
}

// Plugin key for accessing suggestion data
export const suggestionPluginKey = new PluginKey<SuggestionPluginState>('suggestion-plugin');

// Storage for suggestions (shared between plugin instances)
let currentSuggestions: Suggestion[] = [];
let activeSuggestionId: string | null = null;

// Set suggestions from parent
export function setSuggestions(suggestions: Suggestion[]) {
  currentSuggestions = suggestions;
}

// Get current suggestions
export function getSuggestions(): Suggestion[] {
  return currentSuggestions;
}

// Set active suggestion (for keyboard navigation)
export function setActiveSuggestion(id: string | null) {
  activeSuggestionId = id;
}

// Get active suggestion
export function getActiveSuggestion(): string | null {
  return activeSuggestionId;
}

// Remove a suggestion by id
export function removeSuggestion(id: string) {
  currentSuggestions = currentSuggestions.filter(s => s.id !== id);
}

// Get suggestion by id
export function getSuggestionById(id: string): Suggestion | undefined {
  return currentSuggestions.find(s => s.id === id);
}

// Get next/previous suggestion for keyboard navigation
export function getNextSuggestion(currentId: string | null, direction: 'next' | 'prev'): Suggestion | null {
  if (currentSuggestions.length === 0) return null;
  
  if (!currentId) {
    return direction === 'next' ? currentSuggestions[0] : currentSuggestions[currentSuggestions.length - 1];
  }
  
  const currentIndex = currentSuggestions.findIndex(s => s.id === currentId);
  if (currentIndex === -1) {
    return currentSuggestions[0];
  }
  
  if (direction === 'next') {
    return currentSuggestions[(currentIndex + 1) % currentSuggestions.length];
  } else {
    return currentSuggestions[(currentIndex - 1 + currentSuggestions.length) % currentSuggestions.length];
  }
}

export const SuggestionPlugin = Extension.create({
  name: 'suggestionPlugin',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: suggestionPluginKey,
        state: {
          init() {
            return {
              decorations: DecorationSet.empty,
              suggestions: [],
              activeSuggestionId: null,
            };
          },
          apply(tr, old) {
            const suggestions = currentSuggestions;
            const decorations: Decoration[] = [];

            // Create decorations for each suggestion
            for (const suggestion of suggestions) {
              // Validate positions are within document bounds
              const docSize = tr.doc.content.size;
              if (suggestion.from < 0 || suggestion.to > docSize || suggestion.from >= suggestion.to) {
                continue;
              }

              const isActive = suggestion.id === activeSuggestionId;
              
              decorations.push(
                Decoration.inline(suggestion.from, suggestion.to, {
                  class: isActive ? 'st-suggestion st-suggestion-active' : 'st-suggestion',
                  'data-suggestion-id': suggestion.id,
                })
              );
            }

            return {
              decorations: DecorationSet.create(tr.doc, decorations),
              suggestions,
              activeSuggestionId,
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
