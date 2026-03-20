import React from 'react';
import { Suggestion } from '../extensions/SuggestionPlugin';

interface SuggestionPopupProps {
  suggestion: Suggestion;
  position: { x: number; y: number };
  onAccept: (suggestion: Suggestion) => void;
  onDismiss: (suggestion: Suggestion) => void;
  onClose: () => void;
}

const SuggestionPopup: React.FC<SuggestionPopupProps> = ({
  suggestion,
  position,
  onAccept,
  onDismiss,
  onClose,
}) => {
  // Handle click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Escape HTML for safe display
  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  };

  return (
    <div
      className="st-suggestion-popup"
      style={{
        left: position.x,
        top: position.y,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="st-suggestion-popup-header">
        Suggested Fix
      </div>
      
      <div className="st-suggestion-change">
        <span 
          className="st-suggestion-original"
          dangerouslySetInnerHTML={{ __html: escapeHtml(suggestion.original) }}
        />
        <span className="st-suggestion-arrow">→</span>
        <span 
          className="st-suggestion-replacement"
          dangerouslySetInnerHTML={{ __html: escapeHtml(suggestion.replacement) }}
        />
      </div>
      
      {suggestion.ruleDescription && (
        <div className="st-suggestion-rule">
          Rule: {suggestion.ruleDescription}
        </div>
      )}
      
      <div className="st-suggestion-buttons">
        <button
          className="st-suggestion-btn st-suggestion-btn-accept"
          onClick={() => onAccept(suggestion)}
        >
          Accept
        </button>
        <button
          className="st-suggestion-btn st-suggestion-btn-dismiss"
          onClick={() => onDismiss(suggestion)}
        >
          Dismiss
        </button>
      </div>
      
      <div className="st-suggestion-hint">
        Tab to navigate • Enter to accept • Esc to dismiss
      </div>
    </div>
  );
};

export default SuggestionPopup;
