# ScribeTools Auto Fix Rules - Bug Fixes

## Issues Fixed

### 1. **`im -> I'm` Rule Not Working**
**Problem:** The rule had pattern `\\bim\\b(?=\\s)` which required a space after "im". This meant it wouldn't work at the end of sentences or before punctuation marks.

**Fix:** Changed pattern to `\\bim\\b` to match "im" at word boundaries regardless of what follows.

**Location:** `rules.json`, line 314

---

### 2. **Weird "lIne" Capitalization Issue**
**Problem:** The standalone "i" capitalization rule was using only a lookahead, which meant it could match the "i" in the middle of words like "line" if preceded by certain characters.

**Fix:** Added lookbehind assertion to ensure "i" is preceded by appropriate boundaries: `(?<=^|[\\s\\-\\.,!?;:\\(\\[\\{'\"\"'])i(?=[\\s\\-\\.,!?;:\\)\\]\\}'\"\"'']|$)`

**Location:** `rules.json`, line 20

---

### 3. **"Unedited Line" Getting Capitalized to "Unedited Line"**
**Problem:** The beginning of line capitalization rule was capitalizing all lowercase letters at line starts, even when they appeared after other words.

**Fix:** Added additional check in the replacement function to prevent capitalizing if there's a preceding word: `if (/[a-z]\\s+$/i.test(prefix)) { return match; }`

**Location:** `rules.json`, line 95

---

### 4. **Numbers in Annotations Being Converted (e.g., `[text](37683851)` → `[text](37six83851)`)**
**Problem:** The rules were being applied to text inside Genius annotations `[text](numbers)`, causing numbers to be converted to words or otherwise modified.

**Fix:** Added annotation protection to both `applyRulesByTag` and `processRules` functions. Before any rules are applied, all annotations matching the pattern `[text](numbers)` are replaced with placeholders. After rules are complete, the original annotations are restored.

**Locations:**
- `scribetools.user.js`, lines 10059-10077 (applyRulesByTag function)
- `scribetools.user.js`, lines 10442-10460 (processRules function)

---

## How Annotation Protection Works

```javascript
// Before applying rules
const protectedAnnotations = [];
protectedText = fixedText.replace(/\[([^\]]+)\]\((\d+)\)/g, function(match, text, numbers) {
    const placeholder = `__ANNOTATION_${index}__`;
    protectedAnnotations.push({ placeholder, original: match });
    return placeholder;
});

// Apply rules to protectedText
// ... rules processing ...

// After applying rules
protectedAnnotations.forEach(({ placeholder, original }) => {
    fixedText = fixedText.replace(placeholder, original);
});
```

This ensures that content within Genius annotations is never modified by any auto-fix rules.

---

## Testing Recommendations

1. **Test `im` rule:**
   - "im going" → "I'm going" ✓
   - "im." → "I'm." ✓
   - "im!" → "I'm!" ✓

2. **Test standalone `i` capitalization:**
   - "i am" → "I am" ✓
   - "line" → "line" (should NOT become "lIne") ✓

3. **Test beginning of line capitalization:**
   - "unedited line" at start of line → should ask/not auto-capitalize "line"
   - "the quick brown" at start of line → "The quick brown" ✓

4. **Test annotation protection:**
   - `[Song](37683851)` should remain unchanged ✓
   - Numbers inside parentheses after brackets should never be converted ✓

---

## Date
November 22, 2025
