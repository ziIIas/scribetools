import json

# Load rules.json
with open('rules.json', encoding='utf-8') as f:
    data = json.load(f)

# Define the 44 high-priority rules to modify (by description)
priority_rules = [
    # Capitalization (7 rules)
    "Capitalize i' contractions",
    "tec -> TEC",
    "tv -> TV",
    "cuban -> Cuban",
    "Proper noun capitalization",
    
    # Contractions (17 rules)
    "n't contractions (aint, arent, cant, couldnt, didnt, doesnt, dont, hadnt, havent, hasnt, isnt, mustnt, shouldnt, wasnt, werent, wont, wouldnt)",
    "youre -> you're",
    "youll -> you'll",
    "youve -> you've",
    "youd -> you'd",
    "theyre -> they're",
    "theyll -> they'll",
    "theyve -> they've",
    "theyd -> they'd",
    "were going/gonna -> we're",
    "were here/there (context) -> we're",
    "well (future) -> we'll",
    "weve -> we've",
    "wed -> we'd",
    "its (context) -> it's",
    "itll -> it'll",
    "itd -> it'd",
    
    # Common Slang/Spelling (20 rules)
    "ok -> okay",
    "yuh -> yeah",
    "yea -> yeah",
    "hoe -> ho",
    "lil/li'l -> lil'",
    "whoa -> woah",
    "dawg -> dog",
    "choppa -> chopper",
    "alot -> a lot",
    "trynna -> tryna",
    "sux -> sucks",
    "foe 'nem variations -> foenem",
    "bro 'nem variations -> bronem",
    "switchey/switchie -> switchy",
    "switchys -> switchies",
    "blickey/blickie -> blicky",
    "blickys -> blickies",
    "slimey -> slimy",
    "skrt -> skrrt",
    "grah -> grrah",
    "slat -> slatt",
    "mmm -> mm",
]

modified_count = 0

# Iterate through all groups and rules
for group in data.get('ruleGroups', []):
    for rule in group.get('rules', []):
        description = rule.get('description', '')
        
        # Check if this rule should be modified
        if description in priority_rules:
            # Check if it uses \b and doesn't already have enhancedBoundary
            find_pattern = rule.get('find', '')
            if '\\b' in find_pattern and not rule.get('enhancedBoundary'):
                # Add enhancedBoundary
                rule['enhancedBoundary'] = True
                
                # Add 'e' to flags if not present
                flags = rule.get('flags', 'gi')
                if 'e' not in flags:
                    rule['flags'] = flags + 'e'
                
                modified_count += 1
                print(f"✓ Modified: {description}")

# Save the modified data
with open('rules.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"\n{'='*60}")
print(f"Total rules modified: {modified_count}")
print(f"Expected: {len(priority_rules)}")
print(f"{'='*60}")

if modified_count != len(priority_rules):
    print(f"\n⚠️  Warning: Modified count ({modified_count}) doesn't match expected ({len(priority_rules)})")
    print("Some rules may have already had enhancedBoundary or descriptions may not match exactly.")
