    function refreshCustomRegexRulesWithGroups(container) {
        container.innerHTML = '';
        
        // Migrate old customRegexRules to ungroupedRules if needed
        if (autoFixSettings.customRegexRules && autoFixSettings.customRegexRules.length > 0) {
            if (!autoFixSettings.ungroupedRules) {
                autoFixSettings.ungroupedRules = [];
            }
            // Move existing rules to ungrouped, avoiding duplicates
            autoFixSettings.customRegexRules.forEach(rule => {
                const isDuplicate = autoFixSettings.ungroupedRules.some(existingRule => 
                    existingRule.find === rule.find && existingRule.replace === rule.replace
                );
                if (!isDuplicate) {
                    autoFixSettings.ungroupedRules.push(rule);
                }
            });
            autoFixSettings.customRegexRules = []; // Clear old array
            saveSettings();
        }

        const hasAnyRules = (autoFixSettings.ruleGroups && autoFixSettings.ruleGroups.length > 0) ||
                           (autoFixSettings.ungroupedRules && autoFixSettings.ungroupedRules.length > 0);
        
        if (!hasAnyRules) {
            const noRulesMsg = document.createElement('div');
            noRulesMsg.textContent = 'No custom regex rules yet. Click "Add Rule" to create one or "Download Rules" to import rule groups.';
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

        // Display rule groups
        if (autoFixSettings.ruleGroups && autoFixSettings.ruleGroups.length > 0) {
            autoFixSettings.ruleGroups.forEach((group, groupIndex) => {
                const groupContainer = createRuleGroupElement(group, groupIndex);
                container.appendChild(groupContainer);
            });
        }

        // Display ungrouped rules
        if (autoFixSettings.ungroupedRules && autoFixSettings.ungroupedRules.length > 0) {
            const ungroupedContainer = createUngroupedRulesElement();
            container.appendChild(ungroupedContainer);
        }
    }

    // Function to create a rule group element
    function createRuleGroupElement(group, groupIndex) {
        const groupContainer = document.createElement('div');
        groupContainer.style.cssText = `
            border: 1px solid #dee2e6;
            border-radius: 8px;
            margin-bottom: 16px;
            background: #fff;
        `;

        // Group header
        const groupHeader = document.createElement('div');
        groupHeader.style.cssText = `
            background: #f8f9fa;
            padding: 12px 16px;
            border-bottom: 1px solid #dee2e6;
            border-radius: 8px 8px 0 0;
            cursor: pointer;
            user-select: none;
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: relative;
        `;

        const groupInfo = document.createElement('div');
        groupInfo.style.cssText = `
            flex: 1;
        `;

        const groupTitle = document.createElement('div');
        groupTitle.textContent = group.title;
        groupTitle.style.cssText = `
            font-weight: 500;
            color: #333;
            margin-bottom: 4px;
        `;

        const groupMeta = document.createElement('div');
        groupMeta.innerHTML = `
            <span style="font-size: 12px; color: #666;">${group.description}</span>
            <br>
            <span style="font-size: 11px; color: #999;">Author: ${group.author} | Version: ${group.version} | ${group.rules.length} rule${group.rules.length === 1 ? '' : 's'}</span>
        `;

        // Create delete group button - positioned absolutely at top-right
        const deleteGroupBtn = createSmallButton('Delete Group', () => {
            if (confirm(`Are you sure you want to delete the group "${group.title}" and all its rules?`)) {
                autoFixSettings.ruleGroups.splice(groupIndex, 1);
                saveSettings();
                refreshCustomRegexRulesWithGroups(document.getElementById('custom-regex-rules-container'));
            }
        });
        
        // Set base styles for delete button with absolute positioning
        deleteGroupBtn.style.backgroundColor = '#dc3545';
        deleteGroupBtn.style.color = 'white';
        deleteGroupBtn.style.borderColor = '#dc3545';
        deleteGroupBtn.style.fontSize = '10px';
        deleteGroupBtn.style.padding = '2px 6px';
        deleteGroupBtn.style.position = 'absolute';
        deleteGroupBtn.style.top = '8px';
        deleteGroupBtn.style.right = '8px';
        deleteGroupBtn.style.zIndex = '10';
        
        // Add proper hover effect using the UI utility
        UI.addHoverEffect(deleteGroupBtn, {
            backgroundColor: '#c82333',
            borderColor: '#bd2130'
        }, {
            backgroundColor: '#dc3545',
            color: 'white',
            borderColor: '#dc3545'
        });

        const toggleIcon = document.createElement('span');
        toggleIcon.innerHTML = '▼';
        toggleIcon.style.cssText = `
            font-size: 12px;
            color: #666;
            transition: transform 0.2s ease;
            cursor: pointer;
        `;

        groupInfo.appendChild(groupTitle);
        groupInfo.appendChild(groupMeta);
        
        groupHeader.appendChild(groupInfo);
        groupHeader.appendChild(toggleIcon);
        groupHeader.appendChild(deleteGroupBtn);

        // Group actions (initially hidden) - now empty since delete button moved to header
        const groupActions = document.createElement('div');
        groupActions.style.cssText = `
            padding: 8px 16px;
            background: #f8f9fa;
            border-top: 1px solid #dee2e6;
            display: none;
            gap: 8px;
            flex-wrap: wrap;
        `;

        // Delete button is now in the header, so this section can be used for future actions if needed

        // Rules container (initially hidden)
        const rulesContainer = document.createElement('div');
        rulesContainer.style.cssText = `
            display: none;
            padding: 0;
        `;

        // Toggle functionality - only for the group info area and toggle icon, not the delete button
        let isExpanded = false;
        
        const toggleHandler = (e) => {
            // Don't toggle if the delete button was clicked
            if (e.target === deleteGroupBtn || deleteGroupBtn.contains(e.target)) {
                return;
            }
            
            isExpanded = !isExpanded;
            if (isExpanded) {
                rulesContainer.style.display = 'block';
                groupActions.style.display = 'flex';
                toggleIcon.style.transform = 'rotate(-90deg)';
                
                // Load rules if not already loaded
                if (rulesContainer.children.length === 0) {
                    group.rules.forEach((rule, ruleIndex) => {
                        const ruleElement = createGroupRuleElement(rule, groupIndex, ruleIndex, group.title);
                        rulesContainer.appendChild(ruleElement);
                    });
                }
            } else {
                rulesContainer.style.display = 'none';
                groupActions.style.display = 'none';
                toggleIcon.style.transform = 'rotate(0deg)';
            }
        };
        
        groupHeader.addEventListener('click', toggleHandler);

        groupContainer.appendChild(groupHeader);
        groupContainer.appendChild(groupActions);
        groupContainer.appendChild(rulesContainer);

        return groupContainer;
    }

    // Function to create ungrouped rules element
    function createUngroupedRulesElement() {
        const ungroupedContainer = document.createElement('div');
        ungroupedContainer.style.cssText = `
            border: 1px solid #dee2e6;
            border-radius: 8px;
            margin-bottom: 16px;
            background: #fff;
        `;

        // Ungrouped header
        const ungroupedHeader = document.createElement('div');
        ungroupedHeader.style.cssText = `
            background: #fff3cd;
            padding: 12px 16px;
            border-bottom: 1px solid #dee2e6;
            border-radius: 8px 8px 0 0;
            cursor: pointer;
            user-select: none;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;

        const ungroupedInfo = document.createElement('div');
        ungroupedInfo.style.cssText = `
            flex: 1;
        `;

        const ungroupedTitle = document.createElement('div');
        ungroupedTitle.textContent = 'Unsorted Rules';
        ungroupedTitle.style.cssText = `
            font-weight: 500;
            color: #333;
            margin-bottom: 4px;
        `;

        const ungroupedMeta = document.createElement('div');
        ungroupedMeta.innerHTML = `
            <span style="font-size: 12px; color: #666;">Rules not assigned to any group</span>
            <br>
            <span style="font-size: 11px; color: #999;">${autoFixSettings.ungroupedRules.length} rule${autoFixSettings.ungroupedRules.length === 1 ? '' : 's'}</span>
        `;

        const toggleIcon = document.createElement('span');
        toggleIcon.innerHTML = '▼';
        toggleIcon.style.cssText = `
            font-size: 12px;
            color: #666;
            transition: transform 0.2s ease;
        `;

        ungroupedInfo.appendChild(ungroupedTitle);
        ungroupedInfo.appendChild(ungroupedMeta);
        ungroupedHeader.appendChild(ungroupedInfo);
        ungroupedHeader.appendChild(toggleIcon);

        // Rules container (initially hidden)
        const rulesContainer = document.createElement('div');
        rulesContainer.style.cssText = `
            display: none;
            padding: 0;
        `;

        // Toggle functionality
        let isExpanded = false;
        ungroupedHeader.addEventListener('click', () => {
            isExpanded = !isExpanded;
            if (isExpanded) {
                rulesContainer.style.display = 'block';
                toggleIcon.style.transform = 'rotate(-90deg)';
                
                // Load rules if not already loaded
                if (rulesContainer.children.length === 0) {
                    autoFixSettings.ungroupedRules.forEach((rule, ruleIndex) => {
                        const ruleElement = createUngroupedRuleElement(rule, ruleIndex);
                        rulesContainer.appendChild(ruleElement);
                    });
                }
            } else {
                rulesContainer.style.display = 'none';
                toggleIcon.style.transform = 'rotate(0deg)';
            }
        });

        ungroupedContainer.appendChild(ungroupedHeader);
        ungroupedContainer.appendChild(rulesContainer);

        return ungroupedContainer;
    }

    // Function to create a rule element within a group
    function createGroupRuleElement(rule, groupIndex, ruleIndex, groupTitle) {
        const ruleElement = UI.createRuleElement(rule, ruleIndex,
            // onToggle
            (idx, enabled) => {
                autoFixSettings.ruleGroups[groupIndex].rules[idx].enabled = enabled;
                saveSettings();
            },
            // onDelete
            (idx) => {
                autoFixSettings.ruleGroups[groupIndex].rules.splice(idx, 1);
                saveSettings();
                
                // Just remove this rule element instead of refreshing everything
                ruleElement.remove();
                
                // Update group count in header
                const groupContainer = ruleElement.closest('div[style*="border: 1px solid #dee2e6"]');
                const countSpan = groupContainer.querySelector('span[style*="font-size: 11px"]');
                if (countSpan) {
                    const newCount = autoFixSettings.ruleGroups[groupIndex].rules.length;
                    const countText = `${newCount} rule${newCount === 1 ? '' : 's'}`;
                    // Update the count part only (it's after the last | in the text)
                    const fullText = countSpan.innerHTML;
                    const parts = fullText.split(' | ');
                    parts[parts.length - 1] = countText;
                    countSpan.innerHTML = parts.join(' | ');
                }
                
                // If no rules left in group, show empty message
                const parentContainer = ruleElement.closest('div[style*="display: none"]').parentElement;
                const rulesContainer = parentContainer.querySelector('div[style*="padding: 0"]');
                if (rulesContainer && rulesContainer.children.length === 0) {
                    const emptyMsg = document.createElement('div');
                    emptyMsg.textContent = 'No rules in this group';
                    emptyMsg.style.cssText = 'padding: 12px; color: #999; font-style: italic; text-align: center;';
                    rulesContainer.appendChild(emptyMsg);
                }
            }
        );

        // Add group indicator and move/edit options
        const ruleActions = ruleElement.querySelector('div > div'); // Button container
        if (ruleActions) {
            // Add edit button with proper hover effect
            const editBtn = createSmallButton('Edit', () => {
                showEditRulePopup(rule, groupIndex, ruleIndex, false, ruleElement);
            });
            editBtn.style.fontSize = '10px';
            editBtn.style.padding = '2px 6px';
            editBtn.style.height = 'auto';
            
            // Apply consistent button styling with hover effect
            UI.styleButtonWithHover(editBtn, 'info');
            
            ruleActions.appendChild(editBtn);

            const moveBtn = createSmallButton('Move to Unsorted', () => {
                // Move rule to ungrouped
                const ruleToMove = autoFixSettings.ruleGroups[groupIndex].rules[ruleIndex];
                if (!autoFixSettings.ungroupedRules) {
                    autoFixSettings.ungroupedRules = [];
                }
                autoFixSettings.ungroupedRules.push(ruleToMove);
                autoFixSettings.ruleGroups[groupIndex].rules.splice(ruleIndex, 1);
                saveSettings();
                
                // Refresh the entire container to properly update UI
                refreshCustomRegexRulesWithGroups(document.getElementById('custom-regex-rules-container'));
            });
            moveBtn.style.fontSize = '10px';
            moveBtn.style.padding = '2px 6px';
            moveBtn.style.height = 'auto';
            
            // Apply consistent button styling with hover effect
            UI.styleButtonWithHover(moveBtn, 'success');
            
            ruleActions.appendChild(moveBtn);
        }

        ruleElement.style.margin = '0';
        ruleElement.style.borderRadius = '0';
        ruleElement.style.borderLeft = 'none';
        ruleElement.style.borderRight = 'none';
        ruleElement.style.borderTop = 'none';

        return ruleElement;
    }

    // Function to create a rule element for ungrouped rules
    function createUngroupedRuleElement(rule, ruleIndex) {
        const ruleElement = UI.createRuleElement(rule, ruleIndex,
            // onToggle
            (idx, enabled) => {
                autoFixSettings.ungroupedRules[idx].enabled = enabled;
                saveSettings();
            },
            // onDelete
            (idx) => {
                autoFixSettings.ungroupedRules.splice(idx, 1);
                saveSettings();
                
                // Refresh the entire container to properly update UI
                refreshCustomRegexRulesWithGroups(document.getElementById('custom-regex-rules-container'));
            }
        );

        // Add edit and move to group options
        const ruleActions = ruleElement.querySelector('div > div'); // Button container
        if (ruleActions) {
            // Add edit button with proper hover effect
            const editBtn = createSmallButton('Edit', () => {
                showEditRulePopup(rule, null, ruleIndex, true, ruleElement);
            });
            editBtn.style.fontSize = '10px';
            editBtn.style.padding = '2px 6px';
            editBtn.style.height = 'auto';
            
            // Apply consistent button styling with hover effect
            UI.styleButtonWithHover(editBtn, 'info');
            
            ruleActions.appendChild(editBtn);

            // Add move to group button with proper hover effect
            const moveToGroupBtn = createSmallButton('Move to Group', () => {
                showMoveToGroupPopup(rule, ruleIndex);
            });
            moveToGroupBtn.style.fontSize = '10px';
            moveToGroupBtn.style.padding = '2px 6px';
            moveToGroupBtn.style.height = 'auto';
            
            // Apply consistent button styling with hover effect
            UI.styleButtonWithHover(moveToGroupBtn, 'success');
            
            ruleActions.appendChild(moveToGroupBtn);
        }

        ruleElement.style.margin = '0';
        ruleElement.style.borderRadius = '0';
        ruleElement.style.borderLeft = 'none';
        ruleElement.style.borderRight = 'none';
        ruleElement.style.borderTop = 'none';

        return ruleElement;
    }

    // Function to show edit rule popup
    function showEditRulePopup(rule, groupIndex, ruleIndex, isUngrouped, ruleElement) {
        // Create backdrop
        const backdrop = UI.createBackdrop((e) => {
            if (e.target === backdrop) {
                document.body.removeChild(backdrop);
            }
        });
        backdrop.style.display = 'flex';
        backdrop.style.alignItems = 'center';
        backdrop.style.justifyContent = 'center';
        backdrop.style.zIndex = '10004';

        // Create popup
        const popup = UI.createPopup({
            minWidth: '400px',
            maxWidth: '500px',
            position: 'relative',
            top: 'auto',
            left: 'auto',
            transform: 'none'
        });

        // Create header
        const header = UI.createPopupHeader('Edit Rule', () => {
            document.body.removeChild(backdrop);
        });
        popup.appendChild(header);

        // Create form
        const form = document.createElement('form');
        form.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 16px;
            padding: 20px;
        `;

        // Description field
        const descriptionField = createFormField('Description', 'text', rule.description || '');
        
        // Find field
        const findField = createFormField('Find Pattern', 'text', rule.find || '');
        
        // Replace field
        const replaceField = createFormField('Replace With', 'text', 
            typeof rule.replace === 'string' ? rule.replace : '');
        
        // Flags field
        const flagsField = createFormField('Flags', 'text', rule.flags || 'gi');
        
        // Enhanced boundary checkbox
        const enhancedBoundaryContainer = document.createElement('div');
        enhancedBoundaryContainer.style.cssText = `
            display: flex;
            align-items: flex-start;
            gap: 8px;
        `;

        const enhancedBoundaryCheckbox = document.createElement('input');
        enhancedBoundaryCheckbox.type = 'checkbox';
        enhancedBoundaryCheckbox.id = 'edit-enhanced-boundary-checkbox';
        enhancedBoundaryCheckbox.checked = rule.enhancedBoundary || false;
        enhancedBoundaryCheckbox.style.cssText = `
            margin: 0;
            cursor: pointer;
        `;

        const enhancedBoundaryLabel = document.createElement('label');
        enhancedBoundaryLabel.setAttribute('for', 'edit-enhanced-boundary-checkbox');
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

        form.appendChild(descriptionField);
        form.appendChild(findField);
        form.appendChild(replaceField);
        form.appendChild(flagsField);
        form.appendChild(enhancedBoundaryContainer);

        // Buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 8px;
            justify-content: flex-end;
            margin-top: 16px;
        `;

        const saveBtn = createSmallButton('Save', () => {
            const description = descriptionField.querySelector('input').value.trim();
            const find = findField.querySelector('input').value.trim();
            const replace = replaceField.querySelector('input').value.trim();
            const flags = flagsField.querySelector('input').value.trim();
            const enhancedBoundary = enhancedBoundaryCheckbox.checked;

            if (!find) {
                alert('Find pattern is required.');
                return;
            }

            // Update the rule
            const updatedRule = {
                ...rule,
                description: description || `Rule ${ruleIndex + 1}`,
                find: find,
                replace: replace,
                flags: flags,
                enhancedBoundary: enhancedBoundary
            };

            // Save to the appropriate location
            if (isUngrouped) {
                autoFixSettings.ungroupedRules[ruleIndex] = updatedRule;
            } else {
                autoFixSettings.ruleGroups[groupIndex].rules[ruleIndex] = updatedRule;
            }

            saveSettings();
            refreshCustomRegexRulesWithGroups(document.getElementById('custom-regex-rules-container'));
            document.body.removeChild(backdrop);
        });

        saveBtn.style.backgroundColor = '#007bff';
        saveBtn.style.color = 'white';
        saveBtn.style.borderColor = '#007bff';

        const cancelBtn = createSmallButton('Cancel', () => {
            document.body.removeChild(backdrop);
        });

        buttonContainer.appendChild(cancelBtn);
        buttonContainer.appendChild(saveBtn);
        form.appendChild(buttonContainer);

        popup.appendChild(form);
        backdrop.appendChild(popup);
        popup.style.display = 'block';
        document.body.appendChild(backdrop);

        // Focus the description field
        setTimeout(() => {
            const descInput = descriptionField.querySelector('input');
            if (descInput) descInput.focus();
        }, 100);
    }

    // Function to show move to group popup
    function showMoveToGroupPopup(rule, ruleIndex) {
        // Check if there are any groups to move to
        if (!autoFixSettings.ruleGroups || autoFixSettings.ruleGroups.length === 0) {
            alert('No groups available. Create a group first by downloading rules.');
            return;
        }

        // Create backdrop
        const backdrop = UI.createBackdrop((e) => {
            if (e.target === backdrop) {
                document.body.removeChild(backdrop);
            }
        });
        backdrop.style.display = 'flex';
        backdrop.style.alignItems = 'center';
        backdrop.style.justifyContent = 'center';
        backdrop.style.zIndex = '10004';

        // Create popup
        const popup = UI.createPopup({
            minWidth: '350px',
            maxWidth: '450px',
            position: 'relative',
            top: 'auto',
            left: 'auto',
            transform: 'none'
        });

        // Create header
        const header = UI.createPopupHeader('Move Rule to Group', () => {
            document.body.removeChild(backdrop);
        });
        popup.appendChild(header);

        // Content
        const content = document.createElement('div');
        content.style.cssText = `
            padding: 20px;
        `;

        const instructions = document.createElement('p');
        instructions.textContent = 'Select a group to move this rule to:';
        instructions.style.cssText = `
            margin: 0 0 16px 0;
            color: #333;
        `;
        content.appendChild(instructions);

        // Rule preview
        const rulePreview = document.createElement('div');
        rulePreview.style.cssText = `
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 16px;
            font-size: 12px;
            font-family: monospace;
        `;
        rulePreview.innerHTML = `
            <div><strong>Rule:</strong> ${rule.description || 'Unnamed Rule'}</div>
            <div><strong>Find:</strong> /${rule.find}/${rule.flags || 'gi'}</div>
            <div><strong>Replace:</strong> ${rule.replace}</div>
        `;
        content.appendChild(rulePreview);

        // Group selection
        const groupContainer = document.createElement('div');
        groupContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 16px;
        `;

        autoFixSettings.ruleGroups.forEach((group, groupIndex) => {
            const groupOption = document.createElement('div');
            groupOption.style.cssText = `
                border: 1px solid #dee2e6;
                border-radius: 4px;
                padding: 12px;
                cursor: pointer;
                transition: all 0.2s ease;
                background: #fff;
            `;

            groupOption.addEventListener('mouseenter', () => {
                groupOption.style.backgroundColor = '#f8f9fa';
                groupOption.style.borderColor = '#007bff';
            });

            groupOption.addEventListener('mouseleave', () => {
                groupOption.style.backgroundColor = '#fff';
                groupOption.style.borderColor = '#dee2e6';
            });

            groupOption.innerHTML = `
                <div style="font-weight: 500; margin-bottom: 4px;">${group.title}</div>
                <div style="font-size: 12px; color: #666;">${group.description}</div>
                <div style="font-size: 11px; color: #999; margin-top: 4px;">
                    ${group.rules.length} rule${group.rules.length === 1 ? '' : 's'} | Author: ${group.author}
                </div>
            `;

            groupOption.addEventListener('click', () => {
                // Move the rule to the selected group
                const ruleToMove = autoFixSettings.ungroupedRules[ruleIndex];
                autoFixSettings.ruleGroups[groupIndex].rules.push(ruleToMove);
                autoFixSettings.ungroupedRules.splice(ruleIndex, 1);
                saveSettings();
                refreshCustomRegexRulesWithGroups(document.getElementById('custom-regex-rules-container'));
                document.body.removeChild(backdrop);
            });

            groupContainer.appendChild(groupOption);
        });

        content.appendChild(groupContainer);

        // Cancel button
        const cancelBtn = createSmallButton('Cancel', () => {
            document.body.removeChild(backdrop);
        });
        cancelBtn.style.cssText += 'display: block; margin: 0 auto;';
        content.appendChild(cancelBtn);

        popup.appendChild(content);
        backdrop.appendChild(popup);
        popup.style.display = 'block';
        document.body.appendChild(backdrop);
    }

    // Function to refresh the custom regex rules display (legacy compatibility)
    function refreshCustomRegexRules(container) {
        refreshCustomRegexRulesWithGroups(container);
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
        defaultOption.textContent = 'Import';
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
            let importedRules = [];
            
            // Handle different import formats with backwards compatibility
            if (Array.isArray(importedData)) {
                // Old format: simple array of rules
                importedRules = importedData;
            } else if (importedData && typeof importedData === 'object') {
                if (importedData.find && importedData.replace) {
                    // Single rule object (old format)
                    importedRules = [importedData];
                } else if (importedData.rules && Array.isArray(importedData.rules)) {
                    // New format with metadata wrapper (like rules.json)
                    importedRules = importedData.rules;
                } else if (importedData.ruleGroups || importedData.ungroupedRules) {
                    // New export format with rule groups
                    importedRules = [];
                    
                    // Extract rules from rule groups
                    if (importedData.ruleGroups && Array.isArray(importedData.ruleGroups)) {
                        importedData.ruleGroups.forEach(group => {
                            if (group.rules && Array.isArray(group.rules)) {
                                importedRules = [...importedRules, ...group.rules];
                            }
                        });
                    }
                    
                    // Extract ungrouped rules
                    if (importedData.ungroupedRules && Array.isArray(importedData.ungroupedRules)) {
                        importedRules = [...importedRules, ...importedData.ungroupedRules];
                    }
                    
                    // Extract legacy rules
                    if (importedData.legacyRules && Array.isArray(importedData.legacyRules)) {
                        importedRules = [...importedRules, ...importedData.legacyRules];
                    }
                } else {
                    alert(`Invalid format. Please ${source === 'file' ? 'select a valid JSON file' : 'copy valid JSON data'} containing regex rules.`);
                    return;
                }
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
            
            // Add to ungrouped rules (new structure) instead of legacy customRegexRules
            if (!autoFixSettings.ungroupedRules) {
                autoFixSettings.ungroupedRules = [];
            }
            autoFixSettings.ungroupedRules = [...autoFixSettings.ungroupedRules, ...validRules];
            
            saveSettings();
            refreshCustomRegexRulesWithGroups(document.getElementById('custom-regex-rules-container'));
            alert(`Successfully imported ${validRules.length} regex rule(s) from ${source}.`);
        } catch (error) {
            alert(`Error parsing data from ${source}: ` + error.message);
        }
    }

    // Function to export regex rules with options
    function exportRegexRules() {
        // Check if there are any rules to export (new structure or legacy)
        const hasRuleGroups = autoFixSettings.ruleGroups && autoFixSettings.ruleGroups.length > 0;
        const hasUngroupedRules = autoFixSettings.ungroupedRules && autoFixSettings.ungroupedRules.length > 0;
        const hasLegacyRules = autoFixSettings.customRegexRules && autoFixSettings.customRegexRules.length > 0;

        if (!hasRuleGroups && !hasUngroupedRules && !hasLegacyRules) {
            // Show export options popup even if no current rules
            showExportOptionsPopup();
            return;
        }

        // If we have rules, show export options
        showExportOptionsPopup();
    }

    // Function to show export options popup
    function showExportOptionsPopup() {
        // Create backdrop
        const backdrop = UI.createBackdrop((e) => {
            if (e.target === backdrop) {
                document.body.removeChild(backdrop);
            }
        });
        backdrop.style.display = 'flex';
        backdrop.style.alignItems = 'center';
        backdrop.style.justifyContent = 'center';
        backdrop.style.zIndex = '10004';

        // Create popup
        const popup = UI.createPopup({
            minWidth: '400px',
            maxWidth: '500px',
            position: 'relative',
            top: 'auto',
            left: 'auto',
            transform: 'none'
        });

        // Create header
        const header = UI.createPopupHeader('Export Rules', () => {
            document.body.removeChild(backdrop);
        });
        popup.appendChild(header);

        // Export options
        const optionsContainer = document.createElement('div');
        optionsContainer.style.cssText = `margin-bottom: 20px;`;

        // Check what we have available to export
        const hasRuleGroups = autoFixSettings.ruleGroups && autoFixSettings.ruleGroups.length > 0;
        const hasUngroupedRules = autoFixSettings.ungroupedRules && autoFixSettings.ungroupedRules.length > 0;
        const hasLegacyRules = autoFixSettings.customRegexRules && autoFixSettings.customRegexRules.length > 0;

        if (hasRuleGroups || hasUngroupedRules || hasLegacyRules) {
            // Option 1: Export in old simple array format (backwards compatible)
            const oldFormatBtn = UI.createButton('Export as Simple Array (Old Format)', () => {
                exportCurrentRulesOldFormat();
                document.body.removeChild(backdrop);
            }, {
                styles: {
                    width: '100%',
                    marginBottom: '10px',
                    padding: '12px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: '1px solid #007bff'
                }
            });
            optionsContainer.appendChild(oldFormatBtn);

            // Option 2: Export with new structure (includes groups)
            const newFormatBtn = UI.createButton('Export with Groups (New Format)', () => {
                exportCurrentRules();
                document.body.removeChild(backdrop);
            }, {
                styles: {
                    width: '100%',
                    marginBottom: '10px',
                    padding: '12px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: '1px solid #6c757d'
                }
            });
            optionsContainer.appendChild(newFormatBtn);

            // Show what will be exported
            const infoDiv = document.createElement('div');
            infoDiv.style.cssText = `
                background: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 6px;
                padding: 12px;
                margin-bottom: 15px;
                font-size: 12px;
                color: #666;
            `;
            
            let infoText = 'Will export:\n';
            if (hasRuleGroups) {
                const totalGroupRules = autoFixSettings.ruleGroups.reduce((total, group) => total + (group.rules ? group.rules.length : 0), 0);
                infoText += `• ${autoFixSettings.ruleGroups.length} rule group(s) with ${totalGroupRules} rule(s)\n`;
            }
            if (hasUngroupedRules) {
                infoText += `• ${autoFixSettings.ungroupedRules.length} ungrouped rule(s)\n`;
            }
            if (hasLegacyRules) {
                infoText += `• ${autoFixSettings.customRegexRules.length} legacy rule(s)\n`;
            }
            
            infoDiv.textContent = infoText;
            optionsContainer.appendChild(infoDiv);
        }

        // Option 3: Export built-in rules in old format
        const builtinRulesBtn = UI.createButton('Export Built-in Rules (Old Format)', () => {
            exportBuiltinRules();
            document.body.removeChild(backdrop);
        }, {
            styles: {
                width: '100%',
                marginBottom: '10px',
                padding: '12px',
                backgroundColor: '#28a745',
                color: 'white',
                border: '1px solid #28a745'
            }
        });
        optionsContainer.appendChild(builtinRulesBtn);

        // Add description for built-in rules option
        const builtinInfoDiv = document.createElement('div');
        builtinInfoDiv.style.cssText = `
            background: #d4edda;
            border: 1px solid #c3e6cb;
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 15px;
            font-size: 12px;
            color: #155724;
        `;
        builtinInfoDiv.textContent = 'Export the built-in rule set (zilla\'s Rules) in the old simple array format';
        optionsContainer.appendChild(builtinInfoDiv);

        popup.appendChild(optionsContainer);
        backdrop.appendChild(popup);
        popup.style.display = 'block';
        document.body.appendChild(backdrop);
    }

    // Function to export current rules in old simple array format
    function exportCurrentRulesOldFormat() {
        let allRules = [];
        
        // Collect all rules from different sources
        if (autoFixSettings.ruleGroups && autoFixSettings.ruleGroups.length > 0) {
            autoFixSettings.ruleGroups.forEach(group => {
                if (group.rules && Array.isArray(group.rules)) {
                    allRules = [...allRules, ...group.rules];
                }
            });
        }
        
        if (autoFixSettings.ungroupedRules && autoFixSettings.ungroupedRules.length > 0) {
            allRules = [...allRules, ...autoFixSettings.ungroupedRules];
        }
        
        if (autoFixSettings.customRegexRules && autoFixSettings.customRegexRules.length > 0) {
            allRules = [...allRules, ...autoFixSettings.customRegexRules];
        }
        
        // Clean up rules to ensure they have the standard format
        const cleanRules = allRules.map(rule => ({
            description: rule.description || "Imported rule",
            find: rule.find,
            replace: rule.replace,
            flags: rule.flags || "g",
            enabled: rule.enabled !== false // Default to true if not specified
        }));

        const dataStr = JSON.stringify(cleanRules, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'my-rules-simple.json';
        link.click();
        
        URL.revokeObjectURL(url);
    }

    // Function to export current rules with new structure (includes groups)
    function exportCurrentRules() {
        const exportData = {
            metadata: {
                author: "Custom Export",
                title: "My Custom Rules",
                description: "Exported custom rules",
                version: "1.0",
                exportDate: new Date().toISOString()
            },
            ruleGroups: autoFixSettings.ruleGroups || [],
            ungroupedRules: autoFixSettings.ungroupedRules || [],
            legacyRules: autoFixSettings.customRegexRules || []
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'my-custom-rules-with-groups.json';
        link.click();
        
        URL.revokeObjectURL(url);
    }

    // Function to export built-in rules in old simple array format
    async function exportBuiltinRules() {
        // Built-in rules in old simple array format
        const builtinRules = [
            {
                description: "dat -> that",
                find: "\\bdat\\b",
                replace: "that",
                flags: "gie",
                enabled: true,
                enhancedBoundary: true
            },
            {
                description: "Curly double quotes -> straight double quotes",
                find: "[\\u201c\\u201d]",
                replace: "\"",
                flags: "g",
                enabled: true
            },
            {
                description: "za/Za -> 'za or 'Za",
                find: "\\b([Zz]a)\\b",
                replace: "'$1",
                flags: "ge",
                enabled: true,
                enhancedBoundary: true
            },
            {
                description: "Curly apostrophes -> straight apostrophes",
                find: "[\\u2018\\u2019\\u2032]",
                replace: "'",
                flags: "g",
                enabled: true,
                enhancedBoundary: false
            },
            {
                description: "ur -> your",
                find: "\\bur\\b",
                replace: "your",
                flags: "gie",
                enabled: true,
                enhancedBoundary: true
            },
            {
                description: "Capitalize cali",
                find: "\\bcali\\b",
                replace: "Cali",
                flags: "ge",
                enabled: true,
                enhancedBoundary: true
            },
            {
                description: "Capitalize backwood",
                find: "\\bbackwood(s?)\\b",
                replace: "Backwood$1",
                flags: "ge",
                enabled: true,
                enhancedBoundary: true
            },
            {
                description: "Capitalize looseleaf",
                find: "\\blooseleaf\\b",
                replace: "LooseLeaf",
                flags: "gie",
                enabled: true,
                enhancedBoundary: true
            },
            {
                description: "fix double",
                find: "''",
                replace: "'",
                flags: "gi",
                enabled: true,
                enhancedBoundary: false
            },
            {
                description: "ya -> your",
                find: "ya",
                replace: "your",
                flags: "gie",
                enabled: true,
                enhancedBoundary: true
            },
            {
                description: "y'know -> you know",
                find: "y'know",
                replace: "you know",
                flags: "gie",
                enabled: true,
                enhancedBoundary: true
            },
            {
                description: "wassup -> what's up",
                find: "wassup",
                replace: "what's up",
                flags: "gie",
                enabled: true,
                enhancedBoundary: true
            },
            {
                description: "d'fuck -> the fuck",
                find: "d'fuck",
                replace: "the fuck",
                flags: "gie",
                enabled: true,
                enhancedBoundary: true
            },
            {
                description: "'cuz -> cause",
                find: "'cuz",
                replace: "'cause",
                flags: "gie",
                enabled: true,
                enhancedBoundary: true
            },
            {
                description: "tooly -> toolie",
                find: "tooly",
                replace: "toolie",
                flags: "gie",
                enabled: true,
                enhancedBoundary: true
            },
            {
                description: "em comma to em",
                find: "—,",
                replace: "—",
                flags: "g",
                enabled: true,
                enhancedBoundary: false
            },
            {
                description: "double single quote -> one",
                find: "''",
                replace: "'",
                flags: "g",
                enabled: true,
                enhancedBoundary: false
            }
        ];

        const dataStr = JSON.stringify(builtinRules, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'zillas-rules.json';
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

    // Function to show download rules popup
    function showDownloadRulesPopup() {
        // Create backdrop
        const backdrop = UI.createBackdrop((e) => {
            if (e.target === backdrop) {
                document.body.removeChild(backdrop);
            }
        });
        backdrop.style.display = 'flex';
        backdrop.style.alignItems = 'center';
        backdrop.style.justifyContent = 'center';
        backdrop.style.zIndex = '10004';

        // Create popup
        const popup = UI.createPopup({
            minWidth: '450px',
            maxWidth: '600px',
            position: 'relative',
            top: 'auto',
            left: 'auto',
            transform: 'none'
        });

        // Create header
        const header = UI.createPopupHeader('Download Rule Groups', () => {
            document.body.removeChild(backdrop);
        });
        popup.appendChild(header);

        // Loading message
        const loadingMsg = document.createElement('div');
        loadingMsg.textContent = 'Loading available rule groups...';
        loadingMsg.style.cssText = `
            text-align: center;
            padding: 20px;
            color: #666;
            font-style: italic;
        `;
        popup.appendChild(loadingMsg);

        // Content container (initially empty)
        const contentContainer = document.createElement('div');
        popup.appendChild(contentContainer);

        backdrop.appendChild(popup);
        popup.style.display = 'block';
        document.body.appendChild(backdrop);

        // Fetch rule groups from GitHub
        fetchRuleGroups()
            .then(groups => {
                loadingMsg.remove();
                displayRuleGroups(contentContainer, groups, backdrop);
            })
            .catch(error => {
                loadingMsg.textContent = 'Failed to load rule groups: ' + error.message;
                loadingMsg.style.color = '#d32f2f';
            });
    }

    // Function to fetch rule groups from GitHub
    async function fetchRuleGroups() {
        const response = await fetch('https://raw.githubusercontent.com/ziIIas/scribetools/refs/heads/main/rules.json');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        
        // Convert the single rule group format to our array format
        return [{
            id: data.metadata.id,
            title: data.metadata.title,
            description: data.metadata.description,
            author: data.metadata.author,
            version: data.metadata.version,
            rules: data.rules
        }];
    }

    // Function to display rule groups in the download popup
    function displayRuleGroups(container, groups, backdrop) {
        groups.forEach(group => {
            const groupDiv = document.createElement('div');
            groupDiv.style.cssText = `
                border: 1px solid #dee2e6;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 12px;
                background: #f8f9fa;
                cursor: pointer;
                transition: background-color 0.2s ease;
            `;

            groupDiv.addEventListener('mouseenter', () => {
                groupDiv.style.backgroundColor = '#e9ecef';
            });

            groupDiv.addEventListener('mouseleave', () => {
                groupDiv.style.backgroundColor = '#f8f9fa';
            });

            const title = document.createElement('h4');
            title.textContent = group.title;
            title.style.cssText = `
                margin: 0 0 8px 0;
                font-size: 16px;
                font-weight: 500;
                color: #333;
            `;

            const description = document.createElement('p');
            description.textContent = group.description;
            description.style.cssText = `
                margin: 0 0 12px 0;
                font-size: 14px;
                color: #666;
                line-height: 1.4;
            `;

            const metadata = document.createElement('div');
            metadata.style.cssText = `
                font-size: 12px;
                color: #999;
                border-top: 1px solid #dee2e6;
                padding-top: 8px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            `;

            const metaInfo = document.createElement('span');
            metaInfo.innerHTML = `Author: ${group.author} | ID: ${group.id} | Version: ${group.version}`;

            const ruleCount = document.createElement('span');
            ruleCount.textContent = `${group.rules.length} rule${group.rules.length === 1 ? '' : 's'}`;

            metadata.appendChild(metaInfo);
            metadata.appendChild(ruleCount);

            groupDiv.appendChild(title);
            groupDiv.appendChild(description);
            groupDiv.appendChild(metadata);

            groupDiv.addEventListener('click', () => {
                showGroupRulesPopup(group, backdrop);
            });

            container.appendChild(groupDiv);
        });
    }

    // Function to show individual rules within a group for selection
    function showGroupRulesPopup(group, originalBackdrop) {
        // Hide the original backdrop
        originalBackdrop.style.display = 'none';

        // Create new backdrop for group rules
        const backdrop = UI.createBackdrop((e) => {
            if (e.target === backdrop) {
                document.body.removeChild(backdrop);
                originalBackdrop.style.display = 'flex'; // Show original popup again
            }
        });
        backdrop.style.display = 'flex';
        backdrop.style.alignItems = 'center';
        backdrop.style.justifyContent = 'center';
        backdrop.style.zIndex = '10005';

        const popup = UI.createPopup({
            minWidth: '500px',
            maxWidth: '700px',
            position: 'relative',
            top: 'auto',
            left: 'auto',
            transform: 'none',
            maxHeight: '80vh',
            overflowY: 'auto'
        });

        // Header with back button
        const headerContainer = document.createElement('div');
        headerContainer.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 1px solid #eee;
        `;

        const backButton = document.createElement('button');
        backButton.innerHTML = '← Back';
        backButton.style.cssText = `
            background: none;
            border: 1px solid #dee2e6;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        `;
        backButton.addEventListener('click', () => {
            document.body.removeChild(backdrop);
            originalBackdrop.style.display = 'flex';
        });

        const title = document.createElement('h3');
        title.textContent = group.title;
        title.style.cssText = `
            margin: 0;
            font-size: 18px;
            font-weight: 400;
            color: #333;
        `;

        const closeButton = UI.createCloseButton(() => {
            document.body.removeChild(backdrop);
            document.body.removeChild(originalBackdrop);
        });

        headerContainer.appendChild(backButton);
        headerContainer.appendChild(title);
        headerContainer.appendChild(closeButton);
        popup.appendChild(headerContainer);

        // Group info
        const groupInfo = document.createElement('div');
        groupInfo.style.cssText = `
            background: #f8f9fa;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 16px;
            font-size: 13px;
            color: #666;
        `;
        groupInfo.innerHTML = `
            <div style="margin-bottom: 4px;"><strong>Description:</strong> ${group.description}</div>
            <div><strong>Author:</strong> ${group.author} | <strong>Version:</strong> ${group.version} | <strong>Rules:</strong> ${group.rules.length}</div>
        `;
        popup.appendChild(groupInfo);

        // Selection controls
        const selectionControls = document.createElement('div');
        selectionControls.style.cssText = `
            display: flex;
            gap: 8px;
            margin-bottom: 16px;
            flex-wrap: wrap;
            align-items: center;
        `;

        const selectAllBtn = createSmallButton('Select All', () => {
            const checkboxes = popup.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = true);
            updateDownloadButton();
        });

        const selectNoneBtn = createSmallButton('Select None', () => {
            const checkboxes = popup.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = false);
            updateDownloadButton();
        });

        const downloadSelectedBtn = createSmallButton('Download Selected', () => {
            downloadSelectedRules();
        });
        downloadSelectedBtn.style.backgroundColor = '#007bff';
        downloadSelectedBtn.style.color = 'white';
        downloadSelectedBtn.style.borderColor = '#007bff';
        downloadSelectedBtn.disabled = true;
        downloadSelectedBtn.style.opacity = '0.6';

        selectionControls.appendChild(selectAllBtn);
        selectionControls.appendChild(selectNoneBtn);
        selectionControls.appendChild(downloadSelectedBtn);
        popup.appendChild(selectionControls);

        // Rules container
        const rulesContainer = document.createElement('div');
        rulesContainer.style.cssText = `
            max-height: 400px;
            overflow-y: auto;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            background: #fff;
        `;

        // Display rules with checkboxes
        group.rules.forEach((rule, index) => {
            const ruleDiv = document.createElement('div');
            ruleDiv.style.cssText = `
                display: flex;
                padding: 12px;
                border-bottom: 1px solid #f0f0f0;
                align-items: flex-start;
                gap: 12px;
            `;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `rule-${index}`;
            checkbox.style.cssText = `
                margin-top: 2px;
                cursor: pointer;
            `;
            checkbox.addEventListener('change', updateDownloadButton);

            const ruleContent = document.createElement('div');
            ruleContent.style.cssText = `
                flex: 1;
                min-width: 0;
            `;

            const ruleTitle = document.createElement('div');
            ruleTitle.textContent = rule.description || `Rule ${index + 1}`;
            ruleTitle.style.cssText = `
                font-weight: 500;
                margin-bottom: 6px;
                color: #333;
            `;

            const ruleDetails = document.createElement('div');
            ruleDetails.style.cssText = `
                font-size: 12px;
                color: #666;
                font-family: monospace;
                background: #f8f9fa;
                padding: 6px;
                border-radius: 4px;
            `;

            let replaceText = typeof rule.replace === 'string' ? rule.replace : 
                             typeof rule.replace === 'function' ? '[Function]' : rule.replace;
            
            let enhancedBoundaryText = '';
            if (rule.enhancedBoundary && rule.flags && rule.flags.includes('e')) {
                enhancedBoundaryText = ' <span style="color: #007bff; font-weight: bold;">[Enhanced Boundary]</span>';
            }

            ruleDetails.innerHTML = `
                <div><strong>Find:</strong> /${rule.find}/${rule.flags || 'gi'}${enhancedBoundaryText}</div>
                <div><strong>Replace:</strong> ${replaceText}</div>
            `;

            ruleContent.appendChild(ruleTitle);
            ruleContent.appendChild(ruleDetails);

            ruleDiv.appendChild(checkbox);
            ruleDiv.appendChild(ruleContent);
            rulesContainer.appendChild(ruleDiv);
        });

        popup.appendChild(rulesContainer);

        function updateDownloadButton() {
            const checkboxes = popup.querySelectorAll('input[type="checkbox"]');
            const selectedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
            
            downloadSelectedBtn.disabled = selectedCount === 0;
            downloadSelectedBtn.style.opacity = selectedCount === 0 ? '0.6' : '1';
            downloadSelectedBtn.textContent = selectedCount === 0 ? 'Download Selected' : `Download ${selectedCount} Rule${selectedCount === 1 ? '' : 's'}`;
        }

        function downloadSelectedRules() {
            const checkboxes = popup.querySelectorAll('input[type="checkbox"]');
            const selectedRules = [];
            
            checkboxes.forEach((cb, index) => {
                if (cb.checked) {
                    selectedRules.push(group.rules[index]);
                }
            });

            if (selectedRules.length === 0) {
                alert('No rules selected.');
                return;
            }

            // Check if group already exists
            const existingGroupIndex = autoFixSettings.ruleGroups.findIndex(g => g.id === group.id);
            
            if (existingGroupIndex >= 0) {
                // Update existing group
                const existingGroup = autoFixSettings.ruleGroups[existingGroupIndex];
                const newRules = selectedRules.filter(newRule => 
                    !existingGroup.rules.some(existingRule => 
                        existingRule.find === newRule.find && existingRule.replace === newRule.replace
                    )
                );
                
                if (newRules.length > 0) {
                    existingGroup.rules.push(...newRules);
                    existingGroup.version = group.version; // Update version
                }
                
                alert(`Added ${newRules.length} new rule${newRules.length === 1 ? '' : 's'} to existing group "${group.title}".`);
            } else {
                // Create new group
                autoFixSettings.ruleGroups.push({
                    id: group.id,
                    title: group.title,
                    description: group.description,
                    author: group.author,
                    version: group.version,
                    rules: selectedRules
                });
                
                alert(`Downloaded ${selectedRules.length} rule${selectedRules.length === 1 ? '' : 's'} in new group "${group.title}".`);
            }

            saveSettings();
            refreshCustomRegexRulesWithGroups(document.getElementById('custom-regex-rules-container'));
            
            // Close popups
            document.body.removeChild(backdrop);
            document.body.removeChild(originalBackdrop);
        }

        backdrop.appendChild(popup);
        popup.style.display = 'block';
        document.body.appendChild(backdrop);
    }

