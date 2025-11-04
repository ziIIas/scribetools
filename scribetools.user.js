// ==UserScript==
// @name         Genius ScribeTools
// @namespace    http://tampermonkey.net/
// @version      4.21
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

    // Auto-save variables (tracked per editor context: lyrics, annotations, bios)
    let autoSaveInterval = null;
    const lastSavedContent = new Map();
    const activeEditors = new Map();
    const restorePromptShownForContext = new Set();
    const autoSaveInputTimeouts = new Map();
    let lastFocusedContextKey = null;
    let isEditing = false;

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
        emDashEnabled: false, // Save em dash toggle state
        emDashMode: '3', // Options: '2' for --, '3' for --- (default is 3)
        dashType: 'em', // Options: 'em' for em dash (—), 'en' for en dash (–), 'off' for disabled
        dashTrigger: '3', // Options: 'off' for disabled, '2' for --, '3' for --- (moved from emDashMode for dash button settings)
        // New rule groups structure
        ruleGroups: [], // Array of {id: string, title: string, description: string, author: string, version: string, rules: array}
        ungroupedRules: [], // Rules not assigned to any group
        persistentAutoSave: false,
        groupFixesByRule: false // Group autofix prompts by rule instead of one at a time
    };

    // Autoscribe settings
    let autoscribeSettings = {
        musicAiApiKey: '',
        formattingProvider: 'gemini', // Options: 'gemini', 'deepseek', 'none'
        geminiApiKey: '',
        geminiModel: 'gemini-2.5-flash', // Options: 'gemini-2.5-flash', 'gemini-2.5-pro'
        deepseekApiKey: '',
        deepseekModel: 'deepseek-chat', // Options: 'deepseek-chat', 'deepseek-reasoner'
        useFormatting: true, // Master toggle
        useHeaders: true // Toggle for song part headers
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
                width: '500px',
                maxHeight: '85vh',
                overflowY: 'auto',
                transition: 'width 0.3s ease, max-width 0.3s ease'
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

        // Reusable button styling with predefined color schemes
        styleButtonWithHover(button, colorScheme = 'primary') {
            const schemes = {
                primary: {
                    base: { backgroundColor: '#007bff', color: 'white', borderColor: '#007bff' },
                    hover: { backgroundColor: '#0056b3', borderColor: '#004085' }
                },
                success: {
                    base: { backgroundColor: '#28a745', color: 'white', borderColor: '#28a745' },
                    hover: { backgroundColor: '#218838', borderColor: '#1e7e34' }
                },
                info: {
                    base: { backgroundColor: '#17a2b8', color: 'white', borderColor: '#17a2b8' },
                    hover: { backgroundColor: '#138496', borderColor: '#117a8b' }
                },
                danger: {
                    base: { backgroundColor: '#dc3545', color: 'white', borderColor: '#dc3545' },
                    hover: { backgroundColor: '#c82333', borderColor: '#bd2130' }
                },
                secondary: {
                    base: { backgroundColor: '#6c757d', color: 'white', borderColor: '#6c757d' },
                    hover: { backgroundColor: '#545b62', borderColor: '#4e555b' }
                }
            };

            const scheme = schemes[colorScheme] || schemes.primary;

            // Apply base styles
            Object.assign(button.style, scheme.base);

            // Add hover effect
            this.addHoverEffect(button, scheme.hover, scheme.base);
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
        createRuleElement(rule, index, onToggle, onDelete, onModeChange, isSearchResult = false) {
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
                marginBottom: '8px',
                alignItems: 'center'
            });

            const leftSection = this.createFlexContainer('row', '8px', {
                alignItems: 'center',
                flex: '1'
            });

            const enabledCheckbox = document.createElement('input');
            enabledCheckbox.type = 'checkbox';
            enabledCheckbox.checked = rule.enabled !== false;
            enabledCheckbox.addEventListener('change', () => onToggle(index, enabledCheckbox.checked));

            const description = document.createElement('span');
            description.textContent = rule.description || `Rule ${index + 1}`;
            description.style.cssText = `
                font-weight: 400;
                font-family: ${this.FONTS.primary};
                margin-right: 12px;
            `;

            // Mode dropdown (ask/off/auto)
            const modeDropdown = document.createElement('select');
            modeDropdown.style.cssText = `
                padding: 2px 6px;
                border-radius: 4px;
                border: 1px solid ${this.COLORS.border};
                background: white;
                font-size: 11px;
                font-family: ${this.FONTS.primary};
                cursor: pointer;
            `;

            const modes = [
                { value: 'auto', label: 'Auto' },
                { value: 'ask', label: 'Ask' },
                { value: 'off', label: 'Off' }
            ];

            modes.forEach(mode => {
                const option = document.createElement('option');
                option.value = mode.value;
                option.textContent = mode.label;
                if (rule.askMode === mode.value || (mode.value === 'auto' && !rule.askMode)) {
                    option.selected = true;
                }
                modeDropdown.appendChild(option);
            });

            modeDropdown.addEventListener('change', () => {
                if (onModeChange) {
                    onModeChange(index, modeDropdown.value);
                }
            });

            const deleteBtn = this.createButton('Delete', (e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(index);
            }, {
                styles: { fontSize: '10px', padding: '2px 6px', height: 'auto' }
            });

            // Apply consistent red styling to match delete group button
            this.styleButtonWithHover(deleteBtn, 'danger');

            leftSection.appendChild(enabledCheckbox);
            leftSection.appendChild(description);
            leftSection.appendChild(modeDropdown);

            header.appendChild(leftSection);
            header.appendChild(deleteBtn);
            ruleDiv.appendChild(header);

            // Rule details
            const details = document.createElement('div');
            details.style.cssText = `
                font-size: 12px;
                color: ${this.COLORS.secondary};
                font-family: monospace;
            `;

            let replaceText;
            if (typeof rule.replace === 'function') {
                // Show the actual function code
                const funcCode = rule.replace.toString();
                replaceText = `<span style="color: #6f42c1; font-family: monospace; font-size: 11px; display: block; white-space: pre-wrap; max-width: 100%; overflow-wrap: break-word;">[Function]<br>${funcCode}</span>`;
            } else if (typeof rule.replace === 'string') {
                replaceText = rule.replace;
                
                if (rule.replace.includes('\\')) {
                    let jsReplacement = rule.replace.replace(/(?<!\\)\\(\d+)/g, '$$$1');
                    if (jsReplacement !== rule.replace) {
                        replaceText += ` <span style="color: ${this.COLORS.success};">(JS: ${jsReplacement})</span>`;
                    }
                }
            } else {
                replaceText = rule.replace;
            }

            let enhancedBoundaryText = '';
            if (rule.enhancedBoundary && rule.flags && rule.flags.includes('e')) {
                enhancedBoundaryText = ' <span style="color: #007bff; font-weight: bold;">[Enhanced Boundary]</span>';
            }

            details.innerHTML = `
                <div><strong>Find:</strong> /${rule.find}/${rule.flags || 'gi'}${enhancedBoundaryText}</div>
                <div><strong>Replace:</strong> ${replaceText}</div>
            `;
            ruleDiv.appendChild(details);

            return ruleDiv;
        }
    };

    // Helper function to get current Genius button class names dynamically
    function getGeniusButtonClasses() {
        // Try to find an existing Genius button and extract its classes
        const existingButton = document.querySelector('[class*="LyricsEdit-desktop__Button-sc-"]');
        if (existingButton) {
            const classes = Array.from(existingButton.classList);
            const buttonContainerClass = classes.find(c => c.match(/^Button__Container-sc-[a-f0-9]+-\d+$/));
            const lyricsEditButtonClass = classes.find(c => c.match(/^LyricsEdit-desktop__Button-sc-[a-f0-9]+-\d+$/));
            const styleClasses = classes.filter(c => !c.includes('__') && !c.includes('-sc-'));

            return {
                container: buttonContainerClass || 'Button__Container-sc-1a87beb7-0',
                lyricsEdit: lyricsEditButtonClass || 'LyricsEdit-desktop__Button-sc-d9ac6a5d-4',
                styles: styleClasses.join(' ') || 'kRGGgU iUzusl'
            };
        }

        // Fallback to current known classes
        return {
            container: 'Button__Container-sc-1a87beb7-0',
            lyricsEdit: 'LyricsEdit-desktop__Button-sc-d9ac6a5d-4',
            styles: 'kRGGgU iUzusl'
        };
    }

    // Helper function to get current Genius small button class names dynamically
    function getGeniusSmallButtonClasses() {
        const existingSmallButton = document.querySelector('[class*="SmallButton__Container-sc-"]');
        if (existingSmallButton) {
            const classes = Array.from(existingSmallButton.classList);
            const containerClass = classes.find(c => c.match(/^SmallButton__Container-sc-[a-f0-9]+-\d+$/));
            const styleClasses = classes.filter(c => !c.includes('__') && !c.includes('-sc-'));

            return {
                container: containerClass || 'SmallButton__Container-sc-fd351a33-0',
                styles: styleClasses.join(' ') || 'KqsTp'
            };
        }

        return {
            container: 'SmallButton__Container-sc-fd351a33-0',
            styles: 'KqsTp'
        };
    }

    // Function to create the combined dash toggle + settings button
    function createToggleButton() {
        const button = document.createElement('button');

        // Get current dash type for display
        const dashType = autoFixSettings.dashType || 'em';
        const dashChar = dashType === 'em' ? '—' : dashType === 'en' ? '–' : '—';

        button.innerHTML = `
            <span class="dash-text" style="margin-right: 0.5rem;">${dashChar}</span>
            <span class="settings-icon" style="opacity: 0.7; transition: opacity 0.2s;">
                <svg class="svg-icon" style="width: 1em; height: 1em;vertical-align: middle;fill: currentColor;overflow: hidden;" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg">
                    <path d="M512 661.994667q61.994667 0 106.005333-44.010667t44.010667-106.005333-44.010667-106.005333-106.005333-44.010667-106.005333 44.010667-44.010667 106.005333 44.010667 106.005333 106.005333 44.010667zM829.994667 554.005333l90.005333 69.994667q13.994667 10.005333 4.010667 28.010667l-85.994667 148.010667q-8 13.994667-26.005333 8l-106.005333-42.005333q-42.005333 29.994667-72 42.005333l-16 112q-4.010667 18.005333-20.010667 18.005333l-172.010667 0q-16 0-20.010667-18.005333l-16-112q-37.994667-16-72-42.005333l-106.005333 42.005333q-18.005333 5.994667-26.005333-8l-85.994667-148.010667q-10.005333-18.005333 4.010667-28.010667l90.005333-69.994667q-2.005333-13.994667-2.005333-42.005333t2.005333-42.005333l-90.005333-69.994667q-13.994667-10.005333-4.010667-28.010667l85.994667-148.010667q8-13.994667 26.005333-8l106.005333 42.005333q42.005333-29.994667 72-42.005333l16-112q4.010667-18.005333 20.010667-18.005333l172.010667 0q16 0 20.010667 18.005333l16 112q37.994667 16 72 42.005333l106.005333-42.005333q18.005333-5.994667 26.005333 8l85.994667 148.010667q10.005333 18.005333-4.010667 28.010667l-90.005333 69.994667q2.005333 13.994667 2.005333 42.005333t-2.005333 42.005333z" />
                </svg>
            </span>
        `;

        button.title = 'Toggle Dash Auto-Replace. Click gear icon for settings.';
        button.id = 'genius-emdash-toggle';

        // Style to match Genius buttons - get classes dynamically
        const buttonClasses = getGeniusButtonClasses();
        button.className = `${buttonClasses.container} ${buttonClasses.styles} ${buttonClasses.lyricsEdit}`;

        // Additional custom styling to match the autofix button
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
            updateButtonState(); // Reset to proper state colors
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
            const settingsZoneStart = buttonRect.left + (buttonWidth * 0.5); // Right 50% of button

            // If click is in the settings zone (right 50%), open settings
            if (clickX >= settingsZoneStart) {
                toggleDashSettingsPopup();
            } else {
                // Otherwise, toggle dash functionality
                emDashEnabled = !emDashEnabled;
                autoFixSettings.emDashEnabled = emDashEnabled; // Save to settings
                saveSettings(); // Persist to localStorage
                updateButtonState();
            }
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
    // Function to create the dash settings popup
    function createDashSettingsPopup() {
        // Create backdrop using utility
        const backdrop = UI.createBackdrop(() => {
            backdrop.style.display = 'none';
            popup.style.display = 'none';
        });
        backdrop.id = 'genius-dash-settings-backdrop';

        // Create popup using utility
        const popup = UI.createPopup();
        popup.id = 'genius-dash-settings-popup';

        // Create header using utility
        const header = UI.createPopupHeader('Dash Settings', () => {
            backdrop.style.display = 'none';
            popup.style.display = 'none';
        });

        popup.appendChild(header);

        // Create settings content
        const content = createDashSettingsContent();
        popup.appendChild(content);

        document.body.appendChild(backdrop);
        document.body.appendChild(popup);

        return { backdrop, popup };
    }

    // Function to create dash settings content
    function createDashSettingsContent() {
        const content = document.createElement('div');

        const settings = [
            {
                key: 'dashType',
                label: 'Dash Type',
                type: 'dropdown',
                options: [
                    { value: 'en', label: 'En dash (–)' },
                    { value: 'em', label: 'Em dash (—)' }
                ]
            },
            {
                key: 'dashTrigger',
                label: 'Trigger Pattern',
                type: 'dropdown',
                options: [
                    { value: 'off', label: 'Off (disabled)' },
                    { value: '2', label: 'Two dashes (--)' },
                    { value: '3', label: 'Three dashes (---)' }
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

            // Create dropdown
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
            dropdown.id = `dash-setting-${setting.key}`;
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

                // Update button display if dash type changed
                if (setting.key === 'dashType') {
                    updateButtonState();
                }
            });

            container.appendChild(label);
            container.appendChild(dropdown);
            content.appendChild(container);
        });

        return content;
    }

    // Function to toggle dash settings popup
    function toggleDashSettingsPopup() {
        let popup = document.getElementById('genius-dash-settings-popup');
        let backdrop = document.getElementById('genius-dash-settings-backdrop');

        if (!popup) {
            const result = createDashSettingsPopup();
            popup = result.popup;
            backdrop = result.backdrop;
        }

        const isVisible = popup.style.display !== 'none';
        popup.style.display = isVisible ? 'none' : 'block';
        backdrop.style.display = isVisible ? 'none' : 'flex';
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
            const popup = document.getElementById('genius-settings-popup');

            if (tabName === 'default') {
                // Update tab styles
                defaultTabEl.style.color = '#007bff';
                defaultTabEl.style.borderBottomColor = '#007bff';
                customTabEl.style.color = '#6c757d';
                customTabEl.style.borderBottomColor = 'transparent';

                // Show/hide content
                defaultContentEl.style.display = 'block';
                customContentEl.style.display = 'none';
                
                // Set narrow width for default settings
                if (popup) {
                    popup.style.width = '500px';
                    popup.style.maxWidth = '500px';
                }
            } else {
                // Update tab styles
                defaultTabEl.style.color = '#6c757d';
                defaultTabEl.style.borderBottomColor = 'transparent';
                customTabEl.style.color = '#007bff';
                customTabEl.style.borderBottomColor = '#007bff';

                // Show/hide content
                defaultContentEl.style.display = 'none';
                customContentEl.style.display = 'block';
                
                // Set wide width for custom rules
                if (popup) {
                    popup.style.width = '1400px';
                    popup.style.maxWidth = '90vw';
                }
            }
        }

        return container;
    }

    // Function to create default settings content
    function createDefaultSettingsContent() {
        const content = document.createElement('div');

        const settings = [
            { key: 'parenthesesFormatting', label: 'Fix parentheses formatting', type: 'checkbox' },
            { key: 'bracketHighlighting', label: 'Highlight mismatched brackets', type: 'checkbox' },
            { key: 'emDashFixes', label: 'Convert word- to word— / word–', type: 'checkbox' },
            { key: 'capitalizeParentheses', label: 'Capitalize first letter in parentheses', type: 'checkbox' },
            { key: 'customRegex', label: 'Enable custom regex rules', type: 'checkbox' },
            { key: 'persistentAutoSave', label: 'Keep auto-saved drafts after Save / Save & Exit', type: 'checkbox' },
            { key: 'stutterEmDash', label: 'Fix stutter formatting (Ja— ja— ja— → Ja-ja-ja-)', type: 'checkbox' },

            { key: 'numberToText', label: 'Convert numbers to text', type: 'dropdown',
              options: [
                  { value: 'off', label: 'Off' },
                  { value: 'ask', label: 'Ask for each number' },
                  { value: 'on', label: 'Convert automatically' }
              ]
            },
            { key: 'groupFixesByRule', label: 'Group autofix prompts by rule (show all fixes at once)', type: 'checkbox' }
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
    function createSmallButton(text, clickHandler) {
        return UI.createButton(text, clickHandler, {
            styles: {
                fontSize: '11px',
                padding: '5px 10px',
                whiteSpace: 'nowrap'
            }
        });
    }

    // Function to refresh the custom regex rules display with groups
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

    // Function to get professional color scheme for a group
    function getPastelColor(index) {
        const colors = [
            { bg: '#fff5f5', bgDark: '#ffe8e8', border: '#e74c3c', text: '#c0392b', accent: '#e74c3c' },  // Red
            { bg: '#fffaf0', bgDark: '#fff4e0', border: '#f39c12', text: '#d68910', accent: '#f39c12' },  // Orange
            { bg: '#f0fff4', bgDark: '#e0ffe8', border: '#27ae60', text: '#229954', accent: '#27ae60' },  // Green
            { bg: '#f0f8ff', bgDark: '#e0f0ff', border: '#3498db', text: '#2980b9', accent: '#3498db' },  // Blue
            { bg: '#faf5ff', bgDark: '#f0e8ff', border: '#9b59b6', text: '#8e44ad', accent: '#9b59b6' }   // Purple
        ];
        return colors[index % colors.length];
    }

    // Function to create a rule group element (Professional Table Style)
    function createRuleGroupElement(group, groupIndex) {
        const color = getPastelColor(groupIndex);
        
        const groupContainer = document.createElement('div');
        groupContainer.style.cssText = `
            border: 1px solid #e1e4e8;
            border-left: 4px solid ${color.accent};
            border-radius: 6px;
            margin-bottom: 12px;
            background: ${color.bg};
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
            transition: box-shadow 0.2s ease;
        `;
        
        groupContainer.addEventListener('mouseenter', () => {
            groupContainer.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
        });
        
        groupContainer.addEventListener('mouseleave', () => {
            groupContainer.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
        });

        // Group header with controls
        const groupHeader = document.createElement('div');
        groupHeader.style.cssText = `
            background: ${color.bgDark};
            padding: 12px 16px;
            display: flex;
            align-items: center;
            gap: 16px;
            border-bottom: 1px solid #e1e4e8;
            cursor: pointer;
            user-select: none;
        `;

        // Enable/Disable toggle
        const enableToggle = document.createElement('input');
        enableToggle.type = 'checkbox';
        enableToggle.checked = group.enabled !== false;
        enableToggle.style.cssText = `
            width: 18px;
            height: 18px;
            cursor: pointer;
            margin: 0;
            flex-shrink: 0;
        `;
        enableToggle.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        enableToggle.addEventListener('change', (e) => {
            e.stopPropagation();
            group.enabled = enableToggle.checked;
            saveSettings();
            groupInfo.style.opacity = group.enabled ? '1' : '0.5';
        });

        // Color indicator
        const colorIndicator = document.createElement('div');
        colorIndicator.style.cssText = `
            width: 6px;
            height: 32px;
            background: ${color.accent};
            border-radius: 3px;
            flex-shrink: 0;
        `;

        // Group info
        const groupInfo = document.createElement('div');
        groupInfo.style.cssText = `
            flex: 1;
            min-width: 0;
            opacity: ${group.enabled !== false ? '1' : '0.5'};
            transition: opacity 0.2s ease;
        `;

        const groupTitle = document.createElement('div');
        groupTitle.textContent = group.title;
        groupTitle.style.cssText = `
            font-weight: 600;
            color: #24292e;
            font-size: 15px;
            margin-bottom: 2px;
            letter-spacing: -0.01em;
        `;

        const groupMeta = document.createElement('div');
        groupMeta.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
        `;
        groupMeta.innerHTML = `
            <span style="font-size: 12px; color: #586069;">${group.description}</span>
            <span style="font-size: 11px; color: #959da5; display: inline-flex; align-items: center; gap: 4px;">
                <span style="background: ${color.accent}; color: white; padding: 2px 6px; border-radius: 3px; font-weight: 500;">v${group.version}</span>
                <span>•</span>
                <span>${group.rules.length} rule${group.rules.length !== 1 ? 's' : ''}</span>
                ${group.author ? `<span>•</span><span>by ${group.author}</span>` : ''}
            </span>
        `;

        groupInfo.appendChild(groupTitle);
        groupInfo.appendChild(groupMeta);

        // Expand indicator
        const expandIndicator = document.createElement('div');
        expandIndicator.innerHTML = '▼';
        expandIndicator.style.cssText = `
            font-size: 12px;
            color: #586069;
            transition: transform 0.2s ease;
            flex-shrink: 0;
        `;

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '×';
        deleteBtn.style.cssText = `
            width: 28px;
            height: 28px;
            padding: 0;
            background: white;
            border: 1px solid #e1e4e8;
            border-radius: 4px;
            color: #cb2431;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s ease;
            flex-shrink: 0;
            line-height: 1;
        `;
        deleteBtn.addEventListener('mouseenter', () => {
            deleteBtn.style.background = '#ffeef0';
            deleteBtn.style.borderColor = '#cb2431';
        });
        deleteBtn.addEventListener('mouseleave', () => {
            deleteBtn.style.background = 'white';
            deleteBtn.style.borderColor = '#e1e4e8';
        });
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Delete "${group.title}" and all its rules?`)) {
                autoFixSettings.ruleGroups.splice(groupIndex, 1);
                saveSettings();
                refreshCustomRegexRulesWithGroups(document.getElementById('custom-regex-rules-container'));
            }
        });

        groupHeader.appendChild(enableToggle);
        groupHeader.appendChild(colorIndicator);
        groupHeader.appendChild(groupInfo);
        groupHeader.appendChild(expandIndicator);
        groupHeader.appendChild(deleteBtn);

        // Rules grid (collapsed by default)
        const rulesGrid = document.createElement('div');
        rulesGrid.style.cssText = `
            display: none;
            padding: 16px;
            background: white;
        `;

        // Container for rule cards
        const rulesContainer = document.createElement('div');
        rulesContainer.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 12px;
            margin-bottom: 12px;
        `;
        
        // Create rule cards
        group.rules.forEach((rule, ruleIndex) => {
            const ruleWrapper = document.createElement('div');
            
            const ruleCard = document.createElement('div');
            ruleCard.style.cssText = `
                background: ${color.bg};
                border: 1px solid #e1e4e8;
                border-radius: 6px;
                padding: 12px;
                display: flex;
                flex-direction: column;
                gap: 8px;
                transition: all 0.15s ease;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            `;
            
            const currentMode = rule.askMode || (rule.enabled === false ? 'off' : 'auto');
            ruleCard.style.opacity = currentMode === 'off' ? '0.6' : '1';
            
            ruleCard.addEventListener('mouseenter', () => {
                ruleCard.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                ruleCard.style.borderColor = color.accent;
            });
            ruleCard.addEventListener('mouseleave', () => {
                ruleCard.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                ruleCard.style.borderColor = '#e1e4e8';
            });

            // Rule description
            const ruleDesc = document.createElement('div');
            ruleDesc.textContent = rule.description || 'Unnamed rule';
            ruleDesc.style.cssText = `
                font-size: 13px;
                font-weight: 500;
                color: #24292e;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            `;

            // Find and Replace preview (small text)
            const previewContainer = document.createElement('div');
            previewContainer.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 2px;
                font-size: 10px;
                color: #6e7781;
                font-family: 'Courier New', monospace;
                margin-top: 4px;
            `;
            
            const findPreview = document.createElement('div');
            findPreview.style.cssText = `
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            `;
            findPreview.innerHTML = `<span style="color: #959da5; font-weight: 600;">Find:</span> ${rule.find || ''}`;
            
            const replacePreview = document.createElement('div');
            replacePreview.style.cssText = `
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            `;
            const replaceText = typeof rule.replace === 'function' ? '[Function]' : rule.replace || '';
            replacePreview.innerHTML = `<span style="color: #959da5; font-weight: 600;">Replace:</span> ${replaceText}`;
            
            previewContainer.appendChild(findPreview);
            previewContainer.appendChild(replacePreview);

            // Bottom row with mode and edit button
            const bottomRow = document.createElement('div');
            bottomRow.style.cssText = `
                display: flex;
                gap: 8px;
                align-items: center;
                margin-top: 4px;
            `;

            // Mode dropdown
            const ruleMode = document.createElement('select');
            ruleMode.style.cssText = `
                flex: 1;
                padding: 4px 8px;
                border: 1px solid #d1d5da;
                border-radius: 4px;
                font-size: 11px;
                background: white;
                cursor: pointer;
                font-weight: 500;
                color: #24292e;
            `;
            
            ruleMode.innerHTML = `
                <option value="auto" ${currentMode === 'auto' ? 'selected' : ''}>✓ Auto</option>
                <option value="ask" ${currentMode === 'ask' ? 'selected' : ''}>? Ask</option>
                <option value="off" ${currentMode === 'off' ? 'selected' : ''}>✗ Off</option>
            `;
            
            ruleMode.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            
            ruleMode.addEventListener('change', (e) => {
                e.stopPropagation();
                const mode = ruleMode.value;
                if (mode === 'off') {
                    rule.enabled = false;
                    delete rule.askMode;
                } else {
                    rule.enabled = true;
                    rule.askMode = mode;
                }
                saveSettings();
                ruleCard.style.opacity = mode === 'off' ? '0.6' : '1';
            });

            // Edit button
            const editBtn = document.createElement('button');
            editBtn.innerHTML = '⋯';
            editBtn.style.cssText = `
                width: 28px;
                height: 28px;
                padding: 0;
                background: white;
                border: 1px solid #e1e4e8;
                border-radius: 4px;
                color: #586069;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.1s ease;
                line-height: 1;
                flex-shrink: 0;
            `;
            editBtn.addEventListener('mouseenter', () => {
                editBtn.style.background = '#f6f8fa';
                editBtn.style.borderColor = '#d1d5da';
            });
            editBtn.addEventListener('mouseleave', () => {
                editBtn.style.background = 'white';
                editBtn.style.borderColor = '#e1e4e8';
            });
            
            // Create inline edit form
            const editForm = createInlineEditForm(rule, groupIndex, ruleIndex, false, ruleWrapper, color);
            editForm.style.display = 'none';
            editForm.style.gridColumn = '1 / -1'; // Span full width when editing
            
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close any other open edit forms in this group
                rulesContainer.querySelectorAll('.edit-form').forEach(form => {
                    if (form !== editForm) {
                        form.style.display = 'none';
                        const prevCard = form.previousElementSibling;
                        if (prevCard) prevCard.style.display = 'flex';
                    }
                });
                // Toggle this edit form
                const isVisible = editForm.style.display === 'block';
                editForm.style.display = isVisible ? 'none' : 'block';
                ruleCard.style.display = isVisible ? 'flex' : 'none';
            });

            bottomRow.appendChild(ruleMode);
            bottomRow.appendChild(editBtn);
            
            ruleCard.appendChild(ruleDesc);
            ruleCard.appendChild(previewContainer);
            ruleCard.appendChild(bottomRow);
            
            ruleWrapper.appendChild(ruleCard);
            ruleWrapper.appendChild(editForm);
            rulesContainer.appendChild(ruleWrapper);
        });
        
        rulesGrid.appendChild(rulesContainer);

        // Expand/collapse functionality - entire header is clickable
        let isExpanded = false;
        groupHeader.addEventListener('click', (e) => {
            // Don't expand if clicking on delete button or toggle
            if (e.target === deleteBtn || deleteBtn.contains(e.target) || e.target === enableToggle) {
                return;
            }
            
            isExpanded = !isExpanded;
            rulesGrid.style.display = isExpanded ? 'block' : 'none';
            expandIndicator.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
        });

        groupContainer.appendChild(groupHeader);
        groupContainer.appendChild(rulesGrid);

        return groupContainer;
    }
    
    // Function to create inline edit form with compact two-column grid layout
    function createInlineEditForm(rule, groupIndex, ruleIndex, isUngrouped, parentWrapper, color) {
        const editForm = document.createElement('div');
        editForm.className = 'edit-form';
        editForm.style.cssText = `
            padding: 16px;
            background: #fafbfc;
            border: 1px solid #e1e4e8;
            border-radius: 6px;
        `;
        
        const formGrid = document.createElement('div');
        formGrid.style.cssText = `
            display: grid;
            grid-template-columns: 1fr 180px;
            gap: 12px 16px;
            margin-bottom: 12px;
        `;
        
        // Description field (full width)
        const descField = createFormFieldInline('Description', 'text', rule.description || '');
        descField.style.gridColumn = '1 / -1';
        
        // Find field (full width)
        const findField = createFormFieldInline('Find Pattern', 'text', rule.find || '');
        findField.style.gridColumn = '1 / -1';
        
        // Replace field (full width, textarea)
        const replaceField = createFormFieldInline('Replace With', 'textarea', 
            typeof rule.replace === 'function' ? rule.replace.toString() : 
            typeof rule.replace === 'string' ? rule.replace : '', true);
        replaceField.style.gridColumn = '1 / -1';
        
        // Flags field (flexible width - takes remaining space)
        const flagsField = createFormFieldInline('Flags', 'text', rule.flags || 'gi');
        flagsField.style.gridColumn = '1 / 2';
        
        // Enhanced boundary checkbox
        const enhancedContainer = document.createElement('div');
        enhancedContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 6px;
            grid-column: '2 / 3';
        `;
        
        const enhancedLabelTop = document.createElement('label');
        enhancedLabelTop.textContent = 'Enhanced Boundary';
        enhancedLabelTop.style.cssText = `
            font-size: 12px;
            font-weight: 600;
            color: #24292e;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        `;
        
        const enhancedCheckboxContainer = document.createElement('div');
        enhancedCheckboxContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: white;
            border: 1px solid #d1d5da;
            border-radius: 4px;
            height: 38px;
        `;
        
        const enhancedCheckbox = document.createElement('input');
        enhancedCheckbox.type = 'checkbox';
        enhancedCheckbox.checked = rule.enhancedBoundary || false;
        enhancedCheckbox.style.cssText = `
            width: 16px;
            height: 16px;
            cursor: pointer;
            margin: 0;
        `;
        
        const enhancedLabel = document.createElement('label');
        enhancedLabel.textContent = 'Enabled';
        enhancedLabel.style.cssText = `
            font-size: 13px;
            color: #24292e;
            cursor: pointer;
            user-select: none;
        `;
        
        enhancedLabel.addEventListener('click', () => {
            enhancedCheckbox.checked = !enhancedCheckbox.checked;
        });
        
        enhancedCheckboxContainer.appendChild(enhancedCheckbox);
        enhancedCheckboxContainer.appendChild(enhancedLabel);
        enhancedContainer.appendChild(enhancedLabelTop);
        enhancedContainer.appendChild(enhancedCheckboxContainer);
        
        formGrid.appendChild(descField);
        formGrid.appendChild(findField);
        formGrid.appendChild(replaceField);
        formGrid.appendChild(flagsField);
        formGrid.appendChild(enhancedContainer);
        
        // Buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 8px;
            justify-content: flex-start;
        `;
        
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.style.cssText = `
            padding: 6px 14px;
            background: ${color.accent};
            border: 1px solid ${color.accent};
            border-radius: 4px;
            color: white;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s ease;
        `;
        saveBtn.addEventListener('mouseenter', () => {
            saveBtn.style.background = color.text;
            saveBtn.style.borderColor = color.text;
        });
        saveBtn.addEventListener('mouseleave', () => {
            saveBtn.style.background = color.accent;
            saveBtn.style.borderColor = color.accent;
        });
        saveBtn.addEventListener('click', () => {
            const description = descField.querySelector('input, textarea').value.trim();
            const find = findField.querySelector('input, textarea').value.trim();
            const replace = replaceField.querySelector('input, textarea').value.trim();
            const flags = flagsField.querySelector('input, textarea').value.trim();
            const enhancedBoundary = enhancedCheckbox.checked;
            
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
        });
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = `
            padding: 6px 14px;
            background: white;
            border: 1px solid #e1e4e8;
            border-radius: 4px;
            color: #24292e;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s ease;
        `;
        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.background = '#f6f8fa';
            cancelBtn.style.borderColor = '#d1d5da';
        });
        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.background = 'white';
            cancelBtn.style.borderColor = '#e1e4e8';
        });
        cancelBtn.addEventListener('click', () => {
            editForm.style.display = 'none';
            const prevCard = parentWrapper.querySelector('div[style*="flex-direction: column"]');
            if (prevCard) prevCard.style.display = 'flex';
        });
        
        buttonContainer.appendChild(saveBtn);
        buttonContainer.appendChild(cancelBtn);
        
        editForm.appendChild(formGrid);
        editForm.appendChild(buttonContainer);
        
        return editForm;
    }
    
    // Helper function to create inline form fields
    function createFormFieldInline(label, type, value = '', isMonospace = false) {
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 6px;
        `;
        
        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        labelEl.style.cssText = `
            font-size: 12px;
            font-weight: 600;
            color: #24292e;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        `;
        
        let input;
        if (type === 'textarea') {
            input = document.createElement('textarea');
            input.rows = 3;
            input.style.cssText = `
                padding: 8px 12px;
                border: 1px solid #d1d5da;
                border-radius: 4px;
                background: white;
                color: #24292e;
                font-size: 13px;
                font-family: ${isMonospace ? "'Courier New', monospace" : "'Programme', Arial, sans-serif"};
                resize: vertical;
                min-height: 60px;
            `;
        } else {
            input = document.createElement('input');
            input.type = type;
            input.style.cssText = `
                padding: 8px 12px;
                border: 1px solid #d1d5da;
                border-radius: 4px;
                background: white;
                color: #24292e;
                font-size: 13px;
                font-family: ${isMonospace ? "'Courier New', monospace" : "'Programme', Arial, sans-serif"};
            `;
        }
        input.value = value;
        
        container.appendChild(labelEl);
        container.appendChild(input);
        return container;
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

        // Delete all unsorted rules button
        const deleteAllBtn = createSmallButton('Delete All', () => {
            if (confirm(`Are you sure you want to delete all ${autoFixSettings.ungroupedRules.length} unsorted rule${autoFixSettings.ungroupedRules.length === 1 ? '' : 's'}?`)) {
                autoFixSettings.ungroupedRules = [];
                saveSettings();
                refreshCustomRegexRulesWithGroups(document.getElementById('custom-regex-rules-container'));
            }
        });

        // Set base styles for delete button with absolute positioning
        deleteAllBtn.style.backgroundColor = '#dc3545';
        deleteAllBtn.style.color = 'white';
        deleteAllBtn.style.borderColor = '#dc3545';
        deleteAllBtn.style.fontSize = '10px';
        deleteAllBtn.style.padding = '2px 6px';
        deleteAllBtn.style.position = 'absolute';
        deleteAllBtn.style.top = '8px';
        deleteAllBtn.style.right = '8px';
        deleteAllBtn.style.zIndex = '10';

        // Add proper hover effect using the UI utility
        UI.addHoverEffect(deleteAllBtn, {
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
        `;

        ungroupedInfo.appendChild(ungroupedTitle);
        ungroupedInfo.appendChild(ungroupedMeta);
        ungroupedHeader.appendChild(ungroupedInfo);
        ungroupedHeader.appendChild(toggleIcon);
        ungroupedHeader.appendChild(deleteAllBtn);

        // Rules container (initially hidden)
        const rulesContainer = document.createElement('div');
        rulesContainer.style.cssText = `
            display: none;
            padding: 0;
        `;

        // Toggle functionality
        let isExpanded = false;

        const toggleHandler = (e) => {
            // Don't toggle if the delete all button was clicked
            if (e.target === deleteAllBtn || deleteAllBtn.contains(e.target)) {
                return;
            }

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
        };

        ungroupedHeader.addEventListener('click', toggleHandler);

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
            },
            // onModeChange
            (idx, mode) => {
                autoFixSettings.ruleGroups[groupIndex].rules[idx].askMode = mode;
                saveSettings();
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
            },
            // onModeChange
            (idx, mode) => {
                autoFixSettings.ungroupedRules[idx].askMode = mode;
                saveSettings();
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

        // Replace field (use textarea for better editing of functions)
        const replaceFieldContainer = document.createElement('div');
        replaceFieldContainer.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
        
        const replaceLabel = document.createElement('label');
        replaceLabel.textContent = 'Replace With';
        replaceLabel.style.cssText = 'font-weight: 400; color: #333; font-family: Programme, Arial, sans-serif;';
        
        const replaceInput = document.createElement('textarea');
        replaceInput.value = typeof rule.replace === 'function' ? rule.replace.toString() : 
                             typeof rule.replace === 'string' ? rule.replace : '';
        replaceInput.rows = 3;
        replaceInput.style.cssText = `
            padding: 8px 12px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            background: #fff;
            color: #333;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            resize: vertical;
            min-height: 60px;
        `;
        
        replaceFieldContainer.appendChild(replaceLabel);
        replaceFieldContainer.appendChild(replaceInput);
        const replaceField = replaceFieldContainer;

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
            const replace = replaceField.querySelector('textarea').value.trim();
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
            },
            // onModeChange
            (idx, mode) => {
                autoFixSettings.customRegexRules[idx].askMode = mode;
                saveSettings();
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
            let hasGroupStructure = false;

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

            // Handle different import formats with backwards compatibility
            if (Array.isArray(importedData)) {
                // Old format: simple array of rules
                importedRules = importedData;
            } else if (importedData && typeof importedData === 'object') {
                if (importedData.find && importedData.replace) {
                    // Single rule object (old format)
                    importedRules = [importedData];
                } else if (importedData.metadata && importedData.rules && Array.isArray(importedData.rules)) {
                    // New format with metadata wrapper (like rules.json from GitHub)
                    // Create a rule group from the metadata
                    hasGroupStructure = true;
                    
                    if (!autoFixSettings.ruleGroups) {
                        autoFixSettings.ruleGroups = [];
                    }
                    
                    const validRules = importedData.rules
                        .filter(rule => rule && typeof rule === 'object' && rule.find && rule.replace)
                        .map(restoreFunction);
                    
                    if (validRules.length > 0) {
                        // Check if this group already exists
                        const existingGroupIndex = autoFixSettings.ruleGroups.findIndex(g => g.id === importedData.metadata.id);
                        
                        if (existingGroupIndex >= 0) {
                            // Update existing group
                            const existingGroup = autoFixSettings.ruleGroups[existingGroupIndex];
                            const newRules = validRules.filter(newRule =>
                                !existingGroup.rules.some(existingRule =>
                                    existingRule.find === newRule.find && existingRule.replace === newRule.replace
                                )
                            );
                            
                            if (newRules.length > 0) {
                                existingGroup.rules.push(...newRules);
                                existingGroup.version = importedData.metadata.version;
                            }
                            
                            saveSettings();
                            refreshCustomRegexRulesWithGroups(document.getElementById('custom-regex-rules-container'));
                            alert(`Added ${newRules.length} new rule${newRules.length === 1 ? '' : 's'} to existing group "${importedData.metadata.title}".`);
                        } else {
                            // Create new group
                            autoFixSettings.ruleGroups.push({
                                id: importedData.metadata.id,
                                title: importedData.metadata.title,
                                description: importedData.metadata.description,
                                author: importedData.metadata.author,
                                version: importedData.metadata.version,
                                rules: validRules
                            });
                            
                            saveSettings();
                            refreshCustomRegexRulesWithGroups(document.getElementById('custom-regex-rules-container'));
                            alert(`Successfully imported ${validRules.length} rule${validRules.length === 1 ? '' : 's'} in group "${importedData.metadata.title}".`);
                        }
                    } else {
                        alert('No valid regex rules found in the data.');
                    }
                    return;
                } else if (importedData.rules && Array.isArray(importedData.rules)) {
                    // Format with rules array but no metadata (treat as ungrouped)
                    importedRules = importedData.rules;
                } else if (importedData.ruleGroups || importedData.ungroupedRules) {
                    // New export format with rule groups - preserve structure
                    hasGroupStructure = true;
                    let totalImported = 0;

                    // Import rule groups and preserve their structure
                    if (importedData.ruleGroups && Array.isArray(importedData.ruleGroups)) {
                        if (!autoFixSettings.ruleGroups) {
                            autoFixSettings.ruleGroups = [];
                        }

                        importedData.ruleGroups.forEach(group => {
                            if (group.rules && Array.isArray(group.rules)) {
                                // Validate and restore functions for rules in this group
                                const validGroupRules = group.rules
                                    .filter(rule => rule && typeof rule === 'object' && rule.find && rule.replace)
                                    .map(restoreFunction);

                                if (validGroupRules.length > 0) {
                                    // Add the group with its validated rules and all metadata
                                    autoFixSettings.ruleGroups.push({
                                        id: group.id,
                                        title: group.title || group.name || 'Imported Group',
                                        name: group.name || group.title || 'Imported Group',
                                        description: group.description || '',
                                        author: group.author,
                                        version: group.version,
                                        enabled: group.enabled !== false,
                                        rules: validGroupRules
                                    });
                                    totalImported += validGroupRules.length;
                                }
                            }
                        });
                    }

                    // Import ungrouped rules
                    if (importedData.ungroupedRules && Array.isArray(importedData.ungroupedRules)) {
                        if (!autoFixSettings.ungroupedRules) {
                            autoFixSettings.ungroupedRules = [];
                        }

                        const validUngroupedRules = importedData.ungroupedRules
                            .filter(rule => rule && typeof rule === 'object' && rule.find && rule.replace)
                            .map(restoreFunction);

                        autoFixSettings.ungroupedRules = [...autoFixSettings.ungroupedRules, ...validUngroupedRules];
                        totalImported += validUngroupedRules.length;
                    }

                    // Import legacy rules
                    if (importedData.legacyRules && Array.isArray(importedData.legacyRules)) {
                        if (!autoFixSettings.ungroupedRules) {
                            autoFixSettings.ungroupedRules = [];
                        }

                        const validLegacyRules = importedData.legacyRules
                            .filter(rule => rule && typeof rule === 'object' && rule.find && rule.replace)
                            .map(restoreFunction);

                        autoFixSettings.ungroupedRules = [...autoFixSettings.ungroupedRules, ...validLegacyRules];
                        totalImported += validLegacyRules.length;
                    }

                    if (totalImported === 0) {
                        alert('No valid regex rules found in the data.');
                        return;
                    }

                    saveSettings();
                    refreshCustomRegexRulesWithGroups(document.getElementById('custom-regex-rules-container'));
                    alert(`Successfully imported ${totalImported} regex rule(s) from ${source}.`);
                    return;
                } else {
                    alert(`Invalid format. Please ${source === 'file' ? 'select a valid JSON file' : 'copy valid JSON data'} containing regex rules.`);
                    return;
                }
            } else {
                alert(`Invalid format. Please ${source === 'file' ? 'select a valid JSON file' : 'copy valid JSON data'} containing regex rules.`);
                return;
            }

            // For non-grouped imports (simple arrays, single rules, rules.json format)
            // Validate each rule has required fields and restore functions
            const validRules = importedRules
                .filter(rule => rule && typeof rule === 'object' && rule.find && rule.replace)
                .map(restoreFunction);

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
            // onModeChange
            (idx, mode) => {
                autoFixSettings.customRegexRules[idx].askMode = mode;
                saveSettings();
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

            // Ensure ruleGroups array exists
            if (!autoFixSettings.ruleGroups) {
                autoFixSettings.ruleGroups = [];
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
    function saveAutoscribeSettings() {
        try {
            localStorage.setItem('genius-autoscribe-settings', JSON.stringify(autoscribeSettings));
            console.log('Autoscribe settings saved');
        } catch (error) {
            console.error('Failed to save autoscribe settings:', error);
        }
    }

    function loadAutoscribeSettings() {
        try {
            const saved = localStorage.getItem('genius-autoscribe-settings');
            if (saved) {
                const loaded = JSON.parse(saved);
                autoscribeSettings = { ...autoscribeSettings, ...loaded };
                console.log('Autoscribe settings loaded:', autoscribeSettings);
            }
        } catch (error) {
            console.error('Failed to load autoscribe settings:', error);
        }
    }

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

    // Function to load built-in rules from rules.json
    async function loadBuiltInRules() {
        try {
            const response = await fetch('https://raw.githubusercontent.com/ziIIas/scribetools/refs/heads/main/rules.json');
            if (!response.ok) {
                console.error('Failed to fetch built-in rules:', response.status);
                return;
            }
            
            const data = await response.json();
            
            // Helper function to restore functions from strings
            const restoreFunction = (rule) => {
                if (typeof rule.replace === 'string') {
                    const trimmed = rule.replace.trim();
                    if (trimmed.startsWith('function') || trimmed.startsWith('(')) {
                        try {
                            rule.replace = eval(`(${trimmed})`);
                        } catch (e) {
                            console.warn('Failed to restore function for rule:', rule.description || rule.find);
                        }
                    }
                }
                return rule;
            };
            
            if (data.ruleGroups && Array.isArray(data.ruleGroups)) {
                if (!autoFixSettings.ruleGroups) {
                    autoFixSettings.ruleGroups = [];
                }
                
                // Process each rule group from rules.json
                data.ruleGroups.forEach(group => {
                    // Check if this built-in group already exists
                    const existingIndex = autoFixSettings.ruleGroups.findIndex(g => g.id === group.id && g.isBuiltIn);
                    
                    const processedGroup = {
                        ...group,
                        isBuiltIn: true, // Mark as built-in
                        rules: group.rules ? group.rules.map(restoreFunction) : []
                    };
                    
                    if (existingIndex >= 0) {
                        // Update existing built-in group
                        autoFixSettings.ruleGroups[existingIndex] = processedGroup;
                    } else {
                        // Add new built-in group
                        autoFixSettings.ruleGroups.push(processedGroup);
                    }
                });
                
                console.log('Built-in rules loaded successfully from rules.json');
                saveSettings();
            }
        } catch (error) {
            console.error('Error loading built-in rules:', error);
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
        const file = fileInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const jsonContent = e.target.result;
                // Validate it's valid JSON
                const parsed = JSON.parse(jsonContent);

                // Save to localStorage
                localStorage.setItem('genius-autofix-settings', jsonContent);
                localStorage.setItem('genius-autofix-settings-backup', jsonContent);

                console.log('Settings imported successfully');
                alert('Settings imported successfully! Reloading page...');

                // Reload to apply new settings
                location.reload();
            } catch (err) {
                console.error('Failed to import settings:', err);
                alert('Failed to import settings. Invalid file format: ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    // Auto-save functions
    function getAutoSaveKey(contextKey = 'lyrics') {
        // Use the current page URL as the key, but normalize it
        const url = window.location.href;
        const baseUrl = url.split('?')[0].split('#')[0]; // Remove query params and hash
        const safeContext = contextKey.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
        return `genius-autosave-${baseUrl}-${safeContext}`;
    }

    function isTextEntryElement(element) {
        if (!element) return false;
        if (element.tagName === 'TEXTAREA') return true;
        if (element.isContentEditable) return true;
        if (element.tagName === 'INPUT') {
            const type = (element.getAttribute('type') || 'text').toLowerCase();
            return ['text', 'search'].includes(type);
        }
        return false;
    }

    function extractEditorContent(editor) {
        if (!editor) {
            return { content: '', selectionStart: null, selectionEnd: null };
        }

        let content = '';
        let selectionStart = null;
        let selectionEnd = null;

        if (editor.tagName === 'TEXTAREA' || editor.tagName === 'INPUT') {
            content = editor.value;
            selectionStart = editor.selectionStart;
            selectionEnd = editor.selectionEnd;
        } else if (editor.isContentEditable) {
            content = editor.innerText || editor.textContent || '';
        }

        return { content, selectionStart, selectionEnd };
    }

    function detectEditorContext(element) {
        if (!element || !element.closest) return null;

        // Exclude search forms and inputs
        const searchForm = element.closest('form[action*="/search"]');
        if (searchForm) return null;

        const inputName = element.getAttribute && element.getAttribute('name');
        if (inputName === 'q' || inputName === 'query' || inputName === 'search') {
            return null;
        }

        const stringCandidates = [
            element.className || '',
            element.getAttribute && element.getAttribute('aria-label') || '',
            element.getAttribute && element.getAttribute('placeholder') || '',
            element.getAttribute && element.getAttribute('name') || '',
            element.getAttribute && element.getAttribute('data-testid') || ''
        ].join(' ').toLowerCase();

        // Additional check for search-related placeholders/classes
        if (stringCandidates.includes('search lyrics') ||
            stringCandidates.includes('search for') ||
            (stringCandidates.includes('search') && !stringCandidates.includes('editor'))) {
            return null;
        }

        const lyricsContainer = element.closest('[class*="LyricsEdit"]');
        if (lyricsContainer) {
            return {
                type: 'lyrics',
                label: 'lyrics editor',
                key: 'lyrics'
            };
        }

        const annotationContainer = element.closest('[data-annotation-id], [data-id][class*="Annotation"], [class*="AnnotationEditor"], [class*="AnnotationForm"], [class*="Referent"]');
        const looksLikeAnnotation = stringCandidates.includes('annotation') || stringCandidates.includes('referent');
        if (annotationContainer || looksLikeAnnotation) {
            const annotationId = (annotationContainer && (
                annotationContainer.getAttribute('data-annotation-id') ||
                annotationContainer.getAttribute('data-id') ||
                annotationContainer.getAttribute('data-referent-id')
            )) || element.getAttribute && (element.getAttribute('data-annotation-id') || element.getAttribute('data-referent-id'));
            const key = annotationId ? `annotation-${annotationId}` : 'annotation';
            const label = annotationId ? `annotation ${annotationId}` : 'annotation';
            return {
                type: 'annotation',
                label: `${label} editor`,
                key
            };
        }

        const bioContainer = element.closest('[class*="Bio"], [data-testid*="bio"], [class*="About"], [class*="Metadata"]');
        const looksLikeBio = stringCandidates.includes('bio') || stringCandidates.includes('song bio') || stringCandidates.includes('about artist');
        if (bioContainer || looksLikeBio) {
            const sectionId = (bioContainer && (
                bioContainer.getAttribute('data-testid') ||
                bioContainer.getAttribute('id')
            )) || element.getAttribute && element.getAttribute('data-testid');
            const key = sectionId ? `bio-${sectionId}` : 'bio';
            const label = sectionId ? sectionId.replace(/[-_]/g, ' ') : 'song bio';
            return {
                type: 'bio',
                label: `${label} editor`.trim(),
                key
            };
        }

        if (stringCandidates.includes('lyrics') || stringCandidates.includes('transcription')) {
            return {
                type: 'lyrics',
                label: 'lyrics editor',
                key: 'lyrics'
            };
        }

        return null;
    }
    function saveCurrentContent(contextKey = null) {
        const keysToSave = contextKey ? [contextKey] : Array.from(activeEditors.keys());

        if (!keysToSave.length) {
            return;
        }

        keysToSave.forEach((key) => {
            const editorInfo = activeEditors.get(key);
            if (!editorInfo) return;

            const { element, context } = editorInfo;
            if (!element || !document.contains(element)) {
                activeEditors.delete(key);
                lastSavedContent.delete(key);
                return;
            }

            const { content, selectionStart, selectionEnd } = extractEditorContent(element);

            if (!content || content === lastSavedContent.get(key)) {
                return;
            }

            const saveData = {
                content,
                timestamp: Date.now(),
                url: window.location.href,
                selectionStart,
                selectionEnd,
                contextKey: key,
                contextType: context.type,
                contextLabel: context.label
            };

            try {
                localStorage.setItem(getAutoSaveKey(key), JSON.stringify(saveData));
                lastSavedContent.set(key, content);
                isEditing = true;
            } catch (e) {
                console.warn('Failed to persist auto-save data:', e);
            }
        });
    }

    function clearAutoSave(contextKey = null) {
        const keys = contextKey ? [contextKey] : Array.from(new Set([
            ...activeEditors.keys(),
            ...Array.from(lastSavedContent.keys())
        ]));

        keys.forEach((key) => {
            try {
                localStorage.removeItem(getAutoSaveKey(key));
            } catch (e) {
                console.warn('Failed to clear auto-save data:', e);
            }
            lastSavedContent.delete(key);

            const timeout = autoSaveInputTimeouts.get(key);
            if (timeout) {
                clearTimeout(timeout);
                autoSaveInputTimeouts.delete(key);
            }

            activeEditors.delete(key);
            restorePromptShownForContext.delete(key);

            if (window.pendingRestoreData && window.pendingRestoreData.contextKey === key) {
                delete window.pendingRestoreData;
            }

            if (lastFocusedContextKey === key) {
                lastFocusedContextKey = null;
            }
        });

        if (!contextKey) {
            autoSaveInputTimeouts.forEach((timeout) => clearTimeout(timeout));
            autoSaveInputTimeouts.clear();
        }

        isEditing = activeEditors.size > 0;
    }
    function showRestoreNotification(saveData, timeString, options = {}) {
        const { contextKey = saveData.contextKey || 'lyrics', contextLabel = saveData.contextLabel || 'lyrics editor', editorElement = null } = options;
        const normalizedContextKey = contextKey;
        const normalizedLabel = contextLabel;

        window.pendingRestoreData = {
            saveData,
            element: editorElement,
            contextKey: normalizedContextKey
        };

        restorePromptShownForContext.add(normalizedContextKey);

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
            z-index: 100;
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
        message.innerHTML = `We found unsaved work in your <strong>${normalizedLabel}</strong> from <strong>${timeString}</strong>.<br>Would you like to restore it?`;
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
            restoreContent(saveData, editorElement, normalizedContextKey);
            document.body.removeChild(overlay);
        });

        discardBtn.addEventListener('click', () => {
            clearAutoSave(normalizedContextKey);
            document.body.removeChild(overlay);
            isEditing = activeEditors.size > 0;
            if (window.pendingRestoreData) {
                delete window.pendingRestoreData;
            }
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

    function restoreContent(saveData, editorElement = null, contextKeyOverride = null) {
        const targetContextKey = contextKeyOverride || saveData.contextKey || 'lyrics';
        const contextType = saveData.contextType || (targetContextKey.startsWith('annotation') ? 'annotation' : targetContextKey.startsWith('bio') ? 'bio' : 'lyrics');

        let textEditor = editorElement && document.contains(editorElement) ? editorElement : null;

        if (!textEditor && window.pendingRestoreData && window.pendingRestoreData.contextKey === targetContextKey) {
            const pendingElement = window.pendingRestoreData.element;
            if (pendingElement && document.contains(pendingElement)) {
                textEditor = pendingElement;
            }
        }

        if (!textEditor) {
            const selectorsByType = {
                lyrics: [
                    '[class*="LyricsEdit"] textarea',
                    '[class*="LyricsEdit"] [contenteditable="true"]',
                    'textarea[name*="lyrics"]'
                ],
                annotation: [
                    '[data-testid*="annotation"] textarea',
                    '[data-testid*="annotation"] [contenteditable="true"]',
                    '[class*="Annotation"] textarea',
                    '[class*="Annotation"] [contenteditable="true"]',
                    'textarea[name*="annotation"]'
                ],
                bio: [
                    '[data-testid*="bio"] textarea',
                    '[data-testid*="bio"] [contenteditable="true"]',
                    '[class*="Bio"] textarea',
                    '[class*="Bio"] [contenteditable="true"]',
                    'textarea[name*="bio"]'
                ]
            };

            const selectors = selectorsByType[contextType] || selectorsByType.lyrics;
            for (const selector of selectors) {
                const candidate = document.querySelector(selector);
                if (candidate) {
                    textEditor = candidate;
                    break;
                }
            }
        }

        if (!textEditor && document.activeElement && isTextEntryElement(document.activeElement)) {
            const activeContext = detectEditorContext(document.activeElement);
            if (activeContext && activeContext.key === targetContextKey) {
                textEditor = document.activeElement;
            }
        }

        if (textEditor) {
            // Editor found, restore immediately
            performRestore(textEditor, saveData, targetContextKey);
        } else {
            alert('Could not find the appropriate editor. Please ensure you are in editing mode.');
        }
    }

    function performRestore(textEditor, saveData, contextKey = 'lyrics') {

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

                if (textEditor._highlightOverlay) {
                    console.log('Removing specific textarea overlay');
                    textEditor._highlightOverlay.remove();
                    delete textEditor._highlightOverlay;
                }

                if (textEditor._highlightState) {
                    delete textEditor._highlightState;
                }

            } else if (textEditor.isContentEditable) {

                textEditor.focus();
                textEditor.textContent = saveData.content;

                // Dispatch events
                textEditor.dispatchEvent(new Event('input', { bubbles: true }));
                textEditor.dispatchEvent(new Event('change', { bubbles: true }));
                textEditor.dispatchEvent(new Event('keyup', { bubbles: true }));

                if (textEditor._contentEditableInputHandler) {
                    textEditor.removeEventListener('input', textEditor._contentEditableInputHandler);
                    delete textEditor._contentEditableInputHandler;
                }

                if (textEditor._highlightState) {
                    delete textEditor._highlightState;
                }
            }

            lastSavedContent.set(contextKey, saveData.content);
            restorePromptShownForContext.add(contextKey);
            const detectedContext = detectEditorContext(textEditor) || { key: contextKey, label: saveData.contextLabel || 'editor', type: saveData.contextType || 'lyrics' };
            activeEditors.set(contextKey, { element: textEditor, context: detectedContext });
            lastFocusedContextKey = contextKey;
            isEditing = true;

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
            if (!isTextEntryElement(target)) return;

            const context = detectEditorContext(target);
            if (!context) return;

            activeEditors.set(context.key, { element: target, context });
            lastFocusedContextKey = context.key;
            isEditing = true;

            const existingTimeout = autoSaveInputTimeouts.get(context.key);
            if (existingTimeout) {
                clearTimeout(existingTimeout);
            }

            const timeout = setTimeout(() => {
                saveCurrentContent(context.key);
                autoSaveInputTimeouts.delete(context.key);
            }, 2000);

            autoSaveInputTimeouts.set(context.key, timeout);
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
                    removeInteractiveHighlight(null);

                    // Quick follow-up for any editor-specific cleanup
                    setTimeout(() => {
                        const textEditor = document.querySelector('[class*="LyricsEdit"] textarea') ||
                                          document.querySelector('[class*="LyricsEdit"] [contenteditable="true"]');
                        if (textEditor) {
                            removeInteractiveHighlight(textEditor);
                        }
                    }, 10); // Minimal delay
                }

                // Clear auto-save when user successfully saves/publishes or cancels
                if (buttonText.includes('save') || buttonText.includes('publish') ||
                    buttonText.includes('submit') || buttonText.includes('update')) {
                    if (!autoFixSettings.persistentAutoSave) {
                        setTimeout(() => {
                            const activeElement = document.activeElement;
                            const context = detectEditorContext(activeElement) ||
                                (lastFocusedContextKey ? { key: lastFocusedContextKey } : null);
                            if (context && context.key) {
                                clearAutoSave(context.key);
                            } else {
                                clearAutoSave();
                            }
                            isEditing = activeEditors.size > 0;
                        }, 2000);
                    } else {
                        isEditing = false;
                    }
                }
                // Clear auto-save immediately when Cancel button is clicked
                else if (buttonText.includes('cancel') || buttonClasses.includes('iUzusl')) {
                    const activeElement = document.activeElement;
                    const context = detectEditorContext(activeElement) ||
                        (lastFocusedContextKey ? { key: lastFocusedContextKey } : null);
                    if (context && context.key) {
                        clearAutoSave(context.key);
                    } else {
                        clearAutoSave();
                    }
                    isEditing = activeEditors.size > 0;
                }

                // Clean up number conversion popup when Cancel or Save & Exit is clicked
                if (buttonText.includes('cancel') || buttonText.includes('save') || buttonClasses.includes('iUzusl')) {
                    const textEditor = document.querySelector('[class*="LyricsEdit"] textarea') ||
                                      document.querySelector('[class*="LyricsEdit"] [contenteditable="true"]');
                    if (textEditor) {
                        // Always remove highlighting regardless of popup state
                        removeInteractiveHighlight(textEditor);
                    }
                    // Clean up popup if it exists
                    if (currentInteractivePopup) {
                        cleanupCurrentInteractivePopup();
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

    // ===========================================
    // MUSIC.AI AUTOSCRIBE FUNCTIONS
    // ===========================================

    // Function to upload file to Music.ai and get download URL
    async function uploadFileToMusicAI(file, apiKey) {
        console.log('[Autoscribe] Starting file upload process for:', file.name);
        console.log('[Autoscribe] File size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
        console.log('[Autoscribe] File type:', file.type);

        try {
            // Step 1: Request upload URL from Music.ai
            console.log('[Autoscribe] Requesting upload URL from Music.ai API...');
            console.log('[Autoscribe] Endpoint: GET https://api.music.ai/api/upload');
            console.log('[Autoscribe] Authorization header format: API key directly (no Bearer prefix)');

            const uploadUrlResponse = await fetch('https://api.music.ai/api/upload', {
                method: 'GET',
                headers: {
                    'Authorization': apiKey
                }
            });

            console.log('[Autoscribe] Upload URL response status:', uploadUrlResponse.status);

            if (!uploadUrlResponse.ok) {
                const errorText = await uploadUrlResponse.text();
                console.error('[Autoscribe] Failed to get upload URL. Status:', uploadUrlResponse.status);
                console.error('[Autoscribe] Error response:', errorText);
                throw new Error(`Failed to get upload URL: ${uploadUrlResponse.status} - ${errorText}`);
            }

            const uploadData = await uploadUrlResponse.json();
            console.log('[Autoscribe] Received upload data:', uploadData);

            const { uploadUrl, downloadUrl } = uploadData;

            if (!uploadUrl || !downloadUrl) {
                console.error('[Autoscribe] Missing uploadUrl or downloadUrl in response:', uploadData);
                throw new Error('Invalid response from upload endpoint - missing URLs');
            }

            console.log('[Autoscribe] Upload URL obtained successfully');
            console.log('[Autoscribe] Download URL:', downloadUrl);

            // Step 2: Upload file to the provided URL
            console.log('[Autoscribe] Uploading file to provided URL...');
            const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': file.type || 'application/octet-stream'
                },
                body: file
            });

            console.log('[Autoscribe] File upload response status:', uploadResponse.status);

            if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text();
                console.error('[Autoscribe] File upload failed. Status:', uploadResponse.status);
                console.error('[Autoscribe] Error response:', errorText);
                throw new Error(`File upload failed: ${uploadResponse.status} - ${errorText}`);
            }

            console.log('[Autoscribe] File uploaded successfully!');
            return downloadUrl;

        } catch (error) {
            console.error('[Autoscribe] Error in uploadFileToMusicAI:', error);
            throw error;
        }
    }
    // Function to create transcription job
    async function createTranscriptionJob(downloadUrl, apiKey) {
        console.log('[Autoscribe] Creating transcription job...');
        console.log('[Autoscribe] Input URL:', downloadUrl);

        try {
            const jobPayload = {
                name: 'Genius Autoscribe Transcription',
                workflow: 'transcription',
                params: {
                    inputUrl: downloadUrl
                }
            };

            console.log('[Autoscribe] Endpoint: POST https://api.music.ai/api/job');
            console.log('[Autoscribe] Job payload:', jobPayload);

            const response = await fetch('https://api.music.ai/api/job', {
                method: 'POST',
                headers: {
                    'Authorization': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(jobPayload)
            });

            console.log('[Autoscribe] Job creation response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Autoscribe] Failed to create job. Status:', response.status);
                console.error('[Autoscribe] Error response:', errorText);
                throw new Error(`Failed to create transcription job: ${response.status} - ${errorText}`);
            }

            const jobData = await response.json();
            console.log('[Autoscribe] Job created successfully:', jobData);

            if (!jobData.id) {
                console.error('[Autoscribe] No job ID in response:', jobData);
                throw new Error('Invalid response from job endpoint - missing job ID');
            }

            console.log('[Autoscribe] Job ID:', jobData.id);
            return jobData.id;

        } catch (error) {
            console.error('[Autoscribe] Error in createTranscriptionJob:', error);
            throw error;
        }
    }

    // Function to poll job status until completion
    async function pollJobStatus(jobId, apiKey) {
        console.log('[Autoscribe] Starting to poll job status for ID:', jobId);

        const maxAttempts = 120; // 10 minutes max (120 * 5 seconds)
        let attempt = 0;

        while (attempt < maxAttempts) {
            attempt++;
            console.log(`[Autoscribe] Polling attempt ${attempt}/${maxAttempts}...`);

            try {
                const statusUrl = `https://api.music.ai/api/job/${jobId}`;
                console.log('[Autoscribe] Checking status at:', statusUrl);

                const response = await fetch(statusUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': apiKey
                    }
                });

                console.log('[Autoscribe] Status check response status:', response.status);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[Autoscribe] Failed to fetch job status. Status:', response.status);
                    console.error('[Autoscribe] Error response:', errorText);
                    throw new Error(`Failed to fetch job status: ${response.status} - ${errorText}`);
                }

                const statusData = await response.json();
                console.log('[Autoscribe] Job status data:', statusData);

                const { status, result } = statusData;
                console.log('[Autoscribe] Current job status:', status);

                if (status === 'SUCCEEDED') {
                    console.log('[Autoscribe] Job succeeded! Result:', result);
                    return result;
                } else if (status === 'FAILED') {
                    console.error('[Autoscribe] Job failed. Status data:', statusData);
                    throw new Error('Transcription job failed');
                } else {
                    console.log('[Autoscribe] Job still processing, waiting 5 seconds before next check...');
                    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
                }

            } catch (error) {
                console.error('[Autoscribe] Error during status polling:', error);
                throw error;
            }
        }

        console.error('[Autoscribe] Max polling attempts reached. Job may still be processing.');
        throw new Error('Job polling timeout - max attempts reached');
    }
    // Function to create Autoscribe settings popup
    function createAutoscribeSettingsPopup() {
        const backdrop = UI.createBackdrop(() => {
            backdrop.style.display = 'none';
            popup.style.display = 'none';
        });
        backdrop.id = 'genius-autoscribe-settings-backdrop';

        const popup = UI.createPopup();
        popup.id = 'genius-autoscribe-settings-popup';

        const header = UI.createPopupHeader('Autoscribe Settings', () => {
            backdrop.style.display = 'none';
            popup.style.display = 'none';
        });

        popup.appendChild(header);

        // Settings content
        const content = document.createElement('div');
        content.style.cssText = 'padding: 20px;';

        // Formatting Toggle
        const formattingToggleContainer = document.createElement('div');
        formattingToggleContainer.style.cssText = 'margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;';
        
        const formattingLabel = document.createElement('label');
        formattingLabel.textContent = 'Use AI Formatting';
        formattingLabel.style.cssText = 'font-weight: 500;';
        
        const formattingToggle = document.createElement('input');
        formattingToggle.type = 'checkbox';
        formattingToggle.checked = autoscribeSettings.useFormatting;
        formattingToggle.style.cssText = 'width: 20px; height: 20px; cursor: pointer;';
        formattingToggle.addEventListener('change', () => {
            autoscribeSettings.useFormatting = formattingToggle.checked;
            saveAutoscribeSettings();
            // Toggle visibility of provider-specific settings
            updateProviderVisibility();
        });
        
        formattingToggleContainer.appendChild(formattingLabel);
        formattingToggleContainer.appendChild(formattingToggle);

        // Headers Toggle
        const headersToggleContainer = document.createElement('div');
        headersToggleContainer.style.cssText = 'margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;';
        
        const headersLabel = document.createElement('label');
        headersLabel.textContent = 'Use Song Part Headers';
        headersLabel.style.cssText = 'font-weight: 500;';
        
        const headersToggle = document.createElement('input');
        headersToggle.type = 'checkbox';
        headersToggle.checked = autoscribeSettings.useHeaders;
        headersToggle.style.cssText = 'width: 20px; height: 20px; cursor: pointer;';
        headersToggle.addEventListener('change', () => {
            autoscribeSettings.useHeaders = headersToggle.checked;
            saveAutoscribeSettings();
        });
        
        headersToggleContainer.appendChild(headersLabel);
        headersToggleContainer.appendChild(headersToggle);

        // Provider Selector
        const providerContainer = document.createElement('div');
        providerContainer.style.cssText = 'margin-bottom: 20px;';
        
        const providerLabel = document.createElement('label');
        providerLabel.textContent = 'Formatting Provider';
        providerLabel.style.cssText = 'display: block; margin-bottom: 5px; font-weight: 500;';
        
        const providerSelect = document.createElement('select');
        providerSelect.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-family: inherit;';
        
        const geminiOption = document.createElement('option');
        geminiOption.value = 'gemini';
        geminiOption.textContent = 'Google Gemini';
        
        const deepseekOption = document.createElement('option');
        deepseekOption.value = 'deepseek';
        deepseekOption.textContent = 'DeepSeek (Cheaper & Faster)';
        
        providerSelect.appendChild(geminiOption);
        providerSelect.appendChild(deepseekOption);
        providerSelect.value = autoscribeSettings.formattingProvider;
        
        providerSelect.addEventListener('change', () => {
            autoscribeSettings.formattingProvider = providerSelect.value;
            saveAutoscribeSettings();
            console.log('[Autoscribe] Provider changed to:', providerSelect.value);
            updateProviderVisibility();
        });
        
        providerContainer.appendChild(providerLabel);
        providerContainer.appendChild(providerSelect);

        // Gemini Model Selector
        const modelContainer = document.createElement('div');
        modelContainer.style.cssText = 'margin-bottom: 20px;';

        const modelLabel = document.createElement('label');
        modelLabel.textContent = 'Gemini Model';
        modelLabel.style.cssText = 'display: block; margin-bottom: 5px; font-weight: 500;';

        const modelSelect = document.createElement('select');
        modelSelect.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-family: inherit;';

        const flashOption = document.createElement('option');
        flashOption.value = 'gemini-2.5-flash';
        flashOption.textContent = 'Gemini 2.5 Flash (Faster, Cheaper)';

        const proOption = document.createElement('option');
        proOption.value = 'gemini-2.5-pro';
        proOption.textContent = 'Gemini 2.5 Pro (More Accurate)';

        modelSelect.appendChild(flashOption);
        modelSelect.appendChild(proOption);
        modelSelect.value = autoscribeSettings.geminiModel;

        modelSelect.addEventListener('change', () => {
            autoscribeSettings.geminiModel = modelSelect.value;
            saveAutoscribeSettings();
            console.log('[Autoscribe] Model changed to:', modelSelect.value);
        });

        modelContainer.appendChild(modelLabel);
        modelContainer.appendChild(modelSelect);

        // DeepSeek Model Selector
        const deepseekModelContainer = document.createElement('div');
        deepseekModelContainer.style.cssText = 'margin-bottom: 20px;';
        deepseekModelContainer.className = 'deepseek-settings';
        
        const deepseekModelLabel = document.createElement('label');
        deepseekModelLabel.textContent = 'DeepSeek Model';
        deepseekModelLabel.style.cssText = 'display: block; margin-bottom: 5px; font-weight: 500;';
        
        const deepseekModelSelect = document.createElement('select');
        deepseekModelSelect.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-family: inherit;';
        
        const deepseekChatOption = document.createElement('option');
        deepseekChatOption.value = 'deepseek-chat';
        deepseekChatOption.textContent = 'DeepSeek Chat (Non-thinking Mode)';
        
        const deepseekReasonerOption = document.createElement('option');
        deepseekReasonerOption.value = 'deepseek-reasoner';
        deepseekReasonerOption.textContent = 'DeepSeek Reasoner (Thinking Mode)';
        
        deepseekModelSelect.appendChild(deepseekChatOption);
        deepseekModelSelect.appendChild(deepseekReasonerOption);
        deepseekModelSelect.value = autoscribeSettings.deepseekModel;
        
        deepseekModelSelect.addEventListener('change', () => {
            autoscribeSettings.deepseekModel = deepseekModelSelect.value;
            saveAutoscribeSettings();
            console.log('[Autoscribe] DeepSeek model changed to:', deepseekModelSelect.value);
        });
        
        deepseekModelContainer.appendChild(deepseekModelLabel);
        deepseekModelContainer.appendChild(deepseekModelSelect);

        // Music.ai API Key
        const musicAiContainer = document.createElement('div');
        musicAiContainer.style.cssText = 'margin-bottom: 20px;';

        const musicAiLabel = document.createElement('label');
        musicAiLabel.textContent = 'Music.ai API Key';
        musicAiLabel.style.cssText = 'display: block; margin-bottom: 5px; font-weight: 500;';

        const musicAiInput = document.createElement('input');
        musicAiInput.type = 'password';
        musicAiInput.value = autoscribeSettings.musicAiApiKey;
        musicAiInput.placeholder = 'Enter your Music.ai API key';
        musicAiInput.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace;';
        musicAiInput.addEventListener('input', () => {
            autoscribeSettings.musicAiApiKey = musicAiInput.value;
            saveAutoscribeSettings();
        });

        musicAiContainer.appendChild(musicAiLabel);
        musicAiContainer.appendChild(musicAiInput);

        // Gemini API Key
        const geminiContainer = document.createElement('div');
        geminiContainer.style.cssText = 'margin-bottom: 20px;';
        geminiContainer.className = 'gemini-settings';
        
        const geminiKeyLabel = document.createElement('label');
        geminiKeyLabel.textContent = 'Gemini API Key';
        geminiKeyLabel.style.cssText = 'display: block; margin-bottom: 5px; font-weight: 500;';
        
        const geminiInput = document.createElement('input');
        geminiInput.type = 'password';
        geminiInput.value = autoscribeSettings.geminiApiKey;
        geminiInput.placeholder = 'Enter your Gemini API key';
        geminiInput.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace;';
        geminiInput.addEventListener('input', () => {
            autoscribeSettings.geminiApiKey = geminiInput.value;
            saveAutoscribeSettings();
        });
        
        geminiContainer.appendChild(geminiKeyLabel);
        geminiContainer.appendChild(geminiInput);

        // DeepSeek API Key
        const deepseekContainer = document.createElement('div');
        deepseekContainer.style.cssText = 'margin-bottom: 20px;';
        deepseekContainer.className = 'deepseek-settings';
        
        const deepseekKeyLabel = document.createElement('label');
        deepseekKeyLabel.textContent = 'DeepSeek API Key';
        deepseekKeyLabel.style.cssText = 'display: block; margin-bottom: 5px; font-weight: 500;';
        
        const deepseekInput = document.createElement('input');
        deepseekInput.type = 'password';
        deepseekInput.value = autoscribeSettings.deepseekApiKey;
        deepseekInput.placeholder = 'Enter your DeepSeek API key';
        deepseekInput.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace;';
        deepseekInput.addEventListener('input', () => {
            autoscribeSettings.deepseekApiKey = deepseekInput.value;
            saveAutoscribeSettings();
        });
        
        deepseekContainer.appendChild(deepseekKeyLabel);
        deepseekContainer.appendChild(deepseekInput);

        // Info text
        const infoText = document.createElement('p');
        infoText.textContent = 'API keys are stored locally in your browser and never sent anywhere except to their respective services.';
        infoText.style.cssText = 'font-size: 12px; color: #666; margin-top: 15px;';

        // Pricing info
        const pricingInfo = document.createElement('p');
        pricingInfo.innerHTML = '<strong>Pricing:</strong> DeepSeek is ~10x cheaper than Gemini ($0.28/$1.10 vs $3.50/$10.50 per 1M tokens).';
        pricingInfo.style.cssText = 'font-size: 12px; color: #666; margin-top: 10px;';

        content.appendChild(formattingToggleContainer);
        content.appendChild(headersToggleContainer);
        content.appendChild(providerContainer);
        content.appendChild(modelContainer);
        content.appendChild(deepseekModelContainer);
        content.appendChild(musicAiContainer);
        content.appendChild(geminiContainer);
        content.appendChild(deepseekContainer);
        content.appendChild(infoText);
        content.appendChild(pricingInfo);
        popup.appendChild(content);

        // Function to update provider-specific settings visibility
        function updateProviderVisibility() {
            const isEnabled = autoscribeSettings.useFormatting;
            const provider = autoscribeSettings.formattingProvider;
            
            providerContainer.style.display = isEnabled ? 'block' : 'none';
            modelContainer.style.display = (isEnabled && provider === 'gemini') ? 'block' : 'none';
            deepseekModelContainer.style.display = (isEnabled && provider === 'deepseek') ? 'block' : 'none';
            geminiContainer.style.display = (isEnabled && provider === 'gemini') ? 'block' : 'none';
            deepseekContainer.style.display = (isEnabled && provider === 'deepseek') ? 'block' : 'none';
            pricingInfo.style.display = isEnabled ? 'block' : 'none';
        }
        
        // Set initial visibility
        updateProviderVisibility();

        document.body.appendChild(backdrop);
        document.body.appendChild(popup);

        return { backdrop, popup };
    }

    // Function to create the Autoscribe button
    function createAutoscribeButton() {
        console.log('[Autoscribe] Creating Autoscribe button...');

        const button = document.createElement('button');
        button.innerHTML = `
            <span class="autoscribe-text" style="margin-right: 0.5rem;">Autoscribe</span>
            <span class="settings-icon" style="opacity: 0.7; transition: opacity 0.2s; position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); padding: 0.25rem; cursor: pointer;">
                <svg class="svg-icon" style="width: 1em; height: 1em; vertical-align: middle; fill: currentColor; overflow: hidden;" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg">
                    <path d="M512 661.994667q61.994667 0 106.005333-44.010667t44.010667-106.005333-44.010667-106.005333-106.005333-44.010667-106.005333 44.010667-44.010667 106.005333 44.010667 106.005333 106.005333 44.010667zM829.994667 554.005333l90.005333 69.994667q13.994667 10.005333 4.010667 28.010667l-85.994667 148.010667q-8 13.994667-26.005333 8l-106.005333-42.005333q-42.005333 29.994667-72 42.005333l-16 112q-4.010667 18.005333-20.010667 18.005333l-172.010667 0q-16 0-20.010667-18.005333l-16-112q-37.994667-16-72-42.005333l-106.005333 42.005333q-18.005333 5.994667-26.005333-8l-85.994667-148.010667q-10.005333-18.005333 4.010667-28.010667l90.005333-69.994667q-2.005333-13.994667-2.005333-42.005333t2.005333-42.005333l-90.005333-69.994667q-13.994667-10.005333-4.010667-28.010667l85.994667-148.010667q8-13.994667 26.005333-8l106.005333 42.005333q42.005333-29.994667 72-42.005333l16-112q4.010667-18.005333 20.010667-18.005333l172.010667 0q16 0 20.010667 18.005333l16 112q37.994667 16 72 42.005333l106.005333-42.005333q18.005333-5.994667 26.005333 8l85.994667 148.010667q10.005333 18.005333-4.010667 28.010667l-90.005333 69.994667q2.005333 13.994667 2.005333 42.005333t-2.005333 42.005333z" />
                </svg>
            </span>
        `;
        button.title = 'Upload audio file and transcribe using Music.ai. Click gear icon for settings.';
        button.id = 'genius-autoscribe-button';

        // Style to match Genius buttons - get classes dynamically
        const buttonClasses = getGeniusButtonClasses();
        button.className = `${buttonClasses.container} ${buttonClasses.styles} ${buttonClasses.lyricsEdit}`;

        // Additional custom styling to match the other main buttons
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
            position: relative;
            border-radius: 1.25rem;
            cursor: pointer;
            min-width: auto;
            display: inline-flex;
            align-items: center;
            position: relative;
        `;

        // Track timeout to prevent multiple overlapping operations
        let operationInProgress = false;
        let feedbackTimeout = null;

        // Add hover effects like other main buttons
        button.addEventListener('mouseenter', function() {
            if (!operationInProgress) {
                button.style.backgroundColor = '#000';
                button.style.color = '#fff';
                const settingsIcon = button.querySelector('.settings-icon');
                if (settingsIcon) settingsIcon.style.opacity = '1';
            }
        });

        button.addEventListener('mouseleave', function() {
            if (!operationInProgress) {
                button.style.backgroundColor = 'transparent';
                button.style.color = '#000';
                const settingsIcon = button.querySelector('.settings-icon');
                if (settingsIcon) settingsIcon.style.opacity = '0.7';
            }
        });

        // Create hidden file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'genius-autoscribe-file-input';
        fileInput.accept = 'audio/*,video/*'; // Accept audio and video files
        document.body.appendChild(fileInput);

        // Function to update button state
        function updateButtonState(state, text) {
            const textSpan = button.querySelector('.autoscribe-text');
            if (text && textSpan) {
                textSpan.textContent = text;
            }

            if (state === 'processing') {
                button.style.backgroundColor = '#fbbf24';
                button.style.borderColor = '#fbbf24';
                button.style.color = '#000';
            } else if (state === 'copied' || state === 'success') {
                button.style.backgroundColor = '#10b981';
                button.style.borderColor = '#10b981';
                button.style.color = '#fff';
            } else if (state === 'error') {
                button.style.backgroundColor = '#ef4444';
                button.style.borderColor = '#ef4444';
                button.style.color = '#fff';
            } else {
                button.style.backgroundColor = 'transparent';
                button.style.borderColor = '#000';
                button.style.color = '#000';
            }
        }

        // Function to reset button after delay
        function resetButtonAfterDelay(delay = 3000) {
            if (feedbackTimeout) clearTimeout(feedbackTimeout);
            feedbackTimeout = setTimeout(() => {
                updateButtonState(null, 'Autoscribe');
                operationInProgress = false;
                feedbackTimeout = null;
            }, delay);
        }

        // Handle file selection
        fileInput.addEventListener('change', async function() {
            if (operationInProgress) {
                console.log('[Autoscribe] Operation already in progress, ignoring...');
                return;
            }

            if (fileInput.files.length === 0) {
                console.log('[Autoscribe] No file selected');
                return;
            }

            operationInProgress = true;
            const file = fileInput.files[0];

            console.log('[Autoscribe] ========================================');
            console.log('[Autoscribe] Starting Autoscribe process');
            console.log('[Autoscribe] ========================================');

            // Get or prompt for Music.ai API key
            let musicAiApiKey = autoscribeSettings.musicAiApiKey;
            if (!musicAiApiKey || musicAiApiKey.trim() === '') {
                const promptedKey = prompt('Enter your Music.ai API key:');
                if (!promptedKey || promptedKey.trim() === '') {
                    console.log('[Autoscribe] No API key provided, aborting...');
                    updateButtonState('error', 'No API Key');
                    resetButtonAfterDelay();
                    fileInput.value = ''; // Reset file input
                    operationInProgress = false;
                    return;
                }
                musicAiApiKey = promptedKey.trim();
                // Save for next time
                autoscribeSettings.musicAiApiKey = musicAiApiKey;
                saveAutoscribeSettings();
                console.log('[Autoscribe] API key saved to settings');
            }

            console.log('[Autoscribe] Music.ai API key loaded');
            console.log('[Autoscribe] API key length:', musicAiApiKey.length);
            console.log('[Autoscribe] API key format check - starts with expected prefix:', musicAiApiKey.substring(0, 4));

            try {
                // Update button to show processing
                updateButtonState('processing', 'Uploading...');

                // Step 1: Upload file
                const downloadUrl = await uploadFileToMusicAI(file, musicAiApiKey);
                console.log('[Autoscribe] ✓ File upload complete');

                // Step 2: Create transcription job
                updateButtonState('processing', 'Creating Job...');
                const jobId = await createTranscriptionJob(downloadUrl, musicAiApiKey);
                console.log('[Autoscribe] ✓ Job created');

                // Step 3: Poll for result
                updateButtonState('processing', 'Transcribing...');
                const result = await pollJobStatus(jobId, musicAiApiKey);
                console.log('[Autoscribe] ✓ Transcription complete');
                console.log('[Autoscribe] Result object:', result);

                // Step 4: Download the actual transcription JSON
                updateButtonState('processing', 'Downloading...');

                if (!result.Output1) {
                    throw new Error('No Output1 URL in result');
                }

                console.log('[Autoscribe] Downloading transcription from:', result.Output1);
                const transcriptionResponse = await fetch(result.Output1);

                if (!transcriptionResponse.ok) {
                    throw new Error(`Failed to download transcription: ${transcriptionResponse.status}`);
                }

                const transcriptionData = await transcriptionResponse.json();
                console.log('[Autoscribe] ✓ Transcription downloaded');
                console.log('[Autoscribe] Raw transcription data:', transcriptionData);

                // Step 5: Extract text lines from JSON
                updateButtonState('processing', 'Processing...');

                let resultText = '';

                // Check if transcriptionData is an array (expected format)
                if (Array.isArray(transcriptionData)) {
                    // Extract just the "text" field from each object
                    const lines = transcriptionData.map(item => item.text || '').filter(text => text.trim() !== '');
                    resultText = lines.join('\n');
                    console.log('[Autoscribe] Extracted', lines.length, 'lines from transcription');
                } else if (transcriptionData.text) {
                    // If it's a single object with text field
                    resultText = transcriptionData.text;
                    console.log('[Autoscribe] Extracted text from single object');
                } else {
                    // Fallback: stringify the whole thing
                    console.warn('[Autoscribe] Unexpected format, using JSON stringify as fallback');
                    resultText = JSON.stringify(transcriptionData, null, 2);
                }

                console.log('[Autoscribe] ✓ Text extracted');
                console.log('[Autoscribe] Result text (length:', resultText.length, 'characters)');
                console.log('[Autoscribe] Result preview (first 500 chars):', resultText.substring(0, 500));
                console.log('[Autoscribe] Line count:', resultText.split('\n').length);

                // Step 6: Format with AI (if enabled)
                let formattedText = resultText; // Default to unformatted
                
                if (autoscribeSettings.useFormatting && autoscribeSettings.formattingProvider !== 'none') {
                    updateButtonState('processing', 'Formatting...');
                    
                    const provider = autoscribeSettings.formattingProvider;
                    console.log('[Autoscribe] Using formatting provider:', provider);
                    
                    if (provider === 'deepseek') {
                        // DeepSeek formatting
                        let deepseekApiKey = autoscribeSettings.deepseekApiKey;
                        if (!deepseekApiKey || deepseekApiKey.trim() === '') {
                            const promptedKey = prompt('Enter your DeepSeek API key (or press Cancel to skip formatting):');
                            if (promptedKey && promptedKey.trim() !== '') {
                                deepseekApiKey = promptedKey.trim();
                                autoscribeSettings.deepseekApiKey = deepseekApiKey;
                                saveAutoscribeSettings();
                                console.log('[Autoscribe] DeepSeek API key saved to settings');
                            }
                        }
                        
                        if (deepseekApiKey && deepseekApiKey.trim() !== '') {
                            console.log('[Autoscribe] DeepSeek API key loaded, formatting lyrics...');
                            
                            try {
                                const styleGuide = `Format lyrics to Genius style. Follow official streaming version. Write out all repeated sections in full.

**SPELLINGS:** \`I'ma\` \`'cause\` \`okay\` \`'til\`/\`till\` \`tryna\` \`ayy\` \`ho\`/\`hoes\` \`though\` \`y'all\` \`skrrt\` \`Perc'\` \`bougie\` \`shawty\`/\`shorty\` \`lil'\` \`woah\` \`dog\` \`chopper\` \`oughta\` \`naive\` \`cliché\` \`alright\` \`a.k.a.\` \`GOAT\` \`VIP\` \`ASAP\` (use \`A$AP\` for A$AP Rocky/Mob) \`foenem\` \`bronem\` \`somethin'\` \`nothin'\` \`lo'\` \`switch\`/\`switchy\`/\`switchies\` \`blick\`/\`blicky\`/\`blickies\` \`cuz\` \`T'd\` \`doggy\` \`slimy\` \`high-speed\` \`E-way\` \`monyun\`

**NUMBERS:** Spell out (e.g., "five", "fifty-six", "thirty-five hunnid"). Use digits for: proper nouns (\`Royce da 5'9"\` \`Nintendo 64\` \`Area 51\`), model numbers/calibers (\`G5\` \`.380\`), years (\`1993\`), \`24/7\`, police slang (\`5-0\` \`12\`), money (\`24K\` \`10K\`). Times: digits with colon (\`5:30\` \`6 o'clock\` \`a.m.\` \`p.m.\`)

**PUNCTUATION:** Typewriter apostrophes (\`'\`) not curly (\`'\`). Typewriter quotes (\`"\`) not curly (\`"\`\`"\`). Single \`?\` for questions, single \`!\` for screams. Hyphens for scatting/stutters (\`Ski-bi-dibby-dib\` \`D-d-d-d-don't\`). Em dash (\`—\`) for dropped words. Spell out \`&\` and \`°\` unless brand name. No ™ or ®. Censored words: \`****\`

**CAPITALIZATION:** First word of each line, proper nouns, \`God\`, acronyms. Brands: conventional (\`Chanel\` \`Adidas\` \`iPhone\` \`GEICO\`). \`Earth\` (planet), cardinal directions only for regions.

**NON-LYRICAL:** Ad-libs in parentheses, capitalize first letter (\`(Yeah)\` \`(Ooh)\`). Missing lyrics: \`[?]\`. Transcribe as pronounced with apostrophes (\`ballin'\` \`'em\`).

**CATEGORIES:** Firearms: \`Draco\` \`TEC-9\` \`MAC-10\` \`Glock\` \`FN\`/\`F&N\`/\`Five-seveN\` \`Kel-Tec\` \`SIG\` \`Ruger\` \`Smith & Wesson\` (calibers digits: \`.45\` \`5.56\`, rounds spelled: \`thirty-round mag\`). Jewelry: \`plain jane\` \`presidential\`/\`presi\` \`bust down\` \`Richard Mille\` \`Cartier\`/\`Carti'\` \`Rolex\`/\`Rollie\` \`Audemars Piguet\` \`Cuban\`. Drugs: \`Xanax\`/\`Xan'\` \`Percocet\`/\`Perc'\` \`Roxy\` \`Addy\` \`Wockhardt\` \`Hi-Tech\` \`Tussionex\` \`Actavis\` \`zaza\`/\`za\` \`Backwood\`/\`'Wood\` \`molly\` \`fetty\`. Vehicles: \`straight-eight\` \`Redeye\` \`392\` \`Bimmer\` \`Lamborghini\`/\`Lambo'\` \`Durango\`/\`'Rango\` \`Corvette\`/\`'Vette\` \`Maybach\`/\`'Bach\` \`Hemi\` \`Scat Pack\` \`Trackhawk\` \`stolo\`

**EXAMPLE:**
I got two new straps in it (Yeah)
5.56 gon' bleed it, so (Go)
I'm prayin' to God, but I'm sinnin' (Woah)
Dior pants hold up the .60
I-I'm like Marilyn Manson (Yeah)
I got a lean bladder (Yeah, yeah)`;


                                const headerInstructions = autoscribeSettings.useHeaders ? `
**HEADERS:** Use \`[Intro]\` \`[Verse]\` \`[Refrain]\` \`[Pre-Chorus]\` \`[Chorus]\` \`[Bridge]\` \`[Outro]\` to mark song parts. Find chorus first (repeated sections). Add verses between. Number verses like [Verse 1], unless there is only a single verse header in the transcription. Short sections (3 lines max, unless mainly consisting of adlib-type words (like ayy, what, yeah, etc)) starting or ending song before/after chorus = intro/outro. Repeat lyrics under same header if section repeats immediately (no extra space).
Example:
[Chorus]
Line one
Line two` : '';

                        const prompt = `You are a lyrics formatter for Genius. Format the following lyrics according to the style guide provided. Output ONLY the formatted lyrics with no preamble, explanation, or commentary. Place the formatted lyrics inside triple backticks (\`\`\`) so they can be easily extracted.

STYLE GUIDE:
${styleGuide}${headerInstructions}

LYRICS TO FORMAT:
${resultText}

Remember: Output only the formatted lyrics in triple backticks, nothing else.`;
                                
                                console.log('[Autoscribe] Sending request to DeepSeek API...');
                                console.log('[Autoscribe] Using model:', autoscribeSettings.deepseekModel);
                                console.log('[Autoscribe] Prompt length:', prompt.length, 'characters');
                                
                                // Create AbortController for timeout
                                const controller = new AbortController();
                                const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
                                
                                try {
                                    // Try with /v1/ prefix (standard OpenAI-compatible endpoint)
                                    const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
                                        method: 'POST',
                                        headers: {
                                            'Authorization': `Bearer ${deepseekApiKey}`,
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify({
                                            model: autoscribeSettings.deepseekModel,
                                            messages: [
                                                {
                                                    role: 'user',
                                                    content: prompt
                                                }
                                            ],
                                            stream: false,
                                            temperature: 0.7,
                                            max_tokens: 4096
                                        }),
                                        signal: controller.signal
                                    });
                                    
                                    clearTimeout(timeoutId); // Clear timeout on successful response
                                    
                                    console.log('[Autoscribe] DeepSeek response status:', deepseekResponse.status);
                                    console.log('[Autoscribe] DeepSeek response headers:', Object.fromEntries(deepseekResponse.headers.entries()));
                                    
                                    if (!deepseekResponse.ok) {
                                        const errorText = await deepseekResponse.text();
                                        console.error('[Autoscribe] DeepSeek API error:', errorText);
                                        throw new Error(`DeepSeek API error (${deepseekResponse.status}): ${errorText.substring(0, 200)}`);
                                    }
                                    
                                    // Get response text first to check if it's empty
                                    const responseText = await deepseekResponse.text();
                                    console.log('[Autoscribe] DeepSeek raw response length:', responseText.length);
                                    console.log('[Autoscribe] DeepSeek raw response preview:', responseText.substring(0, 200));
                                    
                                    if (!responseText || responseText.trim() === '') {
                                        throw new Error('DeepSeek returned empty response (server may be overloaded, try again later)');
                                    }
                                    
                                    // Try to parse JSON
                                    let deepseekData;
                                    try {
                                        deepseekData = JSON.parse(responseText);
                                    } catch (parseError) {
                                        console.error('[Autoscribe] Failed to parse DeepSeek response:', parseError);
                                        throw new Error('DeepSeek returned invalid JSON response (server may be overloaded)');
                                    }
                                    
                                    console.log('[Autoscribe] DeepSeek response data:', deepseekData);
                                    
                                    // Extract text from DeepSeek response (OpenAI-compatible format)
                                    if (deepseekData.choices && deepseekData.choices[0] && deepseekData.choices[0].message && deepseekData.choices[0].message.content) {
                                        let deepseekText = deepseekData.choices[0].message.content;
                                        console.log('[Autoscribe] Raw DeepSeek output:', deepseekText);
                                        
                                        if (!deepseekText || deepseekText.trim() === '') {
                                            throw new Error('DeepSeek returned empty content (server may be overloaded, try again later)');
                                        }
                                        
                                        // Extract text between triple backticks
                                        const codeBlockMatch = deepseekText.match(/```[\s\S]*?\n([\s\S]*?)```/);
                                        if (codeBlockMatch && codeBlockMatch[1]) {
                                            formattedText = codeBlockMatch[1].trim();
                                            console.log('[Autoscribe] ✓ Extracted formatted text from code block');
                                        } else {
                                            // Fallback: use the whole response if no code block found
                                            console.warn('[Autoscribe] No code block found, using raw response');
                                            formattedText = deepseekText.trim();
                                        }
                                        
                                        console.log('[Autoscribe] ✓ Lyrics formatted by DeepSeek');
                                        console.log('[Autoscribe] Formatted text length:', formattedText.length, 'characters');
                                    } else {
                                        console.error('[Autoscribe] Unexpected response structure:', deepseekData);
                                        throw new Error('Unexpected DeepSeek response structure (missing choices/message/content)');
                                    }
                                } catch (fetchError) {
                                    clearTimeout(timeoutId);
                                    if (fetchError.name === 'AbortError') {
                                        throw new Error('DeepSeek request timed out after 2 minutes (server may be overloaded, try again later)');
                                    }
                                    throw fetchError;
                                }
                                
                            } catch (deepseekError) {
                                console.error('[Autoscribe] DeepSeek formatting error:', deepseekError);
                                console.error('[Autoscribe] Stack:', deepseekError.stack);
                                alert(`DeepSeek formatting failed: ${deepseekError.message}\n\nShowing unformatted lyrics instead.`);
                                // Continue with unformatted text
                            }
                        } else {
                            console.log('[Autoscribe] No DeepSeek API key available, skipping formatting');
                        }
                        
                    } else if (provider === 'gemini') {
                        // Gemini formatting
                        let geminiApiKey = autoscribeSettings.geminiApiKey;
                        if (!geminiApiKey || geminiApiKey.trim() === '') {
                            const promptedKey = prompt('Enter your Google Gemini API key (or press Cancel to skip formatting):');
                            if (promptedKey && promptedKey.trim() !== '') {
                                geminiApiKey = promptedKey.trim();
                                autoscribeSettings.geminiApiKey = geminiApiKey;
                                saveAutoscribeSettings();
                                console.log('[Autoscribe] Gemini API key saved to settings');
                            }
                        }
                        
                        if (geminiApiKey && geminiApiKey.trim() !== '') {
                            console.log('[Autoscribe] Gemini API key loaded, formatting lyrics...');
                            
                            try {
                                const styleGuide = `Format lyrics to Genius style. Follow official streaming version. Have correct and accurate, clean, and concise lyrics. Transcribe the entire song. All repeated sections must be written out in full. If a specific word or format is not covered in this guide, make an educated guess based on the existing rules and the context of the lyric. Type out all repeated lyrics in full each time they occur. Do not use notations like \(x2)\.

**SPELLINGS:** \`I'ma\` (not "I'mma," "Ima,") \`'cause\` (not "cuz," unless about cousin) \`okay\` (not "ok") \`'til\` \`tryna\` \`ayy\` (not aye, ay) \`ho\`/\`hoes\` (not hoe, unless referring to the garden tool)  \`though\` (not "tho") \`y'all\` \`skrrt\` (not "skrt")\`Perc'\` (not Perk, Perky, Percy, unless "perk" is used in another context) \`bougie\` \`shawty\`/\`shorty\` \`lil'\` \`woah\` (not "whoa") \`chopper\` \`oughta\` \`naive\` (not naïve) \`cliché\` \`alright\` \`a.k.a.\` \`GOAT\` \`VIP\` \`ASAP\` (use \`A$AP\` for A$AP Rocky/Mob) \`foenem\` \`bronem\` \`somethin'\` \`nothin'\` \`lo'\` \`switch\`/\`switchy\`/\`switchies\` \`blick\`/\`blicky\`/\`blickies\` \`cuz\` \`T'd\` \`dawgy\` \`slimy\` \`high-speed\` \`E-way\`

**NUMBERS:** Spell out (e.g., "five", "fifty-six", "thirty-five hunnid"). Use digits for: proper nouns (\`Royce da 5'9"\` \`Nintendo 64\` \`Area 51\`), model numbers/calibers (\`G5\` \`.380\`), years (\`1993\`), \`24/7\`, police slang (\`5-0\` \`12\`), money (\`24K\` \`10K\`). Times: digits with colon (\`5:30\` \`6 o'clock\` \`a.m.\` \`p.m.\`)

**PUNCTUATION:** Typewriter apostrophes (\`'\`) not curly (\`'\`). Typewriter quotes (\`"\`) not curly (\`"\`\`"\`). Single \`?\` for questions, do not use \`!\` unless in "Ah!" or metal-type screams. Never use \`.\` Hyphens for stutters (\`D-d-d-d-don't\`). Em dash (\`—\`) for dropped words or multi-word stutters. Spell out \`&\` and \`°\` unless brand name. No ™ or ®. Always add a comma before the word but, unless it's staring a line - same with yeah, unless "Oh yeah"

**CAPITALIZATION:** First word of each line, proper nouns, \`God\`, acronyms. Brands: conventional (\`Chanel\` \`Adidas\` \`iPhone\` \`GEICO\`). \`Earth\` (planet), cardinal directions only for regions.

**NON-LYRICAL:** Ad-libs in parentheses, capitalize first letter (\`(Yeah)\` \`(Ooh)\`). Transcribe as pronounced with apostrophes (\`ballin'\` \`'em\`).

**CATEGORIES:** Firearms: \`Draco\` \`TEC-9\` \`MAC-10\` \`Glock\` \`FN\`/\`F&N\`/\`Five-seveN\` \`Kel-Tec\` \`SIG\` \`Ruger\` \`Smith & Wesson\` (calibers digits: \`.45\` \`5.56\`, rounds spelled: \`thirty-round mag\`). Jewelry: \`plain jane\` \`presidential\`/\`presi\` \`bust down\` \`Richard Mille\` \`Cartier\`/\`Carti'\` \`Rolex\`/\`Rollie\` \`Audemars Piguet\` \`Cuban\`. Drugs: \`Xanax\`/\`Xan'\` \`Percocet\`/\`Perc'\` \`Roxy\` \`Addy\` \`Wockhardt\` \`Hi-Tech\` \`Tussionex\` \`Actavis\` \`zaza\`/\`za\` \`Backwood\`/\`'Wood\` \`molly\` \`fetty\`. Vehicles: \`straight-eight\` \`Redeye\` \`392\` \`Bimmer\` \`Lamborghini\`/\`Lambo'\` \`Durango\`/\`'Rango\` \`Corvette\`/\`'Vette\` \`Maybach\`/\`'Bach\` \`Hemi\` \`Scat Pack\` \`Trackhawk\` \`stolo\`

**PARTIAL EXAMPLE TRANSCRIPTION:**
I got two new straps in it (Yeah)
Bitch, I'm like Lil Tay-Tay, flexin', I'm the youngest in it
5.56 gon' bleed it (Go)
I'm prayin' to God, but I'm sinnin' (Woah)
Dior pants hold up the .60
I'm Hollywood? No, bitch, I'm hood famous (Yeah)
WWE Smackdown, b-bitch, I bring the pain (Yeah, yeah, yeah)
And my OG snappin', told 'em, "Clear the scene"
I-I'm like Marilyn Manson (Yeah)
I'm like— I'm like Marilyn Manson (Yeah)
I got a lean bladder (Yeah, yeah)`;
                                
                                const headerInstructions = autoscribeSettings.useHeaders ? `

**HEADERS:** Use \`[Intro]\` \`[Verse]\` \`[Refrain]\` \`[Pre-Chorus]\` \`[Chorus]\` \`[Bridge]\` \`[Outro]\` to mark song parts. Find chorus first (repeated sections). Add verses between. Number verses like [Verse 1], unless there is only a single verse header in the transcription. Short sections (3 lines max, unless mainly consisting of adlib-type words (like ayy, what, yeah, etc)) starting or ending song before/after chorus = intro/outro. Repeat lyrics under same header if section repeats immediately (no extra space).

Example:
[Chorus]
Line one
Line two` : '';
                                
                                const prompt = `You are a lyrics formatter for Genius. Format the following lyrics according to the style guide provided. Output ONLY the formatted lyrics with no preamble, explanation, or commentary. Place the formatted lyrics inside triple backticks (\`\`\`) so they can be easily extracted.
STYLE GUIDE:
${styleGuide}${headerInstructions}
LYRICS TO FORMAT:
${resultText}
Remember: Output only the formatted lyrics in triple backticks, nothing else.`;
                        
                                console.log('[Autoscribe] Sending request to Gemini API...');
                                console.log('[Autoscribe] Using model:', autoscribeSettings.geminiModel);
                                console.log('[Autoscribe] Prompt length:', prompt.length, 'characters');

                                const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${autoscribeSettings.geminiModel}:generateContent?key=${geminiApiKey}`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                contents: [{
                                    parts: [{
                                        text: prompt
                                    }]
                                }]
                            })
                        });

                        console.log('[Autoscribe] Gemini response status:', geminiResponse.status);

                        if (!geminiResponse.ok) {
                            const errorText = await geminiResponse.text();
                            console.error('[Autoscribe] Gemini API error:', errorText);
                            throw new Error(`Gemini API error: ${geminiResponse.status}`);
                        }

                        const geminiData = await geminiResponse.json();
                        console.log('[Autoscribe] Gemini response data:', geminiData);

                        // Extract text from Gemini response
                        if (geminiData.candidates && geminiData.candidates[0] && geminiData.candidates[0].content && geminiData.candidates[0].content.parts && geminiData.candidates[0].content.parts[0]) {
                            let geminiText = geminiData.candidates[0].content.parts[0].text;
                            console.log('[Autoscribe] Raw Gemini output:', geminiText);

                            // Extract text between triple backticks
                            const codeBlockMatch = geminiText.match(/```[\s\S]*?\n([\s\S]*?)```/);
                            if (codeBlockMatch && codeBlockMatch[1]) {
                                formattedText = codeBlockMatch[1].trim();
                                console.log('[Autoscribe] ✓ Extracted formatted text from code block');
                            } else {
                                // Fallback: use the whole response if no code block found
                                console.warn('[Autoscribe] No code block found, using raw response');
                                formattedText = geminiText.trim();
                            }

                            console.log('[Autoscribe] ✓ Lyrics formatted by Gemini');
                            console.log('[Autoscribe] Formatted text length:', formattedText.length, 'characters');
                        } else {
                            throw new Error('Unexpected Gemini response structure');
                        }

                            } catch (geminiError) {
                                console.error('[Autoscribe] Gemini formatting error:', geminiError);
                                console.error('[Autoscribe] Stack:', geminiError.stack);
                                alert(`Gemini formatting failed: ${geminiError.message}\n\nShowing unformatted lyrics instead.`);
                                // Continue with unformatted text
                            }
                        } else {
                            console.log('[Autoscribe] No Gemini API key available, skipping formatting');
                        }
                    }
                } else {
                    console.log('[Autoscribe] AI formatting disabled in settings');
                }

                // Update resultText to use formatted version
                resultText = formattedText;

                // Create modal to display result with copy button (to get fresh user activation)
                const modal = document.createElement('div');
                modal.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                    z-index: 10002;
                    max-width: 600px;
                    width: 90%;
                `;

                const backdrop = document.createElement('div');
                backdrop.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.5);
                    z-index: 10001;
                `;

                const title = document.createElement('h2');
                title.textContent = 'Transcription Complete! ✓';
                title.style.cssText = 'margin: 0 0 15px 0; font-size: 20px; color: #10b981;';

                const lineCount = resultText.split('\n').length;
                const info = document.createElement('p');
                info.textContent = `${lineCount} line${lineCount !== 1 ? 's' : ''} • ${resultText.length.toLocaleString()} characters`;
                info.style.cssText = 'margin: 0 0 15px 0; color: #666;';

                const textarea = document.createElement('textarea');
                textarea.value = resultText;
                textarea.readOnly = true;
                textarea.style.cssText = `
                    width: 100%;
                    height: 300px;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 14px;
                    line-height: 1.5;
                    margin-bottom: 15px;
                    resize: vertical;
                    white-space: pre-wrap;
                `;

                const buttonContainer = document.createElement('div');
                buttonContainer.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';

                const copyButton = document.createElement('button');
                copyButton.textContent = 'Copy to Clipboard';
                copyButton.style.cssText = `
                    background: #10b981;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                `;

                const closeButton = document.createElement('button');
                closeButton.textContent = 'Close';
                closeButton.style.cssText = `
                    background: #6c757d;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                `;

                // Copy button handler
                copyButton.addEventListener('click', async () => {
                    try {
                        // Try modern API first
                        await navigator.clipboard.writeText(resultText);
                        console.log('[Autoscribe] ✓ Copied to clipboard via Clipboard API');
                        copyButton.textContent = 'Copied! ✓';
                        copyButton.style.background = '#059669';
                        setTimeout(() => {
                            backdrop.remove();
                            modal.remove();
                            updateButtonState('copied', 'Copied');
                            resetButtonAfterDelay(2000);
                        }, 500);
                    } catch (err) {
                        console.warn('[Autoscribe] Clipboard API failed, trying execCommand:', err.message);
                        // Fallback to execCommand
                        textarea.select();
                        const successful = document.execCommand('copy');
                        if (successful) {
                            console.log('[Autoscribe] ✓ Copied to clipboard via execCommand');
                            copyButton.textContent = 'Copied! ✓';
                            copyButton.style.background = '#059669';
                            setTimeout(() => {
                                backdrop.remove();
                                modal.remove();
                                updateButtonState('copied', 'Copied');
                                resetButtonAfterDelay(2000);
                            }, 500);
                        } else {
                            console.error('[Autoscribe] Both copy methods failed');
                            alert('Copy failed! Please manually select and copy the text above.');
                        }
                    }
                });

                // Close button handler
                closeButton.addEventListener('click', () => {
                    backdrop.remove();
                    modal.remove();
                    updateButtonState(null, 'Autoscribe');
                    operationInProgress = false;
                });

                // Backdrop click to close
                backdrop.addEventListener('click', () => {
                    backdrop.remove();
                    modal.remove();
                    updateButtonState(null, 'Autoscribe');
                    operationInProgress = false;
                });

                // Assemble modal
                buttonContainer.appendChild(copyButton);
                buttonContainer.appendChild(closeButton);
                modal.appendChild(title);
                modal.appendChild(info);
                modal.appendChild(textarea);
                modal.appendChild(buttonContainer);

                // Add to page
                document.body.appendChild(backdrop);
                document.body.appendChild(modal);

                // Update button state
                updateButtonState('copied', 'Ready');

                console.log('[Autoscribe] ========================================');
                console.log('[Autoscribe] Autoscribe process completed successfully!');
                console.log('[Autoscribe] Modal displayed with copy button');
                console.log('[Autoscribe] ========================================');

            } catch (error) {
                console.error('[Autoscribe] ========================================');
                console.error('[Autoscribe] ERROR in Autoscribe process:');
                console.error('[Autoscribe]', error.message);
                console.error('[Autoscribe] Stack trace:', error.stack);
                console.error('[Autoscribe] ========================================');

                updateButtonState('error', 'Error');
                alert(`Autoscribe Error: ${error.message}\n\nCheck console for details.`);
                resetButtonAfterDelay(5000);
            }

            // Reset file input
            fileInput.value = '';
        });

        // Button click opens file dialog or settings
        button.addEventListener('click', function(e) {
            // Check if settings icon was clicked
            const settingsIcon = button.querySelector('.settings-icon');
            const clickedSettings = settingsIcon && (e.target === settingsIcon || settingsIcon.contains(e.target));

            if (clickedSettings) {
                console.log('[Autoscribe] Settings icon clicked');
                // Show settings popup
                const autoscribeSettingsPopup = createAutoscribeSettingsPopup();
                autoscribeSettingsPopup.backdrop.style.display = 'block';
                autoscribeSettingsPopup.popup.style.display = 'block';
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            if (operationInProgress) {
                console.log('[Autoscribe] Operation in progress, ignoring click...');
                return;
            }

            console.log('[Autoscribe] Button clicked, opening file dialog...');
            fileInput.click();
        });

        console.log('[Autoscribe] Button created successfully');
        return button;
    }

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
        textEditor.dispatchEvent(new Event('input', { bubbles: true }));
        textEditor.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Resize textarea to fit new content
        resizeTextareaToFit(textEditor);
        
        // Force layout recalculation
        void textEditor.offsetHeight;

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
    let currentInteractivePopup = null;
    let declinedNumbers = new Set(); // Track numbers user said "no" to on this page

    function computeRuleReplacement(rule, match) {
        if (!rule || !match) {
            return match ? match[0] : '';
        }

        if (typeof rule.replace === 'function') {
            try {
                return rule.replace.apply(null, [...match, match.index, match.input, match.groups || undefined]);
            } catch (error) {
                console.log('Interactive replace function failed:', error);
                return match[0];
            }
        }

        if (typeof rule.replace === 'string') {
            let jsReplacement = rule.replace.replace(/(?<!\\)\\(\d+)/g, '$$$1');

            const replacements = {
                '$$': '$',
                '$&': match[0]
            };

            jsReplacement = jsReplacement.replace(/\$\$|\$&|\$(\d+)/g, (token, index) => {
                if (token === '$$' || token === '$&') {
                    return replacements[token];
                }
                const groupValue = match[Number(index)] ?? '';
                return groupValue;
            });

            return jsReplacement;
        }

        return match[0];
    }

    function prepareRegexPattern(rule) {
        if (!rule || !rule.find) return null;

        let processedFind = rule.find;
        let processedFlags = rule.flags || 'g';

        if (!processedFlags.includes('g')) {
            processedFlags += 'g';
        }

        if (rule.enhancedBoundary && processedFlags.includes('e')) {
            processedFlags = processedFlags.replace(/e/g, '');
            const boundaryChars = '[\\s\\[\\]\\(\\),.!?;:"\'`~@#$%^&*+={}|<>/—–-]';
            const startBoundary = `(?<=^|${boundaryChars})`;
            const endBoundary = `(?=${boundaryChars}|$)`;

            if (processedFind.includes('\\b')) {
                processedFind = processedFind
                    .replace(/^\\b/, startBoundary)
                    .replace(/\\b$/, endBoundary)
                    .replace(/\\b/g, `(?<=${boundaryChars}|^)(?=${boundaryChars}|$)`);
            } else {
                processedFind = `${startBoundary}${processedFind}${endBoundary}`;
            }
        }

        try {
            return new RegExp(processedFind, processedFlags);
        } catch (error) {
            console.log(`Failed to prepare regex for rule "${rule.description || rule.find}":`, error);
            return null;
        }
    }

    function findInteractiveMatches(text, rule) {
        if (!text || !rule) return [];

        if (typeof rule.collectMatches === 'function') {
            try {
                const customMatches = rule.collectMatches(text) || [];
                return customMatches
                    .map(match => ({
                        original: match.original ?? match.match ?? match.text ?? '',
                        replacement: match.replacement ?? match.converted ?? match.value ?? '',
                        position: typeof match.position === 'number' ? match.position : (typeof match.index === 'number' ? match.index : -1),
                        uid: match.uid,
                        rule: rule,
                        metadata: match
                    }))
                    .filter(match => match.position >= 0 && match.original && match.replacement && match.original !== match.replacement);
            } catch (error) {
                console.log('Custom interactive match collector failed:', error);
                return [];
            }
        }

        const regex = prepareRegexPattern(rule);
        if (!regex) return [];

        const matches = [];
        let execResult;
        while ((execResult = regex.exec(text)) !== null) {
            const replacement = computeRuleReplacement(rule, execResult);
            if (replacement !== execResult[0]) {
                matches.push({
                    original: execResult[0],
                    replacement: replacement,
                    position: execResult.index,
                    rule: rule,
                    metadata: { groups: execResult.slice(1), input: execResult.input }
                });
            }

            if (execResult.index === regex.lastIndex) {
                regex.lastIndex++;
            }
        }

        return matches;
    }

    // Helper function to resize textarea to fit content
    function resizeTextareaToFit(textarea) {
        if (textarea.tagName === 'TEXTAREA') {
            // Store current style
            const currentHeight = textarea.style.height;
            const currentOverflow = textarea.style.overflow;
            
            // Hide scrollbar temporarily
            textarea.style.overflow = 'hidden';
            
            // Reset height to auto to get proper scrollHeight
            textarea.style.height = 'auto';
            
            // Set to scrollHeight + small buffer to accommodate all content
            textarea.style.height = (textarea.scrollHeight + 2) + 'px';
            
            // Restore overflow
            textarea.style.overflow = currentOverflow || '';
            
            // Force a reflow
            void textarea.offsetHeight;
            
            // For Firefox, also trigger on next frame
            requestAnimationFrame(() => {
                textarea.style.height = 'auto';
                textarea.style.height = (textarea.scrollHeight + 2) + 'px';
                void textarea.offsetHeight;
            });
        }
    }

    function applyInteractiveChange(textEditor, match) {
        if (!textEditor || !match) return false;

        if (textEditor.tagName === 'TEXTAREA' || textEditor.tagName === 'INPUT') {
            const value = textEditor.value;
            const textAtPosition = value.slice(match.position, match.position + match.original.length);
            if (textAtPosition !== match.original) {
                console.warn('Interactive match mismatch at position', match.position, 'expected:', match.original, 'found:', textAtPosition);
                return false;
            }

            const before = value.slice(0, match.position);
            const after = value.slice(match.position + match.original.length);
            const newValue = before + match.replacement + after;

            textEditor.value = newValue;
            textEditor.dispatchEvent(new Event('input', { bubbles: true }));
            textEditor.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Resize textarea to fit new content
            resizeTextareaToFit(textEditor);
            
            // Force layout recalculation
            void textEditor.offsetHeight;
            return true;
        }

        if (textEditor.isContentEditable) {
            const content = textEditor.textContent || '';
            const textAtPosition = content.slice(match.position, match.position + match.original.length);
            if (textAtPosition !== match.original) {
                console.warn('Interactive match mismatch at position', match.position, 'expected:', match.original, 'found:', textAtPosition);
                return false;
            }

            const before = content.slice(0, match.position);
            const after = content.slice(match.position + match.original.length);
            const newContent = before + match.replacement + after;

            textEditor.textContent = newContent;
            textEditor.dispatchEvent(new Event('input', { bubbles: true }));
            textEditor.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Force layout recalculation
            void textEditor.offsetHeight;
            return true;
        }

        return false;
    }

    function findCurrentMatchPosition(textEditor, match, hasChanges) {
        if (!textEditor || !match) return -1;

        let text;
        if (textEditor.tagName === 'TEXTAREA' || textEditor.tagName === 'INPUT') {
            text = textEditor.value;
        } else if (textEditor.isContentEditable) {
            text = textEditor.innerText || textEditor.textContent;
        }

        if (!text) return -1;

        if (!hasChanges) {
            const textAtPosition = text.slice(match.position, match.position + match.original.length);
            if (textAtPosition === match.original) {
                return match.position;
            }
        }

        const searchStart = Math.max(0, match.position - 100);
        const searchEnd = Math.min(text.length, match.position + 100);
        const searchArea = text.slice(searchStart, searchEnd);
        const escaped = match.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped);
        const localMatch = regex.exec(searchArea);
        if (localMatch) {
            return searchStart + localMatch.index;
        }

        const fullMatch = regex.exec(text);
        if (fullMatch) {
            return fullMatch.index;
        }

        return -1;
    }
    function showInteractiveFixPopup(textEditor, match, handlers, context = {}) {
        const { onYes, onNo, onNoToAll } = handlers || {};
        const { groupMatches, allMatches } = context;

        cleanupCurrentInteractivePopup();
        
        // Determine if we're in grouped mode: check if groupMatches exists and has multiple items
        const isGroupedMode = groupMatches && groupMatches.length > 1;
        
        // Highlight all matches: grouped matches (priority), all remaining matches, or just the single match
        const matches = groupMatches || allMatches || [match];
        const sortedMatches = textEditor._highlightState?.matches || [...matches].sort((a, b) => a.position - b.position);
        const highlightState = textEditor._highlightState || {};

        let currentMatchIndex = sortedMatches.findIndex(m => (m === match) || (m.position === match.position && m.original === match.original));
        if (currentMatchIndex === -1) {
            currentMatchIndex = 0;
        }

        const previousState = textEditor._highlightState || {};
        textEditor._highlightState = {
            matches: sortedMatches.map(m => ({
                position: m.position,
                original: m.original,
                replacement: m.replacement,
                ruleId: m.rule?.id || m.rule?.description || 'unknown'
            })),
            currentMatchIndex,
            mode: isGroupedMode ? 'grouped' : 'sequential'
        };

        highlightInteractiveMatch(textEditor, match, matches);

        const popup = document.createElement('div');
        popup.id = 'interactive-fix-popup';
        popup.style.cssText = `
            position: absolute;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(8px);
            border-radius: 8px;
            padding: 12px 16px;
            z-index: 2;
            font-family: 'Programme', Arial, sans-serif;
            min-width: 200px;
            max-width: 320px;
            max-height: 400px;
            overflow-y: auto;
        `;

        const question = document.createElement('div');
        question.style.cssText = `
            margin-bottom: 10px;
            font-size: 13px;
            color: #fff;
            font-weight: 300;
        `;

        const escapeHTML = (value) => {
            if (typeof value !== 'string') return '';
            return value
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        };

        // Build question text based on whether we're showing a group or single match
        let questionText;
        if (isGroupedMode) {
            // Show summary for multiple matches in group
            questionText = `Apply <strong style="color: #4ee153;">${sortedMatches.length} changes</strong> for this rule?`;
            
            // Add a preview of the changes
            const changesPreview = sortedMatches.slice(0, 5).map(m => {
                return `<div style="margin: 4px 0; font-size: 11px; padding: 4px; background: rgba(255,255,255,0.05); border-radius: 3px;">
                    <strong style="color: #ffeb3b;">${escapeHTML(m.original)}</strong> → <strong style="color: #4ee153;">${escapeHTML(m.replacement)}</strong>
                </div>`;
            }).join('');
            
            const moreCount = sortedMatches.length > 5 ? `<div style="margin: 4px 0; font-size: 11px; color: rgba(255,255,255,0.6);">...and ${sortedMatches.length - 5} more</div>` : '';
            
            questionText += `<div style="margin-top: 8px;">${changesPreview}${moreCount}</div>`;
        } else {
            // Single match question
            questionText = typeof match.rule?.formatQuestion === 'function'
                ? match.rule.formatQuestion(match)
                : `Apply change <strong style="color: #ffeb3b;">${escapeHTML(match.original)}</strong> → <strong style="color: #4ee153;">${escapeHTML(match.replacement)}</strong>?`;
        }

        const descriptionText = match.rule?.description
            ? `<div style="margin-top: 6px; font-size: 11px; color: rgba(255,255,255,0.7); font-weight: 200;">Rule: ${escapeHTML(match.rule.description)}</div>`
            : '';

        question.innerHTML = `${questionText}${descriptionText}`;

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 6px;
            justify-content: flex-start;
        `;

        const yesBtn = document.createElement('button');
        yesBtn.textContent = isGroupedMode 
            ? `Yes to all ${sortedMatches.length} (Enter)` 
            : 'Yes (Enter)';
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
        noBtn.textContent = isGroupedMode 
            ? `No to all ${sortedMatches.length} (Esc)` 
            : 'No (Esc)';
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

        let noToAllBtn = null;
        // Show "No to all" button only if:
        // 1. We have the onNoToAll handler
        // 2. We're NOT in grouped mode (where "No" already declines all matches in the group)
        //    OR we're in grouped mode but there are more groups after this one
        const shouldShowNoToAll = onNoToAll && (!isGroupedMode || (context.totalGroups && context.currentGroup < context.totalGroups - 1));
        
        if (shouldShowNoToAll) {
            const remainingCount = Math.max(1, (context.totalMatches || 0) - (context.currentIndex || 0));
            noToAllBtn = document.createElement('button');
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
        }

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

        if (noToAllBtn) {
            noToAllBtn.addEventListener('mouseenter', () => {
                noToAllBtn.style.background = 'rgba(244, 67, 54, 1)';
            });
            noToAllBtn.addEventListener('mouseleave', () => {
                noToAllBtn.style.background = 'rgba(244, 67, 54, 0.9)';
            });
        }

        yesBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            removeInteractiveHighlight(textEditor);
            cleanupCurrentInteractivePopup();
            if (onYes) onYes();
        });

        noBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            removeInteractiveHighlight(textEditor);
            cleanupCurrentInteractivePopup();
            if (onNo) onNo();
        });

        if (noToAllBtn) {
            noToAllBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                removeInteractiveHighlight(textEditor);
                cleanupCurrentInteractivePopup();
                onNoToAll();
            });
        }

        const keyHandler = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                removeInteractiveHighlight(textEditor);
                cleanupCurrentInteractivePopup();
                if (onYes) onYes();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                removeInteractiveHighlight(textEditor);
                cleanupCurrentInteractivePopup();
                if (onNo) onNo();
            }
        };

        document.addEventListener('keydown', keyHandler);

        buttonContainer.appendChild(yesBtn);
        buttonContainer.appendChild(noBtn);
        if (noToAllBtn) buttonContainer.appendChild(noToAllBtn);
        popup.appendChild(question);
        popup.appendChild(buttonContainer);

        const updatePosition = positionPopupBelowFormatSection(popup);
        window.addEventListener('scroll', updatePosition);
        window.addEventListener('resize', updatePosition);
        textEditor.addEventListener('scroll', updatePosition);
        updatePosition();

        document.body.appendChild(popup);
        currentInteractivePopup = { popup, keyHandler, updatePosition, scrollTarget: textEditor };
    }

    function processInteractiveFixes(textEditor, matches, options = {}) {
        if (!textEditor || !Array.isArray(matches) || matches.length === 0) {
            if (typeof options.onComplete === 'function') {
                options.onComplete();
            }
            return;
        }

        const { onAccept, onDecline, onDeclineAll, onComplete } = options;
        const queue = matches.map(match => ({ ...match }));
        const allowNoToAll = typeof onDeclineAll === 'function';

        // Check if we should group by rule
        const shouldGroupByRule = autoFixSettings.groupFixesByRule;
        
        if (shouldGroupByRule) {
            // Group matches by rule
            const ruleGroups = new Map();
            queue.forEach(match => {
                const ruleId = match.rule?.id || match.rule?.description || 'unknown';
                if (!ruleGroups.has(ruleId)) {
                    ruleGroups.set(ruleId, []);
                }
                ruleGroups.get(ruleId).push(match);
            });
            
            // Convert to array of groups
            const groups = Array.from(ruleGroups.values());
            
            const stepGroup = (groupIndex) => {
                if (groupIndex >= groups.length) {
                    console.log('Interactive fixes completed');
                    if (typeof onComplete === 'function') {
                        onComplete();
                    }
                    return;
                }
                
                const group = groups[groupIndex];
                
                // Update positions for all matches in group
                const validMatches = [];
                for (let i = 0; i < group.length; i++) {
                    const match = group[i];
                    const position = findCurrentMatchPosition(textEditor, match, i > 0);
                    if (position !== -1) {
                        validMatches.push({ ...match, position });
                    } else {
                        console.log('Interactive match not found, skipping:', match.original);
                    }
                }
                
                if (validMatches.length === 0) {
                    stepGroup(groupIndex + 1);
                    return;
                }
                
                // Show popup for the group (with first match as primary)
                showInteractiveFixPopup(textEditor, validMatches[0], {
                    onYes: () => {
                        // Apply all matches in this group
                        let cumulativeLengthDiff = 0;
                        validMatches.forEach((currentMatch, idx) => {
                            // Adjust position based on previous changes
                            const adjustedMatch = { ...currentMatch, position: currentMatch.position + cumulativeLengthDiff };
                            const applied = applyInteractiveChange(textEditor, adjustedMatch);
                            if (applied) {
                                if (typeof onAccept === 'function') {
                                    onAccept(adjustedMatch);
                                }
                                const lengthDiff = adjustedMatch.replacement.length - adjustedMatch.original.length;
                                cumulativeLengthDiff += lengthDiff;
                                
                                // Update positions of subsequent matches in the group
                                for (let i = idx + 1; i < validMatches.length; i++) {
                                    if (validMatches[i].position > currentMatch.position) {
                                        validMatches[i].position += lengthDiff;
                                    }
                                }
                                
                                // Update positions of matches in subsequent groups
                                for (let gi = groupIndex + 1; gi < groups.length; gi++) {
                                    groups[gi].forEach(m => {
                                        if (m.position > currentMatch.position) {
                                            m.position += lengthDiff;
                                        }
                                    });
                                }
                            }
                        });
                        
                        stepGroup(groupIndex + 1);
                    },
                    onNo: () => {
                        // Decline all matches in this group
                        validMatches.forEach(currentMatch => {
                            if (typeof onDecline === 'function') {
                                onDecline(currentMatch);
                            }
                        });
                        stepGroup(groupIndex + 1);
                    },
                    onNoToAll: allowNoToAll ? () => {
                        // Decline all remaining matches in all remaining groups
                        const remainingMatches = [];
                        for (let gi = groupIndex; gi < groups.length; gi++) {
                            remainingMatches.push(...groups[gi]);
                        }
                        if (typeof onDeclineAll === 'function') {
                            onDeclineAll(remainingMatches);
                        }
                        if (typeof onComplete === 'function') {
                            onComplete();
                        }
                    } : null
                }, {
                    totalMatches: queue.length,
                    currentIndex: groups.slice(0, groupIndex).reduce((sum, g) => sum + g.length, 0),
                    groupMatches: validMatches,
                    totalGroups: groups.length,
                    currentGroup: groupIndex
                });
            };
            
            stepGroup(0);
        } else {
            // Original behavior: one match at a time
            const step = (currentIndex) => {
                if (currentIndex >= queue.length) {
                    console.log('Interactive fixes completed');
                    if (typeof onComplete === 'function') {
                        onComplete();
                    }
                    return;
                }

                const match = queue[currentIndex];
                const position = findCurrentMatchPosition(textEditor, match, currentIndex > 0);
                if (position === -1) {
                    console.log('Interactive match not found, skipping:', match.original);
                    step(currentIndex + 1);
                    return;
                }

                const currentMatch = { ...match, position };
                
                // Collect all remaining matches for highlighting (including current)
                const allRemainingMatches = [];
                for (let i = currentIndex; i < queue.length; i++) {
                    const m = queue[i];
                    const pos = findCurrentMatchPosition(textEditor, m, i > currentIndex);
                    if (pos !== -1) {
                        allRemainingMatches.push({ ...m, position: pos });
                    }
                }

                showInteractiveFixPopup(textEditor, currentMatch, {
                    onYes: () => {
                        const applied = applyInteractiveChange(textEditor, currentMatch);
                        if (applied && typeof onAccept === 'function') {
                            onAccept(currentMatch);
                        }

                        if (applied) {
                            const lengthDiff = currentMatch.replacement.length - currentMatch.original.length;
                            for (let i = currentIndex + 1; i < queue.length; i++) {
                                if (queue[i].position > currentMatch.position) {
                                    queue[i].position += lengthDiff;
                                }
                            }
                        }

                        step(currentIndex + 1);
                    },
                    onNo: () => {
                        if (typeof onDecline === 'function') {
                            onDecline(currentMatch);
                        }
                        step(currentIndex + 1);
                    },
                    onNoToAll: allowNoToAll ? () => {
                        if (typeof onDeclineAll === 'function') {
                            onDeclineAll(queue.slice(currentIndex));
                        }
                        if (typeof onComplete === 'function') {
                            onComplete();
                        }
                    } : null
                }, {
                    totalMatches: queue.length,
                    currentIndex,
                    allMatches: allRemainingMatches
                });
            };

            step(0);
        }
    }

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

        const numberRule = {
            id: 'numberToText',
            description: 'Convert numbers to text',
            formatQuestion: (match) => `Convert <strong style="color: #ffeb3b;">${match.original}</strong> to <strong style="color: #4ee153;">${match.replacement}</strong>?`
        };

        const matches = convertibleNumbers.map(item => ({
            original: item.original,
            replacement: item.converted,
            position: item.position,
            uid: item.uid,
            rule: numberRule
        }));

        processInteractiveFixes(textEditor, matches, {
            onDecline: (match) => {
                if (match.uid) {
                    declinedNumbers.add(match.uid);
                    saveDeclinedNumbers();
                    console.log('Added to declined numbers:', match.uid);
                }
            },
            onDeclineAll: (remainingMatches) => {
                remainingMatches.forEach(item => {
                    if (item.uid) {
                        declinedNumbers.add(item.uid);
                        console.log('Declined (no to all):', item.original, 'UID:', item.uid);
                    }
                });
                saveDeclinedNumbers();
            }
        });
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
            // Extra check: make sure this match is not part of a longer number (like finding "2" in "2014")
            // Check if there's a digit immediately before or after
            const beforeChar = match.index > 0 ? originalText[match.index - 1] : '';
            const afterChar = match.index + numberText.length < originalText.length ? originalText[match.index + numberText.length] : '';
            
            // Skip if it's part of a longer number (would have been protected)
            if (/\d/.test(beforeChar) || /\d/.test(afterChar)) {
                continue;
            }
            
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

                    // Create a temporary span to get the exact position
                    const span = document.createElement('span');
                    span.textContent = '\u200B'; // Zero-width space
                    range.insertNode(span);

                    // Scroll the span into view
                    span.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });

                    // Remove the span
                    span.parentNode.removeChild(span);

                    // Normalize the text node after removing the span
                    if (targetNode.parentNode) {
                        targetNode.parentNode.normalize();
                    }

                    // Set selection to the range
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                } catch (e) {
                    console.log('Range scrolling failed, using fallback:', e);
                    // Use instant scroll
                    textEditor.scrollIntoView({ behavior: 'auto', block: 'center' });
                }
            } else {
                // Fallback: scroll the editor into view with instant scroll
                textEditor.scrollIntoView({ behavior: 'auto', block: 'center' });
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
    function highlightInteractiveMatch(textEditor, match, allMatches = null) {
        // Support both single match and multiple matches
        const matches = allMatches || [match];
        const sortedMatches = [...matches].sort((a, b) => a.position - b.position);

        let currentMatchIndex = sortedMatches.findIndex(m => (m === match) || (m.position === match.position && m.original === match.original));
        if (currentMatchIndex === -1) {
            currentMatchIndex = 0;
        }

        const isGroupedMode = autoFixSettings.groupFixesByRule &&
                              sortedMatches.length > 1 &&
                              sortedMatches.every(m => (m.rule?.id || m.rule?.description) === (match.rule?.id || match.rule?.description));

        // Scroll to the conversion position first (scroll to the first/current match)
        scrollToPosition(textEditor, match.position);

        if (textEditor.tagName === 'TEXTAREA' || textEditor.tagName === 'INPUT') {
            // For textarea/input we create a temporary overlay to highlight characters
            // Store the original selection for restoration
            textEditor._originalSelectionStart = textEditor.selectionStart;
            textEditor._originalSelectionEnd = textEditor.selectionEnd;

            textEditor.focus();

            // Create highlight overlay
            const parent = textEditor.parentElement;
            if (parent && (parent.style.position === '' || parent.style.position === 'static')) {
                parent.style.position = 'relative';
            }

            const overlay = document.createElement('div');
            overlay.dataset.interactiveHighlightOverlay = 'true';
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

            const buildHighlightHTML = (text) => {
                let htmlParts = [];
                let cursor = 0;

                // Find current positions of all matches in the (possibly modified) text
                const currentMatchPositions = [];
                sortedMatches.forEach((m, idx) => {
                    // Search for this match starting from the cursor
                    const foundIndex = text.indexOf(m.original, cursor);
                    if (foundIndex !== -1) {
                        currentMatchPositions.push({
                            idx,
                            match: m,
                            startPos: foundIndex,
                            endPos: foundIndex + m.original.length
                        });
                        cursor = foundIndex + 1; // Move cursor forward but allow overlaps if needed
                    }
                });

                // Reset cursor for building HTML
                cursor = 0;

                currentMatchPositions.forEach((posInfo) => {
                    const { idx, match: m, startPos, endPos } = posInfo;

                    if (startPos > cursor) {
                        htmlParts.push(escapeHTML(text.slice(cursor, startPos)));
                    }

                    const segment = text.slice(startPos, endPos);
                    const isCurrent = (m === match) || (m.position === match.position && m.original === match.original);
                    const highlightStyle = isGroupedMode
                        ? (isCurrent
                            ? 'background:#ff5252;color:white'
                            : 'background:rgba(255, 82, 82, 0.85);color:white')
                        : (isCurrent
                            ? 'background:#ff5252;color:white'
                            : 'background:rgba(255, 235, 59, 0.5);color:#333');

                    htmlParts.push(`<span data-interactive-highlight="true" data-match-index="${idx}" style="${highlightStyle}">${escapeHTML(segment)}</span>`);
                    cursor = endPos;
                });

                if (cursor < text.length) {
                    htmlParts.push(escapeHTML(text.slice(cursor)));
                }

                return htmlParts.join('');
            };

            overlay.innerHTML = buildHighlightHTML(textEditor.value);

            parent.appendChild(overlay);

            // Keep overlay in sync with textarea scroll
            const syncOverlay = () => {
                overlay.scrollTop = textEditor.scrollTop;
                overlay.scrollLeft = textEditor.scrollLeft;
            };
            textEditor.addEventListener('scroll', syncOverlay);
            syncOverlay();

            // Update overlay position and size on resize
            const updateOverlayPosition = () => {
                overlay.style.left = textEditor.offsetLeft + 'px';
                overlay.style.top = textEditor.offsetTop + 'px';
                overlay.style.width = textEditor.offsetWidth + 'px';
                overlay.style.height = textEditor.offsetHeight + 'px';
                syncOverlay();
            };
            
            // Use ResizeObserver for better resize detection
            let resizeObserver = null;
            if (typeof ResizeObserver !== 'undefined') {
                resizeObserver = new ResizeObserver(() => {
                    updateOverlayPosition();
                });
                resizeObserver.observe(textEditor);
            }
            
            // Fallback to window resize event
            window.addEventListener('resize', updateOverlayPosition);

            // Update overlay content when user types
            const updateOverlay = () => {
                overlay.innerHTML = buildHighlightHTML(textEditor.value);
                syncOverlay();
            };
            textEditor.addEventListener('input', updateOverlay);

            textEditor._highlightOverlay = overlay;
            textEditor._overlayScrollHandler = syncOverlay;
            textEditor._overlayResizeHandler = updateOverlayPosition;
            textEditor._overlayResizeObserver = resizeObserver;
            textEditor._inputHandler = updateOverlay;
            textEditor.classList.add('genius-highlighting-active');

            // Save original spellcheck state and disable it (to prevent misplaced red lines)
            textEditor._originalSpellcheck = textEditor.spellcheck;
            textEditor.spellcheck = false;

            // Make the original text transparent so only the overlay is visible
            textEditor.style.color = 'transparent';
            textEditor.style.caretColor = '#000'; // Keep cursor visible

            textEditor._highlightInfo = { overlay, handler: syncOverlay, inputHandler: updateOverlay };

        } else if (textEditor.isContentEditable) {
            // For contenteditable, wrap all matches in spans
            const originalHTML = textEditor.innerHTML;

            const buildHighlightedHTML = (sourceText) => {
                const sortedMatches = [...matches].sort((a, b) => a.position - b.position);
                let htmlParts = [];
                let cursor = 0;

                // Find current positions of all matches in the (possibly modified) text
                const currentMatchPositions = [];
                sortedMatches.forEach((m, idx) => {
                    // Search for this match starting from the cursor
                    const foundIndex = sourceText.indexOf(m.original, cursor);
                    if (foundIndex !== -1) {
                        currentMatchPositions.push({
                            idx,
                            match: m,
                            startPos: foundIndex,
                            endPos: foundIndex + m.original.length
                        });
                        cursor = foundIndex + 1; // Move cursor forward but allow overlaps if needed
                    }
                });

                // Reset cursor for building HTML
                cursor = 0;

                currentMatchPositions.forEach((posInfo) => {
                    const { idx, match: m, startPos, endPos } = posInfo;

                    if (startPos > cursor) {
                        htmlParts.push(sourceText.slice(cursor, startPos));
                    }

                    const segment = sourceText.slice(startPos, endPos);
                    const isCurrent = (m === match) || (m.position === match.position && m.original === match.original);
                    const highlightStyle = isGroupedMode
                        ? (isCurrent
                            ? 'background-color: #ff5252; color: white; padding: 1px 2px; border-radius: 2px;'
                            : 'background-color: rgba(255, 82, 82, 0.85); color: white; padding: 1px 2px; border-radius: 2px;')
                        : (isCurrent
                            ? 'background-color: #ff5252; color: white; padding: 1px 2px; border-radius: 2px;'
                            : 'background-color: rgba(255, 235, 59, 0.5); color: #333; padding: 1px 2px; border-radius: 2px;');

                    htmlParts.push(`<span style="${highlightStyle}" data-interactive-highlight="true" data-match-index="${idx}">${segment}</span>`);
                    cursor = endPos;
                });

                if (cursor < sourceText.length) {
                    htmlParts.push(sourceText.slice(cursor));
                }

                return htmlParts.join('');
            };

            const textContent = textEditor.textContent || textEditor.innerText || '';
            textEditor._originalHTML = originalHTML;
            textEditor._originalTextContent = textContent;

            const highlightedHTML = buildHighlightedHTML(textContent);
            textEditor.innerHTML = highlightedHTML;

        const highlightSpans = textEditor.querySelectorAll('[data-interactive-highlight="true"]');
        if (highlightSpans.length > 0) {
            const currentSpan = highlightSpans[currentMatchIndex] || highlightSpans[0];
            currentSpan.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }

            const inputHandler = () => {
                const newText = textEditor.textContent || '';
                textEditor.innerHTML = buildHighlightedHTML(newText);
            };
            textEditor.addEventListener('input', inputHandler);
            textEditor._contentEditableInputHandler = inputHandler;
        }
    }
    function removeInteractiveHighlight(textEditor) {
        console.log('removeInteractiveHighlight called for:', textEditor?.tagName);

        // Global cleanup - remove any highlight overlays in the entire document
        const allOverlays = document.querySelectorAll('[data-interactive-highlight-overlay="true"]');
        allOverlays.forEach(overlay => {
            console.log('Removing global highlight overlay');
            overlay.remove();
        });

        // Global cleanup - remove any highlight spans in contenteditable
        const allHighlightSpans = document.querySelectorAll('[data-interactive-highlight="true"]');
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
            
            // Restore original spellcheck state
            if (textEditor._originalSpellcheck !== undefined) {
                textEditor.spellcheck = textEditor._originalSpellcheck;
                delete textEditor._originalSpellcheck;
            }

            if (textEditor._overlayScrollHandler) {
                textEditor.removeEventListener('scroll', textEditor._overlayScrollHandler);
                delete textEditor._overlayScrollHandler;
            }
            
            if (textEditor._overlayResizeHandler) {
                window.removeEventListener('resize', textEditor._overlayResizeHandler);
                delete textEditor._overlayResizeHandler;
            }
            
            if (textEditor._overlayResizeObserver) {
                textEditor._overlayResizeObserver.disconnect();
                delete textEditor._overlayResizeObserver;
            }
            
            if (textEditor._inputHandler) {
                textEditor.removeEventListener('input', textEditor._inputHandler);
                delete textEditor._inputHandler;
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

            if (textEditor._highlightState) {
                delete textEditor._highlightState;
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
            const remainingSpans = textEditor.querySelectorAll('[data-interactive-highlight="true"]');
            remainingSpans.forEach(span => {
                console.log('Removing remaining highlight span from contenteditable');
                const parent = span.parentNode;
                if (parent) {
                    parent.replaceChild(document.createTextNode(span.textContent), span);
                }
            });

            if (textEditor._contentEditableInputHandler) {
                textEditor.removeEventListener('input', textEditor._contentEditableInputHandler);
                delete textEditor._contentEditableInputHandler;
            }

            if (textEditor._highlightState) {
                delete textEditor._highlightState;
            }
        }

        console.log('Number highlight cleanup completed');
    }

    function cleanupCurrentInteractivePopup() {
        if (currentInteractivePopup && currentInteractivePopup.popup) {
            const { popup, keyHandler, updatePosition, scrollTarget } = currentInteractivePopup;
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
            currentInteractivePopup = null;
        }
    }

    function positionPopupNearHighlight(popup, textEditor, match) {
        const updatePosition = () => {
            // Find the highlight element
            const highlightSpan = textEditor.querySelector ?
                textEditor.querySelector('span[style*="background-color: rgba(255, 235, 59"]') : null;

            let targetRect = null;

            if (highlightSpan) {
                // Use the highlighted span's position
                targetRect = highlightSpan.getBoundingClientRect();
            } else if (textEditor.tagName === 'TEXTAREA' || textEditor.tagName === 'INPUT') {
                // For textarea, approximate position based on cursor
                const textEditorRect = textEditor.getBoundingClientRect();
                const styles = window.getComputedStyle(textEditor);
                const lineHeight = parseInt(styles.lineHeight) || parseInt(styles.fontSize) * 1.2 || 20;

                // Get text up to match position
                const textUpToMatch = textEditor.value.slice(0, match.position);
                const lines = textUpToMatch.split('\n');
                const currentLine = lines.length - 1;

                // Calculate approximate position
                targetRect = {
                    left: textEditorRect.left + 10,
                    right: textEditorRect.right - 10,
                    top: textEditorRect.top + (currentLine * lineHeight) - textEditor.scrollTop + 10,
                    bottom: textEditorRect.top + ((currentLine + 1) * lineHeight) - textEditor.scrollTop + 10,
                    width: textEditorRect.width - 20,
                    height: lineHeight
                };
            } else {
                // Fallback to editor position
                targetRect = textEditor.getBoundingClientRect();
            }

            if (targetRect) {
                popup.style.position = 'fixed';

                // Calculate position - try to place below the highlight
                let top = targetRect.bottom + 10;
                let left = targetRect.left;

                // Check if popup would go off-screen at the bottom
                const popupHeight = popup.offsetHeight || 150; // estimated height
                if (top + popupHeight > window.innerHeight) {
                    // Place above instead
                    top = targetRect.top - popupHeight - 10;
                }

                // Check if popup would go off-screen on the right
                const popupWidth = popup.offsetWidth || 320;
                if (left + popupWidth > window.innerWidth) {
                    left = window.innerWidth - popupWidth - 10;
                }

                // Ensure it's not off-screen on the left
                left = Math.max(10, left);
                // Ensure it's not off-screen at the top
                top = Math.max(10, top);

                popup.style.left = left + 'px';
                popup.style.top = top + 'px';
                popup.style.maxWidth = Math.min(320, window.innerWidth - 20) + 'px';
            } else {
                // Final fallback - center on screen
                popup.style.position = 'fixed';
                popup.style.left = '50%';
                popup.style.top = '50%';
                popup.style.transform = 'translate(-50%, -50%)';
                popup.style.maxWidth = '320px';
            }
        };

        return updatePosition;
    }

    function positionPopupBelowFormatSection(popup) {
        const controlsContainer = document.querySelector('[class*="LyricsEdit-desktop__Controls-sc-"]') ||
                                 document.querySelector('[class*="LyricsEdit-desktop__Controls"]') ||
                                 document.querySelector('[class*="LyricsEdit"][class*="Controls"]') ||
                                 document.querySelector('[class*="lyrics-edit"][class*="controls"]') ||
                                 document.querySelector('.ihioQH');

        // Look for the find/replace container first
        const findReplaceContainer = document.getElementById('genius-find-replace-container');

        // Look for lyricsSectionsButtonsContainer or LyricsEditExplainer
        const lyricsSectionsContainer = document.getElementById('lyricsSectionsButtonsContainer');
        const lyricsExplainer = controlsContainer && (controlsContainer.querySelector('[class*="LyricsEditExplainer__Container"]') ||
                                   controlsContainer.querySelector('[class*="LyricsEditExplainer"]'));

        const updatePosition = () => {
            // Position below find/replace but above lyricsSectionsContainer or LyricsEditExplainer
            if (findReplaceContainer) {
                const findReplaceRect = findReplaceContainer.getBoundingClientRect();
                const controlsRect = controlsContainer ? controlsContainer.getBoundingClientRect() : findReplaceRect;
                popup.style.position = 'fixed';
                popup.style.left = controlsRect.left + 'px';
                popup.style.top = (findReplaceRect.bottom + 10) + 'px';
                popup.style.maxWidth = (controlsRect.width - 20) + 'px';
            }
            // Try positioning above lyricsSectionsContainer
            else if (lyricsSectionsContainer && controlsContainer) {
                const sectionsRect = lyricsSectionsContainer.getBoundingClientRect();
                const containerRect = controlsContainer.getBoundingClientRect();
                popup.style.position = 'fixed';
                popup.style.left = containerRect.left + 'px';
                popup.style.top = (sectionsRect.top - 100) + 'px'; // Position above it
                popup.style.maxWidth = (containerRect.width - 20) + 'px';
            }
            // Try positioning above LyricsEditExplainer
            else if (lyricsExplainer && controlsContainer) {
                const explainerRect = lyricsExplainer.getBoundingClientRect();
                const containerRect = controlsContainer.getBoundingClientRect();
                popup.style.position = 'fixed';
                popup.style.left = containerRect.left + 'px';
                popup.style.top = (explainerRect.top - 100) + 'px'; // Position above it
                popup.style.maxWidth = (containerRect.width - 20) + 'px';
            }
            // Final fallback
            else {
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
        let textAppliedToEditor = false;

        const applyFixedTextToEditor = () => {
            if (textAppliedToEditor) {
                return;
            }

            if (textEditor.tagName === 'TEXTAREA' || textEditor.tagName === 'INPUT') {
                const cursorPos = textEditor.selectionStart;
                textEditor.value = fixedText;

                const lengthDiff = fixedText.length - text.length;
                textEditor.selectionStart = textEditor.selectionEnd = Math.max(0, cursorPos + lengthDiff);

                // Dispatch multiple events to ensure page responds
                textEditor.dispatchEvent(new Event('input', { bubbles: true }));
                textEditor.dispatchEvent(new Event('change', { bubbles: true }));
                
                // Resize textarea to fit new content
                resizeTextareaToFit(textEditor);
                
                // Force layout recalculation by triggering a reflow
                void textEditor.offsetHeight;
                
                // Scroll to ensure cursor is visible (helps with layout updates)
                textEditor.scrollTop = textEditor.scrollTop;
                
                // Trigger window resize to force page layout recalculation
                window.dispatchEvent(new Event('resize'));
            } else if (textEditor.isContentEditable) {
                const selection = window.getSelection();
                const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

                textEditor.textContent = fixedText;

                if (range) {
                    try {
                        selection.removeAllRanges();
                        selection.addRange(range);
                    } catch (e) {
                        const newRange = document.createRange();
                        newRange.selectNodeContents(textEditor);
                        newRange.collapse(false);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                    }
                }

                textEditor.dispatchEvent(new Event('input', { bubbles: true }));
                textEditor.dispatchEvent(new Event('change', { bubbles: true }));
                
                // Force layout recalculation
                void textEditor.offsetHeight;
                
                // Trigger window resize to force page layout recalculation
                window.dispatchEvent(new Event('resize'));
            }

            textAppliedToEditor = true;
        };

        console.log('Before fixes:', fixedText.substring(0, 100) + '...');

        // Helper function to apply rules from built-in rule groups by tag
        const applyRulesByTag = (tag, enabled, contextLabel) => {
            if (!enabled) return;
            
            console.log(`Applying rules with tag "${tag}" from built-in groups...`);
            
            // Find all rules with the specified tag from built-in rule groups
            const rulesToApply = [];
            if (autoFixSettings.ruleGroups) {
                autoFixSettings.ruleGroups.forEach(group => {
                    // Check if group is built-in AND enabled
                    if (group.isBuiltIn && group.enabled !== false && group.rules) {
                        group.rules.forEach(rule => {
                            // Check if rule has the tag and is not explicitly disabled
                            if (rule.tags && rule.tags.includes(tag) && rule.enabled !== false) {
                                rulesToApply.push({...rule, contextLabel: `${group.title} (built-in)`});
                            }
                        });
                    }
                });
            }
            
            // Apply each rule
            rulesToApply.forEach(rule => {
                try {
                    let processedFind = rule.find;
                    let processedFlags = rule.flags || 'gi';

                    if (rule.enhancedBoundary && processedFlags.includes('e')) {
                        processedFlags = processedFlags.replace(/e/g, '');
                        const boundaryChars = '[\\s\\[\\]\\(\\),.!?;:"\'`~@#$%^&*+={}|<>/—–-]';
                        const startBoundary = `(?<=^|${boundaryChars})`;
                        const endBoundary = `(?=${boundaryChars}|$)`;

                        if (processedFind.includes('\\b')) {
                            processedFind = processedFind
                                .replace(/^\\b/, startBoundary)
                                .replace(/\\b$/, endBoundary)
                                .replace(/\\b/g, `(?<=${boundaryChars}|^)(?=${boundaryChars}|$)`);
                        } else {
                            processedFind = `${startBoundary}${processedFind}${endBoundary}`;
                        }
                    }

                    let replaceValue = rule.replace;
                    if (typeof replaceValue === 'string') {
                        const trimmed = replaceValue.trim();
                        if (trimmed.startsWith('function') || trimmed.startsWith('(')) {
                            try {
                                replaceValue = eval(trimmed);
                            } catch (error) {
                                console.log(`Failed to evaluate replace function for rule "${rule.description}":`, error);
                            }
                        }
                    }

                    const regex = new RegExp(processedFind, processedFlags);
                    
                    if (typeof replaceValue === 'function') {
                        fixedText = fixedText.replace(regex, replaceValue);
                    } else {
                        let jsReplacement = replaceValue;
                        if (typeof jsReplacement === 'string') {
                            jsReplacement = jsReplacement.replace(/(?<!\\)\\(\d+)/g, '$$$1');
                        }
                        fixedText = fixedText.replace(regex, jsReplacement);
                    }
                } catch (e) {
                    console.log(`Rule "${rule.description}" from ${rule.contextLabel} failed:`, e.message);
                }
            });
            
            console.log(`Applied ${rulesToApply.length} rules with tag "${tag}"`);
        };

        // Apply built-in rules (always enabled when customRegex is on)
        if (autoFixSettings.customRegex) {
            applyRulesByTag('capitalization', true, 'Capitalization fixes');
            applyRulesByTag('contractions', true, 'Contraction fixes');
            applyRulesByTag('spelling', true, 'Spelling fixes');
            applyRulesByTag('apostrophes', true, 'Apostrophe fixes');
        }
        
        // Apply punctuation rules (always enabled with customRegex)
        if (autoFixSettings.customRegex) {
            applyRulesByTag('punctuation', true, 'Punctuation fixes');
        }

        // Fix parentheses formatting - move parentheses outside of bold/italic tags
        if (autoFixSettings.parenthesesFormatting) {
            console.log('Starting parentheses fixes...');

        // Helper function to check if a match is an annotation [text](numbers)
        function isAnnotation(fullMatch, offset, string) {
            // Check if the match contains the annotation pattern: ](only digits)
            const annotationPattern = /\]\([^\)]*\d[^\)]*\)(?:<\/[bi]>)?$/;
            if (annotationPattern.test(fullMatch)) {
                // Extract the parenthetical content to verify it's only digits
                const parenContent = fullMatch.match(/\]\(([^\)]+)\)/);
                if (parenContent && /^\d+$/.test(parenContent[1])) {
                    return true;
                }
            }
            return false;
        }

        // Handle nested formatting tags first (e.g., <i><b>(content)</b></i>)
        // This handles cases where we have nested tags with parentheses
        fixedText = fixedText.replace(/<(i|b)><(b|i)>([^<]*?(?:\([^)]*\)[^<]*?)*)<\/\2><\/\1>/gi, function(match, outerTag, innerTag, content, offset, string) {
            // Check if this is an annotation pattern
            if (isAnnotation(match, offset, string)) {
                return match; // Don't modify annotations
            }
            
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
        fixedText = fixedText.replace(/<(b|i)>([^<]*?(?:\([^)]*\)[^<]*?)*)<\/\1>/gi, function(match, tag, content, offset, string) {
            // Check if this is an annotation pattern
            if (isAnnotation(match, offset, string)) {
                return match; // Don't modify annotations
            }
            
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
        fixedText = fixedText.replace(/<(i|b)><(b|i)>\(([^)]*)\)<\/\2><\/\1>/gi, function(match, outerTag, innerTag, content, offset, string) {
            if (isAnnotation(match, offset, string)) {
                return match;
            }
            return `(<${outerTag}><${innerTag}>${content}</${innerTag}></${outerTag}>)`;
        });

        // Handle simple single parenthetical cases
        // Pattern: <b>(content)</b> or <i>(content)</i> -> (<b>content</b>) or (<i>content</i>)
        fixedText = fixedText.replace(/<(b|i)>\(([^)]*)\)<\/\1>/gi, function(match, tag, content, offset, string) {
            if (isAnnotation(match, offset, string)) {
                return match;
            }
            return `(<${tag}>${content}</${tag}>)`;
        });

        // Handle edge case: <i>(content</i>) -> (<i>content</i>)
        // Pattern: tag starts with parenthesis but closing parenthesis is outside the tag
        fixedText = fixedText.replace(/<(b|i)>\(([^<]*)<\/\1>\)/gi, function(match, tag, content, offset, string) {
            if (isAnnotation(match, offset, string)) {
                return match;
            }
            return `(<${tag}>${content}</${tag}>)`;
        });

        // Handle edge case: (<i>content)</i> -> (<i>content</i>)
        // Pattern: opening parenthesis is outside tag but closing parenthesis is inside the tag
        fixedText = fixedText.replace(/\(<(b|i)>([^<]*)\)<\/\1>/gi, function(match, tag, content, offset, string) {
            if (isAnnotation(match, offset, string)) {
                return match;
            }
            return `(<${tag}>${content}</${tag}>)`;
        });

        // Handle edge case: mixed parentheses with tags
        // Pattern: (<i>content</i>) -> (<i>content</i>) (already correct, but clean up any malformed versions)
        // This handles cases like: (<i>text) followed by </i> somewhere else
        fixedText = fixedText.replace(/\(<(b|i)>([^<)]+)\)([^<]*)<\/\1>/gi, function(match, tag, content, afterParen, offset, string) {
            if (isAnnotation(match, offset, string)) {
                return match;
            }
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
            if (isAnnotation(match, offset, string)) {
                return match;
            }
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

        // Fix words ending with dash to em/en dash (only at end of words, not hyphens)
        if (autoFixSettings.emDashFixes) {
            // Get the dash type setting to determine which dash to use
            const dashType = autoFixSettings.dashType || 'em';
            const dashChar = dashType === 'em' ? '—' : '–'; // em dash or en dash

            // Pattern: word followed by dash at end of word boundary
            fixedText = fixedText.replace(/(\w)-(?=\s|$)/g, `$1${dashChar}`);
        }
        // Fix stutter emdashes (e.g., "Ja— ja— ja— ja— ja— jacked" → "Ja-ja-ja-ja-ja-jacked")
        if (autoFixSettings.stutterEmDash) {
            console.log('Fixing stutter emdashes...');

            // Look for patterns where the same word or word fragment is repeated with emdashes
            // Pattern: word— word— ... (final word that starts with same letters)
            // We'll use a more straightforward approach with a function to analyze each potential match

            // First, find all sequences that might be stutter patterns
            // Look for: word— followed by potential repetitions
            fixedText = fixedText.replace(/\b([a-zA-Z]+)—\s*([a-zA-Z]+)(?:—\s*[a-zA-Z]+)*\b/gi, function(match) {
                console.log('Analyzing potential stutter pattern:', match);

                // Split by emdash and clean up whitespace
                const parts = match.split(/—\s*/).map(part => part.trim()).filter(part => part.length > 0);

                if (parts.length < 2) {
                    // Need at least 2 parts for a stutter (base— final)
                    return match;
                }

                const baseWord = parts[0].toLowerCase();
                let isStutterPattern = true;

                // Check if this is a valid stutter pattern
                if (parts.length === 2) {
                    // For 2-part patterns like "I— I" or "Y— you", second part should start with the base word
                    const secondPart = parts[1].toLowerCase();
                    if (!secondPart.startsWith(baseWord)) {
                        isStutterPattern = false;
                    }
                } else {
                    // For 3+ part patterns, check middle parts and final part
                    for (let i = 1; i < parts.length - 1; i++) {
                        // Middle parts should be exactly the same as base word
                        if (parts[i].toLowerCase() !== baseWord) {
                            isStutterPattern = false;
                            break;
                        }
                    }

                    // Final part should start with the base word or be a completion of it
                    const finalPart = parts[parts.length - 1].toLowerCase();
                    if (!finalPart.startsWith(baseWord)) {
                        isStutterPattern = false;
                    }
                }

                // Additional check: make sure there are no spaces in the original pattern
                // (this should be one connected word-like structure)
                if (match.includes(' ') && match.split(' ').length > parts.length) {
                    // If there are more spaces than expected from the emdash splits,
                    // this might be separate words, not a stutter
                    isStutterPattern = false;
                }

                if (isStutterPattern) {
                    console.log('Confirmed stutter pattern, converting:', match);
                    // Convert emdashes to regular dashes and remove extra spaces
                    let converted = parts.join('-');
                    console.log('Converted to:', converted);
                    return converted;
                } else {
                    console.log('Not a stutter pattern, keeping original:', match);
                    return match;
                }
            });
        }

        // Capitalize first letter inside parentheses
        if (autoFixSettings.capitalizeParentheses) {
            console.log('Capitalizing first letter in parentheses...');
            fixedText = fixedText.replace(/(?<!<[^>]*)\(([a-z])/g, function(match, firstChar) {
                return '(' + firstChar.toUpperCase();
            });
        }

        // Apply formatting rules (spacing)
        if (autoFixSettings.customRegex) {
            applyRulesByTag('formatting', true, 'Formatting fixes');
        }
        // Apply custom regex rules BEFORE number conversion
        let interactiveRuleMatches = [];
        const pendingInteractiveRules = [];

        if (autoFixSettings.customRegex) {
            console.log('Applying custom regex rules...');

            const processRules = (rules, contextLabel) => {
                rules.forEach(rule => {
                    if (rule.enabled === false) {
                        return;
                    }

                    try {
                        let processedFind = rule.find;
                        let processedFlags = rule.flags || 'gi';

                        if (rule.enhancedBoundary && processedFlags.includes('e')) {
                            processedFlags = processedFlags.replace(/e/g, '');
                            const boundaryChars = '[\\s\\[\\]\\(\\),.!?;:"\'`~@#$%^&*+={}|<>/—–-]';
                            const startBoundary = `(?<=^|${boundaryChars})`;
                            const endBoundary = `(?=${boundaryChars}|$)`;

                            if (processedFind.includes('\\b')) {
                                processedFind = processedFind
                                    .replace(/^\\b/, startBoundary)
                                    .replace(/\\b$/, endBoundary)
                                    .replace(/\\b/g, `(?<=${boundaryChars}|^)(?=${boundaryChars}|$)`);

                                console.log(`Enhanced boundary applied to rule "${rule.description}" from ${contextLabel}:`, rule.find, '->', processedFind);
                            } else {
                                processedFind = `${startBoundary}${processedFind}${endBoundary}`;
                                console.log(`Enhanced boundary applied to rule "${rule.description}" from ${contextLabel}:`, rule.find, '->', processedFind);
                            }
                        }

                        let replaceValue = rule.replace;
                        if (typeof replaceValue === 'string') {
                            const trimmed = replaceValue.trim();
                            if (trimmed.startsWith('function') || trimmed.startsWith('(')) {
                                try {
                                    // Evaluate function strings (both traditional and arrow functions)
                                    replaceValue = eval(trimmed);
                                } catch (error) {
                                    console.log(`Failed to evaluate replace function for rule "${rule.description}" from ${contextLabel}:`, error);
                                    replaceValue = rule.replace;
                                }
                            }
                        }

                        const processedRule = {
                            ...rule,
                            replace: replaceValue,
                            find: processedFind,
                            flags: processedFlags,
                            enhancedBoundary: false,
                            contextLabel
                        };

                        // Determine the mode: check askMode first, fall back to ask property for backwards compatibility
                        const mode = rule.askMode || (rule.ask ? 'ask' : 'auto');

                        if (mode === 'off') {
                            // Skip this rule
                            console.log(`Rule "${rule.description}" from ${contextLabel} is disabled (mode: off)`);
                        } else if (mode === 'ask') {
                            pendingInteractiveRules.push(processedRule);
                            console.log(`Interactive rule "${rule.description}" from ${contextLabel} queued for review`);
                        } else {
                            // mode === 'auto' or default
                            const regex = new RegExp(processedFind, processedFlags);
                            const beforeLength = fixedText.length;

                            if (typeof replaceValue === 'function') {
                                fixedText = fixedText.replace(regex, replaceValue);
                            } else {
                                let jsReplacement = replaceValue;
                                if (typeof jsReplacement === 'string') {
                                    jsReplacement = jsReplacement.replace(/(?<!\\)\\(\d+)/g, '$$$1');
                                }

                                fixedText = fixedText.replace(regex, jsReplacement);
                            }

                            if (beforeLength !== fixedText.length) {
                                console.log(`Custom rule "${rule.description}" from ${contextLabel} applied changes`);
                            }
                        }
                    } catch (e) {
                        console.log(`Custom regex rule "${rule.description}" from ${contextLabel} failed:`, e.message);
                    }
                });
            };

            if (autoFixSettings.ruleGroups) {
                autoFixSettings.ruleGroups.forEach(group => {
                    if (group.rules && Array.isArray(group.rules)) {
                        processRules(group.rules, `group "${group.title}"`);
                    }
                });
            }

            if (autoFixSettings.ungroupedRules) {
                processRules(autoFixSettings.ungroupedRules, 'ungrouped rules');
            }
        }

        // Convert numbers to text based on setting
        if (autoFixSettings.numberToText === 'on') {
            console.log('Converting numbers to text automatically...');
            fixedText = convertNumbersToText(fixedText);
        }

        const isNumberConversionInteractive = autoFixSettings.numberToText === 'ask';

        if (pendingInteractiveRules.length > 0) {
            pendingInteractiveRules.forEach(rule => {
                const matches = findInteractiveMatches(fixedText, rule);
                if (matches.length > 0) {
                    matches.forEach(match => {
                        match.rule = rule;
                    });
                    interactiveRuleMatches.push(...matches);
                    console.log(`Interactive rule "${rule.description}" from ${rule.contextLabel} found ${matches.length} match${matches.length === 1 ? '' : 'es'}`);
                }
            });

            interactiveRuleMatches.sort((a, b) => a.position - b.position);
        }

        if (interactiveRuleMatches.length > 0) {
            applyFixedTextToEditor();

            processInteractiveFixes(textEditor, interactiveRuleMatches, {
                onComplete: () => {
                    if (isNumberConversionInteractive) {
                        console.log('Interactive number conversion mode...');
                        setTimeout(() => {
                            startInteractiveNumberConversion(textEditor);
                        }, 100);
                    }
                },
                onDeclineAll: (remainingMatches) => {
                    console.log('User declined all remaining interactive rule fixes:', remainingMatches.length);
                }
            });

            if (isNumberConversionInteractive) {
                return;
            }
        }

        if (isNumberConversionInteractive) {
            applyFixedTextToEditor();
            console.log('Interactive number conversion mode...');
            setTimeout(() => {
                startInteractiveNumberConversion(textEditor);
            }, 100);
            return;
        }

        console.log('Fixed text length:', fixedText.length);
        console.log('Changes made:', text !== fixedText);

        // Apply the fixed text back to the editor
        applyFixedTextToEditor();

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
            z-index: 10006;
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
                let selectionRange = null;

                if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
                    selectionStart = activeElement.selectionStart;
                    selectionEnd = activeElement.selectionEnd;
                } else if (activeElement.isContentEditable && selection.rangeCount > 0) {
                    // Store the actual range for contenteditable elements
                    selectionRange = selection.getRangeAt(0).cloneRange();
                }

                currentSelection = {
                    text: selectedText,
                    activeElement: activeElement,
                    selectionStart: selectionStart,
                    selectionEnd: selectionEnd,
                    selectionRange: selectionRange
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
        // Check if buttons already exist - if so, don't add them again
        const existingToggleButton = document.getElementById('genius-emdash-toggle');
        const existingAutoFixButton = document.getElementById('genius-autofix-button');
        const existingAutoscribeButton = document.getElementById('genius-autoscribe-button');
        const existingZwsButton = document.getElementById('genius-zws-button');
        const existingFindReplaceContainer = document.getElementById('genius-find-replace-container');

        if (existingToggleButton || existingAutoFixButton || existingAutoscribeButton || existingZwsButton || existingFindReplaceContainer) {
            console.log('Buttons already exist, skipping addition');
            return false;
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
            const autoscribeButton = createAutoscribeButton();
            const zwsButton = createZeroWidthSpaceButton();
            const findReplaceContainer = createFindReplaceContainer();

            // Create containers using utility
            const mainButtonContainer = UI.createFlexContainer('row', '0', { marginBottom: '0.5rem' });
            mainButtonContainer.appendChild(toggleButton);
            mainButtonContainer.appendChild(autoFixButton);
            mainButtonContainer.appendChild(autoscribeButton);

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
                    // If other extension's buttons exist, insert our buttons BEFORE them
                    console.log('Found other extension lyrics sections container, positioning our buttons above it');

                    // Insert before the other extension's container
                    lyricsSectionsContainer.parentNode.insertBefore(mainButtonContainer, lyricsSectionsContainer);
                    lyricsSectionsContainer.parentNode.insertBefore(smallButtonsContainer, lyricsSectionsContainer);
                    console.log('Inserted ScribeTools buttons before other extension buttons');

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
        // Only remove the "How to Format Lyrics" explainer content, but preserve the container structure
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

    // Function to remove hidden buttons with specific styling
    function removeHiddenButtons() {
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
            const style = button.getAttribute('style');
            if (style) {
                // Check for the exact style pattern (order-independent)
                const hasWidth95 = style.includes('width: 95px') || style.includes('width:95px');
                const hasDisplayFlex = style.includes('display: flex') || style.includes('display:flex');
                const hasAlignCenter = style.includes('align-items: center') || style.includes('align-items:center');
                const hasJustifyCenter = style.includes('justify-content: center') || style.includes('justify-content:center');
                const hasVisibilityHidden = style.includes('visibility: hidden') || style.includes('visibility:hidden');
                
                if (hasWidth95 && hasDisplayFlex && hasAlignCenter && hasJustifyCenter && hasVisibilityHidden) {
                    console.log('Removing hidden button with specific styling');
                    button.remove();
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
        removeInteractiveHighlight(null);

        // Remove the "How to Format Lyrics" explainer div
        removeFormatExplainerDiv();

        // Remove hidden buttons with specific styling
        removeHiddenButtons();

        // Set up observer to remove the div if it appears later
        const observer = new MutationObserver(() => {
            removeFormatExplainerDiv();
            removeHiddenButtons();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Reset restore prompt flag for new page
        restorePromptShownForContext.clear();

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



        // Listen for focus on editors to check for auto-saved content
        document.addEventListener('focus', (e) => {
            const target = e.target;
            if (!isTextEntryElement(target)) {
                return;
            }

            const context = detectEditorContext(target);
            if (!context) {
                return;
            }

            activeEditors.set(context.key, { element: target, context });
            lastFocusedContextKey = context.key;

            if (context.type === 'lyrics') {
                // Only remove highlights if there's no active autofix popup
                if (!currentInteractivePopup) {
                    console.log('Cleaning up any lingering highlights on lyrics editor focus...');
                    removeInteractiveHighlight(target);
                } else {
                    console.log('Keeping highlights during active autofix session...');
                }
            }

            if (!restorePromptShownForContext.has(context.key)) {
                console.log(`${context.label} focused, checking for auto-saved content...`);

                try {
                    const saveDataRaw = localStorage.getItem(getAutoSaveKey(context.key));
                    if (saveDataRaw) {
                        const parsed = JSON.parse(saveDataRaw);
                        const now = Date.now();
                        const saveAge = now - parsed.timestamp;
                        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

                        if (saveAge <= maxAge) {
                            const { content: currentContent = '' } = extractEditorContent(target);

                            if (parsed.content && parsed.content.trim() !== (currentContent || '').trim()) {
                                const saveDate = new Date(parsed.timestamp);
                                const timeString = saveDate.toLocaleString();
                                console.log('Found different auto-saved content, showing restore notification...');
                                showRestoreNotification(parsed, timeString, {
                                    contextKey: context.key,
                                    contextLabel: context.label,
                                    editorElement: target
                                });
                            } else {
                                console.log('Auto-saved content matches current content, clearing auto-save...');
                                restorePromptShownForContext.add(context.key);
                                clearAutoSave(context.key);
                            }
                        } else {
                            clearAutoSave(context.key);
                        }
                    } else {
                        // No autosave found, mark as checked to prevent future checks
                        restorePromptShownForContext.add(context.key);
                    }
                } catch (err) {
                    console.log('Failed to check auto-save:', err);
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
                    removeInteractiveHighlight(textEditor);
                }
                cleanupCurrentInteractivePopup();
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
        loadAutoscribeSettings();
        
        // Load built-in rules from rules.json
        loadBuiltInRules();

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
                    // Clean up any orphaned buttons (shouldn't happen with new check, but just in case)
                    const existingToggle = document.getElementById('genius-emdash-toggle');
                    const existingAutoFix = document.getElementById('genius-autofix-button');
                    const existingAutoscribe = document.getElementById('genius-autoscribe-button');
                    const existingZws = document.getElementById('genius-zws-button');
                    const existingFindReplaceContainer = document.getElementById('genius-find-replace-container');

                    // Only remove if they exist but their parent containers are missing
                    if (existingToggle && !existingToggle.parentNode) existingToggle.remove();
                    if (existingAutoFix && !existingAutoFix.parentNode) existingAutoFix.remove();
                    if (existingAutoscribe && !existingAutoscribe.parentNode) existingAutoscribe.remove();
                    if (existingZws && !existingZws.parentNode) existingZws.remove();
                    if (existingFindReplaceContainer && !existingFindReplaceContainer.parentNode) existingFindReplaceContainer.remove();

                    // Create all buttons
                    toggleButton = createToggleButton();
                    autoFixButton = createAutoFixButton();
                    const autoscribeButton = createAutoscribeButton();
                    const zwsButton = createZeroWidthSpaceButton();
                    const findReplaceContainer = createFindReplaceContainer();

                    // Create containers using utility
                    const mainButtonContainer = UI.createFlexContainer('row', '0', { marginBottom: '0.5rem' });
                    mainButtonContainer.appendChild(toggleButton);
                    mainButtonContainer.appendChild(autoFixButton);
                    mainButtonContainer.appendChild(autoscribeButton);

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
                    if (hasLyricsEditor && isOnLyricsPage() && !document.getElementById('genius-emdash-toggle') && !document.getElementById('genius-autoscribe-button') && !document.getElementById('genius-zws-button')) {
                        // Small delay to ensure the editor is fully rendered
                        // Immediate cleanup
                        console.log('Lyrics editor appeared, immediately cleaning up any lingering highlights...');
                        removeInteractiveHighlight(null); // Global cleanup first

                        setTimeout(() => {
                            addButtonToEditor();

                            // Additional cleanup after buttons are added
                            const textEditor = document.querySelector('[class*="LyricsEdit"] textarea') ||
                                              document.querySelector('[class*="LyricsEdit"] [contenteditable="true"]');
                            if (textEditor) {
                                removeInteractiveHighlight(textEditor);
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