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
        // Exclude "were here yesterday" type patterns where "here" is followed by time words
        fixedText = fixedText.replace(/\bwere\b(?=\s+(?:going|gonna|not|all|together|done|made))/gi, "we're");
        // Handle "were here/there" more carefully - only if it's clearly present tense context
        fixedText = fixedText.replace(/\bwere\b(?=\s+(?:here|there)(?:\s+(?:now|today|earlier|before|waiting|standing|sitting|looking|watching|talking|going|coming|ready|about|just)|\s*[,.]|\s*$))/gi, "we're");
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
        // Handle both 'cuz and cuz, don't duplicate apostrophes, and DON'T match 'cause
        fixedText = fixedText.replace(/(?<!(?:my|our|your|his|her|their|the)\s+)(?<![''\u2018\u2019])('?)cuz\b(?!se\b)/gi, function(match, existingApostrophe) {
            // If there's already an apostrophe, keep it; otherwise add one
            const apostrophe = existingApostrophe ? existingApostrophe : "'";
            
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
        if (autoFixSettings.customRegex) {
            console.log('Applying custom regex rules...');
            
            // Process rules from groups
            if (autoFixSettings.ruleGroups) {
                autoFixSettings.ruleGroups.forEach((group, groupIndex) => {
                    group.rules.forEach((rule, ruleIndex) => {
                        if (rule.enabled !== false) {
                            try {
                                let processedFind = rule.find;
                                let processedFlags = rule.flags || 'gi';
                                
                                // Enhanced boundary processing
                                if (rule.enhancedBoundary && processedFlags.includes('e')) {
                                    // Remove 'e' from flags as it's not a standard regex flag
                                    processedFlags = processedFlags.replace(/e/g, '');
                                    
                                    // Convert simple word boundary patterns to enhanced boundaries
                                    // Replace \b with enhanced boundary pattern
                                    if (processedFind.includes('\\b')) {
                                        // Enhanced boundary characters include: start/end of string, whitespace, brackets, parentheses, common punctuation, em dashes
                                        const boundaryChars = '[\\s\\[\\]\\(\\),.!?;:"\'`~@#$%^&*+={}|<>/—–-]';
                                        const startBoundary = `(?<=^|${boundaryChars})`;
                                        const endBoundary = `(?=${boundaryChars}|$)`;
                                        
                                        // Replace word boundaries with enhanced boundaries
                                        // Handle starting \b
                                        processedFind = processedFind.replace(/^\\b/, startBoundary);
                                        // Handle ending \b
                                        processedFind = processedFind.replace(/\\b$/, endBoundary);
                                        // Handle \b in the middle (both sides) - use lookbehind and lookahead
                                        processedFind = processedFind.replace(/\\b/g, `(?<=${boundaryChars}|^)(?=${boundaryChars}|$)`);
                                        
                                        console.log(`Enhanced boundary applied to rule "${rule.description}" from group "${group.title}":`, rule.find, '->', processedFind);
                                    }
                                    // Also handle rules without \b but with enhancedBoundary flag - wrap the entire pattern
                                    else {
                                        const boundaryChars = '[\\s\\[\\]\\(\\),.!?;:"\'`~@#$%^&*+={}|<>/—–-]';
                                        const startBoundary = `(?<=^|${boundaryChars})`;
                                        const endBoundary = `(?=${boundaryChars}|$)`;
                                        
                                        // Wrap the pattern with enhanced boundaries, using lookbehind/lookahead
                                        processedFind = `${startBoundary}${processedFind}${endBoundary}`;
                                        
                                        console.log(`Enhanced boundary applied to rule "${rule.description}" from group "${group.title}":`, rule.find, '->', processedFind);
                                    }
                                }
                                
                                const regex = new RegExp(processedFind, processedFlags);
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
                                    console.log(`Custom rule "${rule.description}" from group "${group.title}" applied changes`);
                                }
                            } catch (e) {
                                console.log(`Custom regex rule "${rule.description}" from group "${group.title}" failed:`, e.message);
                            }
                        }
                    });
                });
            }
            
            // Process ungrouped rules
            if (autoFixSettings.ungroupedRules) {
                autoFixSettings.ungroupedRules.forEach((rule, index) => {
                    if (rule.enabled !== false) {
                        try {
                            let processedFind = rule.find;
                            let processedFlags = rule.flags || 'gi';
                            
                            // Enhanced boundary processing
                            if (rule.enhancedBoundary && processedFlags.includes('e')) {
                                // Remove 'e' from flags as it's not a standard regex flag
                                processedFlags = processedFlags.replace(/e/g, '');
                                
                                // Convert simple word boundary patterns to enhanced boundaries
                                // Replace \b with enhanced boundary pattern
                                if (processedFind.includes('\\b')) {
                                    // Enhanced boundary characters include: start/end of string, whitespace, brackets, parentheses, common punctuation, em dashes
                                    const boundaryChars = '[\\s\\[\\]\\(\\),.!?;:"\'`~@#$%^&*+={}|<>/—–-]';
                                    const startBoundary = `(?<=^|${boundaryChars})`;
                                    const endBoundary = `(?=${boundaryChars}|$)`;
                                    
                                    // Replace word boundaries with enhanced boundaries
                                    // Handle starting \b
                                    processedFind = processedFind.replace(/^\\b/, startBoundary);
                                    // Handle ending \b
                                    processedFind = processedFind.replace(/\\b$/, endBoundary);
                                    // Handle \b in the middle (both sides) - use lookbehind and lookahead
                                    processedFind = processedFind.replace(/\\b/g, `(?<=${boundaryChars}|^)(?=${boundaryChars}|$)`);
                                    
                                    console.log(`Enhanced boundary applied to ungrouped rule "${rule.description}":`, rule.find, '->', processedFind);
                                }
                                // Also handle rules without \b but with enhancedBoundary flag - wrap the entire pattern
                                else {
                                    const boundaryChars = '[\\s\\[\\]\\(\\),.!?;:"\'`~@#$%^&*+={}|<>/—–-]';
                                    const startBoundary = `(?<=^|${boundaryChars})`;
                                    const endBoundary = `(?=${boundaryChars}|$)`;
                                    
                                    // Wrap the pattern with enhanced boundaries, using lookbehind/lookahead
                                    processedFind = `${startBoundary}${processedFind}${endBoundary}`;
                                    
                                    console.log(`Enhanced boundary applied to ungrouped rule "${rule.description}":`, rule.find, '->', processedFind);
                                }
                            }
                            
                            const regex = new RegExp(processedFind, processedFlags);
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
                                console.log(`Ungrouped custom rule "${rule.description}" applied changes`);
                            }
                        } catch (e) {
                            console.log(`Ungrouped custom regex rule "${rule.description}" failed:`, e.message);
                        }
                    }
                });
            }
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
