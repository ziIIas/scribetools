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
                styles: { fontSize: '10px', padding: '2px 6px', height: 'auto' }
            });
            
            // Apply consistent red styling to match delete group button
            this.styleButtonWithHover(deleteBtn, 'danger');
            
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
