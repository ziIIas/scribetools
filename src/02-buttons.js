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
