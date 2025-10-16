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
            
            // Process customRegexRules (legacy)
            if (settingsToSave.customRegexRules && Array.isArray(settingsToSave.customRegexRules)) {
                settingsToSave.customRegexRules = settingsToSave.customRegexRules.map(rule => {
                    if (typeof rule.replace === 'function') {
                        return { ...rule, replace: rule.replace.toString() };
                    }
                    return rule;
                });
            }
            
            // Process ungroupedRules
            if (settingsToSave.ungroupedRules && Array.isArray(settingsToSave.ungroupedRules)) {
                settingsToSave.ungroupedRules = settingsToSave.ungroupedRules.map(rule => {
                    if (typeof rule.replace === 'function') {
                        return { ...rule, replace: rule.replace.toString() };
                    }
                    return rule;
                });
            }
            
            // Process ruleGroups
            if (settingsToSave.ruleGroups && Array.isArray(settingsToSave.ruleGroups)) {
                settingsToSave.ruleGroups = settingsToSave.ruleGroups.map(group => {
                    const groupCopy = { ...group };
                    if (groupCopy.rules && Array.isArray(groupCopy.rules)) {
                        groupCopy.rules = groupCopy.rules.map(rule => {
                            if (typeof rule.replace === 'function') {
                                return { ...rule, replace: rule.replace.toString() };
                            }
                            return rule;
                        });
                    }
                    return groupCopy;
                });
            }
            
            const jsonString = JSON.stringify(settingsToSave);
            localStorage.setItem('genius-autofix-settings', jsonString);
            
            // Create a backup in case the main storage gets corrupted
            localStorage.setItem('genius-autofix-settings-backup', jsonString);
            
            console.log('Settings saved successfully. Total rules:', 
                (settingsToSave.customRegexRules?.length || 0) + 
                (settingsToSave.ungroupedRules?.length || 0) +
                (settingsToSave.ruleGroups?.reduce((acc, g) => acc + (g.rules?.length || 0), 0) || 0)
            );
        } catch (e) {
            console.error('Failed to save settings:', e);
            alert('Warning: Failed to save custom regex rules. Error: ' + e.message);
        }
    }

    // Function to load settings from localStorage
    function loadSettings() {
        try {
            let saved = localStorage.getItem('genius-autofix-settings');
            let loadedSettings = null;
            
            // Try to parse the saved settings
            try {
                if (saved) {
                    loadedSettings = JSON.parse(saved);
                }
            } catch (parseError) {
                console.error('Failed to parse settings, trying backup:', parseError);
                // Try to load from backup if main storage is corrupted
                const backup = localStorage.getItem('genius-autofix-settings-backup');
                if (backup) {
                    try {
                        loadedSettings = JSON.parse(backup);
                        console.log('Successfully loaded from backup');
                        // Restore the main storage from backup
                        localStorage.setItem('genius-autofix-settings', backup);
                    } catch (backupError) {
                        console.error('Backup is also corrupted:', backupError);
                    }
                }
            }
            
            if (loadedSettings) {
                // Helper function to restore functions from strings
                const restoreFunction = (rule) => {
                    if (typeof rule.replace === 'string' && rule.replace.startsWith('function')) {
                        try {
                            rule.replace = eval(`(${rule.replace})`);
                        } catch (e) {
                            console.warn('Failed to restore function for rule:', rule.description || rule.find);
                        }
                    }
                    return rule;
                };
                
                // Handle customRegexRules (legacy)
                if (loadedSettings.customRegexRules && Array.isArray(loadedSettings.customRegexRules)) {
                    loadedSettings.customRegexRules = loadedSettings.customRegexRules.map(restoreFunction);
                }
                
                // Handle ungroupedRules
                if (loadedSettings.ungroupedRules && Array.isArray(loadedSettings.ungroupedRules)) {
                    loadedSettings.ungroupedRules = loadedSettings.ungroupedRules.map(restoreFunction);
                }
                
                // Handle ruleGroups
                if (loadedSettings.ruleGroups && Array.isArray(loadedSettings.ruleGroups)) {
                    loadedSettings.ruleGroups = loadedSettings.ruleGroups.map(group => {
                        if (group.rules && Array.isArray(group.rules)) {
                            group.rules = group.rules.map(restoreFunction);
                        }
                        return group;
                    });
                }
                
                // Merge loaded settings with defaults
                autoFixSettings = { ...autoFixSettings, ...loadedSettings };
                
                // Load em dash state from settings
                emDashEnabled = autoFixSettings.emDashEnabled || false;
                
                console.log('Settings loaded successfully. Total rules:', 
                    (autoFixSettings.customRegexRules?.length || 0) + 
                    (autoFixSettings.ungroupedRules?.length || 0) +
                    (autoFixSettings.ruleGroups?.reduce((acc, g) => acc + (g.rules?.length || 0), 0) || 0)
                );
            } else {
                console.log('No saved settings found, using defaults');
            }
        } catch (e) {
            console.error('Fatal error loading settings:', e);
        }
    }

    // Verify settings persistence periodically
    function verifySettingsPersistence() {
        const saved = localStorage.getItem('genius-autofix-settings');
        if (!saved) {
            console.warn('Settings not found in localStorage! Attempting recovery...');
            const backup = localStorage.getItem('genius-autofix-settings-backup');
            if (backup) {
                localStorage.setItem('genius-autofix-settings', backup);
                console.log('Settings recovered from backup');
            } else {
                console.error('No backup available. Settings may be lost.');
                // Try to save current in-memory settings
                saveSettings();
            }
        }
    }

    // Export settings to JSON file for manual backup
    function exportSettings() {
        try {
            const settingsJson = localStorage.getItem('genius-autofix-settings');
            if (!settingsJson) {
                alert('No settings to export');
                return;
            }
            
            const blob = new Blob([settingsJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `genius-scribetools-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('Settings exported successfully');
            alert('Settings exported successfully!');
        } catch (e) {
            console.error('Failed to export settings:', e);
            alert('Failed to export settings: ' + e.message);
        }
    }

    // Import settings from JSON file
    function importSettings(fileInput) {
