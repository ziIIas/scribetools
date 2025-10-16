    function updateButtonState() {
        if (!toggleButton) return;

        // Get current dash settings
        const dashType = autoFixSettings.dashType || 'em';
        const dashTrigger = autoFixSettings.dashTrigger || autoFixSettings.emDashMode || '3';
        const dashChar = dashType === 'em' ? '—' : '–';
        const dashName = dashType === 'em' ? 'Em Dash' : 'En Dash';
        
        // Update the dash character in the button
        const dashText = toggleButton.querySelector('.dash-text');
        if (dashText) {
            dashText.textContent = dashChar;
        }

        if (emDashEnabled && dashTrigger !== 'off') {
            toggleButton.style.backgroundColor = '#1e40af'; // Darker blue (less cyan)
            toggleButton.style.borderColor = '#1e40af';
            toggleButton.style.color = '#fff';
            toggleButton.title = `Toggle ${dashName} Auto-Replace (Currently: ON). Click gear icon for settings.`;
        } else {
            toggleButton.style.backgroundColor = 'transparent';
            toggleButton.style.borderColor = '#000';
            toggleButton.style.color = '#000';
            toggleButton.title = `Toggle ${dashName} Auto-Replace (Currently: OFF). Click gear icon for settings.`;
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

        // Prevent the default dash and insert dash based on settings
        event.preventDefault();
        
        // Get the dash type from settings (em dash or en dash)
        const dashType = autoFixSettings.dashType || 'em';
        const dashChar = dashType === 'em' ? '—' : '–'; // em dash or en dash
        
        if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
            // Handle textarea and input elements
            const start = target.selectionStart;
            const end = target.selectionEnd;
            const value = target.value;
            
            target.value = value.slice(0, start) + dashChar + value.slice(end);
            target.selectionStart = target.selectionEnd = start + 1;
            
            // Trigger input event to notify any listeners
            target.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (target.isContentEditable) {
            // Handle contenteditable elements
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                range.insertNode(document.createTextNode(dashChar));
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
            
            // Always use stored selection positions for accuracy with multiline text
            if (currentSelection.selectionStart !== null && currentSelection.selectionEnd !== null) {
                const selectedIndex = currentSelection.selectionStart;
                const selectedEndIndex = currentSelection.selectionEnd;
                
                // Double-check that the stored positions contain the expected text
                const storedText = value.slice(selectedIndex, selectedEndIndex);
                if (storedText === selectedText) {
                    console.log('Using stored selection positions:', selectedIndex, 'to', selectedEndIndex);
                    
                    const newValue = value.slice(0, selectedIndex) + formattedText + value.slice(selectedEndIndex);
                    activeElement.value = newValue;
                    
                    // Re-select the formatted text to allow for additional formatting
                    const newEndIndex = selectedIndex + formattedText.length;
                    activeElement.selectionStart = selectedIndex;
                    activeElement.selectionEnd = newEndIndex;
                    
                    // Update current selection for potential additional formatting
                    currentSelection.text = formattedText;
                    currentSelection.selectionStart = selectedIndex;
                    currentSelection.selectionEnd = newEndIndex;
                    
                    // Trigger input event
                    activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                    console.log('Text formatted in textarea/input using exact positions, text re-selected');
                } else {
                    console.log('Stored positions contain unexpected text. Expected:', selectedText, 'Found:', storedText);
                    console.log('Selection may have changed since capture. Trying fallback approach...');
                    
                    // Fallback: try to find the text near the stored position
                    const searchStart = Math.max(0, selectedIndex - 50);
                    const searchEnd = Math.min(value.length, selectedEndIndex + 50);
                    const searchArea = value.slice(searchStart, searchEnd);
                    const localIndex = searchArea.indexOf(selectedText);
                    
                    if (localIndex !== -1) {
                        const actualIndex = searchStart + localIndex;
                        console.log('Found text at nearby position:', actualIndex);
                        
                        const newValue = value.slice(0, actualIndex) + formattedText + value.slice(actualIndex + selectedText.length);
                        activeElement.value = newValue;
                        
                        // Re-select the formatted text
                        activeElement.selectionStart = actualIndex;
                        activeElement.selectionEnd = actualIndex + formattedText.length;
                        
                        // Update current selection
                        currentSelection.text = formattedText;
                        currentSelection.selectionStart = actualIndex;
                        currentSelection.selectionEnd = actualIndex + formattedText.length;
                        
                        // Trigger input event
                        activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                        console.log('Text formatted using fallback position search');
                    } else {
                        console.log('Could not locate selected text for formatting');
                    }
                }
            } else {
                console.log('No stored selection positions available - cannot format multiline text accurately');
            }
        } else if (activeElement.isContentEditable) {
            // For contenteditable, try to use the stored range for better multiline support
            try {
                const selection = window.getSelection();
                if (currentSelection.selectionRange) {
                    // Use the stored range for better accuracy with multiline selections
                    const range = currentSelection.selectionRange;
                    range.deleteContents();
                    const textNode = document.createTextNode(formattedText);
                    range.insertNode(textNode);
                    
                    // Re-select the formatted text
                    range.selectNodeContents(textNode);
                    selection.removeAllRanges();
                    selection.addRange(range);
                    
                    // Update current selection
                    currentSelection.text = formattedText;
                    currentSelection.selectionRange = range.cloneRange();
                } else if (selection.rangeCount > 0) {
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
                // Fallback: replace in innerHTML
                try {
                    activeElement.innerHTML = activeElement.innerHTML.replace(selectedText, formattedText);
                    activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                } catch (fallbackError) {
                    console.log('Fallback formatting also failed:', fallbackError);
                }
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

    // Function to handle auto em dash conversion
    function handleAutoEmDashConversion(e) {
        const target = e.target;
        
        // Only work on lyrics editor elements
        const isLyricsEditor = target && target.closest && target.matches &&
                              target.closest('[class*="LyricsEdit"]') && 
                              (target.matches('textarea') || target.isContentEditable);
        
        if (!isLyricsEditor) {
            return;
        }

        let currentContent;
        let cursorPosition;
        
        // Get content and cursor position
        if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
            currentContent = target.value;
            cursorPosition = target.selectionStart;
        } else if (target.isContentEditable) {
            currentContent = target.innerText || target.textContent;
            // For contenteditable, we'll handle cursor position differently
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                cursorPosition = range.startOffset;
            }
        } else {
            return;
        }

        // Check for -- or --- patterns and replace with em dash based on setting
        let newContent = currentContent;
        let replacementMade = false;
        let cursorAdjustment = 0;

        // Get the dash settings (use new settings first, fall back to old for compatibility)
        const dashType = autoFixSettings.dashType || 'em';
        const dashTrigger = autoFixSettings.dashTrigger || autoFixSettings.emDashMode || '3';
        
        // Skip if trigger pattern is set to 'off'
        if (dashTrigger === 'off') {
            return;
        }
        
        // Determine the replacement character
        const dashChar = dashType === 'em' ? '—' : '–'; // em dash or en dash

        if (dashTrigger === '3') {
            // Replace --- (three dashes)
            if (newContent.includes('---')) {
                const beforeReplace = newContent.substring(0, cursorPosition);
                
                // Count replacements before cursor to adjust cursor position
                const beforeMatches = (beforeReplace.match(/---/g) || []).length;
                
                newContent = newContent.replace(/---/g, dashChar);
                replacementMade = true;
                // Each --- becomes dashChar (3 chars become 1, so -2 adjustment per replacement)
                cursorAdjustment = -(beforeMatches * 2);
            }
        } else if (dashTrigger === '2') {
            // Replace -- (two dashes) but avoid replacing if it's part of a longer sequence
            if (newContent.includes('--')) {
                const beforeReplace = newContent.substring(0, cursorPosition);
                
                // Count -- that are not part of --- (we need to be careful here)
                // Replace -- with dashChar but avoid replacing if it's part of a longer sequence
                const beforeMatches = (beforeReplace.match(/(?<!-)--(?!-)/g) || []).length;
                
                newContent = newContent.replace(/(?<!-)--(?!-)/g, dashChar);
                if (beforeMatches > 0) {
                    replacementMade = true;
                    // Each -- becomes dashChar (2 chars become 1, so -1 adjustment per replacement)
                    cursorAdjustment = -(beforeMatches * 1);
                }
            }
        }

        // Apply changes if replacements were made
        if (replacementMade) {
            if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
                target.value = newContent;
                // Restore cursor position
                const newCursorPosition = Math.max(0, cursorPosition + cursorAdjustment);
                target.setSelectionRange(newCursorPosition, newCursorPosition);
            } else if (target.isContentEditable) {
                target.innerText = newContent;
                // For contenteditable, restoring cursor position is more complex
                // We'll just place it at the end for simplicity
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(target);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            }
            
            // Trigger input event to notify any listeners
            const inputEvent = new Event('input', { bubbles: true });
            target.dispatchEvent(inputEvent);
        }
    }

    // Function to handle text selection
    function handleTextSelection() {
