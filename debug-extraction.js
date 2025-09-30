// Debug script to test extraction logic
// Copy and paste this in the browser console on the RO page

console.log("=== TEKFLOW DEBUG EXTRACTION ===");

// Test 1: Find title element
const titleElement = document.querySelector('h1');
console.log("Title element found:", titleElement);
console.log("Title text:", titleElement?.textContent);

// Test 2: Test customer extraction regex
const titleText = titleElement?.textContent || '';
console.log("Testing customer extraction on:", titleText);

// Try all patterns
const patterns = [
    /RO\s*#?\w+:\s*([^']+)'s?\s+\d{4}/,
    /RO\s*#?\w+:\s*([^0-9]+?)\s+\d{4}/,
    /:\s*([A-Za-z\s]+?)\s*\d{4}/
];

patterns.forEach((pattern, i) => {
    const match = titleText.match(pattern);
    console.log(`Pattern ${i+1}:`, pattern, "Match:", match);
    if (match) {
        console.log(`Customer from pattern ${i+1}:`, match[1]?.trim());
    }
});

// Test 3: Test RO extraction
const roMatch = titleText.match(/RO\s*#?(\w+):/);
console.log("RO Match:", roMatch);
if (roMatch) {
    console.log("RO Number:", roMatch[1]);
}

// Test 4: Look for promise time
const promiseTimeElement = document.querySelector('*');
const allText = document.body.textContent;
console.log("Looking for 'Tue, Sep 30 08:00 AM' in page...");
console.log("Found:", allText.includes("Tue, Sep 30 08:00 AM"));

// Test 5: Check if content script is injected
console.log("Is content script active?", window.isPromiseTimeContentScriptActive);