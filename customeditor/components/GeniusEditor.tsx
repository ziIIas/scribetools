import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { GeniusFormatting, setAnnotationsVisible, getAnnotationsVisible, getAnnotations, geniusFormattingKey } from '../extensions/GeniusFormatting';
import { SuggestionPlugin, Suggestion, setSuggestions, getSuggestions, setActiveSuggestion, getActiveSuggestion, getNextSuggestion, removeSuggestion, getSuggestionById } from '../extensions/SuggestionPlugin';
import SuggestionPopup from './SuggestionPopup';

type ParentMessage =
  | { type: 'init'; text?: string; selectionStart?: number; selectionEnd?: number; focus?: boolean; fontSize?: string; lineHeight?: string; fontFamily?: string; editorId?: string }
  | { type: 'set-content'; text: string; editorId?: string }
  | { type: 'set-selection'; selectionStart: number; selectionEnd: number; editorId?: string }
  | { type: 'focus'; editorId?: string }
  | { type: 'set-annotations-visible'; visible: boolean; editorId?: string }
  | { type: 'set-suggestions'; suggestions: Suggestion[]; editorId?: string }
  | { type: 'clear-suggestions'; editorId?: string };

const GeniusEditor: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorId = useMemo(() => window.name || 'scribetools-custom-editor', []);
  const [annotationsVisible, setAnnotationsVisibleState] = useState(true);
  
  // Suggestion state
  const [activeSuggestionData, setActiveSuggestionData] = useState<Suggestion | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const hoverTimeoutRef = useRef<number | null>(null);

  // Show popup for a suggestion
  const showSuggestionPopup = useCallback((suggestion: Suggestion, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setActiveSuggestionData(suggestion);
    setActiveSuggestion(suggestion.id);
    setPopupPosition({
      x: rect.left,
      y: rect.bottom + 6, // 6px below the highlighted text
    });
    setShowPopup(true);
  }, []);

  // Hide popup
  const hidePopup = useCallback(() => {
    setShowPopup(false);
    setActiveSuggestionData(null);
    setActiveSuggestion(null);
    setPopupPosition(null);
  }, []);

  // Handle accepting a suggestion
  const handleAcceptSuggestion = useCallback((suggestion: Suggestion) => {
    // Notify parent about accepted suggestion
    window.parent?.postMessage({
      source: 'scribetools-custom-editor',
      type: 'suggestion-accepted',
      suggestionId: suggestion.id,
      from: suggestion.from,
      to: suggestion.to,
      replacement: suggestion.replacement,
      editorId,
    }, '*');
    
    // Remove from local list
    removeSuggestion(suggestion.id);
    hidePopup();
  }, [editorId, hidePopup]);

  // Handle dismissing a suggestion
  const handleDismissSuggestion = useCallback((suggestion: Suggestion) => {
    // Notify parent about dismissed suggestion
    window.parent?.postMessage({
      source: 'scribetools-custom-editor',
      type: 'suggestion-dismissed',
      suggestionId: suggestion.id,
      editorId,
    }, '*');
    
    // Remove from local list
    removeSuggestion(suggestion.id);
    hidePopup();
  }, [editorId, hidePopup]);

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
      SuggestionPlugin,
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'genius-editor',
        spellcheck: 'false',
      },
      // Handle keyboard events to protect hidden annotations and add formatting shortcuts
      handleKeyDown: (view, event) => {
        const { state } = view;
        const { selection } = state;
        const { from, to } = selection;
        
        // Handle Ctrl+B for bold and Ctrl+I for italic (works regardless of annotation visibility)
        if ((event.ctrlKey || event.metaKey) && (event.key === 'b' || event.key === 'B')) {
          event.preventDefault();
          
          if (from === to) return true; // No selection, do nothing
          
          const selectedText = state.doc.textBetween(from, to);
          let newText: string;
          
          // Check if already bold - toggle off
          if (selectedText.startsWith('<b>') && selectedText.endsWith('</b>')) {
            newText = selectedText.slice(3, -4);
          } else {
            newText = `<b>${selectedText}</b>`;
          }
          
          // Replace selection with new text
          const tr = state.tr.insertText(newText, from, to);
          // Adjust selection to include the new text
          const newTo = from + newText.length;
          tr.setSelection(state.selection.constructor.create(tr.doc, from, newTo));
          view.dispatch(tr);
          return true;
        }
        
        if ((event.ctrlKey || event.metaKey) && (event.key === 'i' || event.key === 'I')) {
          event.preventDefault();
          
          if (from === to) return true; // No selection, do nothing
          
          const selectedText = state.doc.textBetween(from, to);
          let newText: string;
          
          // Check if already italic - toggle off
          if (selectedText.startsWith('<i>') && selectedText.endsWith('</i>')) {
            newText = selectedText.slice(3, -4);
          } else {
            newText = `<i>${selectedText}</i>`;
          }
          
          // Replace selection with new text
          const tr = state.tr.insertText(newText, from, to);
          // Adjust selection to include the new text
          const newTo = from + newText.length;
          tr.setSelection(state.selection.constructor.create(tr.doc, from, newTo));
          view.dispatch(tr);
          return true;
        }
        
        if (annotationsVisible) return false; // Normal behavior when annotations visible
        
        const annotations = getAnnotations(state);
        
        // Check if cursor/selection is in a hidden annotation bracket
        const isInHiddenBracket = (pos: number) => {
          for (const annot of annotations) {
            if ((pos >= annot.start && pos < annot.innerStart) ||
                (pos >= annot.innerEnd && pos < annot.end)) {
              return annot;
            }
          }
          return null;
        };
        
        const fromAnnot = isInHiddenBracket(from);
        const toAnnot = isInHiddenBracket(to);
        
        // Handle backspace
        if (event.key === 'Backspace') {
          // Check if backspace would delete into hidden bracket
          const beforeFrom = from - 1;
          const annotBefore = isInHiddenBracket(beforeFrom);
          if (annotBefore) {
            // Move cursor to before the annotation instead of deleting
            if (from === to) {
              view.dispatch(state.tr.setSelection(
                state.selection.constructor.near(state.doc.resolve(annotBefore.start))
              ));
              return true; // Prevent default
            }
          }
        }
        
        // Handle delete
        if (event.key === 'Delete') {
          const afterTo = to;
          const annotAfter = isInHiddenBracket(afterTo);
          if (annotAfter) {
            // Move cursor to after the annotation instead of deleting
            if (from === to) {
              view.dispatch(state.tr.setSelection(
                state.selection.constructor.near(state.doc.resolve(annotAfter.end))
              ));
              return true; // Prevent default
            }
          }
        }
        
        // Handle arrow keys to skip over hidden annotations
        if (event.key === 'ArrowLeft' && from === to) {
          const prevPos = from - 1;
          for (const annot of annotations) {
            if (prevPos >= annot.start && prevPos < annot.innerStart) {
              // Skip to before the annotation
              view.dispatch(state.tr.setSelection(
                state.selection.constructor.near(state.doc.resolve(annot.start))
              ));
              return true;
            }
            if (prevPos >= annot.innerEnd && prevPos < annot.end) {
              // Skip to innerEnd (before closing bracket)
              view.dispatch(state.tr.setSelection(
                state.selection.constructor.near(state.doc.resolve(annot.innerEnd))
              ));
              return true;
            }
          }
        }
        
        if (event.key === 'ArrowRight' && from === to) {
          const nextPos = to;
          for (const annot of annotations) {
            if (nextPos >= annot.start && nextPos < annot.innerStart) {
              // Skip to innerStart (after opening bracket)
              view.dispatch(state.tr.setSelection(
                state.selection.constructor.near(state.doc.resolve(annot.innerStart))
              ));
              return true;
            }
            if (nextPos >= annot.innerEnd && nextPos < annot.end) {
              // Skip to end (after closing bracket)
              view.dispatch(state.tr.setSelection(
                state.selection.constructor.near(state.doc.resolve(annot.end))
              ));
              return true;
            }
          }
        }
        
        // Prevent typing inside hidden brackets
        if (fromAnnot || toAnnot) {
          // If it's a printable character, prevent it
          if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            return true; // Prevent default
          }
        }
        
        return false;
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
      // Adjust selection to skip hidden annotations
      if (!annotationsVisible) {
        const { state } = editor;
        const { from, to } = state.selection;
        const annotations = getAnnotations(state);
        
        let adjustedFrom = from;
        let adjustedTo = to;
        let needsAdjust = false;
        
        // Check if from is in a hidden bracket
        for (const annot of annotations) {
          if (from >= annot.start && from < annot.innerStart) {
            adjustedFrom = annot.innerStart;
            needsAdjust = true;
          } else if (from >= annot.innerEnd && from < annot.end) {
            adjustedFrom = annot.end;
            needsAdjust = true;
          }
          
          if (to >= annot.start && to < annot.innerStart) {
            adjustedTo = annot.innerStart;
            needsAdjust = true;
          } else if (to >= annot.innerEnd && to < annot.end) {
            adjustedTo = annot.end;
            needsAdjust = true;
          }
        }
        
        if (needsAdjust && (adjustedFrom !== from || adjustedTo !== to)) {
          // Use setTimeout to avoid recursion
          setTimeout(() => {
            editor.commands.setTextSelection({ from: adjustedFrom, to: adjustedTo });
          }, 0);
          return;
        }
      }
      
      postSelectionUpdate(editor);
    },
  });

  // Normalize copy to single newlines and smooth out paste scrolling
  useEffect(() => {
    if (!editor) return;

    const onCopy = (event: ClipboardEvent) => {
      if (!event.clipboardData) return;
      
      const { from, to } = editor.state.selection;
      
      // If there's a selection, copy only the selected text
      if (from !== to) {
        const selectedText = editor.state.doc.textBetween(from, to, '\n');
        event.clipboardData.setData('text/plain', selectedText);
        event.preventDefault();
        return;
      }
      
      // No selection - let default behavior handle it (or copy nothing)
      // Don't prevent default so browser can handle cursor-only copy
    };

    const onCut = (event: ClipboardEvent) => {
      if (!event.clipboardData) return;
      
      const { from, to } = editor.state.selection;
      
      // If there's a selection, cut only the selected text
      if (from !== to) {
        // When annotations are hidden, prevent cutting if selection includes hidden parts
        if (!annotationsVisible) {
          const annotations = getAnnotations(editor.state);
          for (const annot of annotations) {
            // Check if selection includes any hidden bracket parts
            if ((from < annot.innerStart && to > annot.start) ||
                (from < annot.end && to > annot.innerEnd)) {
              // Selection includes hidden parts - don't allow cut
              event.preventDefault();
              return;
            }
          }
        }
        
        const selectedText = editor.state.doc.textBetween(from, to, '\n');
        event.clipboardData.setData('text/plain', selectedText);
        // Delete the selected content
        editor.commands.deleteSelection();
        event.preventDefault();
        return;
      }
      
      // No selection - let default behavior handle it
    };

    const onPaste = () => {
      // After paste, ask parent to center the current selection
      window.parent?.postMessage(
        {
          source: 'scribetools-custom-editor',
          type: 'scroll-to-selection',
          editorId,
        },
        '*',
      );
    };

    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);
    document.addEventListener('paste', onPaste);

    return () => {
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('paste', onPaste);
    };
  }, [editor, editorId, annotationsVisible]);

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
    editor?.commands.setContent(plainTextToDoc(text), { emitUpdate: false });
  };

  const postContentUpdate = (activeEditor: typeof editor | null) => {
    if (!activeEditor) return;
    // Use a single newline between blocks to avoid double-spacing when syncing back
    const text = activeEditor.getText({ blockSeparator: '\n' });
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

  // Handle click and hover on suggestion elements
  useEffect(() => {
    if (!containerRef.current) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const suggestionEl = target.closest('.st-suggestion') as HTMLElement;
      
      if (suggestionEl) {
        const suggestionId = suggestionEl.getAttribute('data-suggestion-id');
        if (suggestionId) {
          const suggestion = getSuggestionById(suggestionId);
          if (suggestion) {
            showSuggestionPopup(suggestion, suggestionEl);
            e.preventDefault();
            e.stopPropagation();
          }
        }
      } else if (!target.closest('.st-suggestion-popup')) {
        // Clicked outside suggestion and popup - hide popup
        hidePopup();
      }
    };

    const handleMouseEnter = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.classList.contains('st-suggestion')) return;
      
      const suggestionId = target.getAttribute('data-suggestion-id');
      if (!suggestionId) return;
      
      // Clear any existing timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      
      // Show popup after a short delay (300ms)
      hoverTimeoutRef.current = window.setTimeout(() => {
        const suggestion = getSuggestionById(suggestionId);
        if (suggestion) {
          showSuggestionPopup(suggestion, target);
        }
      }, 300);
    };

    const handleMouseLeave = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.classList.contains('st-suggestion')) return;
      
      // Clear hover timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
    };

    const container = containerRef.current;
    container.addEventListener('click', handleClick);
    container.addEventListener('mouseenter', handleMouseEnter, true);
    container.addEventListener('mouseleave', handleMouseLeave, true);

    return () => {
      container.removeEventListener('click', handleClick);
      container.removeEventListener('mouseenter', handleMouseEnter, true);
      container.removeEventListener('mouseleave', handleMouseLeave, true);
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, [showSuggestionPopup, hidePopup]);

  // Keyboard navigation for suggestions
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const suggestions = getSuggestions();
      if (suggestions.length === 0) return;

      // Tab - navigate to next suggestion
      if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const currentId = getActiveSuggestion();
        const next = getNextSuggestion(currentId, e.shiftKey ? 'prev' : 'next');
        
        if (next) {
          setActiveSuggestion(next.id);
          setActiveSuggestionData(next);
          
          // Find the suggestion element and show popup
          const suggestionEl = document.querySelector(`[data-suggestion-id="${next.id}"]`) as HTMLElement;
          if (suggestionEl) {
            showSuggestionPopup(next, suggestionEl);
            // Scroll element into view
            suggestionEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          
          // Force re-render decorations
          editor.view.dispatch(editor.state.tr);
        }
        return;
      }

      // Enter - accept active suggestion
      if (e.key === 'Enter' && showPopup && activeSuggestionData) {
        e.preventDefault();
        handleAcceptSuggestion(activeSuggestionData);
        return;
      }

      // Escape - dismiss active suggestion or close popup
      if (e.key === 'Escape') {
        if (showPopup && activeSuggestionData) {
          e.preventDefault();
          handleDismissSuggestion(activeSuggestionData);
        }
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editor, showPopup, activeSuggestionData, showSuggestionPopup, handleAcceptSuggestion, handleDismissSuggestion]);

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

      if (event.data.type === 'set-annotations-visible') {
        const visible = event.data.visible;
        setAnnotationsVisibleState(visible);
        setAnnotationsVisible(visible);
        // Force re-render of decorations
        editor.view.dispatch(editor.state.tr);
      }

      if (event.data.type === 'set-suggestions') {
        const rawSuggestions = (event.data as any).suggestions || [];
        
        // Convert text offsets to ProseMirror doc positions
        // Parent sends plain-text offsets, but ProseMirror needs doc positions
        const mappedSuggestions = rawSuggestions.map((s: Suggestion) => ({
          ...s,
          from: offsetToPos(s.from),
          to: offsetToPos(s.to),
        }));
        
        setSuggestions(mappedSuggestions);
        // Force re-render of decorations to show suggestions
        editor.view.dispatch(editor.state.tr);
      }

      if (event.data.type === 'clear-suggestions') {
        setSuggestions([]);
        hidePopup();
        // Force re-render of decorations
        editor.view.dispatch(editor.state.tr);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [editor, editorId, hidePopup]);

  if (!editor) {
    return null;
  }

  return (
    <div ref={containerRef} className="w-full">
      <EditorContent editor={editor} className="w-full" />
      {showPopup && activeSuggestionData && popupPosition && (
        <SuggestionPopup
          suggestion={activeSuggestionData}
          position={popupPosition}
          onAccept={handleAcceptSuggestion}
          onDismiss={handleDismissSuggestion}
          onClose={hidePopup}
        />
      )}
    </div>
  );
};

export default GeniusEditor;
