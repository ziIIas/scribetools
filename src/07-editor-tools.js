    // Common button styling constants
    const BUTTON_STYLES = {
        base: {
            margin: '0',
            padding: '0.375rem 0.75rem',
            backgroundColor: 'transparent',
            border: '1px solid #ccc',
            borderRadius: '0.25rem',
            color: '#666',
            fontWeight: '400',
            fontFamily: "'HelveticaNeue', Arial, sans-serif",
            fontSize: '0.875rem',
            lineHeight: '1.1',
            cursor: 'pointer',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none',
            outline: 'none',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            overflow: 'hidden'
        },
        container: {
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            border: '1px solid #ccc',
            borderRadius: '0.25rem',
            overflow: 'hidden',
            backgroundColor: '#fff'
        },
        innerButton: {
            padding: '0.375rem 0.5rem',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 'bold',
            color: '#666',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '0'
        }
    };

    // Function to create the zero-width space button
    function createZeroWidthSpaceButton() {
        const button = document.createElement('button');
        button.innerHTML = 'Zero-Width Space';
        button.title = 'Copy a zero-width space (​) to clipboard - useful for spacing fixes';
        button.id = 'genius-zws-button';
        button.type = 'button';
        
        // Track timeout to prevent multiple overlapping feedback
        let feedbackTimeout = null;
        
        // Style to match Genius small buttons (like Edit Metadata button) - get classes dynamically
        const smallButtonClasses = getGeniusSmallButtonClasses();
        button.className = `${smallButtonClasses.container} ${smallButtonClasses.styles}`;
        
        // Apply base button styles
        Object.assign(button.style, BUTTON_STYLES.base, {
            marginBottom: '0.5rem',
            minWidth: 'auto',
            maxWidth: '200px',
            display: 'inline-block',
            position: 'relative',
            flexShrink: '1'
        });

        // Add CSS with forced background override and consistent styling
        const style = document.createElement('style');
        style.textContent = `
            #genius-zws-button {
                user-select: none !important;
                -webkit-user-select: none !important;
                -moz-user-select: none !important;
                -ms-user-select: none !important;
                background-color: transparent !important;
                background: transparent !important;
            }
            #genius-zws-button:not(.genius-copied-state):hover {
                background-color: #f5f5f5 !important;
                background: #f5f5f5 !important;
                border-color: #ccc !important;
            }
            #genius-zws-button.genius-copied-state {
                background-color: #10b981 !important;
                background: #10b981 !important;
                border-color: #10b981 !important;
            }
        `;
        document.head.appendChild(style);
        
        // Prevent selection with events
        button.onselectstart = function() { return false; };
        button.onmousedown = function(e) { 
            if (e.detail > 1) { // Prevent multiple clicks
                e.preventDefault();
                return false;
            }
        };

        // Copy zero-width space to clipboard
        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Prevent multiple clicks during feedback
            if (feedbackTimeout) {
                return;
            }
            
            const zeroWidthSpace = '​'; // This is U+200B zero-width space
            
            // Try to copy to clipboard
            try {
                navigator.clipboard.writeText(zeroWidthSpace).then(() => {
                    // Success feedback with timer
                    const originalText = button.innerHTML;
                    const originalBgColor = button.style.backgroundColor;
                    const originalBorderColor = button.style.borderColor;
                    const originalTextColor = button.style.color;
                    
                    button.innerHTML = 'Copied!';
                    button.classList.add('genius-copied-state');
                    button.style.borderColor = '#10b981';
                    button.style.color = '#fff';
                    
                    feedbackTimeout = setTimeout(() => {
                        button.innerHTML = originalText;
                        button.classList.remove('genius-copied-state');
                        button.style.borderColor = originalBorderColor;
                        button.style.color = originalTextColor;
                        feedbackTimeout = null;
                    }, 2000);
                }).catch(() => {
                    // Fallback method
                    fallbackCopyToClipboard(zeroWidthSpace, button, feedbackTimeout);
                });
            } catch (e) {
                // Fallback method
                fallbackCopyToClipboard(zeroWidthSpace, button, feedbackTimeout);
            }
        });

        return button;
    }

    // Fallback clipboard copy method
    function fallbackCopyToClipboard(text, button, feedbackTimeoutRef = null) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            // Success feedback with timer
            const originalText = button.innerHTML;
            const originalBgColor = button.style.backgroundColor;
            const originalBorderColor = button.style.borderColor;
            const originalTextColor = button.style.color;
            
            button.innerHTML = 'Copied!';
            button.classList.add('genius-copied-state');
            button.style.borderColor = '#10b981';
            button.style.color = '#fff';
            
            if (feedbackTimeoutRef) {
                feedbackTimeoutRef = setTimeout(() => {
                    button.innerHTML = originalText;
                    button.classList.remove('genius-copied-state');
                    button.style.borderColor = originalBorderColor;
                    button.style.color = originalTextColor;
                    feedbackTimeoutRef = null;
                }, 2000);
            } else {
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.classList.remove('genius-copied-state');
                    button.style.borderColor = originalBorderColor;
                    button.style.color = originalTextColor;
                }, 2000);
            }
        } catch (e) {
            // Error feedback
            button.innerHTML = 'Copy Failed';
            if (feedbackTimeoutRef) {
                feedbackTimeoutRef = setTimeout(() => {
                    button.innerHTML = 'Zero-Width Space';
                    feedbackTimeoutRef = null;
                }, 2000);
            } else {
                setTimeout(() => {
                    button.innerHTML = 'Zero-Width Space';
                }, 2000);
            }
        }
        
        document.body.removeChild(textArea);
    }

    // Global variable to store the last find/replace operation for undo
    let lastFindReplaceOperation = null;

    // Function to create inline find and replace container
    function createFindReplaceContainer() {
        const container = document.createElement('div');
        container.id = 'genius-find-replace-container';
        container.style.cssText = `
            margin-bottom: 0.5rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-family: 'HelveticaNeue', Arial, sans-serif;
            font-size: 0.875rem;
        `;

        // Combined find/replace input container
        const inputContainer = document.createElement('div');
        Object.assign(inputContainer.style, BUTTON_STYLES.container, {
            flexShrink: '1',
            minWidth: '180px'
        });

        // Find input
        const findInput = document.createElement('input');
        findInput.type = 'text';
        findInput.id = 'genius-find-input';
        findInput.placeholder = 'Find';
        findInput.style.cssText = `
            padding: 0.375rem 0.5rem;
            border: none;
            font-size: 0.875rem;
            flex: 1;
            min-width: 60px;
            max-width: 120px;
            font-family: 'HelveticaNeue', Arial, sans-serif;
            outline: none;
        `;

        // Divider
        const divider = document.createElement('div');
        divider.style.cssText = `
            width: 1px;
            background-color: #ccc;
            height: 100%;
        `;

        // Replace input
        const replaceInput = document.createElement('input');
        replaceInput.type = 'text';
        replaceInput.id = 'genius-replace-input';
        replaceInput.placeholder = 'Replace';
        replaceInput.style.cssText = `
            padding: 0.375rem 0.5rem;
            border: none;
            font-size: 0.875rem;
            flex: 1;
            min-width: 60px;
            max-width: 120px;
            font-family: 'HelveticaNeue', Arial, sans-serif;
            outline: none;
        `;

        // Divider 2 (before check button)
        const divider2 = document.createElement('div');
        divider2.style.cssText = `
            width: 1px;
            background-color: #ccc;
            height: 100%;
        `;

        // Check/Execute button
        const executeButton = document.createElement('button');
        executeButton.innerHTML = '✓';
        executeButton.type = 'button';
        executeButton.title = 'Replace all occurrences';
        Object.assign(executeButton.style, BUTTON_STYLES.innerButton);

        executeButton.addEventListener('mouseenter', function() {
            executeButton.style.backgroundColor = '#f5f5f5';
        });

        executeButton.addEventListener('mouseleave', function() {
            executeButton.style.backgroundColor = 'transparent';
        });

        executeButton.addEventListener('click', function() {
            performReplace();
        });

        inputContainer.appendChild(findInput);
        inputContainer.appendChild(divider);
        inputContainer.appendChild(replaceInput);
        inputContainer.appendChild(divider2);
        inputContainer.appendChild(executeButton);

        // Combined undo/case sensitive button container
        const buttonContainer = document.createElement('div');
        Object.assign(buttonContainer.style, BUTTON_STYLES.container, {
            flexShrink: '0',
            minWidth: '56px'
        });

        // Undo button (left side)
        const undoButton = document.createElement('button');
        undoButton.innerHTML = '↺';
        undoButton.type = 'button';
        undoButton.id = 'genius-undo-replace-button';
        undoButton.title = 'Undo last replace operation';
        undoButton.disabled = true;
        Object.assign(undoButton.style, BUTTON_STYLES.innerButton, {
            color: '#999',
            cursor: 'not-allowed',
            opacity: '0.6'
        });

        // Button divider
        const buttonDivider = document.createElement('div');
        buttonDivider.style.cssText = `
            width: 1px;
            background-color: #ccc;
            height: 100%;
        `;

        // Case sensitive button (right side)
        const caseSensitiveButton = document.createElement('button');
        caseSensitiveButton.innerHTML = 'Aa';
        caseSensitiveButton.type = 'button';
        caseSensitiveButton.id = 'genius-case-sensitive';
        caseSensitiveButton.title = 'Toggle case sensitive search';
        Object.assign(caseSensitiveButton.style, BUTTON_STYLES.innerButton, {
            fontSize: '0.75rem'
        });

        let caseSensitive = false;
        caseSensitiveButton.addEventListener('click', function() {
            caseSensitive = !caseSensitive;
            if (caseSensitive) {
                caseSensitiveButton.style.backgroundColor = '#000';
                caseSensitiveButton.style.color = '#fff';
                caseSensitiveButton.style.borderRadius = '0.25rem 0 0 0.25rem'; // Only round left side
                caseSensitiveButton.style.height = '32px'; // Fill full container height
                caseSensitiveButton.style.padding = '0 0.5rem'; // Remove top/bottom padding
            } else {
                caseSensitiveButton.style.backgroundColor = 'transparent';
                caseSensitiveButton.style.color = '#666';
                caseSensitiveButton.style.borderRadius = '0';
                caseSensitiveButton.style.height = '28px'; // Reset to original height
                caseSensitiveButton.style.padding = '0.375rem 0.5rem'; // Reset to original padding
            }
        });

        undoButton.addEventListener('click', function() {
            if (!undoButton.disabled) {
                undoFindReplace();
            }
        });

        buttonContainer.appendChild(caseSensitiveButton);
        buttonContainer.appendChild(buttonDivider);
        buttonContainer.appendChild(undoButton);

        container.appendChild(inputContainer);
        container.appendChild(buttonContainer);

        // Auto-replace functionality when typing
        function performReplace() {
            const findText = findInput.value.trim();
            const replaceText = replaceInput.value;
            
            if (findText) {
                performFindReplaceAll(findText, replaceText, caseSensitive);
            }
        }

        // Handle Enter key in inputs to trigger replace
        [findInput, replaceInput].forEach(input => {
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    performReplace();
                }
            });
        });

        return container;
    }

    // Function to perform find and replace all
    function performFindReplaceAll(findText, replaceText, caseSensitive = false) {
        // Find the active text editor
        const textEditor = document.querySelector('[class*="LyricsEdit"] textarea') ||
                          document.querySelector('[class*="LyricsEdit"] [contenteditable="true"]') ||
                          document.querySelector('textarea') ||
                          document.querySelector('[contenteditable="true"]');

        if (!textEditor) {
            alert('No text editor found');
            return;
        }

        let originalContent;
        if (textEditor.tagName === 'TEXTAREA' || textEditor.tagName === 'INPUT') {
            originalContent = textEditor.value;
        } else if (textEditor.isContentEditable) {
            originalContent = textEditor.innerText || textEditor.textContent;
        }

        if (!originalContent) {
            alert('No content to search');
            return;
        }

        // Perform the replacement
        let newContent;
        let replacementCount = 0;
        
        if (caseSensitive) {
            // Case sensitive replacement
            const regex = new RegExp(escapeRegex(findText), 'g');
            newContent = originalContent.replace(regex, (match) => {
                replacementCount++;
                return replaceText;
            });
        } else {
            // Case insensitive replacement
            const regex = new RegExp(escapeRegex(findText), 'gi');
            newContent = originalContent.replace(regex, (match) => {
                replacementCount++;
                return replaceText;
            });
        }

        if (replacementCount === 0) {
            alert(`No occurrences of "${findText}" found`);
            return;
        }

        // Store the operation for undo
        lastFindReplaceOperation = {
            originalContent: originalContent,
            findText: findText,
            replaceText: replaceText,
            caseSensitive: caseSensitive,
            replacementCount: replacementCount,
            editor: textEditor
        };

        // Apply the changes
        if (textEditor.tagName === 'TEXTAREA' || textEditor.tagName === 'INPUT') {
            textEditor.value = newContent;
        } else if (textEditor.isContentEditable) {
            textEditor.innerText = newContent;
        }

        // Trigger input event to notify any listeners
        const inputEvent = new Event('input', { bubbles: true });
        textEditor.dispatchEvent(inputEvent);

        // Enable undo button
        const undoButton = document.getElementById('genius-undo-replace-button');
        if (undoButton) {
            undoButton.disabled = false;
            undoButton.style.color = '#666';
            undoButton.style.cursor = 'pointer';
            undoButton.style.opacity = '1';
            undoButton.style.backgroundColor = 'transparent';
            undoButton.style.borderColor = '#666';
            
            undoButton.addEventListener('mouseenter', function() {
                if (!undoButton.disabled) {
                    undoButton.style.backgroundColor = '#f5f5f5';
                    undoButton.style.borderColor = '#999';
                }
            });

            undoButton.addEventListener('mouseleave', function() {
                if (!undoButton.disabled) {
                    undoButton.style.backgroundColor = 'transparent';
                    undoButton.style.borderColor = '#666';
                }
            });
        }

        alert(`Replaced ${replacementCount} occurrence${replacementCount === 1 ? '' : 's'} of "${findText}" with "${replaceText}"`);
    }

    // Function to undo the last find and replace operation
    function undoFindReplace() {
        if (!lastFindReplaceOperation) {
            alert('No find and replace operation to undo');
            return;
        }

        const { originalContent, editor, findText, replaceText, replacementCount } = lastFindReplaceOperation;

        // Restore original content
        if (editor.tagName === 'TEXTAREA' || editor.tagName === 'INPUT') {
            editor.value = originalContent;
        } else if (editor.isContentEditable) {
            editor.innerText = originalContent;
        }

        // Trigger input event to notify any listeners
        const inputEvent = new Event('input', { bubbles: true });
        editor.dispatchEvent(inputEvent);

        // Disable undo button
        const undoButton = document.getElementById('genius-undo-replace-button');
        if (undoButton) {
            undoButton.disabled = true;
            undoButton.style.color = '#999';
            undoButton.style.cursor = 'not-allowed';
            undoButton.style.opacity = '0.6';
            undoButton.style.backgroundColor = 'transparent';
            undoButton.style.borderColor = '#ccc';
        }

        // Clear the last operation
        lastFindReplaceOperation = null;

        alert(`Undid replacement of ${replacementCount} occurrence${replacementCount === 1 ? '' : 's'} of "${findText}" with "${replaceText}"`);
    }

    // Helper function to escape regex special characters
    function escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Function to create the combined auto fix + settings button
    function createAutoFixButton() {
        const button = document.createElement('button');
        button.innerHTML = `
            <span class="autofix-text" style="margin-right: 0.5rem;">Auto Fix</span>
            <span class="settings-icon" style="opacity: 0.7; transition: opacity 0.2s;">
                <svg class="svg-icon" style="width: 1em; height: 1em;vertical-align: middle;fill: currentColor;overflow: hidden;" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg">
                    <path d="M512 661.994667q61.994667 0 106.005333-44.010667t44.010667-106.005333-44.010667-106.005333-106.005333-44.010667-106.005333 44.010667-44.010667 106.005333 44.010667 106.005333 106.005333 44.010667zM829.994667 554.005333l90.005333 69.994667q13.994667 10.005333 4.010667 28.010667l-85.994667 148.010667q-8 13.994667-26.005333 8l-106.005333-42.005333q-42.005333 29.994667-72 42.005333l-16 112q-4.010667 18.005333-20.010667 18.005333l-172.010667 0q-16 0-20.010667-18.005333l-16-112q-37.994667-16-72-42.005333l-106.005333 42.005333q-18.005333 5.994667-26.005333-8l-85.994667-148.010667q-10.005333-18.005333 4.010667-28.010667l90.005333-69.994667q-2.005333-13.994667-2.005333-42.005333t2.005333-42.005333l-90.005333-69.994667q-13.994667-10.005333-4.010667-28.010667l85.994667-148.010667q8-13.994667 26.005333-8l106.005333 42.005333q42.005333-29.994667 72-42.005333l16-112q4.010667-18.005333 20.010667-18.005333l172.010667 0q16 0 20.010667 18.005333l16 112q37.994667 16 72 42.005333l106.005333-42.005333q18.005333-5.994667 26.005333 8l85.994667 148.010667q10.005333 18.005333-4.010667 28.010667l-90.005333 69.994667q2.005333 13.994667 2.005333 42.005333t-2.005333 42.005333z" />
                </svg>
            </span>
        `;
        button.title = 'Auto-fix capitalization, contractions, parentheses formatting, bracket matching, and common errors. Click gear icon for settings.';
        button.id = 'genius-autofix-button';
        
        // Style to match Genius buttons - get classes dynamically
        const buttonClasses = getGeniusButtonClasses();
        button.className = `${buttonClasses.container} ${buttonClasses.styles} ${buttonClasses.lyricsEdit}`;
        
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
            display: inline-flex;
            align-items: center;
            position: relative;
        `;

        // Add hover effects like Genius buttons
        button.addEventListener('mouseenter', function() {
            button.style.backgroundColor = '#000';
            button.style.color = '#fff';
            // Make settings icon more visible on hover
            const settingsIcon = button.querySelector('.settings-icon');
            if (settingsIcon) settingsIcon.style.opacity = '1';
        });

        button.addEventListener('mouseleave', function() {
            button.style.backgroundColor = 'transparent';
            button.style.color = '#000';
            // Reset settings icon opacity
            const settingsIcon = button.querySelector('.settings-icon');
            if (settingsIcon) settingsIcon.style.opacity = '0.7';
        });

        // Combined click functionality
        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Get button bounds and click position
            const buttonRect = button.getBoundingClientRect();
            const clickX = e.clientX;
            
            // Create a generous buffer zone - if click is in the right 35% of button, treat as settings
            const buttonWidth = buttonRect.width;
            const settingsZoneStart = buttonRect.left + (buttonWidth * 0.65); // Right 35% of button
            
            // If click is in the settings zone (right 35% with buffer), open settings
            if (clickX >= settingsZoneStart) {
                toggleSettingsPopup();
            } else {
                // Otherwise, perform auto fix
                performAutoFix();
            }
        });

        return button;
    }

    // Function to convert numbers to text according to Genius guidelines
