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
            { key: 'emDashFixes', label: 'Convert word- to word— / word–', type: 'checkbox' },
            { key: 'capitalizeParentheses', label: 'Capitalize first letter in parentheses', type: 'checkbox' },
            { key: 'multipleSpaces', label: 'Fix spacing (multiple spaces → single, remove trailing)', type: 'checkbox' },
            { key: 'customRegex', label: 'Enable custom regex rules', type: 'checkbox' },
            { key: 'stutterEmDash', label: 'Fix stutter formatting (Ja— ja— ja— → Ja-ja-ja-)', type: 'checkbox' },

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
            gap: 6px;
            margin-bottom: 20px;
            flex-wrap: wrap;
            align-items: center;
        `;

        const addRuleBtn = createSmallButton('+ Add', () => {
            const form = document.getElementById('add-rule-form');
            const isVisible = form.style.display !== 'none';
            form.style.display = isVisible ? 'none' : 'block';
            addRuleBtn.textContent = isVisible ? '+ Add Rule' : 'Cancel';
        });
        
        const searchBtn = createSmallButton('Search', () => {
            showRuleSearchPopup();
        });
        
        const downloadBtn = createSmallButton('Download', () => {
            showDownloadRulesPopup();
        });
        
        const importBtn = createImportDropdown();
        const exportBtn = createSmallButton('Export', exportRegexRules);

        buttonContainer.appendChild(addRuleBtn);
        buttonContainer.appendChild(searchBtn);
        buttonContainer.appendChild(downloadBtn);
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

        // Load existing rules and groups
        refreshCustomRegexRulesWithGroups(rulesContainer);

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

        // Enhanced boundary checkbox
        const enhancedBoundaryContainer = document.createElement('div');
        enhancedBoundaryContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px;
        `;

        const enhancedBoundaryCheckbox = document.createElement('input');
        enhancedBoundaryCheckbox.type = 'checkbox';
        enhancedBoundaryCheckbox.id = 'enhanced-boundary-checkbox';
        enhancedBoundaryCheckbox.title = 'Enhanced boundaries recognize brackets, punctuation, em dashes, and more as word boundaries. Simplifies complex regex patterns like lookarounds.';
        enhancedBoundaryCheckbox.style.cssText = `
            margin: 0;
            cursor: pointer;
        `;

        const enhancedBoundaryLabel = document.createElement('label');
        enhancedBoundaryLabel.setAttribute('for', 'enhanced-boundary-checkbox');
        enhancedBoundaryLabel.innerHTML = `
            <strong>Enhanced Boundary Mode</strong> - Automatically handles brackets, punctuation, etc. 
            <br><span style="font-size: 12px; color: #666; font-style: italic;">
            Add "e" to flags and use simple patterns like "\\bza\\b" instead of complex lookarounds
            </span>
        `;
        enhancedBoundaryLabel.style.cssText = `
            font-size: 14px;
            cursor: pointer;
            color: #333;
            line-height: 1.4;
            font-family: 'Programme', Arial, sans-serif;
        `;

        enhancedBoundaryContainer.appendChild(enhancedBoundaryCheckbox);
        enhancedBoundaryContainer.appendChild(enhancedBoundaryLabel);

        fieldsContainer.appendChild(descriptionField);
        fieldsContainer.appendChild(findField);
        fieldsContainer.appendChild(replaceField);
        fieldsContainer.appendChild(flagsField);
        fieldsContainer.appendChild(enhancedBoundaryContainer);
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
            let flags = flagsField.querySelector('input').value || 'gi';
            const enhancedBoundary = enhancedBoundaryCheckbox.checked;

            if (!description || !find) {
                alert('Description and Find Pattern are required.');
                return;
            }

            // If enhanced boundary is enabled, ensure 'e' is in flags
            if (enhancedBoundary && !flags.includes('e')) {
                flags += 'e';
            }

            try {
                // Test the regex (remove 'e' for testing since it's not a standard flag)
                const testFlags = flags.replace(/e/g, '');
                new RegExp(find, testFlags);
            } catch (e) {
                alert('Invalid regex pattern: ' + e.message);
                return;
            }

            const newRule = { description, find, replace, flags, enabled: true, enhancedBoundary };
            if (!autoFixSettings.ungroupedRules) {
                autoFixSettings.ungroupedRules = [];
            }
            autoFixSettings.ungroupedRules.push(newRule);
            saveSettings();
            refreshCustomRegexRulesWithGroups(document.getElementById('custom-regex-rules-container'));
            
            // Clear form and hide it
            descriptionField.querySelector('input').value = '';
            findField.querySelector('input').value = '';
            replaceField.querySelector('input').value = '';
            flagsField.querySelector('input').value = 'gi';
            enhancedBoundaryCheckbox.checked = false;
            form.style.display = 'none';
            
            // Reset button text - find the correct add rule button
            const addRuleButton = form.parentElement.querySelector('button');
            if (addRuleButton && addRuleButton.textContent === 'Cancel') {
                addRuleButton.textContent = '+ Add Rule';
            }
        });

        // Apply consistent button styling with hover effect
        UI.styleButtonWithHover(saveBtn, 'primary');

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

        const importBtn = createSmallButton('Import', () => {
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

        // Apply consistent button styling with hover effect
        UI.styleButtonWithHover(importBtn, 'primary');

        const cancelBtn = createSmallButton('Cancel', () => {
            textArea.value = '';
            form.style.display = 'none';
        });

        // Apply consistent button styling with hover effect
        UI.styleButtonWithHover(cancelBtn, 'secondary');

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
