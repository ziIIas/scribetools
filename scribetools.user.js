// ==UserScript==
// @name         Genius ScribeTools
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Helpful tools for editing lyrics on Genius
// @author       zilla
// @match        https://genius.com/*
// @match        https://*.genius.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let emDashEnabled = false;
    let toggleButton = null;
    let autoFixButton = null;
    let isInitialized = false;
    let formatPopup = null;
    let currentSelection = null;
    let popupTimeout = null;

    // Function to create the toggle button
    function createToggleButton() {
        const button = document.createElement('button');
        button.innerHTML = '—';
        button.title = 'Toggle Em Dash Auto-Replace (Currently: OFF)';
        button.id = 'genius-emdash-toggle';
        
        // Style to match Genius buttons
        button.className = 'Button__Container-sc-f0320e7a-0 ggiKTY LyricsEdit-desktop__Button-sc-6d8e67d6-4 hvIRPS';
        
        // Additional custom styling to ensure it looks right and flows with the page
        button.style.cssText = `
            margin-bottom: 0.5rem;
            background-color: transparent;
            border: 1px solid #000;
            color: #000;
            font-weight: 400;
            font-family: 'HelveticaNeue', Arial, sans-serif;
            font-size: 1rem;
            line-height: 1.1;
            padding: 0.5rem 1.313rem;
            border-radius: 1.25rem;
            cursor: pointer;
            min-width: auto;
            display: inline-block;
            position: relative;
        `;

        // Add hover effects like Genius buttons
        button.addEventListener('mouseenter', function() {
            // Hover turns black background with white text for both states
            button.style.backgroundColor = '#000';
            button.style.color = '#fff';
        });

        button.addEventListener('mouseleave', function() {
            updateButtonState(); // Reset to proper state colors
        });

        // Toggle functionality
        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            emDashEnabled = !emDashEnabled;
            updateButtonState();
        });

        return button;
    }

    // Function to create the auto fix button
    function createAutoFixButton() {
        const button = document.createElement('button');
        button.innerHTML = 'Auto Fix';
        button.title = 'Auto-fix capitalization, contractions, parentheses formatting, and common errors (i → I, ima/imma → I\'ma, dont → don\'t, <i>(text)</i> → (<i>text</i>), etc.)';
        button.id = 'genius-autofix-button';
        
        // Style to match Genius buttons
        button.className = 'Button__Container-sc-f0320e7a-0 ggiKTY LyricsEdit-desktop__Button-sc-6d8e67d6-4 hvIRPS';
        
        // Additional custom styling to match the em dash button
        button.style.cssText = `
            margin-bottom: 0.5rem;
            margin-left: 0.5rem;
            background-color: transparent;
            border: 1px solid #000;
            color: #000;
            font-weight: 400;
            font-family: 'HelveticaNeue', Arial, sans-serif;
            font-size: 1rem;
            line-height: 1.1;
            padding: 0.5rem 1.313rem;
            border-radius: 1.25rem;
            cursor: pointer;
            min-width: auto;
            display: inline-block;
            position: relative;
        `;

        // Add hover effects like Genius buttons
        button.addEventListener('mouseenter', function() {
            button.style.backgroundColor = '#000';
            button.style.color = '#fff';
        });

        button.addEventListener('mouseleave', function() {
            button.style.backgroundColor = 'transparent';
            button.style.color = '#000';
        });

        // Auto fix functionality
        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            performAutoFix();
        });

        return button;
    }

    // Function to perform auto fix on lyrics text
    function performAutoFix() {
        // Find the active text editor
        const textEditor = document.querySelector('[class*="LyricsEdit"] textarea') ||
                          document.querySelector('[class*="LyricsEdit"] [contenteditable="true"]') ||
                          document.querySelector('textarea') ||
                          document.querySelector('[contenteditable="true"]');

        if (!textEditor) {
            console.log('No text editor found for auto fix');
            return;
        }

        let text;
        if (textEditor.tagName === 'TEXTAREA' || textEditor.tagName === 'INPUT') {
            text = textEditor.value;
        } else if (textEditor.isContentEditable) {
            text = textEditor.innerText || textEditor.textContent;
        }

        if (!text) {
            console.log('No text found to fix');
            return;
        }

        console.log('Original text length:', text.length);

        // Apply auto fixes
        let fixedText = text;

        console.log('Before fixes:', fixedText.substring(0, 100) + '...');

        // Fix "ima", "imma" and "i'mma" to "I'ma" (case insensitive)
        fixedText = fixedText.replace(/\b(i'mma|imma|ima)\b/gi, "I'ma");
        console.log('After ima fixes:', fixedText !== text ? 'CHANGED' : 'NO CHANGE');

        // Fix standalone "i" to "I" when followed by space, dash, punctuation, or end of string
        fixedText = fixedText.replace(/\bi(?=[\s\-\.,!?;:\)\]\}'""]|$)/g, "I");
        console.log('After i fixes:', fixedText.includes(' I ') ? 'FOUND I' : 'NO I FOUND');

        // Fix "i'" contractions to "I'" (i'm, i'll, i've, i'd, etc.)
        fixedText = fixedText.replace(/\bi'/g, "I'");

        // Auto apostrophe fixes for common contractions
        console.log('Starting apostrophe fixes...');
        
        // Basic contractions (most common ones)
        fixedText = fixedText.replace(/\bdont\b/gi, "don't");
        fixedText = fixedText.replace(/\bcant\b/gi, "can't");
        fixedText = fixedText.replace(/\bwont\b/gi, "won't");
        fixedText = fixedText.replace(/\bisnt\b/gi, "isn't");
        fixedText = fixedText.replace(/\bwasnt\b/gi, "wasn't");
        fixedText = fixedText.replace(/\bwerent\b/gi, "weren't");
        fixedText = fixedText.replace(/\barent\b/gi, "aren't");
        fixedText = fixedText.replace(/\bdidnt\b/gi, "didn't");
        fixedText = fixedText.replace(/\bcouldnt\b/gi, "couldn't");
        fixedText = fixedText.replace(/\bwouldnt\b/gi, "wouldn't");
        fixedText = fixedText.replace(/\bshouldnt\b/gi, "shouldn't");
        fixedText = fixedText.replace(/\bhasnt\b/gi, "hasn't");
        fixedText = fixedText.replace(/\bhavent\b/gi, "haven't");
        fixedText = fixedText.replace(/\bhadnt\b/gi, "hadn't");
        
        // "You" contractions
        fixedText = fixedText.replace(/\byoure\b/gi, "you're");
        fixedText = fixedText.replace(/\byoull\b/gi, "you'll");
        fixedText = fixedText.replace(/\byouve\b/gi, "you've");
        fixedText = fixedText.replace(/\byoud\b/gi, "you'd");
        
        // "They" contractions
        fixedText = fixedText.replace(/\btheyre\b/gi, "they're");
        fixedText = fixedText.replace(/\btheyll\b/gi, "they'll");
        fixedText = fixedText.replace(/\btheyve\b/gi, "they've");
        fixedText = fixedText.replace(/\btheyd\b/gi, "they'd");
        
        // "We" contractions (with some context awareness)
        fixedText = fixedText.replace(/\bwere\b(?=\s+(?:going|gonna|not|all|here|there|together|done|made))/gi, "we're");
        fixedText = fixedText.replace(/\bwell\b(?=\s+(?:see|be|go|have|get|do|make|take|come|find))/gi, "we'll");
        fixedText = fixedText.replace(/\bweve\b/gi, "we've");
        fixedText = fixedText.replace(/\bwed\b/gi, "we'd");
        
        // "It" contractions (with context)
        fixedText = fixedText.replace(/\bits\b(?=\s+(?:a|an|the|not|been|going|gonna|time|over|all|really|just|like|so|very))/gi, "it's");
        fixedText = fixedText.replace(/\bitll\b/gi, "it'll");
        fixedText = fixedText.replace(/\bitd\b/gi, "it'd");
        
        // Other common ones
        fixedText = fixedText.replace(/\bthats\b/gi, "that's");
        fixedText = fixedText.replace(/\bwhats\b/gi, "what's");
        fixedText = fixedText.replace(/\bheres\b/gi, "here's");
        fixedText = fixedText.replace(/\btheres\b/gi, "there's");
        fixedText = fixedText.replace(/\bwheres\b/gi, "where's");
        fixedText = fixedText.replace(/\bhes\b(?=\s+(?:a|an|the|not|been|going|gonna|like|so|very|all|really|just))/gi, "he's");
        fixedText = fixedText.replace(/\bshes\b(?=\s+(?:a|an|the|not|been|going|gonna|like|so|very|all|really|just))/gi, "she's");
        
        // Special case: "im" to "I'm" 
        fixedText = fixedText.replace(/\bim\b(?=\s)/gi, "I'm");
        
        console.log('After apostrophe fixes:', fixedText.includes("don't") ? 'FOUND APOSTROPHES' : 'NO APOSTROPHES FOUND');

        // Fix parentheses formatting - move parentheses outside of bold/italic tags
        console.log('Starting parentheses fixes...');
        
        // Handle nested formatting tags first (e.g., <i><b>(content)</b></i>)
        // This handles cases where we have nested tags with parentheses
        fixedText = fixedText.replace(/<(i|b)><(b|i)>([^<]*?(?:\([^)]*\)[^<]*?)*)<\/\2><\/\1>/gi, function(match, outerTag, innerTag, content) {
            if (content.includes('(') && content.includes(')')) {
                console.log('Processing nested formatting block:', match.substring(0, 50) + '...');
                
                // Split content by parentheses and rebuild with both tags
                let result = '';
                let remaining = content;
                
                while (remaining.includes('(') && remaining.includes(')')) {
                    const openIndex = remaining.indexOf('(');
                    const closeIndex = remaining.indexOf(')', openIndex);
                    
                    if (openIndex === -1 || closeIndex === -1) break;
                    
                    // Add text before the parenthesis (if any) with both formatting tags
                    const beforeParen = remaining.substring(0, openIndex);
                    if (beforeParen.trim()) {
                        result += `<${outerTag}><${innerTag}>${beforeParen}</${innerTag}></${outerTag}>`;
                    }
                    
                    // Add the parenthetical content with both formatting tags inside
                    const parenContent = remaining.substring(openIndex + 1, closeIndex);
                    result += `(<${outerTag}><${innerTag}>${parenContent}</${innerTag}></${outerTag}>)`;
                    
                    // Continue with remaining text
                    remaining = remaining.substring(closeIndex + 1);
                }
                
                // Add any remaining text with both formatting tags
                if (remaining.trim()) {
                    result += `<${outerTag}><${innerTag}>${remaining}</${innerTag}></${outerTag}>`;
                }
                
                return result;
            }
            return match; // No parentheses, return unchanged
        });
        
        // Handle complex single-tag multiline cases
        // Pattern: <b> or <i> that contains multiple parenthetical groups
        fixedText = fixedText.replace(/<(b|i)>([^<]*?(?:\([^)]*\)[^<]*?)*)<\/\1>/gi, function(match, tag, content) {
            // If the content contains parentheses, process it
            if (content.includes('(') && content.includes(')')) {
                console.log('Processing single-tag multiline formatting block:', match.substring(0, 50) + '...');
                
                // Split content by parentheses and rebuild
                let result = '';
                let remaining = content;
                
                while (remaining.includes('(') && remaining.includes(')')) {
                    const openIndex = remaining.indexOf('(');
                    const closeIndex = remaining.indexOf(')', openIndex);
                    
                    if (openIndex === -1 || closeIndex === -1) break;
                    
                    // Add text before the parenthesis (if any) with formatting
                    const beforeParen = remaining.substring(0, openIndex);
                    if (beforeParen.trim()) {
                        result += `<${tag}>${beforeParen}</${tag}>`;
                    }
                    
                    // Add the parenthetical content with formatting inside
                    const parenContent = remaining.substring(openIndex + 1, closeIndex);
                    result += `(<${tag}>${parenContent}</${tag}>)`;
                    
                    // Continue with remaining text
                    remaining = remaining.substring(closeIndex + 1);
                }
                
                // Add any remaining text with formatting
                if (remaining.trim()) {
                    result += `<${tag}>${remaining}</${tag}>`;
                }
                
                return result;
            }
            return match; // No parentheses, return unchanged
        });
        
        // Handle simple nested cases: <i><b>(content)</b></i> -> (<i><b>content</b></i>)
        fixedText = fixedText.replace(/<(i|b)><(b|i)>\(([^)]*)\)<\/\2><\/\1>/gi, '(<$1><$2>$3</$2></$1>)');
        
        // Handle simple single parenthetical cases
        // Pattern: <b>(content)</b> or <i>(content)</i> -> (<b>content</b>) or (<i>content</i>)
        fixedText = fixedText.replace(/<(b|i)>\(([^)]*)\)<\/\1>/gi, '(<$1>$2</$1>)');
        
        console.log('After parentheses fixes:', fixedText.includes('(<b>') || fixedText.includes('(<i>') ? 'FOUND FIXED PARENTHESES' : 'NO PARENTHESES FIXES APPLIED');

        console.log('Fixed text length:', fixedText.length);
        console.log('Changes made:', text !== fixedText);

        // Apply the fixed text back to the editor
        if (textEditor.tagName === 'TEXTAREA' || textEditor.tagName === 'INPUT') {
            const cursorPos = textEditor.selectionStart;
            textEditor.value = fixedText;
            
            // Try to maintain cursor position approximately
            const lengthDiff = fixedText.length - text.length;
            textEditor.selectionStart = textEditor.selectionEnd = Math.max(0, cursorPos + lengthDiff);
            
            // Trigger input event
            textEditor.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (textEditor.isContentEditable) {
            const selection = window.getSelection();
            const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
            
            textEditor.textContent = fixedText;
            
            // Try to restore cursor position
            if (range) {
                try {
                    selection.removeAllRanges();
                    selection.addRange(range);
                } catch (e) {
                    // If restoring selection fails, just place cursor at end
                    const newRange = document.createRange();
                    newRange.selectNodeContents(textEditor);
                    newRange.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                }
            }
            
            // Trigger input event
            textEditor.dispatchEvent(new Event('input', { bubbles: true }));
        }

        console.log('Auto fix completed');
        
        // Brief visual feedback
        const originalText = autoFixButton.innerHTML;
        autoFixButton.innerHTML = 'Fixed!';
        autoFixButton.style.backgroundColor = '#10b981';
        autoFixButton.style.borderColor = '#10b981';
        autoFixButton.style.color = '#fff';
        
        setTimeout(() => {
            autoFixButton.innerHTML = originalText;
            autoFixButton.style.backgroundColor = 'transparent';
            autoFixButton.style.borderColor = '#000';
            autoFixButton.style.color = '#000';
        }, 1000);
    }

    // Function to update button appearance based on state
    function updateButtonState() {
        if (!toggleButton) return;

        if (emDashEnabled) {
            toggleButton.style.backgroundColor = '#1e40af'; // Darker blue (less cyan)
            toggleButton.style.borderColor = '#1e40af';
            toggleButton.style.color = '#fff';
            toggleButton.title = 'Toggle Em Dash Auto-Replace (Currently: On)';
            toggleButton.innerHTML = '— On';
        } else {
            toggleButton.style.backgroundColor = 'transparent';
            toggleButton.style.borderColor = '#000';
            toggleButton.style.color = '#000';
            toggleButton.title = 'Toggle Em Dash Auto-Replace (Currently: Off)';
            toggleButton.innerHTML = '— Off';
        }
    }

    // Function to handle keypress events
    function handleKeyPress(event) {
        // Only process if em dash is enabled and it's a dash/hyphen
        if (!emDashEnabled || event.key !== '-') {
            return;
        }

        // Check if we're in a lyrics editing context
        const target = event.target;
        const isInEditor = target.closest('[class*="LyricsEdit"]') || 
                          target.closest('[class*="lyrics-edit"]') ||
                          target.closest('textarea') ||
                          target.closest('[contenteditable="true"]') ||
                          target.matches('textarea') ||
                          target.matches('[contenteditable="true"]');

        if (!isInEditor) {
            return;
        }

        // Prevent the default dash and insert em dash instead
        event.preventDefault();
        
        // Insert em dash
        const emDash = '—';
        
        if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
            // Handle textarea and input elements
            const start = target.selectionStart;
            const end = target.selectionEnd;
            const value = target.value;
            
            target.value = value.slice(0, start) + emDash + value.slice(end);
            target.selectionStart = target.selectionEnd = start + 1;
            
            // Trigger input event to notify any listeners
            target.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (target.isContentEditable) {
            // Handle contenteditable elements
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                range.insertNode(document.createTextNode(emDash));
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
                
                // Trigger input event
                target.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    }

    // Function to create the formatting popup
    function createFormatPopup() {
        const popup = document.createElement('div');
        popup.id = 'genius-format-popup';
        popup.style.cssText = `
            position: absolute;
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            padding: 8px;
            display: none;
            z-index: 10001;
            font-family: 'HelveticaNeue', Arial, sans-serif;
            gap: 8px;
        `;

        // Bold button
        const boldBtn = document.createElement('button');
        boldBtn.innerHTML = '<strong>B</strong>';
        boldBtn.title = 'Bold';
        boldBtn.style.cssText = `
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 6px 10px;
            cursor: pointer;
            font-weight: bold;
            margin-right: 4px;
            transition: all 0.2s ease;
        `;
        
        boldBtn.addEventListener('mouseenter', () => {
            boldBtn.style.backgroundColor = '#f5f5f5';
        });
        
        boldBtn.addEventListener('mouseleave', () => {
            boldBtn.style.backgroundColor = '#fff';
        });

        boldBtn.addEventListener('click', () => formatSelectedText('bold'));

        // Italic button
        const italicBtn = document.createElement('button');
        italicBtn.innerHTML = '<em>I</em>';
        italicBtn.title = 'Italic';
        italicBtn.style.cssText = `
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 6px 10px;
            cursor: pointer;
            font-style: italic;
            transition: all 0.2s ease;
        `;
        
        italicBtn.addEventListener('mouseenter', () => {
            italicBtn.style.backgroundColor = '#f5f5f5';
        });
        
        italicBtn.addEventListener('mouseleave', () => {
            italicBtn.style.backgroundColor = '#fff';
        });

        italicBtn.addEventListener('click', () => formatSelectedText('italic'));

        popup.appendChild(boldBtn);
        popup.appendChild(italicBtn);

        return popup;
    }

    // Function to format selected text
    function formatSelectedText(format) {
        if (!currentSelection || !currentSelection.text) {
            console.log('No current selection available');
            return;
        }

        const selectedText = currentSelection.text;
        const activeElement = currentSelection.activeElement;
        
        console.log('Formatting text:', selectedText, 'as', format);

        // Check if text already has the formatting (toggle functionality)
        let formattedText;
        let isRemoving = false;
        
        if (format === 'bold') {
            if (selectedText.startsWith('<b>') && selectedText.endsWith('</b>')) {
                // Remove bold formatting
                formattedText = selectedText.slice(3, -4); // Remove <b> and </b>
                isRemoving = true;
                console.log('Removing bold formatting');
            } else {
                // Add bold formatting
                formattedText = `<b>${selectedText}</b>`;
                console.log('Adding bold formatting');
            }
        } else if (format === 'italic') {
            if (selectedText.startsWith('<i>') && selectedText.endsWith('</i>')) {
                // Remove italic formatting
                formattedText = selectedText.slice(3, -4); // Remove <i> and </i>
                isRemoving = true;
                console.log('Removing italic formatting');
            } else {
                // Add italic formatting
                formattedText = `<i>${selectedText}</i>`;
                console.log('Adding italic formatting');
            }
        }

        // Handle both contenteditable and textarea elements
        if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
            // Handle textarea/input - use stored selection positions to avoid duplicate text issues
            const value = activeElement.value;
            
            // Use stored selection positions if available, otherwise fall back to indexOf
            let selectedIndex = -1;
            if (currentSelection.selectionStart !== null && currentSelection.selectionEnd !== null) {
                // Verify the stored positions still contain the expected text
                const storedText = value.slice(currentSelection.selectionStart, currentSelection.selectionEnd);
                if (storedText === selectedText) {
                    selectedIndex = currentSelection.selectionStart;
                    console.log('Using stored selection positions:', selectedIndex, 'to', currentSelection.selectionEnd);
                } else {
                    console.log('Stored positions invalid, falling back to indexOf');
                    selectedIndex = value.indexOf(selectedText);
                }
            } else {
                selectedIndex = value.indexOf(selectedText);
            }
            
            if (selectedIndex !== -1) {
                const newValue = value.slice(0, selectedIndex) + formattedText + value.slice(selectedIndex + selectedText.length);
                activeElement.value = newValue;
                
                // Re-select the formatted text to allow for additional formatting
                activeElement.selectionStart = selectedIndex;
                activeElement.selectionEnd = selectedIndex + formattedText.length;
                
                // Update current selection for potential additional formatting
                currentSelection.text = formattedText;
                currentSelection.selectionStart = selectedIndex;
                currentSelection.selectionEnd = selectedIndex + formattedText.length;
                
                // Trigger input event
                activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                console.log('Text formatted in textarea/input, text re-selected');
            } else {
                console.log('Could not find selected text in input value');
            }
        } else if (activeElement.isContentEditable) {
            // For contenteditable, try to use execCommand or innerHTML manipulation
            try {
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    range.deleteContents();
                    const textNode = document.createTextNode(formattedText);
                    range.insertNode(textNode);
                    
                    // Re-select the formatted text
                    range.selectNodeContents(textNode);
                    selection.removeAllRanges();
                    selection.addRange(range);
                    
                    // Update current selection
                    currentSelection.text = formattedText;
                } else {
                    // Fallback: replace in innerHTML
                    activeElement.innerHTML = activeElement.innerHTML.replace(selectedText, formattedText);
                }
                
                // Trigger input event
                activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                console.log('Text formatted in contenteditable, text re-selected');
            } catch (e) {
                console.log('Error formatting contenteditable:', e);
            }
        }

        // Don't hide popup - keep it open for additional formatting
        console.log('Keeping popup open for additional formatting');
    }

    // Function to show the formatting popup
    function showFormatPopup(x, y) {
        console.log('Showing format popup at:', x, y);
        
        if (!formatPopup) {
            console.log('Creating new format popup');
            formatPopup = createFormatPopup();
            document.body.appendChild(formatPopup);
        }

        // Ensure proper positioning
        formatPopup.style.position = 'absolute';
        formatPopup.style.left = x + 'px';
        formatPopup.style.top = y + 'px';
        formatPopup.style.display = 'flex';
        
        console.log('Popup positioned at left:', formatPopup.style.left, 'top:', formatPopup.style.top);
        console.log('Popup should now be visible');
    }

    // Function to hide the formatting popup
    function hideFormatPopup() {
        console.log('Hiding format popup');
        if (formatPopup) {
            formatPopup.style.display = 'none';
        }
        currentSelection = null;
    }

    // Function to handle text selection
    function handleTextSelection() {
        console.log('Text selection event triggered');
        
        // Clear any pending hide timeout
        if (popupTimeout) {
            clearTimeout(popupTimeout);
            popupTimeout = null;
        }
        
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        console.log('Selected text:', selectedText);
        console.log('Selection range count:', selection.rangeCount);
        
        // Check if we have selected text, even if ranges are cleared
        if (selectedText && selectedText.length > 0) {
            const activeElement = document.activeElement;
            console.log('Active element:', activeElement);
            console.log('Active element tag:', activeElement.tagName);
            console.log('Active element classes:', activeElement.className);
            
            const isInEditor = activeElement.closest('[class*="LyricsEdit"]') || 
                              activeElement.closest('[class*="lyrics-edit"]') ||
                              activeElement.matches('textarea') ||
                              activeElement.matches('[contenteditable="true"]') ||
                              activeElement.isContentEditable;

            console.log('Is in editor:', isInEditor);

            if (isInEditor) {
                // Store the selection with position information to handle duplicates
                let selectionStart = null;
                let selectionEnd = null;
                
                if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
                    selectionStart = activeElement.selectionStart;
                    selectionEnd = activeElement.selectionEnd;
                }
                
                currentSelection = {
                    text: selectedText,
                    activeElement: activeElement,
                    selectionStart: selectionStart,
                    selectionEnd: selectionEnd
                };
                
                // Better positioning for textarea elements
                let x, y;
                const elementRect = activeElement.getBoundingClientRect();
                
                if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
                    // For textarea, try to estimate position based on cursor
                    const cursorPosition = activeElement.selectionStart;
                    const text = activeElement.value.substring(0, cursorPosition);
                    const lines = text.split('\n');
                    const currentLine = lines.length - 1;
                    const currentColumn = lines[lines.length - 1].length;
                    
                    // Get computed styles for more accurate measurements
                    const styles = window.getComputedStyle(activeElement);
                    const lineHeight = parseInt(styles.lineHeight) || 20;
                    const fontSize = parseInt(styles.fontSize) || 14;
                    const charWidth = fontSize * 0.6; // approximate character width
                    
                    // Account for padding and scroll
                    const paddingLeft = parseInt(styles.paddingLeft) || 0;
                    const paddingTop = parseInt(styles.paddingTop) || 0;
                    
                    x = elementRect.left + paddingLeft + (currentColumn * charWidth);
                    y = elementRect.top + window.scrollY + paddingTop + (currentLine * lineHeight) + lineHeight + 10;
                    
                    // Bounds checking
                    x = Math.min(x, elementRect.right - 120); // Don't go past right edge
                    x = Math.max(x, elementRect.left + 10); // Don't go past left edge
                    
                    console.log('Using textarea positioning with cursor estimation');
                    console.log('Cursor position:', cursorPosition, 'Line:', currentLine, 'Column:', currentColumn);
                    console.log('LineHeight:', lineHeight, 'CharWidth:', charWidth, 'Padding:', paddingLeft, paddingTop);
                } else if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const rect = range.getBoundingClientRect();
                    console.log('Selection rect:', rect);
                    
                    // Check if rect is valid (not all zeros)
                    if (rect.width > 0 && rect.height > 0) {
                        x = rect.left + (rect.width / 2) - 50;
                        y = rect.top + window.scrollY - 60;
                        console.log('Using selection rect positioning');
                    } else {
                        // Fallback to element positioning
                        x = elementRect.left + 20;
                        y = elementRect.top + window.scrollY - 60;
                        console.log('Selection rect invalid, using element positioning');
                    }
                } else {
                    // Fallback: position near the active element
                    x = elementRect.left + 20;
                    y = elementRect.top + window.scrollY - 60;
                    console.log('Using fallback element positioning');
                }
                
                // Ensure popup is not positioned off-screen
                x = Math.max(10, x);
                y = Math.max(10, y);
                
                console.log('Popup position:', x, y);
                
                showFormatPopup(x, y);
                return;
            } else {
                console.log('Not in editor - hiding popup');
            }
        } else {
            console.log('No selected text - scheduling popup hide');
            // Don't hide immediately, schedule it with a delay
            popupTimeout = setTimeout(() => {
                hideFormatPopup();
            }, 200);
        }
    }

    // Function to add buttons to lyrics editor
    function addButtonToEditor() {
        // Remove any existing buttons first
        const existingToggleButton = document.getElementById('genius-emdash-toggle');
        const existingAutoFixButton = document.getElementById('genius-autofix-button');
        if (existingToggleButton) {
            existingToggleButton.remove();
            console.log('Removed existing em dash button');
        }
        if (existingAutoFixButton) {
            existingAutoFixButton.remove();
            console.log('Removed existing auto fix button');
        }

        // Look for the lyrics editor controls container (try multiple approaches)
        const controlsContainer = document.querySelector('.LyricsEdit-desktop__Controls-sc-6d8e67d6-3') ||
                                 document.querySelector('[class*="LyricsEdit-desktop__Controls"]') ||
                                 document.querySelector('[class*="LyricsEdit"][class*="Controls"]') ||
                                 document.querySelector('[class*="lyrics-edit"][class*="controls"]') ||
                                 document.querySelector('.ihioQH'); // backup class name from the HTML

        if (controlsContainer) {
            console.log('Found controls container:', controlsContainer);
            
            // Create both buttons
            toggleButton = createToggleButton();
            autoFixButton = createAutoFixButton();
            
            // Create a container div for our buttons to keep them together
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                display: flex;
                align-items: center;
                margin-bottom: 0.5rem;
            `;
            buttonContainer.appendChild(toggleButton);
            buttonContainer.appendChild(autoFixButton);
            
            // Look for the "How to Format Lyrics" section to insert before it
            const formatExplainer = controlsContainer.querySelector('[class*="LyricsEdit-desktop__Explainer"]') ||
                                   controlsContainer.querySelector('[class*="Explainer"]') ||
                                   controlsContainer.querySelector('*:last-child');
            
            if (formatExplainer && formatExplainer.textContent && formatExplainer.textContent.includes('Format')) {
                // Insert before the explainer (above "How to Format Lyrics:")
                controlsContainer.insertBefore(buttonContainer, formatExplainer);
                console.log('Inserted buttons before format explainer');
            } else {
                // Fallback: append to the container
                controlsContainer.appendChild(buttonContainer);
                console.log('Appended buttons to controls container');
            }
            
            updateButtonState();
            console.log('Genius Em Dash Toggle and Auto Fix buttons added to editor');
            return true;
        } else {
            console.log('Controls container not found');
        }
        return false;
    }

    // Function to initialize the userscript
    function init() {
        // Only run on Genius pages
        if (!window.location.hostname.includes('genius.com') || isInitialized) {
            return;
        }

        // Add global event listeners (only once)
        document.addEventListener('keypress', handleKeyPress);
        document.addEventListener('selectionchange', handleTextSelection);
        document.addEventListener('mouseup', () => {
            // Add a small delay to allow selection to stabilize
            setTimeout(handleTextSelection, 10);
        });
        document.addEventListener('click', (e) => {
            // Only hide popup if clicking outside of it and not selecting text
            if (formatPopup && !formatPopup.contains(e.target)) {
                // Add a small delay to allow for text selection to complete
                setTimeout(() => {
                    const selection = window.getSelection();
                    const selectedText = selection.toString().trim();
                    // Only hide if no text is currently selected
                    if (!selectedText || selectedText.length === 0) {
                        hideFormatPopup();
                    }
                }, 50);
            }
        });
        
        console.log('Event listeners added for text formatting');
        isInitialized = true;

        // Try to add button to editor if it exists
        const buttonAdded = addButtonToEditor();
        
        // If that failed, try multiple fallback searches
        if (!buttonAdded) {
            setTimeout(() => {
                console.log('Retrying button placement with broader search...');
                
                // Try multiple possible containers with more specific selectors
                let targetContainer = document.querySelector('.LyricsEdit-desktop__Controls-sc-6d8e67d6-3') ||
                                    document.querySelector('.ihioQH') ||
                                    document.querySelector('[class*="LyricsEdit-desktop__Controls"]') ||
                                    document.querySelector('[class*="LyricsEdit"][class*="Controls"]');
                
                // If still not found, look for any element that contains buttons (likely a controls area)
                if (!targetContainer) {
                    const allContainers = document.querySelectorAll('div');
                    for (let container of allContainers) {
                        if (container.querySelector('button') && container.textContent.includes('Cancel')) {
                            targetContainer = container;
                            console.log('Found container with Cancel button');
                            break;
                        }
                    }
                }
                
                console.log('Fallback container found:', targetContainer);
                
                if (targetContainer) {
                    // Remove any existing buttons
                    const existingToggle = document.getElementById('genius-emdash-toggle');
                    const existingAutoFix = document.getElementById('genius-autofix-button');
                    if (existingToggle) existingToggle.remove();
                    if (existingAutoFix) existingAutoFix.remove();
                    
                    // Create both buttons
                    toggleButton = createToggleButton();
                    autoFixButton = createAutoFixButton();
                    
                    // Create container for buttons
                    const buttonContainer = document.createElement('div');
                    buttonContainer.style.cssText = `
                        display: flex;
                        align-items: center;
                        margin-bottom: 0.5rem;
                    `;
                    buttonContainer.appendChild(toggleButton);
                    buttonContainer.appendChild(autoFixButton);
                    
                    // Try to insert at the top of the container
                    if (targetContainer.firstChild) {
                        targetContainer.insertBefore(buttonContainer, targetContainer.firstChild);
                    } else {
                        targetContainer.appendChild(buttonContainer);
                    }
                    
                    updateButtonState();
                    console.log('Buttons added with fallback method to:', targetContainer.className || 'unnamed container');
                } else {
                    console.log('No suitable container found for buttons');
                }
            }, 500);
        }

        console.log('Genius Em Dash Toggle initialized');
    }

    // Function to handle dynamic content loading (for SPAs)
    function observePageChanges() {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList') {
                    // Check if lyrics editing elements were added
                    const addedNodes = Array.from(mutation.addedNodes);
                    const hasLyricsEditor = addedNodes.some(node => 
                        node.nodeType === 1 && (
                            node.querySelector && (
                                node.querySelector('[class*="LyricsEdit"]') ||
                                node.querySelector('[class*="lyrics-edit"]')
                            )
                        )
                    );

                    // Only try to add buttons if editor appeared and we don't already have them
                    if (hasLyricsEditor && !document.getElementById('genius-emdash-toggle')) {
                        // Small delay to ensure the editor is fully rendered
                        setTimeout(addButtonToEditor, 100);
                    }
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Also observe for dynamic content
    observePageChanges();

})();
