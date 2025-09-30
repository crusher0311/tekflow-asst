// Advanced debug to find the actual title element
console.log("=== FINDING TITLE ELEMENT ===");

// Check all possible title selectors
const titleSelectors = [
    'h1',
    'h2', 
    'h3',
    '[data-testid*="title"]',
    '[data-testid*="repair-order"]',
    '.page-title',
    '.title',
    '*[class*="title"]',
    '*[class*="header"]'
];

titleSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    console.log(`Selector '${selector}':`, elements.length, 'elements found');
    elements.forEach((el, i) => {
        const text = el.textContent?.trim();
        if (text && text.includes('RO') && text.includes('Jay')) {
            console.log(`  FOUND TITLE in ${selector}[${i}]:`, text);
        } else if (text && text.length > 10 && text.length < 200) {
            console.log(`  Possible title in ${selector}[${i}]:`, text);
        }
    });
});

// Check if text exists anywhere on page
console.log("\n=== SEARCHING FOR RO TEXT ===");
const allText = document.body.textContent;
const roMatches = allText.match(/RO\s*#?\w+:.*?Jay.*?2021.*?Chevrolet/gi);
console.log("Found RO text patterns:", roMatches);

// Look for elements containing this text
console.log("\n=== FINDING ELEMENTS WITH RO TEXT ===");
const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
);

let node;
while (node = walker.nextNode()) {
    if (node.textContent.includes('RO #001') && node.textContent.includes('Jay')) {
        console.log("Found text node:", node.textContent.trim());
        console.log("Parent element:", node.parentElement);
        console.log("Parent tagName:", node.parentElement?.tagName);
        console.log("Parent classes:", node.parentElement?.className);
    }
}