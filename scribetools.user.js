// ==UserScript==
// @name         Genius ScribeTools
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Helpful tools for editing lyrics on Genius
// @author       zilla
// @match        https://genius.com/*
// @match        https://*.genius.com/*
// @updateURL    https://github.com/ziIIas/scribetools/raw/refs/heads/main/scribetools.user.js
// @downloadURL  https://github.com/ziIIas/scribetools/raw/refs/heads/main/scribetools.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let emDashEnabled = false;
    let toggleButton = null;
    let autoFixButton = null;
    let settingsPopup = null;
    let settingsBackdrop = null;
    let isInitialized = false;
    let formatPopup = null;
    let currentSelection = null;
    let popupTimeout = null;

    // Auto-save variables
    let autoSaveInterval = null;
    let lastSavedContent = '';
    let isEditing = false;
    let hasShownRestorePrompt = false; // Only show restore prompt once per page load

    // Auto fix settings - default all enabled
    let autoFixSettings = {
        contractions: true,
        capitalizeI: true,
        wordFixes: true,
        apostrophes: true,
        parenthesesFormatting: true,
        bracketHighlighting: true,
        emDashFixes: true,
        capitalizeParentheses: true,
        multipleSpaces: true,
        numberToText: 'ask', // Options: 'off', 'ask', 'on' - default to 'ask' for user control
        customRegex: true,
        customRegexRules: [], // Array of {find: string, replace: string, description: string, flags: string, enabled: boolean}
        emDashEnabled: false // Save em dash toggle state
    };



    // ===========================================
    // UI UTILITY FUNCTIONS
    // ===========================================
    
    const UI = {
        // CSS Constants
        COLORS: {
            primary: '#007bff',
            secondary: '#6c757d', 
            success: '#28a745',
            light: '#f8f9fa',
            border: '#dee2e6',
            borderLight: '#e9ecef',
            borderHover: '#adb5bd',
            text: '#333',
            textMuted: '#666',
            backgroundHover: '#e9ecef'
        },
        
        FONTS: {
            primary: "'Programme', Arial, sans-serif",
            monospace: "monospace, 'Programme', Arial, sans-serif"
        },
        
        TRANSITIONS: {
            standard: 'all 0.2s ease'
        },
        
        // Create standardized button
        createButton(text, clickHandler, options = {}) {
            const button = document.createElement('button');
            button.textContent = text;
            
            const defaults = {
                background: this.COLORS.light,
                border: `1px solid ${this.COLORS.border}`,
                color: this.COLORS.text,
                padding: '6px 12px',
                fontSize: '12px',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: this.TRANSITIONS.standard,
                fontWeight: '100',
                fontFamily: this.FONTS.primary,
                textAlign: 'left'  // Fix text alignment issue
            };
            
            const styles = { ...defaults, ...options.styles };
            button.style.cssText = Object.entries(styles)
                .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
                .join('; ');
            
            if (options.hover !== false) {
                this.addHoverEffect(button, {
                    backgroundColor: this.COLORS.backgroundHover,
                    borderColor: this.COLORS.borderHover
                });
            }
            
            if (clickHandler) {
                button.addEventListener('click', clickHandler);
            }
            
            return button;
        },
        
        // Create close button
        createCloseButton(clickHandler) {
            const button = document.createElement('button');
            button.innerHTML = '×';
            button.title = 'Close';
            
            button.style.cssText = `
                background: none;
                border: none;
                font-size: 24px;
                font-weight: 300;
                color: ${this.COLORS.textMuted};
                cursor: pointer;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: ${this.TRANSITIONS.standard};
            `;
            
            this.addHoverEffect(button, {
                backgroundColor: '#f5f5f5',
                color: this.COLORS.text
            });
            
            if (clickHandler) {
                button.addEventListener('click', clickHandler);
            }
            
            return button;
        },
        
        // Create flex container
        createFlexContainer(direction = 'row', gap = '0', additionalStyles = {}) {
            const container = document.createElement('div');
            
            const baseStyles = {
                display: 'flex',
                flexDirection: direction,
                gap: gap,
                alignItems: 'center'
            };
            
            const styles = { ...baseStyles, ...additionalStyles };
            container.style.cssText = Object.entries(styles)
                .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
                .join('; ');
            
            return container;
        },
        
        // Create popup backdrop
        createBackdrop(clickHandler = null) {
            const backdrop = document.createElement('div');
            backdrop.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: none;
                z-index: 10001;
                backdrop-filter: blur(2px);
            `;
            
            if (clickHandler) {
                backdrop.addEventListener('click', clickHandler);
            }
            
            return backdrop;
        },
        
        // Create popup
        createPopup(additionalStyles = {}) {
            const popup = document.createElement('div');
            
            const baseStyles = {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: '#fff',
                border: '1px solid #ddd',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                padding: '24px',
                display: 'none',
                zIndex: '10002',
                fontFamily: this.FONTS.primary,
                minWidth: '350px',
                maxWidth: '500px',
                maxHeight: '80vh',
                overflowY: 'auto'
            };
            
            const styles = { ...baseStyles, ...additionalStyles };
            popup.style.cssText = Object.entries(styles)
                .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
                .join('; ');
            
            return popup;
        },
        
        // Create popup header
        createPopupHeader(titleText, onClose) {
            const header = this.createFlexContainer('row', '0', {
                justifyContent: 'space-between',
                marginBottom: '20px',
                paddingBottom: '12px',
                borderBottom: '1px solid #eee'
            });
            
            const title = document.createElement('h3');
            title.textContent = titleText;
            title.style.cssText = `
                margin: 0;
                font-size: 18px;
                font-weight: 400;
                color: ${this.COLORS.text};
                font-family: ${this.FONTS.primary};
            `;
            
            const closeButton = this.createCloseButton(onClose);
            
            header.appendChild(title);
            header.appendChild(closeButton);
            
            return header;
        },
        
        // Add hover effect utility
        addHoverEffect(element, hoverStyles, originalStyles = null) {
            // Store original styles if not provided
            if (!originalStyles) {
                originalStyles = {};
                Object.keys(hoverStyles).forEach(key => {
                    const styleKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
                    originalStyles[key] = element.style[key] || 
                        getComputedStyle(element)[styleKey];
                });
            }
            
            element.addEventListener('mouseenter', function() {
                Object.entries(hoverStyles).forEach(([key, value]) => {
                    this.style[key] = value;
                });
            });
            
            element.addEventListener('mouseleave', function() {
                Object.entries(originalStyles).forEach(([key, value]) => {
                    this.style[key] = value;
                });
            });
        },
        
        // Create form field
        createFormField(label, type, value = '', isMonospace = false) {
            const container = this.createFlexContainer('column', '4px', {
                alignItems: 'stretch'  // Override the default 'center' alignment
            });
            
            const labelEl = document.createElement('label');
            labelEl.textContent = label;
            labelEl.style.cssText = `
                font-weight: 400; 
                color: ${this.COLORS.text};
                font-family: ${this.FONTS.primary};
                text-align: left;
            `;
            
            const input = document.createElement('input');
            input.type = type;
            input.value = value;
            input.style.cssText = `
                padding: 8px 12px;
                border: 1px solid #ced4da;
                border-radius: 4px;
                background: #fff;
                color: ${this.COLORS.text};
                font-weight: 100;
                font-family: ${isMonospace ? this.FONTS.monospace : this.FONTS.primary};
                text-align: left;
            `;
            
            container.appendChild(labelEl);
            container.appendChild(input);
            return container;
        },
        
        // Create rule element (unified for both regular and search results)
        createRuleElement(rule, index, onToggle, onDelete, isSearchResult = false) {
            const ruleDiv = document.createElement('div');
            ruleDiv.style.cssText = `
                border: 1px solid ${this.COLORS.borderLight};
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 8px;
                background: ${this.COLORS.light};
            `;
            
            const header = this.createFlexContainer('row', '8px', {
                justifyContent: 'space-between',
                marginBottom: '8px'
            });
            
            const enabledCheckbox = document.createElement('input');
            enabledCheckbox.type = 'checkbox';
            enabledCheckbox.checked = rule.enabled !== false;
            enabledCheckbox.addEventListener('change', () => onToggle(index, enabledCheckbox.checked));
            
            const description = document.createElement('span');
            description.textContent = rule.description || `Rule ${index + 1}`;
            description.style.cssText = `
                font-weight: 400;
                flex: 1;
                font-family: ${this.FONTS.primary};
            `;
            
            const deleteBtn = this.createButton('Delete', (e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(index);
            }, {
                styles: { fontSize: '12px', padding: '4px 8px' }
            });
            
            header.appendChild(enabledCheckbox);
            header.appendChild(description);
            header.appendChild(deleteBtn);
            ruleDiv.appendChild(header);
            
            // Rule details
            const details = document.createElement('div');
            details.style.cssText = `
                font-size: 12px;
                color: ${this.COLORS.secondary};
                font-family: monospace;
            `;
            
            let replaceText = typeof rule.replace === 'string' ? rule.replace : 
                             typeof rule.replace === 'function' ? '[Function]' : rule.replace;
            
            if (typeof rule.replace === 'string' && rule.replace.includes('\\')) {
                let jsReplacement = rule.replace.replace(/(?<!\\)\\(\d+)/g, '$$$1');
                if (jsReplacement !== rule.replace) {
                    replaceText += ` <span style="color: ${this.COLORS.success};">(JS: ${jsReplacement})</span>`;
                }
            }
            
            details.innerHTML = `
                <div><strong>Find:</strong> /${rule.find}/${rule.flags || 'gi'}</div>
                <div><strong>Replace:</strong> ${replaceText}</div>
            `;
            ruleDiv.appendChild(details);
            
            return ruleDiv;
        }
    };

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
            autoFixSettings.emDashEnabled = emDashEnabled; // Save to settings
            saveSettings(); // Persist to localStorage
            updateButtonState();
        });

        return button;
    }



    // Function to create the settings popup
    function createSettingsPopup() {
        // Create backdrop using utility
        const backdrop = UI.createBackdrop(() => {
            backdrop.style.display = 'none';
            popup.style.display = 'none';
        });
        backdrop.id = 'genius-settings-backdrop';

        // Create popup using utility
        const popup = UI.createPopup();
        popup.id = 'genius-settings-popup';

        // Create header using utility
        const header = UI.createPopupHeader('Auto Fix Settings', () => {
            backdrop.style.display = 'none';
            popup.style.display = 'none';
        });

        popup.appendChild(header);

        // Create tabbed interface
        const tabContainer = createTabbedInterface();
        popup.appendChild(tabContainer);

        document.body.appendChild(backdrop);
        document.body.appendChild(popup);

        return { backdrop, popup };
    }

    // Function to create tabbed interface
    function createTabbedInterface() {
        const container = document.createElement('div');
        container.style.cssText = `
            width: 100%;
        `;

        // Tab headers
        const tabHeaders = document.createElement('div');
        tabHeaders.style.cssText = `
            display: flex;
            border-bottom: 1px solid #dee2e6;
            margin-bottom: 20px;
        `;

        // Default Settings tab
        const defaultTab = document.createElement('button');
        defaultTab.textContent = 'Default Settings';
        defaultTab.id = 'default-settings-tab';
        defaultTab.style.cssText = `
            background: none;
            border: none;
            padding: 12px 20px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            color: #007bff;
            border-bottom: 2px solid #007bff;
            transition: all 0.2s ease;
        `;

        // Custom Rules tab
        const customTab = document.createElement('button');
        customTab.textContent = 'Custom Rules';
        customTab.id = 'custom-rules-tab';
        customTab.style.cssText = `
            background: none;
            border: none;
            padding: 12px 20px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            color: #6c757d;
            border-bottom: 2px solid transparent;
            transition: all 0.2s ease;
        `;

        tabHeaders.appendChild(defaultTab);
        tabHeaders.appendChild(customTab);
        container.appendChild(tabHeaders);

        // Tab content container
        const tabContent = document.createElement('div');
        tabContent.id = 'tab-content';
        container.appendChild(tabContent);

        // Default settings content
        const defaultContent = createDefaultSettingsContent();
        defaultContent.id = 'default-settings-content';
        defaultContent.style.display = 'block';
        tabContent.appendChild(defaultContent);

        // Custom rules content
        const customContent = createCustomRulesContent();
        customContent.id = 'custom-rules-content';
        customContent.style.display = 'none';
        tabContent.appendChild(customContent);

        // Tab switching logic
        defaultTab.addEventListener('click', () => switchTab('default'));
        customTab.addEventListener('click', () => switchTab('custom'));

        function switchTab(tabName) {
            const defaultTabEl = document.getElementById('default-settings-tab');
            const customTabEl = document.getElementById('custom-rules-tab');
            const defaultContentEl = document.getElementById('default-settings-content');
            const customContentEl = document.getElementById('custom-rules-content');

            if (tabName === 'default') {
                // Update tab styles
                defaultTabEl.style.color = '#007bff';
                defaultTabEl.style.borderBottomColor = '#007bff';
                customTabEl.style.color = '#6c757d';
                customTabEl.style.borderBottomColor = 'transparent';
                
                // Show/hide content
                defaultContentEl.style.display = 'block';
                customContentEl.style.display = 'none';
            } else {
                // Update tab styles
                defaultTabEl.style.color = '#6c757d';
                defaultTabEl.style.borderBottomColor = 'transparent';
                customTabEl.style.color = '#007bff';
                customTabEl.style.borderBottomColor = '#007bff';
                
                // Show/hide content
                defaultContentEl.style.display = 'none';
                customContentEl.style.display = 'block';
            }
        }

        return container;
    }

    // Function to create default settings content
    function createDefaultSettingsContent() {
        const content = document.createElement('div');

        const settings = [
            { key: 'contractions', label: 'Fix contractions (don\'t, can\'t, etc.)', type: 'checkbox' },
            { key: 'capitalizeI', label: 'Capitalize standalone "i"', type: 'checkbox' },
            { key: 'wordFixes', label: 'Word fixes (ok→okay, yea→yeah, etc.)', type: 'checkbox' },
            { key: 'apostrophes', label: 'Add missing apostrophes (gon\'→gon\', \'til, etc.)', type: 'checkbox' },
            { key: 'parenthesesFormatting', label: 'Fix parentheses formatting', type: 'checkbox' },
            { key: 'bracketHighlighting', label: 'Highlight mismatched brackets', type: 'checkbox' },
            { key: 'emDashFixes', label: 'Convert word- to word—', type: 'checkbox' },
            { key: 'capitalizeParentheses', label: 'Capitalize first letter in parentheses', type: 'checkbox' },
            { key: 'multipleSpaces', label: 'Fix spacing (multiple spaces → single, remove trailing)', type: 'checkbox' },
            { key: 'customRegex', label: 'Enable custom regex rules', type: 'checkbox' },
            { key: 'numberToText', label: 'Convert numbers to text', type: 'dropdown', 
              options: [
                  { value: 'off', label: 'Off' },
                  { value: 'ask', label: 'Ask for each number' },
                  { value: 'on', label: 'Convert automatically' }
              ]
            }
        ];

        settings.forEach(setting => {
            const container = document.createElement('div');
            container.style.cssText = `
                display: flex;
                align-items: flex-start;
                margin-bottom: 12px;
                padding: 8px;
                border-radius: 6px;
                transition: background-color 0.2s ease;
            `;

            container.addEventListener('mouseenter', function() {
                this.style.backgroundColor = '#f8f9fa';
            });

            container.addEventListener('mouseleave', function() {
                this.style.backgroundColor = 'transparent';
            });

            if (setting.type === 'dropdown') {
                // Create dropdown for number conversion setting
                const label = document.createElement('label');
                label.textContent = setting.label;
                label.style.cssText = `
                    font-size: 14px;
                    cursor: pointer;
                    color: #444;
                    line-height: 1.4;
                    flex: 1;
                    font-weight: 100;
                    font-family: 'Programme', Arial, sans-serif;
                `;

                const dropdown = document.createElement('select');
                dropdown.id = `setting-${setting.key}`;
                dropdown.style.cssText = `
                    margin-left: 12px;
                    margin-top: 0px;
                    cursor: pointer;
                    padding: 1px 6px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    background: #fff;
                    font-family: 'Programme', Arial, sans-serif;
                    font-size: 13px;
                    height: 18px;
                    vertical-align: middle;
                `;

                setting.options.forEach(option => {
                    const optionEl = document.createElement('option');
                    optionEl.value = option.value;
                    optionEl.textContent = option.label;
                    optionEl.selected = autoFixSettings[setting.key] === option.value;
                    dropdown.appendChild(optionEl);
                });

                dropdown.addEventListener('change', function() {
                    autoFixSettings[setting.key] = this.value;
                    saveSettings();
                });

                container.appendChild(label);
                container.appendChild(dropdown);
            } else {
                // Create checkbox for regular settings
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `setting-${setting.key}`;
                checkbox.checked = autoFixSettings[setting.key];
                checkbox.style.cssText = `
                    margin-right: 12px;
                    margin-top: 2px;
                    cursor: pointer;
                    width: 16px;
                    height: 16px;
                `;

                checkbox.addEventListener('change', function() {
                    autoFixSettings[setting.key] = this.checked;
                    saveSettings();
                });

                const label = document.createElement('label');
                label.htmlFor = `setting-${setting.key}`;
                label.textContent = setting.label;
                label.style.cssText = `
                    font-size: 14px;
                    cursor: pointer;
                    color: #444;
                    line-height: 1.4;
                    flex: 1;
                    font-weight: 100;
                    font-family: 'Programme', Arial, sans-serif;
                `;

                container.appendChild(checkbox);
                container.appendChild(label);
            }
            
            content.appendChild(container);
        });

        return content;
    }

    // Function to create custom rules content
    function createCustomRulesContent() {
        const content = document.createElement('div');

                 // All buttons on same line
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 8px;
            margin-bottom: 20px;
        `;

        const addRuleBtn = createSmallButton('+ Add Rule', () => {
            const form = document.getElementById('add-rule-form');
            const isVisible = form.style.display !== 'none';
            form.style.display = isVisible ? 'none' : 'block';
            addRuleBtn.textContent = isVisible ? '+ Add Rule' : 'Cancel';
        });
        
        const searchBtn = createSmallButton('Search Rules', () => {
            showRuleSearchPopup();
        });
        
        const importBtn = createImportDropdown();
        const exportBtn = createSmallButton('Export Rules', exportRegexRules);

        buttonContainer.appendChild(addRuleBtn);
        buttonContainer.appendChild(searchBtn);
        buttonContainer.appendChild(importBtn);
        buttonContainer.appendChild(exportBtn);
        content.appendChild(buttonContainer);

        // Add rule form (initially hidden)
        const addRuleForm = createAddRuleForm();
        content.appendChild(addRuleForm);

        // Import from clipboard form (initially hidden)
        const clipboardImportForm = createClipboardImportForm();
        content.appendChild(clipboardImportForm);

        // Rules container
        const rulesContainer = document.createElement('div');
        rulesContainer.id = 'custom-regex-rules-container';
        content.appendChild(rulesContainer);

        // Load existing rules
        refreshCustomRegexRules(rulesContainer);

        return content;
    }

    // Function to create inline add rule form
    function createAddRuleForm() {
        const form = document.createElement('div');
        form.id = 'add-rule-form';
        form.style.cssText = `
            display: none;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            background: #f8f9fa;
        `;

                 const title = document.createElement('h5');
        title.textContent = 'Add New Regex Rule';
        title.style.cssText = `
            margin: 0 0 16px 0;
            font-size: 16px;
            font-weight: 400;
            color: #333;
            font-family: 'Programme', Arial, sans-serif;
        `;
        form.appendChild(title);

        // Form fields
        const fieldsContainer = document.createElement('div');
        fieldsContainer.style.cssText = `display: flex; flex-direction: column; gap: 16px; margin-bottom: 16px;`;

        const descriptionField = createFormField('Description', 'text', '');
        const findField = createFormField('Find Pattern (regex)', 'text', '');
        const replaceField = createFormField('Replace With', 'text', '');
        const flagsField = createFormField('Flags (optional)', 'text', 'gi');

        fieldsContainer.appendChild(descriptionField);
        fieldsContainer.appendChild(findField);
        fieldsContainer.appendChild(replaceField);
        fieldsContainer.appendChild(flagsField);
        form.appendChild(fieldsContainer);

        // Buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 8px;
        `;

                 const saveBtn = createSmallButton('Add Rule', () => {
            const description = descriptionField.querySelector('input').value;
            const find = findField.querySelector('input').value;
            const replace = replaceField.querySelector('input').value;
            const flags = flagsField.querySelector('input').value || 'gi';

            if (!description || !find) {
                alert('Description and Find Pattern are required.');
                return;
            }

            try {
                // Test the regex
                new RegExp(find, flags);
            } catch (e) {
                alert('Invalid regex pattern: ' + e.message);
                return;
            }

            const newRule = { description, find, replace, flags, enabled: true };
            autoFixSettings.customRegexRules.push(newRule);
            saveSettings();
            refreshCustomRegexRules(document.getElementById('custom-regex-rules-container'));
            
            // Clear form and hide it
            descriptionField.querySelector('input').value = '';
            findField.querySelector('input').value = '';
            replaceField.querySelector('input').value = '';
            flagsField.querySelector('input').value = 'gi';
            form.style.display = 'none';
            
                         // Reset button text - find the correct add rule button
            const addRuleButton = form.parentElement.querySelector('button');
            if (addRuleButton && addRuleButton.textContent === 'Cancel') {
                addRuleButton.textContent = '+ Add Rule';
            }
        });

        saveBtn.style.backgroundColor = '#007bff';
        saveBtn.style.color = 'white';
        saveBtn.style.borderColor = '#007bff';

        buttonContainer.appendChild(saveBtn);
        form.appendChild(buttonContainer);

        return form;
    }

    // Function to create clipboard import form
    function createClipboardImportForm() {
        const form = document.createElement('div');
        form.id = 'clipboard-import-form';
        form.style.cssText = `
            display: none;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            background: #f8f9fa;
        `;

        const title = document.createElement('h5');
        title.textContent = 'Import from Clipboard';
        title.style.cssText = `
            margin: 0 0 16px 0;
            font-size: 16px;
            font-weight: 400;
            color: #333;
            font-family: 'Programme', Arial, sans-serif;
        `;
        form.appendChild(title);

        // Description
        const description = document.createElement('p');
        description.textContent = 'Paste your JSON rules below:';
        description.style.cssText = `
            margin: 0 0 12px 0;
            font-size: 14px;
            color: #666;
            font-family: 'Programme', Arial, sans-serif;
        `;
        form.appendChild(description);

        // Text area for JSON input
        const textArea = document.createElement('textarea');
        textArea.placeholder = 'Paste your JSON rules here...\n\nExample:\n[\n  {\n    "description": "wit -> with",\n    "find": "\\\\bwit\\\\b(?!\')",\n    "replace": "with",\n    "flags": "gi",\n    "enabled": true\n  }\n]';
        textArea.style.cssText = `
            width: 100%;
            height: 150px;
            padding: 12px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            background: #fff;
            color: #333;
            font-weight: 100;
            font-family: monospace, 'Programme', Arial, sans-serif;
            font-size: 12px;
            resize: vertical;
            box-sizing: border-box;
            margin-bottom: 16px;
        `;
        form.appendChild(textArea);

        // Buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 8px;
        `;

        const importBtn = createSmallButton('Import Rules', () => {
            const jsonText = textArea.value.trim();
            if (!jsonText) {
                alert('Please paste your JSON rules first.');
                return;
            }
            
            processImportedData(jsonText, 'clipboard');
            
            // Clear form and hide it
            textArea.value = '';
            form.style.display = 'none';
        });

        importBtn.style.backgroundColor = '#007bff';
        importBtn.style.color = 'white';
        importBtn.style.borderColor = '#007bff';

        const cancelBtn = createSmallButton('Cancel', () => {
            textArea.value = '';
            form.style.display = 'none';
        });

        buttonContainer.appendChild(importBtn);
        buttonContainer.appendChild(cancelBtn);
        form.appendChild(buttonContainer);

        return form;
    }

    // Function to toggle clipboard import form
    function toggleClipboardImportForm() {
        const form = document.getElementById('clipboard-import-form');
        const addRuleForm = document.getElementById('add-rule-form');
        
        // Hide add rule form if it's open
        if (addRuleForm && addRuleForm.style.display !== 'none') {
            addRuleForm.style.display = 'none';
            // Reset add rule button text
            const addRuleButton = addRuleForm.parentElement.querySelector('button');
            if (addRuleButton && addRuleButton.textContent === 'Cancel') {
                addRuleButton.textContent = '+ Add Rule';
            }
        }
        
        if (form) {
            const isVisible = form.style.display !== 'none';
            form.style.display = isVisible ? 'none' : 'block';
            
            // Focus the textarea when showing the form
            if (!isVisible) {
                const textArea = form.querySelector('textarea');
                if (textArea) {
                    setTimeout(() => textArea.focus(), 100);
                }
            }
        }
    }



    // Function to create small buttons
    function createSmallButton(text, clickHandler) {
        return UI.createButton(text, clickHandler, {
            styles: {
                fontSize: '12px',
                padding: '6px 12px'
            }
        });
    }

    // Function to refresh the custom regex rules display
    function refreshCustomRegexRules(container) {
        container.innerHTML = '';
        
        if (!autoFixSettings.customRegexRules || autoFixSettings.customRegexRules.length === 0) {
                         const noRulesMsg = document.createElement('div');
            noRulesMsg.textContent = 'No custom regex rules yet. Click "Add Rule" to create one.';
            noRulesMsg.style.cssText = `
                color: #6c757d;
                font-style: italic;
                padding: 12px;
                text-align: center;
                font-weight: 100;
                font-family: 'Programme', Arial, sans-serif;
            `;
            container.appendChild(noRulesMsg);
            return;
        }

        autoFixSettings.customRegexRules.forEach((rule, index) => {
            const ruleElement = createRegexRuleElement(rule, index);
            container.appendChild(ruleElement);
        });
    }

    // Function to create a regex rule element
    function createRegexRuleElement(rule, index) {
        return UI.createRuleElement(rule, index,
            // onToggle
            (idx, enabled) => {
                autoFixSettings.customRegexRules[idx].enabled = enabled;
                saveSettings();
            },
            // onDelete  
            (idx) => {
                autoFixSettings.customRegexRules.splice(idx, 1);
                saveSettings();
                refreshCustomRegexRules(document.getElementById('custom-regex-rules-container'));
            }
        );
    }



         // Function to create form fields
    function createFormField(label, type, value = '') {
        const isMonospace = type === 'text' && (label.includes('Pattern') || label.includes('Replace'));
        return UI.createFormField(label, type, value, isMonospace);
    }

    // Function to create import dropdown
    function createImportDropdown() {
        const container = document.createElement('div');
        container.style.cssText = `
            position: relative;
            display: inline-block;
        `;

        const dropdown = document.createElement('select');
        dropdown.style.cssText = `
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            color: #333;
            border-radius: 4px;
            padding: 6px 12px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            font-weight: 100;
            font-family: 'Programme', Arial, sans-serif;
        `;

        dropdown.addEventListener('mouseenter', function() {
            this.style.backgroundColor = '#e9ecef';
            this.style.borderColor = '#adb5bd';
        });

        dropdown.addEventListener('mouseleave', function() {
            this.style.backgroundColor = '#f8f9fa';
            this.style.borderColor = '#dee2e6';
        });

        // Create options
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Import Rules';
        defaultOption.disabled = true;
        defaultOption.selected = true;

        const fileOption = document.createElement('option');
        fileOption.value = 'file';
        fileOption.textContent = 'From File';

        const clipboardOption = document.createElement('option');
        clipboardOption.value = 'clipboard';
        clipboardOption.textContent = 'From Clipboard';

        dropdown.appendChild(defaultOption);
        dropdown.appendChild(fileOption);
        dropdown.appendChild(clipboardOption);

        dropdown.addEventListener('change', function() {
            const value = this.value;
            this.value = ''; // Reset to default

            if (value === 'file') {
                importFromFile();
            } else if (value === 'clipboard') {
                toggleClipboardImportForm();
            }
        });

        container.appendChild(dropdown);
        return container;
    }

    // Function to import from file
    function importFromFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                processImportedData(e.target.result, 'file');
            };
            reader.readAsText(file);
        });
        input.click();
    }



    // Function to process imported data (common logic for both file and clipboard)
    function processImportedData(dataString, source) {
        try {
            const importedData = JSON.parse(dataString);
            let importedRules;
            
            // Handle both single rule objects and arrays of rules
            if (Array.isArray(importedData)) {
                importedRules = importedData;
            } else if (importedData && typeof importedData === 'object' && importedData.find && importedData.replace) {
                // Single rule object
                importedRules = [importedData];
            } else {
                alert(`Invalid format. Please ${source === 'file' ? 'select a valid JSON file' : 'copy valid JSON data'} containing regex rules.`);
                return;
            }
            
            // Validate each rule has required fields
            const validRules = importedRules.filter(rule => 
                rule && typeof rule === 'object' && rule.find && rule.replace
            );
            
            if (validRules.length === 0) {
                alert('No valid regex rules found in the data.');
                return;
            }
            
            // Add to existing rules instead of replacing
            autoFixSettings.customRegexRules = [...(autoFixSettings.customRegexRules || []), ...validRules];
            saveSettings();
            refreshCustomRegexRules(document.getElementById('custom-regex-rules-container'));
            alert(`Successfully imported ${validRules.length} regex rule(s) from ${source}.`);
        } catch (error) {
            alert(`Error parsing data from ${source}: ` + error.message);
        }
    }

    // Function to export regex rules
    function exportRegexRules() {
        if (!autoFixSettings.customRegexRules || autoFixSettings.customRegexRules.length === 0) {
            alert('No custom regex rules to export.');
            return;
        }

        const dataStr = JSON.stringify(autoFixSettings.customRegexRules, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'genius-custom-regex-rules.json';
        link.click();
        
        URL.revokeObjectURL(url);
    }

    // Function to show rule search popup
    function showRuleSearchPopup() {
        // Create backdrop using utility
        const backdrop = UI.createBackdrop((e) => {
            if (e.target === backdrop) {
                document.body.removeChild(backdrop);
            }
        });
        backdrop.style.display = 'flex';
        backdrop.style.alignItems = 'center';
        backdrop.style.justifyContent = 'center';
        backdrop.style.zIndex = '10004';

        // Create popup using utility  
        const popup = UI.createPopup({
            minWidth: '400px',
            maxWidth: '600px',
            position: 'relative',
            top: 'auto',
            left: 'auto',
            transform: 'none'
        });

        // Create header using utility
        const header = UI.createPopupHeader('Search Rules', () => {
            document.body.removeChild(backdrop);
        });

        popup.appendChild(header);

        // Search input
        const searchContainer = document.createElement('div');
        searchContainer.style.cssText = `margin-bottom: 20px;`;

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search rules by description, pattern, or replacement...';
        searchInput.style.cssText = `
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
            font-family: 'Programme', Arial, sans-serif;
            box-sizing: border-box;
        `;

        searchContainer.appendChild(searchInput);
        popup.appendChild(searchContainer);

        // Results container
        const resultsContainer = document.createElement('div');
        resultsContainer.id = 'search-results-container';
        popup.appendChild(resultsContainer);

        // Search function
        function performSearch() {
            const query = searchInput.value.toLowerCase().trim();
            resultsContainer.innerHTML = '';

            if (!query) {
                resultsContainer.innerHTML = '<div style="color: #666; font-style: italic; text-align: center; padding: 20px;">Enter a search term to find rules</div>';
                return;
            }

            const matchingRules = autoFixSettings.customRegexRules.filter((rule, index) => {
                const description = (rule.description || '').toLowerCase();
                const find = (rule.find || '').toLowerCase();
                const replace = (typeof rule.replace === 'string' ? rule.replace : rule.replace.toString()).toLowerCase();
                
                return description.includes(query) || find.includes(query) || replace.includes(query);
            }).map((rule, originalIndex) => ({ rule, originalIndex: autoFixSettings.customRegexRules.indexOf(rule) }));

            if (matchingRules.length === 0) {
                resultsContainer.innerHTML = '<div style="color: #666; font-style: italic; text-align: center; padding: 20px;">No rules found matching your search</div>';
                return;
            }

            matchingRules.forEach(({ rule, originalIndex }) => {
                const ruleElement = createSearchResultElement(rule, originalIndex);
                resultsContainer.appendChild(ruleElement);
            });
        }

        // Search on input
        searchInput.addEventListener('input', performSearch);

        // Initial empty state
        resultsContainer.innerHTML = '<div style="color: #666; font-style: italic; text-align: center; padding: 20px;">Enter a search term to find rules</div>';

        // Close on backdrop click
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                document.body.removeChild(backdrop);
            }
        });

        backdrop.appendChild(popup);
        document.body.appendChild(backdrop);
        
        // Show the popup (override the default 'none' from utility)
        popup.style.display = 'block';

        // Focus search input
        setTimeout(() => searchInput.focus(), 100);
    }

    // Function to create search result element
    function createSearchResultElement(rule, index) {
        return UI.createRuleElement(rule, index,
            // onToggle
            (idx, enabled) => {
                autoFixSettings.customRegexRules[idx].enabled = enabled;
                saveSettings();
            },
            // onDelete
            (idx) => {
                autoFixSettings.customRegexRules.splice(idx, 1);
                saveSettings();
                // Refresh the current search results
                const searchInput = document.querySelector('#search-results-container').parentElement.querySelector('input[type="text"]');
                if (searchInput) {
                    searchInput.dispatchEvent(new Event('input'));
                }
            },
            true // isSearchResult flag
        );
    }

    // Function to toggle settings popup
    function toggleSettingsPopup() {
        if (!settingsPopup) {
            const popupElements = createSettingsPopup();
            settingsBackdrop = popupElements.backdrop;
            settingsPopup = popupElements.popup;
        }

        if (settingsPopup.style.display === 'none' || !settingsPopup.style.display) {
            settingsBackdrop.style.display = 'block';
            settingsPopup.style.display = 'block';
        } else {
            settingsBackdrop.style.display = 'none';
            settingsPopup.style.display = 'none';
        }
    }

    // Function to save settings to localStorage
    function saveSettings() {
        try {
            // Create a copy for serialization, converting functions to strings
            const settingsToSave = { ...autoFixSettings };
            settingsToSave.customRegexRules = autoFixSettings.customRegexRules.map(rule => {
                if (typeof rule.replace === 'function') {
                    return { ...rule, replace: rule.replace.toString() };
                }
                return rule;
            });
            localStorage.setItem('genius-autofix-settings', JSON.stringify(settingsToSave));
        } catch (e) {
        }
    }

    // Function to load settings from localStorage
    function loadSettings() {
        try {
            const saved = localStorage.getItem('genius-autofix-settings');
            if (saved) {
                const loadedSettings = JSON.parse(saved);
                
                // Handle custom regex rules separately to restore functions
                if (loadedSettings.customRegexRules) {
                    loadedSettings.customRegexRules = loadedSettings.customRegexRules.map(rule => {
                        if (typeof rule.replace === 'string' && rule.replace.startsWith('function')) {
                            try {
                                // Restore function from string
                                rule.replace = eval(`(${rule.replace})`);
                            } catch (e) {

                            }
                        }
                        return rule;
                    });
                }
                
                autoFixSettings = { ...autoFixSettings, ...loadedSettings };
                // Load em dash state from settings
                emDashEnabled = autoFixSettings.emDashEnabled || false;
            }
        } catch (e) {
        }
    }

    // Auto-save functions
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
                else if (buttonText.includes('cancel') || buttonClasses.includes('hvIRPS')) {
                    clearAutoSave();
                    isEditing = false;
                }
                
                // Clean up number conversion popup when Cancel or Save & Exit is clicked
                if (buttonText.includes('cancel') || buttonText.includes('save') || buttonClasses.includes('hvIRPS')) {
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

    // Function to create the zero-width space button
    function createZeroWidthSpaceButton() {
        const button = document.createElement('button');
        button.innerHTML = 'Copy Zero-Width Space';
        button.title = 'Copy a zero-width space (​) to clipboard - useful for spacing fixes';
        button.id = 'genius-zws-button';
        button.type = 'button';
        
        // Style to match Genius small buttons (like Edit Metadata button)
        button.className = 'SmallButton__Container-sc-70651651-0 gsusny';
        
        // Additional custom styling to match the small button style
        button.style.cssText = `
            margin-bottom: 0.5rem;
            background-color: transparent;
            border: 1px solid #ccc;
            color: #666;
            font-weight: 400;
            font-family: 'HelveticaNeue', Arial, sans-serif;
            font-size: 0.875rem;
            line-height: 1.1;
            padding: 0.375rem 0.75rem;
            border-radius: 0.25rem;
            cursor: pointer;
            min-width: auto;
            display: inline-block;
            position: relative;
        `;

        // Add hover effects
        button.addEventListener('mouseenter', function() {
            button.style.backgroundColor = '#f5f5f5';
            button.style.borderColor = '#999';
        });

        button.addEventListener('mouseleave', function() {
            button.style.backgroundColor = 'transparent';
            button.style.borderColor = '#ccc';
        });

        // Copy zero-width space to clipboard
        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const zeroWidthSpace = '​'; // This is U+200B zero-width space
            
            // Try to copy to clipboard
            try {
                navigator.clipboard.writeText(zeroWidthSpace).then(() => {
                    // Success feedback
                    const originalText = button.innerHTML;
                    button.innerHTML = 'Copied!';
                    button.style.backgroundColor = '#10b981';
                    button.style.borderColor = '#10b981';
                    button.style.color = '#fff';
                    
                    setTimeout(() => {
                        button.innerHTML = originalText;
                        button.style.backgroundColor = 'transparent';
                        button.style.borderColor = '#ccc';
                        button.style.color = '#666';
                    }, 1000);
                }).catch(() => {
                    // Fallback method
                    fallbackCopyToClipboard(zeroWidthSpace, button);
                });
            } catch (e) {
                // Fallback method
                fallbackCopyToClipboard(zeroWidthSpace, button);
            }
        });

        return button;
    }

    // Fallback clipboard copy method
    function fallbackCopyToClipboard(text, button) {
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
            // Success feedback
            const originalText = button.innerHTML;
            button.innerHTML = 'Copied!';
            button.style.backgroundColor = '#10b981';
            button.style.borderColor = '#10b981';
            button.style.color = '#fff';
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.style.backgroundColor = 'transparent';
                button.style.borderColor = '#ccc';
                button.style.color = '#666';
            }, 1000);
        } catch (e) {
            // Error feedback
            button.innerHTML = 'Copy Failed';
            setTimeout(() => {
                button.innerHTML = 'Copy Zero-Width Space';
            }, 1000);
        }
        
        document.body.removeChild(textArea);
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
    function convertNumbersToText(text) {
        // Whitelisted numbers that should never be converted
        const whitelist = ['1600', '3500', '1629', '808', '360', '999', '1337', '420', '187'];
        
        // Number to text mappings
        const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 
                     'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 
                     'seventeen', 'eighteen', 'nineteen'];
        
        const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
        
        function numberToWords(num) {
            if (num === 0) return 'zero';
            
            let result = '';
            
            // Handle thousands
            if (num >= 1000) {
                const thousands = Math.floor(num / 1000);
                if (thousands <= 19) {
                    result += ones[thousands] + ' thousand';
                } else {
                    const thousandsTens = Math.floor(thousands / 10);
                    const thousandsOnes = thousands % 10;
                    result += tens[thousandsTens];
                    if (thousandsOnes > 0) result += '-' + ones[thousandsOnes];
                    result += ' thousand';
                }
                num %= 1000;
                if (num > 0) result += ' ';
            }
            
            // Handle hundreds
            if (num >= 100) {
                const hundreds = Math.floor(num / 100);
                
                // Special case for multiples of 100 in thousands (e.g., 3500 = thirty-five hundred)
                if (num % 100 === 0 && result.includes('thousand')) {
                    // Remove the "thousand" part and use "hundred" format
                    const totalHundreds = Math.floor((parseInt(text.match(/\d+/)[0]) || 0) / 100);
                    if (totalHundreds <= 99) {
                        if (totalHundreds <= 19) {
                            return ones[totalHundreds] + ' hundred';
                        } else {
                            const hundredsTens = Math.floor(totalHundreds / 10);
                            const hundredsOnes = totalHundreds % 10;
                            let hundredResult = tens[hundredsTens];
                            if (hundredsOnes > 0) hundredResult += '-' + ones[hundredsOnes];
                            return hundredResult + ' hundred';
                        }
                    }
                }
                
                result += ones[hundreds] + ' hundred';
                num %= 100;
                if (num > 0) result += ' ';
            }
            
            // Handle tens and ones
            if (num >= 20) {
                const tensDigit = Math.floor(num / 10);
                const onesDigit = num % 10;
                result += tens[tensDigit];
                if (onesDigit > 0) result += '-' + ones[onesDigit];
            } else if (num > 0) {
                result += ones[num];
            }
            
            return result.trim();
        }
        
        // Handle special "hunnid" format for round hundreds
        function handleHundreds(num) {
            if (num % 100 === 0 && num >= 100) {
                const hundreds = num / 100;
                if (hundreds <= 19) {
                    return ones[hundreds] + ' hundred';
                } else {
                    const tensDigit = Math.floor(hundreds / 10);
                    const onesDigit = hundreds % 10;
                    let result = tens[tensDigit];
                    if (onesDigit > 0) result += '-' + ones[onesDigit];
                    return result + ' hundred';
                }
            }
            return numberToWords(num);
        }
        
        // Create protected ranges for exemptions - same order as findConvertibleNumbers
        let protectedRanges = [];
        let protectedIndex = 0;
        
        // 1. FIRST: Protect entire square bracket sections (highest priority)
        text = text.replace(/\[[^\]]*\]/g, function(match) {
            const placeholder = `__BRACKET_SECTION_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        // 1.5. Handle "X hundred" patterns early (like "10 hundred" = "one thousand")
        text = text.replace(/\b(\d+)\s+hundred\b/gi, function(match, numStr) {
            const num = parseInt(numStr);
            let converted;
            if (num === 10) converted = 'one thousand';
            else if (num === 20) converted = 'two thousand';
            else if (num === 30) converted = 'three thousand';
            else converted = numberToWords(num) + ' hundred';
            
            // Don't protect, just convert directly
            return converted;
        });
        
        // 2. Protect phone numbers (need to be before general number patterns)
        // Standard phone formats: 555-123-4567, 555.123.4567, etc.
        text = text.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, function(match) {
            const placeholder = `__PHONE_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        // Also protect shorter phone patterns like 867-5309
        text = text.replace(/\b\d{3}-\d{4}\b/g, function(match) {
            const placeholder = `__PHONE_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        // 3. Protect times (need to be before general number patterns)
        const timePatterns = [
            /\b(\d{1,2}):(\d{2})\s*(a\.m\.|p\.m\.|AM|PM|am|pm)?\b/g,
            /\b(\d{1,2})\s*(a\.m\.|p\.m\.|AM|PM|am|pm)\b/g,
            /\b(\d{1,2})\s*o'clock\b/gi,
            /\b(\d)\s*(a\.m\.|p\.m\.|AM|PM|am|pm)\b/g  // Single digit times like "6 a.m."
        ];
        
        timePatterns.forEach(pattern => {
            text = text.replace(pattern, function(match) {
                let normalizedTime = match;
                
                // Normalize time format
                normalizedTime = normalizedTime.replace(/\b(\d{1,2}):00\s*(a\.m\.|p\.m\.)/gi, '$1 $2');
                normalizedTime = normalizedTime.replace(/\b(am|AM)\b/g, 'a.m.');
                normalizedTime = normalizedTime.replace(/\b(pm|PM)\b/g, 'p.m.');
                normalizedTime = normalizedTime.replace(/\b(\d{1,2})\s*O'clock/gi, '$1 o\'clock');
                
                const placeholder = `__TIME_${protectedIndex}__`;
                protectedRanges.push({ placeholder, original: normalizedTime });
                protectedIndex++;
                return placeholder;
            });
        });
        
        // 4. Protect decimals (3.5, .9, 0.75, etc.) - MUST include decimals starting with just a dot
        text = text.replace(/\b\d*\.\d+\b/g, function(match) {
            const placeholder = `__DECIMAL_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        // Also protect decimals that start with just a period (like .380, .45)
        text = text.replace(/\.\d+\b/g, function(match) {
            const placeholder = `__DECIMAL_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        // Protect decimals followed by units (like 7.62mm)
        text = text.replace(/\b\d+\.\d+[a-zA-Z]+\b/g, function(match) {
            const placeholder = `__DECIMAL_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        // 4.5. Protect percentages (number followed by %)
        text = text.replace(/\b\d+%/g, function(match) {
            const placeholder = `__PERCENTAGE_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        text = text.replace(/\b\d+\.\d+%/g, function(match) {
            const placeholder = `__PERCENTAGE_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        // 5. Protect ALL 4-digit and longer numbers (years, addresses, IDs, etc. - too complex to differentiate)
        text = text.replace(/\b\d{4,}s?\b/g, function(match) {
            const placeholder = `__FOURDIGIT_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        // 6. Protect specific compound words and model numbers
        // Only protect if it's truly a compound word (not just plural 's')
        text = text.replace(/\b\d+[a-rt-z]\w+\b/gi, function(match) {
            const placeholder = `__COMPOUND_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        text = text.replace(/\b[a-zA-Z]+\d+\b/g, function(match) {
            const placeholder = `__LETTER_NUM_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        // 7. Protect firearm calibers
        text = text.replace(/\b\.\d{3}\b/g, function(match) {
            const placeholder = `__CALIBER_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        text = text.replace(/\b\d+mm\b/gi, function(match) {
            const placeholder = `__MM_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        // 8. Protect specific proper nouns
        const properNouns = [
            /\b(Royce\s+da\s+5'9"?)\b/gi,
            /\b(Nintendo\s+64)\b/gi,
            /\b(Area\s+51)\b/gi,
            /\b(iPhone\s*\d+)\b/gi,
            /\b(PlayStation\s*\d+)\b/gi,
            /\b(Xbox\s*(360|One|Series\s*[XS]|\d+))\b/gi
        ];
        
        properNouns.forEach(pattern => {
            text = text.replace(pattern, function(match) {
                const placeholder = `__PROPER_NOUN_${protectedIndex}__`;
                protectedRanges.push({ placeholder, original: match });
                protectedIndex++;
                return placeholder;
            });
        });
        
        // 9. Protect common numerical terms
        const numericalTerms = [
            /\b24\/7\b/g,
            /\b365\b/g,
            /\b911\b/g,
            /\b411\b/g
        ];
        
        numericalTerms.forEach(pattern => {
            text = text.replace(pattern, function(match) {
                const placeholder = `__TERM_${protectedIndex}__`;
                protectedRanges.push({ placeholder, original: match });
                protectedIndex++;
                return placeholder;
            });
        });
        
        // 10. Protect police numerical slang
        text = text.replace(/\b5-0\b/g, function(match) {
            const placeholder = `__POLICE_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        // Only protect "12" when it's clearly police slang (with context words)
        text = text.replace(/\b12\b(?=\s+(?:pulling|watching|coming|on\s+the|is\s+the|are\s+the))/gi, function(match) {
            const placeholder = `__POLICE_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        text = text.replace(/(?:the\s+)\b12\b/gi, function(match) {
            const placeholder = `__POLICE_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        // 11. Protect whitelisted numbers
        whitelist.forEach(num => {
            const pattern = new RegExp(`\\b${num}\\b`, 'g');
            text = text.replace(pattern, function(match) {
                const placeholder = `__WHITELIST_${protectedIndex}__`;
                protectedRanges.push({ placeholder, original: match });
                protectedIndex++;
                return placeholder;
            });
        });
        
                // 12. Protect K numbers that are not multiples of 100
         text = text.replace(/\b(\d+)K\b/gi, function(match, num) {
             const numVal = parseInt(num);
             if (numVal % 100 !== 0) {
                 const placeholder = `__K_NUMBER_${protectedIndex}__`;
                 protectedRanges.push({ placeholder, original: match });
                 protectedIndex++;
                 return placeholder;
             }
             return match; // Keep for conversion - this allows 100K, 200K, etc. to be converted
         });
        
        // 13. Protect model numbers (single letter + number)
        text = text.replace(/\b[A-Z]\d+\b/g, function(match) {
            const placeholder = `__MODEL_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        // Handle plural numbers ending in 's' (convert number part and keep plural)
        text = text.replace(/\b(\d+)s\b/g, function(match, numStr) {
            const num = parseInt(numStr);
            
            // Special handling for common plural forms
            if (num % 100 === 0 && num >= 100) {
                const hundreds = num / 100;
                if (hundreds <= 19) {
                    return ones[hundreds] + ' hundreds';
                } else {
                    const tensDigit = Math.floor(hundreds / 10);
                    const onesDigit = hundreds % 10;
                    let result = tens[tensDigit];
                    if (onesDigit > 0) result += '-' + ones[onesDigit];
                    return result + ' hundreds';
                }
            } else if (num >= 20 && num < 100 && num % 10 === 0) {
                // For round tens (20s, 30s, etc.)
                const tensDigit = Math.floor(num / 10);
                return tens[tensDigit].slice(0, -1) + 'ies'; // twenty -> twenties
            } else {
                // For other numbers, add 's' or 'es' appropriately
                const wordForm = numberToWords(num);
                // Numbers ending in 'x' need 'es' (six -> sixes)
                if (wordForm.endsWith('x')) {
                    return wordForm + 'es';
                }
                return wordForm + 's';
            }
        });
        
        // Convert remaining numbers
        text = text.replace(/\b\d+\b/g, function(match) {
            const num = parseInt(match);
            
            // Handle special cases for multiples of 100
            if (num % 100 === 0 && num >= 100) {
                return handleHundreds(num);
            }
            
            return numberToWords(num);
        });
        
        // Restore protected content
        protectedRanges.forEach(({ placeholder, original }) => {
            text = text.replace(placeholder, original);
        });
        
        return text;
    }

    // Interactive number conversion system
    let currentNumberConversion = null;
    let declinedNumbers = new Set(); // Track numbers user said "no" to on this page
    
    // Function to create unique ID for a number instance
    function createNumberUID(text, position, numberText) {
        // Create context around the number for uniqueness
        const contextStart = Math.max(0, position - 20);
        const contextEnd = Math.min(text.length, position + numberText.length + 20);
        const context = text.slice(contextStart, contextEnd);
        
        // Create UID from number, position, and context
        return `${numberText}_${position}_${context.replace(/\s+/g, '_')}`;
    }
    
    // Function to get localStorage key for declined numbers on this page
    function getDeclinedNumbersKey() {
        const url = window.location.href;
        const baseUrl = url.split('?')[0].split('#')[0]; // Remove query params and hash
        return `genius-declined-numbers-${baseUrl}`;
    }
    
    // Function to save declined numbers to localStorage
    function saveDeclinedNumbers() {
        try {
            const now = Date.now();
            const dataToSave = {};
            
            // Convert Set to object with timestamps
            declinedNumbers.forEach(uid => {
                dataToSave[uid] = now;
            });
            
            localStorage.setItem(getDeclinedNumbersKey(), JSON.stringify(dataToSave));
        } catch (e) {
        }
    }
    
    // Function to load declined numbers from localStorage
    function loadDeclinedNumbers() {
        try {
            const saved = localStorage.getItem(getDeclinedNumbersKey());
            if (saved) {
                const data = JSON.parse(saved);
                const now = Date.now();
                const oneWeek = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
                
                // Filter out entries older than a week and load valid ones
                const validEntries = {};
                Object.keys(data).forEach(uid => {
                    const timestamp = data[uid];
                    if (now - timestamp <= oneWeek) {
                        validEntries[uid] = timestamp;
                        declinedNumbers.add(uid);
                    }
                });
                
                // Save back the cleaned data if we removed any old entries
                if (Object.keys(validEntries).length !== Object.keys(data).length) {
                    localStorage.setItem(getDeclinedNumbersKey(), JSON.stringify(validEntries));
                }
            }
        } catch (e) {
            console.log('Failed to load declined numbers:', e);
        }
    }
    
    function startInteractiveNumberConversion(textEditor) {
        if (!textEditor) return;
        
        let text;
        if (textEditor.tagName === 'TEXTAREA' || textEditor.tagName === 'INPUT') {
            text = textEditor.value;
        } else if (textEditor.isContentEditable) {
            text = textEditor.innerText || textEditor.textContent;
        }
        
        if (!text) return;
        

        
        // Find convertible numbers using the same protection logic as convertNumbersToText
        const convertibleNumbers = findConvertibleNumbers(text);
        
        if (convertibleNumbers.length === 0) {
            return;
        }
        processNumberConversionsInteractively(textEditor, convertibleNumbers, 0);
    }
    
    function findConvertibleNumbers(text) {
        // Use the EXACT same protection logic as convertNumbersToText
        // but instead of converting, collect the numbers that would be converted
        
        const whitelist = ['1600', '3500', '1629', '808', '360', '999', '1337', '420', '187'];
        
        // Apply the same protection logic as convertNumbersToText
        let workingText = text;
        let protectedRanges = [];
        let protectedIndex = 0;
        
        // 1. FIRST: Protect entire square bracket sections (highest priority)
        workingText = workingText.replace(/\[[^\]]*\]/g, function(match) {

            const placeholder = `__BRACKET_SECTION_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        // 1.5. Handle "X hundred" patterns early (like "10 hundred" = "one thousand")
        workingText = workingText.replace(/\b(\d+)\s+hundred\b/gi, function(match, numStr) {
            const placeholder = `__X_HUNDRED_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        // 2. Protect phone numbers
        workingText = workingText.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, function(match) {
            const placeholder = `__PHONE_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        workingText = workingText.replace(/\b\d{3}-\d{4}\b/g, function(match) {
            const placeholder = `__PHONE_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        // 3. Protect times
        const timePatterns = [
            /\b(\d{1,2}):(\d{2})\s*(a\.m\.|p\.m\.|AM|PM|am|pm)?\b/g,
            /\b(\d{1,2})\s*(a\.m\.|p\.m\.|AM|PM|am|pm)\b/g,
            /\b(\d{1,2})\s*o'clock\b/gi,
            /\b(\d)\s*(a\.m\.|p\.m\.|AM|PM|am|pm)\b/g
        ];
        
        timePatterns.forEach(pattern => {
            workingText = workingText.replace(pattern, function(match) {
                const placeholder = `__TIME_${protectedIndex}__`;
                protectedRanges.push({ placeholder, original: match });
                protectedIndex++;
                return placeholder;
            });
        });
        
        // 4. Protect decimals
        workingText = workingText.replace(/\b\d*\.\d+\b/g, function(match) {
            const placeholder = `__DECIMAL_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        workingText = workingText.replace(/\.\d+\b/g, function(match) {
            const placeholder = `__DECIMAL_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        workingText = workingText.replace(/\b\d+\.\d+[a-zA-Z]+\b/g, function(match) {
            const placeholder = `__DECIMAL_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        // 4.5. Protect percentages
        workingText = workingText.replace(/\b\d+%/g, function(match) {
            const placeholder = `__PERCENTAGE_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        workingText = workingText.replace(/\b\d+\.\d+%/g, function(match) {
            const placeholder = `__PERCENTAGE_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        // 5. Protect ALL 4-digit and longer numbers (including plurals like "1900s")
        workingText = workingText.replace(/\b\d{4,}s?\b/g, function(match) {
            const placeholder = `__FOURDIGIT_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        // 6. Protect compound words and model numbers
        workingText = workingText.replace(/\b\d+[a-rt-z]\w+\b/gi, function(match) {
            const placeholder = `__COMPOUND_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        workingText = workingText.replace(/\b[a-zA-Z]+\d+\b/g, function(match) {
            const placeholder = `__LETTER_NUM_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        // 7. Protect firearm calibers
        workingText = workingText.replace(/\b\.\d{3}\b/g, function(match) {
            const placeholder = `__CALIBER_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        workingText = workingText.replace(/\b\d+mm\b/gi, function(match) {
            const placeholder = `__MM_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        // 8. Protect proper nouns
        const properNouns = [
            /\b(Royce\s+da\s+5'9"?)\b/gi,
            /\b(Nintendo\s+64)\b/gi,
            /\b(Area\s+51)\b/gi,
            /\b(iPhone\s*\d+)\b/gi,
            /\b(PlayStation\s*\d+)\b/gi,
            /\b(Xbox\s*(360|One|Series\s*[XS]|\d+))\b/gi
        ];
        
        properNouns.forEach(pattern => {
            workingText = workingText.replace(pattern, function(match) {
                const placeholder = `__PROPER_NOUN_${protectedIndex}__`;
                protectedRanges.push({ placeholder, original: match });
                protectedIndex++;
                return placeholder;
            });
        });
        
        // 9. Protect common numerical terms
        const numericalTerms = [
            /\b24\/7\b/g,
            /\b365\b/g,
            /\b911\b/g,
            /\b411\b/g
        ];
        
        numericalTerms.forEach(pattern => {
            workingText = workingText.replace(pattern, function(match) {
                const placeholder = `__TERM_${protectedIndex}__`;
                protectedRanges.push({ placeholder, original: match });
                protectedIndex++;
                return placeholder;
            });
        });
        
        // 10. Protect police numerical slang
        workingText = workingText.replace(/\b5-0\b/g, function(match) {
            const placeholder = `__POLICE_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        workingText = workingText.replace(/\b12\b(?=\s+(?:pulling|watching|coming|on\s+the|is\s+the|are\s+the))/gi, function(match) {
            const placeholder = `__POLICE_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        workingText = workingText.replace(/(?:the\s+)\b12\b/gi, function(match) {
            const placeholder = `__POLICE_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        // 11. Protect whitelisted numbers
        whitelist.forEach(num => {
            const pattern = new RegExp(`\\b${num}\\b`, 'g');
            workingText = workingText.replace(pattern, function(match) {
                const placeholder = `__WHITELIST_${protectedIndex}__`;
                protectedRanges.push({ placeholder, original: match });
                protectedIndex++;
                return placeholder;
            });
        });
        
        // 12. Protect K numbers that are not multiples of 100
        workingText = workingText.replace(/\b(\d+)K\b/gi, function(match, num) {
            const numVal = parseInt(num);
            if (numVal % 100 !== 0) {
                const placeholder = `__K_NUMBER_${protectedIndex}__`;
                protectedRanges.push({ placeholder, original: match });
                protectedIndex++;
                return placeholder;
            }
            return match; // Keep for potential conversion
        });
        
        // 13. Protect model numbers (single letter + number)
        workingText = workingText.replace(/\b[A-Z]\d+\b/g, function(match) {
            const placeholder = `__MODEL_${protectedIndex}__`;
            protectedRanges.push({ placeholder, original: match });
            protectedIndex++;
            return placeholder;
        });
        
        // Now find all remaining numbers that would be converted
        console.log('Working text after all protections:');
        console.log(workingText);
        console.log('Protected ranges:', protectedRanges.map(r => r.original));
        
        const convertibleNumbers = [];
        
        // Handle plural numbers ending in 's' (these would be converted)
        workingText.replace(/\b(\d+)s\b/g, function(match, numStr, position) {
            console.log('Found plural number in working text:', match, 'at position', position);
            const originalPosition = findOriginalPosition(text, match, position, protectedRanges);
            if (originalPosition !== -1) {
                // Double-check this number isn't inside protected content
                if (!isInsideProtectedContent(text, originalPosition, match, protectedRanges)) {
                    const converted = convertPluralNumber(numStr);
                    const uid = createNumberUID(text, originalPosition, match);
                    
                    // Skip if user already declined this number
                    if (declinedNumbers.has(uid)) {
                        console.log('Skipping previously declined plural number:', match);
                        return match;
                    }
                    
                    console.log('Adding plural conversion:', match, '→', converted, 'at position', originalPosition);
                    convertibleNumbers.push({
                        original: match,
                        converted: converted,
                        position: originalPosition,
                        uid: uid
                    });
                } else {
                    console.log('Skipping plural number inside protected content:', match);
                }
            }
            return match;
        });
        
        // Find remaining standalone numbers (these would be converted)
        workingText.replace(/\b\d+\b/g, function(match, position) {
            console.log('Found standalone number in working text:', match, 'at position', position);
            const num = parseInt(match);
            const originalPosition = findOriginalPosition(text, match, position, protectedRanges);
            if (originalPosition !== -1) {
                // Double-check this number isn't inside protected content
                if (!isInsideProtectedContent(text, originalPosition, match, protectedRanges)) {
                    const converted = convertStandaloneNumber(num);
                    const uid = createNumberUID(text, originalPosition, match);
                    
                    // Skip if user already declined this number
                    if (declinedNumbers.has(uid)) {
                        console.log('Skipping previously declined standalone number:', match);
                        return match;
                    }
                    
                    console.log('Adding standalone conversion:', match, '→', converted, 'at position', originalPosition);
                    convertibleNumbers.push({
                        original: match,
                        converted: converted,
                        position: originalPosition,
                        uid: uid
                    });
                } else {
                    console.log('Skipping standalone number inside protected content:', match);
                }
            }
            return match;
        });
        
        // Sort by position to maintain order
        convertibleNumbers.sort((a, b) => a.position - b.position);
        
        console.log('Found convertible numbers:', convertibleNumbers.map(c => c.original));
        return convertibleNumbers;
    }
    
    function findOriginalPosition(originalText, numberText, workingPosition, protectedRanges) {
        // Since we have the number text, we can find all occurrences in original text
        // and match them with word boundaries
        
        const regex = new RegExp('\\b' + numberText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
        const matches = [];
        let match;
        
        while ((match = regex.exec(originalText)) !== null) {
            matches.push(match.index);
        }
        
        if (matches.length === 0) {
            return -1; // Number not found in original text
        }
        
        if (matches.length === 1) {
            return matches[0]; // Only one match, return it
        }
        
        // Multiple matches - need to determine which one corresponds to our working position
        // Calculate approximate original position by accounting for protected ranges
        let estimatedPosition = workingPosition;
        
        // Sort protected ranges by their original position in text
        const sortedRanges = [...protectedRanges].sort((a, b) => {
            const aPos = originalText.indexOf(a.original);
            const bPos = originalText.indexOf(b.original);
            return aPos - bPos;
        });
        
        // Adjust position based on length differences from protections
        for (const { placeholder, original } of sortedRanges) {
            const originalPos = originalText.indexOf(original);
            if (originalPos !== -1 && originalPos < estimatedPosition) {
                const lengthDiff = original.length - placeholder.length;
                estimatedPosition += lengthDiff;
            }
        }
        
        // Find the closest match to our estimated position
        let closestMatch = matches[0];
        let closestDistance = Math.abs(matches[0] - estimatedPosition);
        
        for (let i = 1; i < matches.length; i++) {
            const distance = Math.abs(matches[i] - estimatedPosition);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestMatch = matches[i];
            }
        }
        
        return closestMatch;
    }
    
    function isInsideProtectedContent(originalText, position, numberText, protectedRanges) {
        // Check if the number at this position is inside any of the original protected ranges
        
        for (const { original } of protectedRanges) {
            // Find all occurrences of this protected content in the original text
            let searchStart = 0;
            let protectedStart;
            
            while ((protectedStart = originalText.indexOf(original, searchStart)) !== -1) {
                const protectedEnd = protectedStart + original.length;
                
                // Check if our number position falls within this protected range
                if (position >= protectedStart && position + numberText.length <= protectedEnd) {
                    console.log('Number', numberText, 'at position', position, 'is inside protected content:', original);
                    return true;
                }
                
                searchStart = protectedStart + 1;
            }
        }
        
        return false;
    }
    
    function convertPluralNumber(numStr) {
        const num = parseInt(numStr);
        const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 
                     'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 
                     'seventeen', 'eighteen', 'nineteen'];
        const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
        
        if (num % 100 === 0 && num >= 100) {
            const hundreds = num / 100;
            if (hundreds <= 19) {
                return ones[hundreds] + ' hundreds';
            } else {
                const tensDigit = Math.floor(hundreds / 10);
                const onesDigit = hundreds % 10;
                let result = tens[tensDigit];
                if (onesDigit > 0) result += '-' + ones[onesDigit];
                return result + ' hundreds';
            }
        } else if (num >= 20 && num < 100 && num % 10 === 0) {
            const tensDigit = Math.floor(num / 10);
            return tens[tensDigit].slice(0, -1) + 'ies';
        } else {
            const wordForm = convertStandaloneNumber(num);
            if (wordForm.endsWith('x')) {
                return wordForm + 'es';
            }
            return wordForm + 's';
        }
    }
    
    function convertStandaloneNumber(num) {
        if (num === 0) return 'zero';
        
        const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 
                     'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 
                     'seventeen', 'eighteen', 'nineteen'];
        const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
        
        let result = '';
        
        // Handle thousands
        if (num >= 1000) {
            const thousands = Math.floor(num / 1000);
            if (thousands <= 19) {
                result += ones[thousands] + ' thousand';
            } else {
                const thousandsTens = Math.floor(thousands / 10);
                const thousandsOnes = thousands % 10;
                result += tens[thousandsTens];
                if (thousandsOnes > 0) result += '-' + ones[thousandsOnes];
                result += ' thousand';
            }
            num %= 1000;
            if (num > 0) result += ' ';
        }
        
        // Handle hundreds
        if (num >= 100) {
            const hundreds = Math.floor(num / 100);
            result += ones[hundreds] + ' hundred';
            num %= 100;
            if (num > 0) result += ' ';
        }
        
        // Handle tens and ones
        if (num >= 20) {
            const tensDigit = Math.floor(num / 10);
            const onesDigit = num % 10;
            result += tens[tensDigit];
            if (onesDigit > 0) result += '-' + ones[onesDigit];
        } else if (num > 0) {
            result += ones[num];
        }
        
        return result.trim();
    }
    

    
    function processNumberConversionsInteractively(textEditor, conversions, currentIndex) {
        if (currentIndex >= conversions.length) {
            console.log('Interactive number conversion completed');
            return;
        }
        
        const conversion = conversions[currentIndex];
        
        // Re-find the current position of this number in case text has changed
        const currentPosition = findCurrentPosition(textEditor, conversion, currentIndex > 0);
        if (currentPosition === -1) {
            // Number not found, skip to next
            console.log('Number not found, skipping:', conversion.original);
            processNumberConversionsInteractively(textEditor, conversions, currentIndex + 1);
            return;
        }
        
        // Update the conversion with current position
        const currentConversion = {
            ...conversion,
            position: currentPosition
        };
        
        showNumberConversionPopup(textEditor, currentConversion, () => {
            // Yes - apply this conversion
            applyConversion(textEditor, currentConversion);
            
            // Update positions of remaining conversions
            const lengthDiff = currentConversion.converted.length - currentConversion.original.length;
            for (let i = currentIndex + 1; i < conversions.length; i++) {
                if (conversions[i].position > currentConversion.position) {
                    conversions[i].position += lengthDiff;
                }
            }
            
            processNumberConversionsInteractively(textEditor, conversions, currentIndex + 1);
        }, () => {
            // No - skip this conversion
            processNumberConversionsInteractively(textEditor, conversions, currentIndex + 1);
        }, () => {
            // No to all - decline all remaining conversions
            console.log('No to all selected - declining all remaining number conversions');
            
            // Add all remaining conversions (including current) to declined list
            for (let i = currentIndex; i < conversions.length; i++) {
                declinedNumbers.add(conversions[i].uid);
                console.log('Declined (no to all):', conversions[i].original, 'UID:', conversions[i].uid);
            }
            
            // Save all declined numbers to localStorage
            saveDeclinedNumbers();
            
            return; // Exit without processing any more conversions
        }, conversions, currentIndex);
    }
    
    function findCurrentPosition(textEditor, conversion, hasChanges) {
        let text;
        if (textEditor.tagName === 'TEXTAREA' || textEditor.tagName === 'INPUT') {
            text = textEditor.value;
        } else if (textEditor.isContentEditable) {
            text = textEditor.innerText || textEditor.textContent;
        }
        
        if (!text) return -1;
        
        // If no changes have been made yet, use original position
        if (!hasChanges) {
            const textAtPosition = text.slice(conversion.position, conversion.position + conversion.original.length);
            if (textAtPosition === conversion.original) {
                return conversion.position;
            }
        }
        
        // Search for the number near the expected position
        const searchStart = Math.max(0, conversion.position - 100);
        const searchEnd = Math.min(text.length, conversion.position + 100);
        const searchArea = text.slice(searchStart, searchEnd);
        
        const regex = new RegExp('\\b' + conversion.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
        const match = regex.exec(searchArea);
        
        if (match) {
            return searchStart + match.index;
        }
        
        // Fallback: search the entire text
        const fullMatch = regex.exec(text);
        if (fullMatch) {
            return fullMatch.index;
        }
        
        return -1; // Not found
    }
    
    function applyConversion(textEditor, conversion) {
        if (textEditor.tagName === 'TEXTAREA' || textEditor.tagName === 'INPUT') {
            const value = textEditor.value;
            
            // Double-check that we're replacing the right text at the right position
            const textAtPosition = value.slice(conversion.position, conversion.position + conversion.original.length);
            if (textAtPosition !== conversion.original) {
                console.warn('Number mismatch at position', conversion.position, 'expected:', conversion.original, 'found:', textAtPosition);
                return;
            }
            
            const before = value.slice(0, conversion.position);
            const after = value.slice(conversion.position + conversion.original.length);
            const newValue = before + conversion.converted + after;
            
            textEditor.value = newValue;
            textEditor.dispatchEvent(new Event('input', { bubbles: true }));
            
            console.log('Applied conversion:', conversion.original, '→', conversion.converted, 'at position', conversion.position);
        } else if (textEditor.isContentEditable) {
            const content = textEditor.textContent;
            
            // Double-check that we're replacing the right text at the right position
            const textAtPosition = content.slice(conversion.position, conversion.position + conversion.original.length);
            if (textAtPosition !== conversion.original) {
                console.warn('Number mismatch at position', conversion.position, 'expected:', conversion.original, 'found:', textAtPosition);
            return;
        }
        
            const before = content.slice(0, conversion.position);
            const after = content.slice(conversion.position + conversion.original.length);
            const newContent = before + conversion.converted + after;
            
            textEditor.textContent = newContent;
            textEditor.dispatchEvent(new Event('input', { bubbles: true }));
            
            console.log('Applied conversion:', conversion.original, '→', conversion.converted, 'at position', conversion.position);
        }
    }
    
    function showNumberConversionPopup(textEditor, conversion, onYes, onNo, onNoToAll, conversions, currentIndex) {
        // Remove any existing popup and associated listeners
        cleanupCurrentNumberPopup();
        
        // Highlight the number in red in the text editor
        highlightNumberInEditor(textEditor, conversion);
        
        // Create popup with sleek transparent styling
        const popup = document.createElement('div');
        popup.id = 'number-conversion-popup';
        popup.style.cssText = `
            position: absolute;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(8px);
            border-radius: 8px;
            padding: 12px 16px;
            z-index: 10003;
            font-family: 'Programme', Arial, sans-serif;
            min-width: 200px;
            max-width: 280px;
        `;
        
        const question = document.createElement('div');
        question.style.cssText = `
            margin-bottom: 10px;
            font-size: 13px;
            color: #fff;
            font-weight: 300;
        `;
        question.innerHTML = `Convert <strong style="color: #ffeb3b;">${conversion.original}</strong> to <strong style="color: #4ee153;">${conversion.converted}</strong>?`;
        
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 6px;
            justify-content: flex-start;
        `;
        
        const yesBtn = document.createElement('button');
        yesBtn.textContent = 'Yes (Enter)';
        yesBtn.style.cssText = `
            background: rgba(76, 175, 80, 0.9);
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 10px;
            cursor: pointer;
            font-size: 11px;
            font-family: 'Programme', Arial, sans-serif;
            font-weight: 300;
            transition: background 0.2s ease;
        `;
        
        const noBtn = document.createElement('button');
        noBtn.textContent = 'No (Esc)';
        noBtn.style.cssText = `
            background: rgba(158, 158, 158, 0.7);
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 10px;
            cursor: pointer;
            font-size: 11px;
            font-family: 'Programme', Arial, sans-serif;
            font-weight: 300;
            transition: background 0.2s ease;
        `;
        
        const noToAllBtn = document.createElement('button');
        // Show how many numbers will be declined
        const remainingCount = conversions ? conversions.length - currentIndex : 1;
        noToAllBtn.textContent = `No to all (${remainingCount})`;
        noToAllBtn.style.cssText = `
            background: rgba(244, 67, 54, 0.9);
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 10px;
            cursor: pointer;
            font-size: 11px;
            font-family: 'Programme', Arial, sans-serif;
            font-weight: 300;
            transition: background 0.2s ease;
        `;
        
        // Hover effects
        yesBtn.addEventListener('mouseenter', () => {
            yesBtn.style.background = 'rgba(76, 175, 80, 1)';
        });
        yesBtn.addEventListener('mouseleave', () => {
            yesBtn.style.background = 'rgba(76, 175, 80, 0.9)';
        });
        
        noBtn.addEventListener('mouseenter', () => {
            noBtn.style.background = 'rgba(158, 158, 158, 0.9)';
        });
        noBtn.addEventListener('mouseleave', () => {
            noBtn.style.background = 'rgba(158, 158, 158, 0.7)';
        });
        
        noToAllBtn.addEventListener('mouseenter', () => {
            noToAllBtn.style.background = 'rgba(244, 67, 54, 1)';
        });
        noToAllBtn.addEventListener('mouseleave', () => {
            noToAllBtn.style.background = 'rgba(244, 67, 54, 0.9)';
        });
        
        yesBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            removeNumberHighlight(textEditor);
            cleanupCurrentNumberPopup();
            onYes();
        });

        noBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Remember this number was declined
            declinedNumbers.add(conversion.uid);
            saveDeclinedNumbers();
            console.log('Added to declined numbers:', conversion.uid);
            removeNumberHighlight(textEditor);
            cleanupCurrentNumberPopup();
            onNo();
        });

        noToAllBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            removeNumberHighlight(textEditor);
            cleanupCurrentNumberPopup();
            if (onNoToAll) onNoToAll();
        });
        
        // Keyboard support
        const keyHandler = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                removeNumberHighlight(textEditor);
                cleanupCurrentNumberPopup();
                onYes();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                // Remember this number was declined
                declinedNumbers.add(conversion.uid);
                saveDeclinedNumbers();
                console.log('Added to declined numbers (Escape key):', conversion.uid);
                removeNumberHighlight(textEditor);
                cleanupCurrentNumberPopup();
                onNo();
            }
        };
        
        document.addEventListener('keydown', keyHandler);
        
        buttonContainer.appendChild(yesBtn);
        buttonContainer.appendChild(noBtn);
        buttonContainer.appendChild(noToAllBtn);
        popup.appendChild(question);
        popup.appendChild(buttonContainer);
        
        // Position popup and update on scroll
        const updatePosition = positionPopupBelowFormatSection(popup);
        window.addEventListener('scroll', updatePosition);
        window.addEventListener('resize', updatePosition);
        textEditor.addEventListener('scroll', updatePosition);
        updatePosition();

        document.body.appendChild(popup);
        currentNumberConversion = { popup, keyHandler, updatePosition, scrollTarget: textEditor };

        // Keep focus on the editor so the number highlight remains visible
    }
    
    function scrollToPosition(textEditor, position) {
        // Focus the editor first
        textEditor.focus();
        
        if (textEditor.tagName === 'TEXTAREA' || textEditor.tagName === 'INPUT') {
            // Set cursor position to highlight the area
            textEditor.selectionStart = position;
            textEditor.selectionEnd = position;
            
            // Calculate line position for scrolling with improved accuracy
            const textUpToPosition = textEditor.value.slice(0, position);
            const lines = textUpToPosition.split('\n');
            const currentLine = lines.length - 1;
            const currentColumn = lines[lines.length - 1].length;
            
            // Get textarea dimensions and styling with more precision
            const styles = window.getComputedStyle(textEditor);
            const lineHeight = parseInt(styles.lineHeight) || parseInt(styles.fontSize) * 1.2 || 20;
            const paddingTop = parseInt(styles.paddingTop) || 0;
            const borderTop = parseInt(styles.borderTopWidth) || 0;
            
            // Calculate more accurate target scroll position
            const lineOffsetFromTop = currentLine * lineHeight;
            const totalVerticalOffset = paddingTop + borderTop + lineOffsetFromTop;
            
            // Center the line in the visible area, but ensure we don't scroll past content
            const visibleHeight = textEditor.clientHeight;
            const targetScrollTop = Math.max(0, 
                Math.min(
                    totalVerticalOffset - (visibleHeight / 3), // Show in top third rather than center
                    textEditor.scrollHeight - visibleHeight
                )
            );
            
            // Apply scroll with validation
            textEditor.scrollTop = targetScrollTop;
            
            // Verify scroll position and adjust if needed
            setTimeout(() => {
                const actualScrollTop = textEditor.scrollTop;
                if (Math.abs(actualScrollTop - targetScrollTop) > 10) {
                    // If scroll didn't work as expected, try alternative method
                    const alternativeTarget = Math.max(0, lineOffsetFromTop - 100);
                    textEditor.scrollTop = alternativeTarget;
                }
            }, 50);
            
            console.log('Scrolled to line:', currentLine, 'column:', currentColumn, 'scrollTop:', targetScrollTop);
        } else {
            // For contenteditable, try to scroll to the specific position
            const range = document.createRange();
            const textNodes = getTextNodes(textEditor);
            
            let currentPos = 0;
            let targetNode = null;
            let targetOffset = 0;
            
            // Find the text node that contains our position
            for (const node of textNodes) {
                const nodeLength = node.textContent.length;
                if (currentPos + nodeLength >= position) {
                    targetNode = node;
                    targetOffset = position - currentPos;
                    break;
                }
                currentPos += nodeLength;
            }
            
            if (targetNode) {
                try {
                    range.setStart(targetNode, Math.min(targetOffset, targetNode.textContent.length));
                    range.setEnd(targetNode, Math.min(targetOffset, targetNode.textContent.length));
                    
                    // Scroll the range into view
                    range.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                    
                    // Set selection to the range
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                } catch (e) {
                    console.log('Range scrolling failed, using fallback:', e);
                    textEditor.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            } else {
                // Fallback: scroll the editor into view
                textEditor.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }
    
    function getTextNodes(element) {
        const textNodes = [];
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }
        
        return textNodes;
    }
    
    function highlightNumberInEditor(textEditor, conversion) {
        // Scroll to the conversion position first
        scrollToPosition(textEditor, conversion.position);

        if (textEditor.tagName === 'TEXTAREA' || textEditor.tagName === 'INPUT') {
            // For textarea/input we create a temporary overlay to highlight characters
            // Store the original selection for restoration
            textEditor._originalSelectionStart = textEditor.selectionStart;
            textEditor._originalSelectionEnd = textEditor.selectionEnd;

            const startPos = conversion.position;
            const endPos = conversion.position + conversion.original.length;

            textEditor.focus();

            // Create highlight overlay
            const parent = textEditor.parentElement;
            if (parent && (parent.style.position === '' || parent.style.position === 'static')) {
                parent.style.position = 'relative';
            }

            const overlay = document.createElement('div');
            overlay.dataset.numberHighlightOverlay = 'true';
            const styles = window.getComputedStyle(textEditor);
            overlay.style.position = 'absolute';
            overlay.style.left = textEditor.offsetLeft + 'px';
            overlay.style.top = textEditor.offsetTop + 'px';
            overlay.style.width = textEditor.offsetWidth + 'px';
            overlay.style.height = textEditor.offsetHeight + 'px';
            overlay.style.pointerEvents = 'none';
            overlay.style.whiteSpace = 'pre-wrap';
            overlay.style.overflow = 'hidden';
            overlay.style.font = styles.font;
            overlay.style.lineHeight = styles.lineHeight;
            overlay.style.padding = styles.padding;
            overlay.style.boxSizing = 'border-box';
            overlay.style.color = styles.color;
            overlay.style.background = 'transparent';
            overlay.style.border = styles.border;
            overlay.style.borderRadius = styles.borderRadius;
            overlay.style.margin = styles.margin;

            const escapeHTML = (str) => str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            const before = escapeHTML(textEditor.value.slice(0, startPos));
            const numberText = escapeHTML(textEditor.value.slice(startPos, endPos));
            const after = escapeHTML(textEditor.value.slice(endPos));
            overlay.innerHTML = `${before}<span style="background:#ff5252;color:white">${numberText}</span>${after}`;

            parent.appendChild(overlay);

            // Keep overlay in sync with textarea scroll
            const syncOverlay = () => {
                overlay.scrollTop = textEditor.scrollTop;
                overlay.scrollLeft = textEditor.scrollLeft;
            };
            textEditor.addEventListener('scroll', syncOverlay);
            syncOverlay();

            textEditor._highlightOverlay = overlay;
            textEditor._overlayScrollHandler = syncOverlay;
            textEditor.classList.add('genius-highlighting-active');
            
            // Make the original text transparent so only the overlay is visible
            textEditor.style.color = 'transparent';
            textEditor.style.caretColor = '#000'; // Keep cursor visible
            
            textEditor._highlightInfo = { overlay, handler: syncOverlay };

        } else if (textEditor.isContentEditable) {
            // For contenteditable, wrap the number in a red span
            const textContent = textEditor.textContent || textEditor.innerText;
            const beforeText = textContent.slice(0, conversion.position);
            const numberText = textContent.slice(conversion.position, conversion.position + conversion.original.length);
            const afterText = textContent.slice(conversion.position + conversion.original.length);
            
            // Create highlighted version
            const highlightedHTML = beforeText + 
                `<span style="background-color: #ff5252; color: white; padding: 1px 2px; border-radius: 2px;" data-number-highlight="true">${numberText}</span>` + 
                afterText;
            
            // Store original content for restoration
            textEditor._originalHTML = textEditor.innerHTML;
            textEditor._originalTextContent = textEditor.textContent;
            
            // Apply highlighted content
            textEditor.innerHTML = highlightedHTML;
            
            // Scroll the highlighted number into view
            const highlightSpan = textEditor.querySelector('[data-number-highlight="true"]');
            if (highlightSpan) {
                highlightSpan.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            }
        }
    }
    
    function removeNumberHighlight(textEditor) {
        console.log('removeNumberHighlight called for:', textEditor?.tagName);
        
        // Global cleanup - remove any highlight overlays in the entire document
        const allOverlays = document.querySelectorAll('[data-number-highlight-overlay="true"]');
        allOverlays.forEach(overlay => {
            console.log('Removing global highlight overlay');
            overlay.remove();
        });
        
        // Global cleanup - remove any highlight spans in contenteditable
        const allHighlightSpans = document.querySelectorAll('[data-number-highlight="true"]');
        allHighlightSpans.forEach(span => {
            console.log('Removing global highlight span');
            const parent = span.parentNode;
            if (parent) {
                parent.replaceChild(document.createTextNode(span.textContent), span);
            }
        });
        
        if (!textEditor) {
            console.log('No textEditor provided, only global cleanup performed');
            return;
        }
        
        if (textEditor.tagName === 'TEXTAREA' || textEditor.tagName === 'INPUT') {
            textEditor.classList.remove('genius-highlighting-active');

            // Restore original text color
            textEditor.style.color = '';
            textEditor.style.caretColor = '';

            if (textEditor._overlayScrollHandler) {
                textEditor.removeEventListener('scroll', textEditor._overlayScrollHandler);
                delete textEditor._overlayScrollHandler;
            }

            if (textEditor._highlightOverlay) {
                console.log('Removing specific textarea overlay');
                textEditor._highlightOverlay.remove();
                delete textEditor._highlightOverlay;
            }

            if (textEditor._originalSelectionStart !== undefined && textEditor._originalSelectionEnd !== undefined) {
                try {
                    textEditor.setSelectionRange(textEditor._originalSelectionStart, textEditor._originalSelectionEnd);
                } catch (e) {
                    console.log('Could not restore selection range:', e);
                }
                delete textEditor._originalSelectionStart;
                delete textEditor._originalSelectionEnd;
            }

            if (textEditor._highlightInfo) {
                delete textEditor._highlightInfo;
            }
            
        } else if (textEditor.isContentEditable) {
            // Restore original content
            if (textEditor._originalHTML !== undefined) {
                console.log('Restoring original HTML content');
                textEditor.innerHTML = textEditor._originalHTML;
                delete textEditor._originalHTML;
                delete textEditor._originalTextContent;
            }
            
            // Additional cleanup for any remaining highlight spans in this editor
            const remainingSpans = textEditor.querySelectorAll('[data-number-highlight="true"]');
            remainingSpans.forEach(span => {
                console.log('Removing remaining highlight span from contenteditable');
                const parent = span.parentNode;
                if (parent) {
                    parent.replaceChild(document.createTextNode(span.textContent), span);
                }
            });
        }
        
        console.log('Number highlight cleanup completed');
    }

    function cleanupCurrentNumberPopup() {
        if (currentNumberConversion && currentNumberConversion.popup) {
            const { popup, keyHandler, updatePosition, scrollTarget } = currentNumberConversion;
            if (updatePosition) {
                window.removeEventListener('scroll', updatePosition);
                window.removeEventListener('resize', updatePosition);
                if (scrollTarget) scrollTarget.removeEventListener('scroll', updatePosition);
            }
            if (keyHandler) {
                document.removeEventListener('keydown', keyHandler);
            }
            if (popup && popup.parentNode) {
                popup.parentNode.removeChild(popup);
            }
            currentNumberConversion = null;
        }
    }
    
    function positionPopupBelowFormatSection(popup) {
        const controlsContainer = document.querySelector('.LyricsEdit-desktop__Controls-sc-6d8e67d6-3') ||
                                 document.querySelector('[class*="LyricsEdit-desktop__Controls"]') ||
                                 document.querySelector('[class*="LyricsEdit"][class*="Controls"]') ||
                                 document.querySelector('[class*="lyrics-edit"][class*="controls"]') ||
                                 document.querySelector('.ihioQH');

        const formatExplainer = controlsContainer && (controlsContainer.querySelector('[class*="LyricsEdit-desktop__Explainer"]') ||
                                   controlsContainer.querySelector('[class*="Explainer"]') ||
                                   controlsContainer.querySelector('*:last-child'));

        const updatePosition = () => {
            if (controlsContainer && formatExplainer) {
                const explainerRect = formatExplainer.getBoundingClientRect();
                const containerRect = controlsContainer.getBoundingClientRect();
                popup.style.position = 'fixed';
                popup.style.left = containerRect.left + 'px';
                popup.style.top = (explainerRect.bottom + 10) + 'px';
                popup.style.maxWidth = (containerRect.width - 20) + 'px';
            } else {
                popup.style.position = 'fixed';
                popup.style.left = '20px';
                popup.style.top = (window.innerHeight - 200) + 'px';
                popup.style.maxWidth = '300px';
            }
        };

        return updatePosition;
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
        if (autoFixSettings.capitalizeI) {
            fixedText = fixedText.replace(/\b(i'mma|imma|ima)\b/gi, "I'ma");
            console.log('After ima fixes:', fixedText !== text ? 'CHANGED' : 'NO CHANGE');

            // Fix standalone "i" to "I" when followed by space, dash, punctuation, or end of string
            fixedText = fixedText.replace(/\bi(?=[\s\-\.,!?;:\)\]\}'""]|$)/g, "I");
            console.log('After i fixes:', fixedText.includes(' I ') ? 'FOUND I' : 'NO I FOUND');

            // Fix "i'" contractions to "I'" (i'm, i'll, i've, i'd, etc.)
            fixedText = fixedText.replace(/\bi'/g, "I'");
        }

        // Auto apostrophe fixes for common contractions
        if (autoFixSettings.contractions) {
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
        }

        // Additional word fixes
        if (autoFixSettings.wordFixes) {
            console.log('Starting additional word fixes...');
        
        // Fix "ok" to "okay" but preserve specific producer tag phrases
        console.log('Processing ok → okay with whitelist...');
        
        // Store whitelisted phrases with placeholders to protect them
        const okWhitelist = [
            /ok,?\s+let\s+me\s+hear\s+your\s+tag/gi,
            /ok\s+is\s+the\s+hardest,?\s+i\s+swear\s+to\s+god/gi
        ];
        
        let protectedPhrases = [];
        let placeholderIndex = 0;
        
        // Replace whitelisted phrases with placeholders
        okWhitelist.forEach(pattern => {
            fixedText = fixedText.replace(pattern, function(match) {
                const placeholder = `__OK_PLACEHOLDER_${placeholderIndex}__`;
                protectedPhrases.push({ placeholder: placeholder, original: match });
                placeholderIndex++;
                console.log('Protected phrase:', match);
                return placeholder;
            });
        });
        
        // Now replace all remaining "ok" instances with "okay"
        fixedText = fixedText.replace(/\bok\b/gi, function(match) {
            // Preserve capitalization
            if (match === 'OK') return 'OKAY';
            if (match === 'Ok') return 'Okay';
            return 'okay';
        });
        
        // Restore the protected phrases
        protectedPhrases.forEach(({ placeholder, original }) => {
            fixedText = fixedText.replace(placeholder, original);
            console.log('Restored phrase:', original);
        });
        
        // Fix "sumn" to "somethin'" (but don't change "somethin'" to "somethin''")
        fixedText = fixedText.replace(/\bsumn(?!')\b/gi, function(match) {
            // Preserve capitalization
            if (match === 'SUMN') return "SOMETHIN'";
            if (match === 'Sumn') return "Somethin'";
            return "somethin'";
        });
        
        // Fix "yuh" and "yea" to "yeah" (preserve capitalization)
        fixedText = fixedText.replace(/\byuh\b/gi, function(match) {
            if (match === 'YUH') return 'YEAH';
            if (match === 'Yuh') return 'Yeah';
            return 'yeah';
        });
        
        fixedText = fixedText.replace(/\byea\b/gi, function(match) {
            if (match === 'YEA') return 'YEAH';
            if (match === 'Yea') return 'Yeah';
            return 'yeah';
        });
        
        // Fix "aye" and "ay" to "ayy"
        fixedText = fixedText.replace(/\b(aye|ay)\b/gi, function(match) {
            if (match === 'AYE' || match === 'AY') return 'AYY';
            if (match === 'Aye' || match === 'Ay') return 'Ayy';
            return 'ayy';
        });
        
        // Fix "hoe" to "ho"
        fixedText = fixedText.replace(/\bhoe\b/gi, function(match) {
            if (match === 'HOE') return 'HO';
            if (match === 'Hoe') return 'Ho';
            return 'ho';
        });
        
        // Fix "skrt" to "skkrt"
        fixedText = fixedText.replace(/\bskrt\b/gi, function(match) {
            if (match === 'SKRT') return 'SKRRT';
            if (match === 'SKRTT') return 'SKRRT';
            if (match === 'Skrtt') return 'Skrrt';
            if (match === 'Skrt') return 'Skrrt';
            if (match === 'skrtt') return 'skrrt';
            return 'skrrt';
        });
        
        // Fix "lil" or "li'l" to "lil'" (but don't change "lil'" to "lil''")
        fixedText = fixedText.replace(/\b(lil|li'l)(?!')\b/gi, function(match) {
            if (match === 'LIL' || match === "LI'L") return "LIL'";
            if (match === 'Lil' || match === "Li'l") return "Lil'";
            return "lil'";
        });
        
        // Fix "whoa" to "woah"
        fixedText = fixedText.replace(/\bwhoa\b/gi, function(match) {
            if (match === 'WHOA') return 'WOAH';
            if (match === 'Whoa') return 'Woah';
            return 'woah';
        });
        
        // Fix "dawg" to "dog"
        fixedText = fixedText.replace(/\bdawg\b/gi, function(match) {
            if (match === 'DAWG') return 'DOG';
            if (match === 'Dawg') return 'Dog';
            return 'dog';
        });
        
        // Fix "choppa" to "chopper"
        fixedText = fixedText.replace(/\bchoppa\b/gi, function(match) {
            if (match === 'CHOPPA') return 'CHOPPER';
            if (match === 'Choppa') return 'Chopper';
            return 'chopper';
        });
        
        // Fix "oughtta" to "oughta"
        fixedText = fixedText.replace(/\boughtta\b/gi, function(match) {
            if (match === 'OUGHTTA') return 'OUGHTA';
            if (match === 'Oughtta') return 'Oughta';
            return 'oughta';
        });
        
        // Fix "naïve" to "naive"
        fixedText = fixedText.replace(/\bnaïve\b/gi, function(match) {
            if (match === 'NAÏVE') return 'NAIVE';
            if (match === 'Naïve') return 'Naive';
            return 'naive';
        });
        
        // Fix "all right" to "alright"
        fixedText = fixedText.replace(/\ball right\b/gi, function(match) {
            if (match === 'ALL RIGHT') return 'ALRIGHT';
            if (match === 'All Right' || match === 'All right') return 'Alright';
            return 'alright';
        });
        
        // Fix "cliche" to "cliché"
        fixedText = fixedText.replace(/\bcliche\b/gi, function(match) {
            if (match === 'CLICHE') return 'CLICHÉ';
            if (match === 'Cliche') return 'Cliché';
            return 'cliché';
        });
        
        // Fix "A.S.A.P." to "ASAP"
        fixedText = fixedText.replace(/\bA\.S\.A\.P\./gi, 'ASAP');
        
        // Fix "V.I.P." and "V.I.P.s" to "VIP" and "VIPs"
        fixedText = fixedText.replace(/\bV\.I\.P\.s\b/gi, 'VIPs');
        fixedText = fixedText.replace(/\bV\.I\.P\./gi, 'VIP');
        
        // Add missing apostrophes to common contractions
        console.log('Adding missing apostrophes...');
        
        // Words that need apostrophes at the end
        fixedText = fixedText.replace(/\bgon\b(?!')/gi, function(match) {
            // Preserve capitalization
            if (match === 'GON') return "GON'";
            if (match === 'Gon') return "Gon'";
            return "gon'";
        });
        
        fixedText = fixedText.replace(/\bfuckin\b(?!')/gi, function(match) {
            if (match === 'FUCKIN') return "FUCKIN'";
            if (match === 'Fuckin') return "Fuckin'";
            return "fuckin'";
        });
        
        fixedText = fixedText.replace(/\byall\b(?!')/gi, function(match) {
            if (match === 'YALL') return "Y'ALL";
            if (match === 'Yall') return "Y'all";
            return "y'all";
        });
        
        // Words that need apostrophes at the beginning (but only in certain contexts)
        // 'til (until)
        fixedText = fixedText.replace(/(?<![''\u2018\u2019])\btil\b(?!')/gi, function(match) {
            if (match === 'TIL') return "'TIL";
            if (match === 'Til') return "'Til";
            return "'til";
        });
        
        // 'cause (because) - be careful not to change "cause" as in "the cause of"
        // Also avoid matching when already preceded by an apostrophe (straight or curly)
        fixedText = fixedText.replace(/(?<![''\u2018\u2019])\bcause\b(?=\s+(?:i|you|he|she|it|we|they|that|this|my|your|his|her|its|our|their))/gi, function(match) {
            if (match === 'CAUSE') return "'CAUSE";
            if (match === 'Cause') return "'Cause";
            return "'cause";
        });
        
        // 'cuz (because) - be careful not to change when it means "cousin"
        // Avoid matching when preceded by possessive pronouns (my cuz, our cuz, etc.)
        // Handle both 'cuz and cuz, don't duplicate apostrophes
        fixedText = fixedText.replace(/(?<!(?:my|our|your|his|her|their|the)\s+)(?<!')('?)cuz\b/gi, function(match, existingApostrophe) {
            // If there's already an apostrophe, don't add another one
            const apostrophe = existingApostrophe ? '' : "'";
            
            if (match === "'CUZ" || match === "CUZ") return apostrophe + "cause";
            if (match === "'Cuz" || match === "Cuz") return apostrophe + "cause";
            return apostrophe + "cause";
        });
        
        // 'bout (about)
        fixedText = fixedText.replace(/(?<![''\u2018\u2019])\bbout\b(?!')/gi, function(match) {
            if (match === 'BOUT') return "'BOUT";
            if (match === 'Bout') return "'Bout";
            return "'bout";
        });
        
        // 'fore (before)
        // Also avoid matching when already preceded by an apostrophe (straight or curly)
        fixedText = fixedText.replace(/(?<![''\u2018\u2019])\bfore\b(?=\s+(?:i|you|he|she|it|we|they|the|a|an|my|your|his|her|its|our|their|this|that|y'all|yall|me|us|all|anyone|everyone|anybody|everybody|someone|somebody|long|now|then|sure|real))/gi, function(match) {
            if (match === 'FORE') return "'FORE";
            if (match === 'Fore') return "'Fore";
            return "'fore";
        });
        
            console.log('After adding missing apostrophes:', 'completed');
        }

        // Fix parentheses formatting - move parentheses outside of bold/italic tags
        if (autoFixSettings.parenthesesFormatting) {
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
                    if (beforeParen) {
                        // If it's just whitespace, don't wrap in formatting tags
                        if (beforeParen.trim()) {
                            result += `<${outerTag}><${innerTag}>${beforeParen}</${innerTag}></${outerTag}>`;
                        } else {
                            result += beforeParen; // Just add the whitespace as-is
                        }
                    }
                    
                    // Add the parenthetical content with both formatting tags inside
                    const parenContent = remaining.substring(openIndex + 1, closeIndex);
                    result += `(<${outerTag}><${innerTag}>${parenContent}</${innerTag}></${outerTag}>)`;
                    
                    // Continue with remaining text
                    remaining = remaining.substring(closeIndex + 1);
                }
                
                // Add any remaining text with both formatting tags
                if (remaining) {
                    // If it's just whitespace, don't wrap in formatting tags
                    if (remaining.trim()) {
                        result += `<${outerTag}><${innerTag}>${remaining}</${innerTag}></${outerTag}>`;
                    } else {
                        result += remaining; // Just add the whitespace as-is
                    }
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
                    if (beforeParen) {
                        // If it's just whitespace, don't wrap in formatting tags
                        if (beforeParen.trim()) {
                            result += `<${tag}>${beforeParen}</${tag}>`;
                        } else {
                            result += beforeParen; // Just add the whitespace as-is
                        }
                    }
                    
                    // Add the parenthetical content with formatting inside
                    const parenContent = remaining.substring(openIndex + 1, closeIndex);
                    result += `(<${tag}>${parenContent}</${tag}>)`;
                    
                    // Continue with remaining text
                    remaining = remaining.substring(closeIndex + 1);
                }
                
                // Add any remaining text with formatting
                if (remaining) {
                    // If it's just whitespace, don't wrap in formatting tags
                    if (remaining.trim()) {
                        result += `<${tag}>${remaining}</${tag}>`;
                    } else {
                        result += remaining; // Just add the whitespace as-is
                    }
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
        
        // Handle edge case: <i>(content</i>) -> (<i>content</i>)
        // Pattern: tag starts with parenthesis but closing parenthesis is outside the tag
        fixedText = fixedText.replace(/<(b|i)>\(([^<]*)<\/\1>\)/gi, '(<$1>$2</$1>)');
        
        // Handle edge case: (<i>content)</i> -> (<i>content</i>)
        // Pattern: opening parenthesis is outside tag but closing parenthesis is inside the tag
        fixedText = fixedText.replace(/\(<(b|i)>([^<]*)\)<\/\1>/gi, '(<$1>$2</$1>)');
        
        // Handle edge case: mixed parentheses with tags
        // Pattern: (<i>content</i>) -> (<i>content</i>) (already correct, but clean up any malformed versions)
        // This handles cases like: (<i>text) followed by </i> somewhere else
        fixedText = fixedText.replace(/\(<(b|i)>([^<)]+)\)([^<]*)<\/\1>/gi, function(match, tag, content, afterParen) {
            // If there's content after the closing parenthesis but before the closing tag, 
            // it means the parenthesis should be moved outside
            if (afterParen.trim() === '') {
                return `(<${tag}>${content}</${tag}>)`;
            }
            return match; // Don't change if there's actual content after the parenthesis
        });
        
        // Handle the reverse case: <i>content)</i> where opening paren is missing or outside
        // This catches orphaned closing parentheses inside tags and moves them outside
        fixedText = fixedText.replace(/<(b|i)>([^<(]*)\)<\/\1>/gi, function(match, tag, content, offset, string) {
            // Check if there's an opening parenthesis before this tag in a reasonable range
            const beforeTag = string.substring(Math.max(0, offset - 50), offset);
            if (beforeTag.includes('(')) {
                // There's a parenthesis before, so move the closing one outside
                return `<${tag}>${content}</${tag}>)`;
            }
            // No matching opening parenthesis found, leave as is or wrap completely
            return `(<${tag}>${content}</${tag}>)`;
        });
        
            console.log('After parentheses fixes:', fixedText.includes('(<b>') || fixedText.includes('(<i>') ? 'FOUND FIXED PARENTHESES' : 'NO PARENTHESES FIXES APPLIED');
        }

        // Detect and mark mismatched parentheses/brackets with warning emojis
        if (autoFixSettings.bracketHighlighting) {
            console.log('Checking for mismatched parentheses/brackets...');
            fixedText = highlightMismatchedBracketsWithEmojis(fixedText);
        }

        // Fix words ending with dash to em dash (only at end of words, not hyphens)
        if (autoFixSettings.emDashFixes) {
            // Pattern: word followed by dash at end of word boundary
            fixedText = fixedText.replace(/(\w)-(?=\s|$)/g, '$1—');
        }

        // Capitalize first letter inside parentheses
        if (autoFixSettings.capitalizeParentheses) {
            console.log('Capitalizing first letter in parentheses...');
            // Pattern: ( followed by optional whitespace and a lowercase letter
            fixedText = fixedText.replace(/\(\s*([a-z])/g, function(match, firstChar) {
                return match.replace(firstChar, firstChar.toUpperCase());
            });
        }

        // Replace multiple consecutive spaces with single space and remove trailing spaces
        if (autoFixSettings.multipleSpaces) {
            console.log('Replacing multiple spaces with single space and removing trailing spaces...');
            // Pattern: 2 or more consecutive space characters
            fixedText = fixedText.replace(/ {2,}/g, ' ');
            // Pattern: spaces or tabs at the end of lines (before newlines)
            fixedText = fixedText.replace(/[ \t]+$/gm, '');
        }



        // Apply custom regex rules BEFORE number conversion
        if (autoFixSettings.customRegex && autoFixSettings.customRegexRules) {
            console.log('Applying custom regex rules...');
            autoFixSettings.customRegexRules.forEach((rule, index) => {
                if (rule.enabled !== false) {
                    try {
                        const regex = new RegExp(rule.find, rule.flags || 'gi');
                        const beforeLength = fixedText.length;
                        
                        // Handle both string and function replacements
                        if (typeof rule.replace === 'function') {
                            fixedText = fixedText.replace(regex, rule.replace);
                        } else {
                            // Convert backslash-based capture group references (\1, \2, etc.) to JavaScript format ($1, $2, etc.)
                            let jsReplacement = rule.replace;
                            if (typeof jsReplacement === 'string') {
                                // Replace \1, \2, \3, etc. with $1, $2, $3, etc.
                                // Use negative lookbehind to avoid replacing escaped backslashes (\\1)
                                jsReplacement = jsReplacement.replace(/(?<!\\)\\(\d+)/g, '$$$1');
                            }
                            
                            fixedText = fixedText.replace(regex, jsReplacement);
                        }
                        
                        const afterLength = fixedText.length;
                        if (beforeLength !== afterLength) {
                            console.log(`Custom rule "${rule.description}" applied changes`);
                        }
                    } catch (e) {
                        console.log(`Custom regex rule "${rule.description}" failed:`, e.message);
                    }
                }
            });
        }

        // Convert numbers to text based on setting
        if (autoFixSettings.numberToText === 'on') {
            console.log('Converting numbers to text automatically...');
            fixedText = convertNumbersToText(fixedText);
        } else if (autoFixSettings.numberToText === 'ask') {
            console.log('Interactive number conversion mode...');
            // Apply fixed text first, then start interactive conversion
            if (textEditor.tagName === 'TEXTAREA' || textEditor.tagName === 'INPUT') {
                textEditor.value = fixedText;
                textEditor.dispatchEvent(new Event('input', { bubbles: true }));
            } else if (textEditor.isContentEditable) {
                textEditor.textContent = fixedText;
                textEditor.dispatchEvent(new Event('input', { bubbles: true }));
            }
            
            // Now start interactive conversion on the updated text
            setTimeout(() => {
                startInteractiveNumberConversion(textEditor);
            }, 100);
            
            // Skip the normal text application below since we already did it
            return;
        }

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

    // Function to detect and mark mismatched parentheses/brackets with warning emojis
    function highlightMismatchedBracketsWithEmojis(text) {
        console.log('Analyzing bracket matching...');
        
        // Track different types of brackets separately but allow nesting
        const brackets = {
            '(': { close: ')', stack: [], type: 'paren' },
            '[': { close: ']', stack: [], type: 'bracket' }
        };
        
        let result = text;
        let mismatchedPositions = [];
        
        // First pass: find all bracket positions and track matching
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            
            if (char === '(' || char === '[') {
                brackets[char].stack.push(i);
            } else if (char === ')' || char === ']') {
                const openChar = char === ')' ? '(' : '[';
                
                if (brackets[openChar].stack.length > 0) {
                    // Found a match, remove from stack
                    brackets[openChar].stack.pop();
                } else {
                    // Unmatched closing bracket
                    mismatchedPositions.push({ pos: i, char: char, type: 'unmatched_close' });
                    console.log('Found unmatched closing bracket:', char, 'at position', i);
                }
            }
        }
        
        // Add remaining unmatched opening brackets
        Object.keys(brackets).forEach(openChar => {
            brackets[openChar].stack.forEach(pos => {
                mismatchedPositions.push({ pos: pos, char: openChar, type: 'unmatched_open' });
                console.log('Found unmatched opening bracket:', openChar, 'at position', pos);
            });
        });
        
        // Sort positions in reverse order to maintain correct indices when inserting emojis
        mismatchedPositions.sort((a, b) => b.pos - a.pos);
        
        // Mark mismatched brackets with warning emojis
        mismatchedPositions.forEach(({ pos, char }) => {
            const before = result.slice(0, pos);
            const after = result.slice(pos + 1);
            const markedChar = `⚠️${char}⚠️`;
            result = before + markedChar + after;
        });
        
        if (mismatchedPositions.length > 0) {
            console.log('Marked', mismatchedPositions.length, 'mismatched brackets with warning emojis');
        } else {
            console.log('No mismatched brackets found');
        }
        
        return result;
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
        
        // Only show format popup on lyrics pages
        if (!isOnLyricsPage()) {
            console.log('Not on a lyrics page, skipping text formatting');
            return;
        }
        
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

    // Function to check if we're on a lyrics page
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

        // Look for the lyrics editor controls container (try multiple approaches)
        const controlsContainer = document.querySelector('.LyricsEdit-desktop__Controls-sc-6d8e67d6-3') ||
                                 document.querySelector('[class*="LyricsEdit-desktop__Controls"]') ||
                                 document.querySelector('[class*="LyricsEdit"][class*="Controls"]') ||
                                 document.querySelector('[class*="lyrics-edit"][class*="controls"]') ||
                                 document.querySelector('.ihioQH'); // backup class name from the HTML

        if (controlsContainer) {
            console.log('Found controls container:', controlsContainer);
            
            // Create all buttons
            toggleButton = createToggleButton();
            autoFixButton = createAutoFixButton();
            const zwsButton = createZeroWidthSpaceButton();
            
            // Create containers using utility
            const mainButtonContainer = UI.createFlexContainer('row', '0', { marginBottom: '0.5rem' });
            mainButtonContainer.appendChild(toggleButton);
            mainButtonContainer.appendChild(autoFixButton);
            
            const zwsButtonContainer = UI.createFlexContainer('row', '0', { marginBottom: '0.5rem' });
            zwsButtonContainer.appendChild(zwsButton);
            
            // Look for the "How to Format Lyrics" section to insert before it
            const formatExplainer = controlsContainer.querySelector('[class*="LyricsEdit-desktop__Explainer"]') ||
                                   controlsContainer.querySelector('[class*="Explainer"]') ||
                                   controlsContainer.querySelector('*:last-child');
            
            if (formatExplainer && formatExplainer.textContent && formatExplainer.textContent.includes('Format')) {
                // Insert before the explainer (above "How to Format Lyrics:")
                controlsContainer.insertBefore(mainButtonContainer, formatExplainer);
                controlsContainer.insertBefore(zwsButtonContainer, formatExplainer);
                console.log('Inserted buttons before format explainer');
            } else {
                // Fallback: append to the container
                controlsContainer.appendChild(mainButtonContainer);
                controlsContainer.appendChild(zwsButtonContainer);
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

    // Function to remove the "How to Format Lyrics" div
    function removeFormatExplainerDiv() {
        // Look for the div containing "How to Format Lyrics" text
        const explainerDivs = document.querySelectorAll('div');
        explainerDivs.forEach(div => {
            if (div.textContent && div.textContent.includes('How to Format Lyrics:')) {
                // Check if it matches the specific structure with flex styling
                const style = div.getAttribute('style') || '';
                if (style.includes('display: flex') && style.includes('flex-direction: row')) {
                    console.log('Removing "How to Format Lyrics" explainer div');
                    div.remove();
                }
            }
        });
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
        
        // Start auto-save functionality
        startAutoSave();
        
        isInitialized = true;

        // Try to add button to editor if it exists
        const buttonAdded = addButtonToEditor();
        
        // If that failed, try multiple fallback searches (but only on lyrics pages)
        if (!buttonAdded && isOnLyricsPage()) {
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
                    const existingZws = document.getElementById('genius-zws-button');
                    if (existingToggle) existingToggle.remove();
                    if (existingAutoFix) existingAutoFix.remove();
                    if (existingZws) existingZws.remove();
                    
                    // Create all buttons
                    toggleButton = createToggleButton();
                    autoFixButton = createAutoFixButton();
                    const zwsButton = createZeroWidthSpaceButton();
                    
                    // Create containers using utility
                    const mainButtonContainer = UI.createFlexContainer('row', '0', { marginBottom: '0.5rem' });
                    mainButtonContainer.appendChild(toggleButton);
                    mainButtonContainer.appendChild(autoFixButton);
                    
                    const zwsButtonContainer = UI.createFlexContainer('row', '0', { marginBottom: '0.5rem' });
                    zwsButtonContainer.appendChild(zwsButton);
                    
                    // Try to insert at the top of the container
                    if (targetContainer.firstChild) {
                        targetContainer.insertBefore(mainButtonContainer, targetContainer.firstChild);
                        targetContainer.insertBefore(zwsButtonContainer, targetContainer.firstChild.nextSibling);
                    } else {
                        targetContainer.appendChild(mainButtonContainer);
                        targetContainer.appendChild(zwsButtonContainer);
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
                        }, 50); // Reduced delay just for button placement
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
