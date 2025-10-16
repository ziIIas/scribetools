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
