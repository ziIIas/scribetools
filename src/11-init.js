    function isOnLyricsPage() {
        return window.location.pathname.endsWith('-lyrics') || window.location.pathname.endsWith('-annotated');
    }

    // Function to add buttons to lyrics editor
    function addButtonToEditor() {
        // Only add buttons on lyrics pages
        if (!isOnLyricsPage()) {
            console.log('Not on a lyrics page, skipping button addition');
            return false;
        }
        // Remove any existing buttons first
        const existingToggleButton = document.getElementById('genius-emdash-toggle');
        const existingAutoFixButton = document.getElementById('genius-autofix-button');
        const existingZwsButton = document.getElementById('genius-zws-button');
        const existingFindReplaceContainer = document.getElementById('genius-find-replace-container');
        if (existingToggleButton) {
            existingToggleButton.remove();
            console.log('Removed existing em dash button');
        }
        if (existingAutoFixButton) {
            existingAutoFixButton.remove();
            console.log('Removed existing auto fix button');
        }
        if (existingZwsButton) {
            existingZwsButton.remove();
            console.log('Removed existing zero-width space button');
        }
        if (existingFindReplaceContainer) {
            existingFindReplaceContainer.remove();
            console.log('Removed existing find replace container');
        }

        // Look for the lyrics editor controls container (try multiple approaches)
        const controlsContainer = document.querySelector('[class*="LyricsEdit-desktop__Controls-sc-"]') ||
                                 document.querySelector('[class*="LyricsEdit-desktop__Controls"]') ||
                                 document.querySelector('[class*="LyricsEdit"][class*="Controls"]') ||
                                 document.querySelector('[class*="lyrics-edit"][class*="controls"]') ||
                                 document.querySelector('.ihioQH'); // backup class name from the HTML

        if (controlsContainer) {
            console.log('Found controls container:', controlsContainer);
            
            // Expand the controls container to use available space better
            controlsContainer.style.maxWidth = 'none';
            controlsContainer.style.width = '130%';
            if (controlsContainer.style.flexBasis) {
                controlsContainer.style.flexBasis = 'auto';
            }
            
            // Create all buttons
            toggleButton = createToggleButton();
            autoFixButton = createAutoFixButton();
            const zwsButton = createZeroWidthSpaceButton();
            const findReplaceContainer = createFindReplaceContainer();
            
            // Create containers using utility
            const mainButtonContainer = UI.createFlexContainer('row', '0', { marginBottom: '0.5rem' });
            mainButtonContainer.appendChild(toggleButton);
            mainButtonContainer.appendChild(autoFixButton);
            
            const smallButtonsContainer = UI.createFlexContainer('row', '0.5rem', { 
                marginBottom: '0.5rem',
                flexWrap: 'wrap',
                minWidth: '0'
            });
            smallButtonsContainer.appendChild(zwsButton);
            smallButtonsContainer.appendChild(findReplaceContainer);
            
            // Wait for other extension to potentially create its buttons
            setTimeout(() => {
                // Check for other extension's lyrics sections buttons container
                const lyricsSectionsContainer = document.getElementById('lyricsSectionsButtonsContainer');
                
                // Look for the LyricsEditExplainer container (don't remove it, let other extensions use it)
                const lyricsExplainer = controlsContainer.querySelector('[class*="LyricsEditExplainer__Container"]') ||
                                       controlsContainer.querySelector('[class*="LyricsEditExplainer"]');
                
                // Look for the "How to Format Lyrics" section as a fallback
                const formatExplainer = controlsContainer.querySelector('[class*="LyricsEdit-desktop__Explainer"]') ||
                                       controlsContainer.querySelector('[class*="Explainer"]');
                
                if (lyricsSectionsContainer) {
                    // If other extension's buttons exist, insert our buttons after them
                    console.log('Found other extension lyrics sections container, positioning our buttons below it');
                    
                    // Create a wrapper for our buttons with proper styling
                    const scribeToolsWrapper = document.createElement('div');
                    scribeToolsWrapper.id = 'scribe-tools-wrapper';
                    scribeToolsWrapper.style.marginTop = '1rem';
                    scribeToolsWrapper.appendChild(mainButtonContainer);
                    scribeToolsWrapper.appendChild(smallButtonsContainer);
                    
                    // Insert after the other extension's container
                    lyricsSectionsContainer.parentNode.insertBefore(scribeToolsWrapper, lyricsSectionsContainer.nextSibling);
                    console.log('Inserted ScribeTools buttons after other extension buttons');
                    
                } else if (lyricsExplainer && controlsContainer.contains(lyricsExplainer)) {
                    // Insert before the LyricsEditExplainer (only if it's a child of controlsContainer)
                    controlsContainer.insertBefore(mainButtonContainer, lyricsExplainer);
                    controlsContainer.insertBefore(smallButtonsContainer, lyricsExplainer);
                    console.log('Inserted buttons before LyricsEditExplainer');
                    
                } else if (formatExplainer && controlsContainer.contains(formatExplainer) && formatExplainer.textContent && formatExplainer.textContent.includes('Format')) {
                    // Insert before the format explainer (above "How to Format Lyrics:")
                    controlsContainer.insertBefore(mainButtonContainer, formatExplainer);
                    controlsContainer.insertBefore(smallButtonsContainer, formatExplainer);
                    console.log('Inserted buttons before format explainer');
                    
                } else {
                    // Fallback: append to the container
                    controlsContainer.appendChild(mainButtonContainer);
                    controlsContainer.appendChild(smallButtonsContainer);
                    console.log('Appended buttons to controls container');
                }
            }, 500); // Give other extension time to create its buttons
            
            updateButtonState();
            console.log('Genius Em Dash Toggle and Auto Fix buttons added to editor');
            return true;
        } else {
            console.log('Controls container not found');
        }
        return false;
    }

    // Function to remove only specific format explainer content while preserving structure for other extensions
    function removeFormatExplainerDiv() {
        // Only remove the "How to Format Lyrics" text content, but preserve the container structure
        // that other extensions might need
        const explainerDivs = document.querySelectorAll('div');
        explainerDivs.forEach(div => {
            if (div.textContent && div.textContent.includes('How to Format Lyrics:')) {
                // Check if it matches the specific structure with flex styling
                const style = div.getAttribute('style') || '';
                if (style.includes('display: flex') && style.includes('flex-direction: row')) {
                    // Instead of removing the entire div, just hide it or make it smaller
                    console.log('Hiding "How to Format Lyrics" explainer content (preserving container)');
                    div.style.display = 'none';
                    // Or alternatively: div.style.fontSize = '0'; div.style.height = '0';
                }
            }
        });
        
        // Do NOT remove LyricsEditExplainer divs as other extensions need them
        // Comment out this section to preserve compatibility
        /*
        const lyricsExplainerDivs = document.querySelectorAll('div[class*="LyricsEditExplainer"]');
        lyricsExplainerDivs.forEach(div => {
            console.log('Removing LyricsEditExplainer div:', div.className);
            div.remove();
        });
        */
    }

    // Function to initialize the userscript
    function init() {
        // Only run on Genius pages
        if (!window.location.hostname.includes('genius.com') || isInitialized) {
            return;
        }

        // Immediate cleanup of any lingering highlights from previous sessions
        console.log('Initializing: cleaning up any existing highlights...');
        removeNumberHighlight(null);

        // Remove the "How to Format Lyrics" explainer div
        removeFormatExplainerDiv();
        
        // Set up observer to remove the div if it appears later
        const observer = new MutationObserver(() => {
            removeFormatExplainerDiv();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Reset restore prompt flag for new page
        hasShownRestorePrompt = false;
        
        // Load declined numbers from localStorage (per page, expires after 1 week)
        declinedNumbers.clear();
        loadDeclinedNumbers();

                 // Add global event listeners (only once)
        document.addEventListener('keypress', handleKeyPress);
        document.addEventListener('selectionchange', handleTextSelection);
        document.addEventListener('mouseup', () => {
            // Add a small delay to allow selection to stabilize
            setTimeout(handleTextSelection, 10);
        });

        // Add auto em dash conversion listener
        document.addEventListener('input', handleAutoEmDashConversion);



        // Listen for focus on lyrics editor to check for auto-saved content
        document.addEventListener('focus', (e) => {
            const target = e.target;
            // Check if focusing on lyrics editor specifically
            // First ensure target is an Element and has the closest method
            const isLyricsEditor = target && target.closest && target.matches &&
                                  target.closest('[class*="LyricsEdit"]') && 
                                  (target.matches('textarea') || target.isContentEditable);

            if (isLyricsEditor) {
                // Always clean up any lingering highlights when editor is opened
                console.log('Cleaning up any lingering highlights on editor focus...');
                removeNumberHighlight(target);
                
                if (!hasShownRestorePrompt) {
                    hasShownRestorePrompt = true;
                    console.log('Lyrics editor focused (typing cursor active), checking for auto-saved content...');
                    
                    try {
                        const saveData = localStorage.getItem(getAutoSaveKey());
                        if (saveData) {
                            const parsed = JSON.parse(saveData);
                            const now = Date.now();
                            const saveAge = now - parsed.timestamp;
                            const maxAge = 24 * 60 * 60 * 1000; // 24 hours

                            // Only offer to restore if save is less than 24 hours old
                            if (saveAge <= maxAge) {
                                // Get current editor content for comparison
                                let currentContent = '';
                                if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
                                    currentContent = target.value || '';
                                } else if (target.isContentEditable) {
                                    currentContent = target.innerText || target.textContent || '';
                                }

                                // Only show restore prompt if autosaved content is different from current content
                                if (parsed.content && parsed.content.trim() !== currentContent.trim()) {
                                    const saveDate = new Date(parsed.timestamp);
                                    const timeString = saveDate.toLocaleString();
                                    console.log('Found different auto-saved content, showing restore notification...');
                                    
                                    // Show restore notification immediately since editor is ready
                                    showRestoreNotification(parsed, timeString);
                                } else {
                                    console.log('Auto-saved content matches current content, clearing auto-save...');
                                    clearAutoSave();
                                }
                            } else {
                                clearAutoSave();
                            }
                        }
                    } catch (e) {
                        console.log('Failed to check auto-save:', e);
                    }
                }
            }
        }, true); // Use capture phase to catch focus events early

        // Add beforeunload listener to save work before leaving
        window.addEventListener('beforeunload', (e) => {
            // Clean up number conversion popup before leaving
            if (currentNumberConversion) {
                const textEditor = document.querySelector('[class*="LyricsEdit"] textarea') ||
                                  document.querySelector('[class*="LyricsEdit"] [contenteditable="true"]') ||
                                  document.querySelector('textarea') ||
                                  document.querySelector('[contenteditable="true"]');
                if (textEditor) {
                    removeNumberHighlight(textEditor);
                }
                cleanupCurrentNumberPopup();
            }
            
            if (isEditing) {
                saveCurrentContent();
                // Optional: Show browser warning for unsaved changes
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return 'You have unsaved changes. Are you sure you want to leave?';
            }
        });
        document.addEventListener('click', (e) => {
            // Only hide format popup if clicking outside of it and not selecting text
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
            
            // Hide settings popup if clicking outside of it and not on the auto fix button
            if (settingsPopup && autoFixButton && 
                !settingsPopup.contains(e.target) && 
                !autoFixButton.contains(e.target)) {
                if (settingsBackdrop) settingsBackdrop.style.display = 'none';
                settingsPopup.style.display = 'none';
            }
            

        });
        
        console.log('Event listeners added for text formatting');
        
                 // Load saved settings
        loadSettings();
        
        // Verify settings persistence every 5 minutes
        setInterval(verifySettingsPersistence, 5 * 60 * 1000);
        
        // Also verify once after 10 seconds to catch early issues
        setTimeout(verifySettingsPersistence, 10 * 1000);
        
        // Start auto-save functionality
        startAutoSave();
        
        isInitialized = true;

        // Wait for other extensions to initialize first, then try to add button to editor
        setTimeout(() => {
            const buttonAdded = addButtonToEditor();
        }, 1000); // Give other extensions time to load
        
        // If that failed, try multiple fallback searches (but only on lyrics pages and don't interfere with other extensions)
        if (false && !buttonAdded && isOnLyricsPage()) { // Temporarily disabled to prevent interference
            setTimeout(() => {
                console.log('Retrying button placement with broader search...');
                
                // Try multiple possible containers with more specific selectors
                let targetContainer = document.querySelector('[class*="LyricsEdit-desktop__Controls-sc-"]') ||
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
                    // Expand the container to use available space better
                    targetContainer.style.maxWidth = 'none';
                    targetContainer.style.width = '130%';
                    if (targetContainer.style.flexBasis) {
                        targetContainer.style.flexBasis = 'auto';
                    }
                    // Remove any existing buttons
                    const existingToggle = document.getElementById('genius-emdash-toggle');
                    const existingAutoFix = document.getElementById('genius-autofix-button');
                    const existingZws = document.getElementById('genius-zws-button');
                    const existingFindReplaceContainer = document.getElementById('genius-find-replace-container');
                    if (existingToggle) existingToggle.remove();
                    if (existingAutoFix) existingAutoFix.remove();
                    if (existingZws) existingZws.remove();
                    if (existingFindReplaceContainer) existingFindReplaceContainer.remove();
                    
                    // Create all buttons
                    toggleButton = createToggleButton();
                    autoFixButton = createAutoFixButton();
                    const zwsButton = createZeroWidthSpaceButton();
                    const findReplaceContainer = createFindReplaceContainer();
                    
                    // Create containers using utility
                    const mainButtonContainer = UI.createFlexContainer('row', '0', { marginBottom: '0.5rem' });
                    mainButtonContainer.appendChild(toggleButton);
                    mainButtonContainer.appendChild(autoFixButton);
                    
                    const smallButtonsContainer = UI.createFlexContainer('row', '0.5rem', { 
                        marginBottom: '0.5rem',
                        flexWrap: 'wrap',
                        minWidth: '0'
                    });
                    smallButtonsContainer.appendChild(zwsButton);
                    smallButtonsContainer.appendChild(findReplaceContainer);
                    
                    // Try to insert at the top of the container
                    if (targetContainer.firstChild) {
                        targetContainer.insertBefore(mainButtonContainer, targetContainer.firstChild);
                        targetContainer.insertBefore(smallButtonsContainer, targetContainer.firstChild.nextSibling);
                    } else {
                        targetContainer.appendChild(mainButtonContainer);
                        targetContainer.appendChild(smallButtonsContainer);
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

                    // Only try to add buttons if editor appeared, we're on a lyrics page, and we don't already have them
                    if (hasLyricsEditor && isOnLyricsPage() && !document.getElementById('genius-emdash-toggle') && !document.getElementById('genius-zws-button')) {
                        // Small delay to ensure the editor is fully rendered
                        // Immediate cleanup
                        console.log('Lyrics editor appeared, immediately cleaning up any lingering highlights...');
                        removeNumberHighlight(null); // Global cleanup first
                        
                        setTimeout(() => {
                            addButtonToEditor();
                            
                            // Additional cleanup after buttons are added
                            const textEditor = document.querySelector('[class*="LyricsEdit"] textarea') ||
                                              document.querySelector('[class*="LyricsEdit"] [contenteditable="true"]');
                            if (textEditor) {
                                removeNumberHighlight(textEditor);
                            }
                        }, 1200); // Longer delay to wait for other extensions
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
