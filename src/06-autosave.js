    function getAutoSaveKey() {
        // Use the current page URL as the key, but normalize it
        const url = window.location.href;
        const baseUrl = url.split('?')[0].split('#')[0]; // Remove query params and hash
        return `genius-autosave-${baseUrl}`;
    }

    function saveCurrentContent() {
        if (!isEditing) return;

        const textEditor = document.querySelector('[class*="LyricsEdit"] textarea') ||
                          document.querySelector('[class*="LyricsEdit"] [contenteditable="true"]') ||
                          document.querySelector('textarea') ||
                          document.querySelector('[contenteditable="true"]');

        if (!textEditor) return;

        let content;
        let selectionStart = null;
        let selectionEnd = null;

        if (textEditor.tagName === 'TEXTAREA' || textEditor.tagName === 'INPUT') {
            content = textEditor.value;
            selectionStart = textEditor.selectionStart;
            selectionEnd = textEditor.selectionEnd;
        } else if (textEditor.isContentEditable) {
            content = textEditor.innerText || textEditor.textContent;
        }

        if (!content || content === lastSavedContent) return;

        const saveData = {
            content: content,
            timestamp: Date.now(),
            url: window.location.href,
            selectionStart: selectionStart,
            selectionEnd: selectionEnd
        };

        try {
            localStorage.setItem(getAutoSaveKey(), JSON.stringify(saveData));
            lastSavedContent = content;
        } catch (e) {
        }
    }

    function clearAutoSave() {
        try {
            localStorage.removeItem(getAutoSaveKey());
            lastSavedContent = '';
        } catch (e) {
        }
    }



         function showRestoreNotification(saveData, timeString) {
        // Create notification overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10003;
            backdrop-filter: blur(2px);
        `;

        const notification = document.createElement('div');
        notification.style.cssText = `
            background: #fff;
            border-radius: 12px;
            padding: 32px;
            max-width: 550px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            text-align: center;
            min-width: 400px;
        `;

        const title = document.createElement('h3');
        title.textContent = '💾 Restore Previous Work?';
        title.style.cssText = `
            margin: 0 0 20px 0;
            color: #333;
            font-size: 24px;
            font-weight: 400;
            font-family: 'Programme', Arial, sans-serif;
            line-height: 1.125;
        `;

        const message = document.createElement('p');
        message.innerHTML = `We found unsaved work from <strong>${timeString}</strong>.<br>Would you like to restore it?`;
        message.style.cssText = `
            margin: 0 0 24px 0;
            color: #666;
            line-height: 1.5;
            font-size: 16px;
            font-weight: 100;
            font-family: 'Programme', Arial, sans-serif;
        `;

        const preview = document.createElement('div');
        preview.style.cssText = `
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 16px;
            margin: 20px 0;
            max-height: 120px;
            overflow-y: auto;
            text-align: left;
            font-size: 14px;
            color: #495057;
            font-family: 'Programme', Arial, sans-serif;
            font-weight: 100;
            white-space: pre-wrap;
            line-height: 1.4;
        `;
        preview.textContent = saveData.content.substring(0, 300) + (saveData.content.length > 300 ? '...' : '');

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 16px;
            justify-content: center;
            margin-top: 24px;
        `;

        const restoreBtn = document.createElement('button');
        restoreBtn.textContent = 'Restore Work';
        restoreBtn.style.cssText = `
            background-color: #000;
            color: #fff;
            border: 1px solid #000;
            border-radius: 20px;
            padding: 12px 24px;
            cursor: pointer;
            font-family: 'HelveticaNeue', Arial, sans-serif;
            font-size: 16px;
            font-weight: 400;
            line-height: 1.1;
            min-width: 140px;
            transition: all 0.2s ease;
        `;

        const discardBtn = document.createElement('button');
        discardBtn.textContent = 'Start Fresh';
        discardBtn.style.cssText = `
            background-color: transparent;
            color: #000;
            border: 1px solid #000;
            border-radius: 20px;
            padding: 12px 24px;
            cursor: pointer;
            font-family: 'HelveticaNeue', Arial, sans-serif;
            font-size: 16px;
            font-weight: 400;
            line-height: 1.1;
            min-width: 140px;
            transition: all 0.2s ease;
        `;

        // Add hover effects matching Genius button style
        restoreBtn.addEventListener('mouseenter', function() {
            this.style.backgroundColor = '#333';
        });

        restoreBtn.addEventListener('mouseleave', function() {
            this.style.backgroundColor = '#000';
        });

        discardBtn.addEventListener('mouseenter', function() {
            this.style.backgroundColor = '#000';
            this.style.color = '#fff';
        });

        discardBtn.addEventListener('mouseleave', function() {
            this.style.backgroundColor = 'transparent';
            this.style.color = '#000';
        });

        restoreBtn.addEventListener('click', () => {
            restoreContent(saveData);
            document.body.removeChild(overlay);
        });

        discardBtn.addEventListener('click', () => {
            clearAutoSave();
            hasShownRestorePrompt = true; // Mark as handled
            document.body.removeChild(overlay);
        });

        buttonContainer.appendChild(restoreBtn);
        buttonContainer.appendChild(discardBtn);

        notification.appendChild(title);
        notification.appendChild(message);
        notification.appendChild(preview);
        notification.appendChild(buttonContainer);
        overlay.appendChild(notification);

        document.body.appendChild(overlay);
    }

    function restoreContent(saveData) {
        // Look for the lyrics editor specifically
        let textEditor = document.querySelector('[class*="LyricsEdit"] textarea') ||
                        document.querySelector('[class*="LyricsEdit"] [contenteditable="true"]');



        if (textEditor) {
            // Editor found, restore immediately
            performRestore(textEditor, saveData);
        } else {
            alert('Could not find the lyrics editor. Please ensure you are in editing mode.');
        }
    }

    function performRestore(textEditor, saveData) {

        try {
            if (textEditor.tagName === 'TEXTAREA' || textEditor.tagName === 'INPUT') {
                
                // Focus the element
                textEditor.focus();
                
                // Use a more direct approach that works better with React
                // Set the value directly and trigger all necessary events
                textEditor.value = saveData.content;
                
                // Trigger React-compatible events in sequence
                const events = ['input', 'change', 'blur', 'focus'];
                events.forEach(eventType => {
                    const event = new Event(eventType, { bubbles: true });
                    // Make the event look more like a real user event
                    Object.defineProperty(event, 'target', { value: textEditor, enumerable: true });
                    Object.defineProperty(event, 'currentTarget', { value: textEditor, enumerable: true });
                    textEditor.dispatchEvent(event);
                });
                
                // Set cursor position if available
                if (saveData.selectionStart !== null && saveData.selectionEnd !== null) {
                    textEditor.selectionStart = saveData.selectionStart;
                    textEditor.selectionEnd = saveData.selectionEnd;
                }

                
            } else if (textEditor.isContentEditable) {
                
                textEditor.focus();
                textEditor.textContent = saveData.content;
                
                // Dispatch events
                textEditor.dispatchEvent(new Event('input', { bubbles: true }));
                textEditor.dispatchEvent(new Event('change', { bubbles: true }));
                textEditor.dispatchEvent(new Event('keyup', { bubbles: true }));
            }

            lastSavedContent = saveData.content;
            hasShownRestorePrompt = true; // Mark as handled
            
        } catch (error) {
            console.error('Error during content restoration:', error);
        }
        
        // Clear pending restore data
        if (window.pendingRestoreData) {
            delete window.pendingRestoreData;
        }
    }



    function startAutoSave() {
        if (autoSaveInterval) return;

        // Save every 30 seconds
        autoSaveInterval = setInterval(saveCurrentContent, 30000);
        
                 // Also save on text input
        document.addEventListener('input', (e) => {
            const target = e.target;
            // Make sure we're specifically in the lyrics editor, not a comment box
            const isInLyricsEditor = target.closest('[class*="LyricsEdit"]') && 
                                   (target.matches('textarea') || target.isContentEditable);

            if (isInLyricsEditor) {
                isEditing = true;
                
                // Debounced save - save 2 seconds after last input
                clearTimeout(window.autoSaveInputTimeout);
                window.autoSaveInputTimeout = setTimeout(saveCurrentContent, 2000);
            }
        });

                 // Listen for save/publish/cancel button clicks to clear auto-save
        document.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (button) {
                const buttonText = button.textContent.toLowerCase();
                const buttonClasses = button.className || '';
                
                // Clean up highlights when entering edit mode
                if (buttonText.includes('edit') && buttonText.includes('lyrics')) {
                    // Immediate global cleanup
                    removeNumberHighlight(null);
                    
                    // Quick follow-up for any editor-specific cleanup
                    setTimeout(() => {
                        const textEditor = document.querySelector('[class*="LyricsEdit"] textarea') ||
                                          document.querySelector('[class*="LyricsEdit"] [contenteditable="true"]');
                        if (textEditor) {
                            removeNumberHighlight(textEditor);
                        }
                    }, 10); // Minimal delay
                }
                
                // Clear auto-save when user successfully saves/publishes or cancels
                if (buttonText.includes('save') || buttonText.includes('publish') || 
                    buttonText.includes('submit') || buttonText.includes('update')) {
                    setTimeout(() => {
                        // Clear auto-save after a short delay to ensure save was successful
                        clearAutoSave();
                        isEditing = false;
                    }, 2000);
                }
                // Clear auto-save immediately when Cancel button is clicked
                else if (buttonText.includes('cancel') || buttonClasses.includes('iUzusl')) {
                    clearAutoSave();
                    isEditing = false;
                }
                
                // Clean up number conversion popup when Cancel or Save & Exit is clicked
                if (buttonText.includes('cancel') || buttonText.includes('save') || buttonClasses.includes('iUzusl')) {
                    const textEditor = document.querySelector('[class*="LyricsEdit"] textarea') ||
                                      document.querySelector('[class*="LyricsEdit"] [contenteditable="true"]');
                    if (textEditor) {
                        // Always remove highlighting regardless of popup state
                        removeNumberHighlight(textEditor);
                    }
                    // Clean up popup if it exists
                    if (currentNumberConversion) {
                        cleanupCurrentNumberPopup();
                    }
                }
            }
        });




    }

    function stopAutoSave() {
        if (autoSaveInterval) {
            clearInterval(autoSaveInterval);
            autoSaveInterval = null;
        }
        isEditing = false;
    }
