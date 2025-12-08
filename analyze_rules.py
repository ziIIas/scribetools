import json

with open('rules.json', encoding='utf-8') as f:
    data = json.load(f)

total_rules_with_b = 0
rules_with_eb = 0
rules_without_eb = []

for group in data.get('ruleGroups', []):
    group_title = group.get('title', 'Unknown')
    for rule in group.get('rules', []):
        find_pattern = rule.get('find', '')
        if '\\b' in find_pattern:
            total_rules_with_b += 1
            has_eb = rule.get('enhancedBoundary', False)
            
            if has_eb:
                rules_with_eb += 1
            else:
                rules_without_eb.append({
                    'group': group_title,
                    'description': rule.get('description', 'No description'),
                    'find': find_pattern,
                    'flags': rule.get('flags', '')
                })

print(f'Total rules using \\b: {total_rules_with_b}')
print(f'Rules WITH enhancedBoundary: {rules_with_eb}')
print(f'Rules WITHOUT enhancedBoundary: {len(rules_without_eb)}')
print(f'\nPercentage with enhanced boundary: {(rules_with_eb/total_rules_with_b*100):.1f}%\n')

print('='*80)
print('RULES WITHOUT ENHANCED BOUNDARY:')
print('='*80)

for i, rule in enumerate(rules_without_eb, 1):
    print(f'\n{i}. [{rule["group"]}] {rule["description"]}')
    print(f'   Pattern: {rule["find"][:70]}')
    print(f'   Flags: {rule["flags"]}')
