// Test file to avoid PowerShell escaping issues
const regex = /(?<![\w./:;\-–—\[\]%])(100|[1-9][0-9]|[0-9])(?![\w./:;\-–—\[\]%])/g;

const replace = (match) => {
    const n = parseInt(match);
    if (n === 9 || n === 12) return match;
    const ones = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
    const tens = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
    if (n === 100) return 'one hundred';
    if (n < 20) return ones[n];
    if (n % 10 === 0) return tens[n/10];
    return tens[Math.floor(n/10)] + '-' + ones[n%10];
};

const tests = [
    ['2 dogs', 'two dogs', 'Standalone, space boundaries'],
    ['(5)', '(five)', 'Parentheses allowed'],
    ['100%', '100%', '% in boundary check'],
    ['100 ways', 'one hundred ways', 'Standalone 100'],
    ['9 lives', '9 lives', 'Exception (9)'],
    ['the 12', 'the 12', 'Exception (12)'],
    ['l33t', 'l33t', 'Letter adjacency'],
    ['24/7', '24/7', 'Slash adjacency'],
    ['3:00', '3:00', 'Colon adjacency'],
    ['867-5309', '867-5309', 'Hyphen adjacency'],
    ['[Verse 1]', '[Verse 1]', 'Bracket adjacency'],
    ['7 feelings', 'seven feelings', 'Single digit with spaces'],
    ['20 bucks', 'twenty bucks', 'Round tens'],
    ['35 minutes', 'thirty-five minutes', 'Compound number'],
    ['99 problems', 'ninety-nine problems', 'High compound number'],
    ['0 tolerance', 'zero tolerance', 'Zero conversion'],
    ['Chapter 8', 'Chapter eight', '8 should convert']
];

let passed = 0;
tests.forEach(([input, expected, reason]) => {
    const result = input.replace(regex, replace);
    const pass = result === expected;
    if (pass) passed++;
    console.log((pass ? '✓' : '✗') + ' ' + input + ' → ' + result + (pass ? '' : ' (expected: ' + expected + ')'));
    if (!pass) console.log('  Reason: ' + reason);
});

console.log('\n' + passed + '/' + tests.length + ' tests passed');

// Debug specific failing cases
console.log('\n=== Debugging ===');
console.log('\\w matches letter l:', /\w/.test('l'));
console.log('\\w matches digit 3:', /\w/.test('3'));
console.log('Matches in l33t:', 'l33t'.match(regex));
console.log('Matches in 24/7:', '24/7'.match(regex));
console.log('Matches in 100%:', '100%'.match(regex));

