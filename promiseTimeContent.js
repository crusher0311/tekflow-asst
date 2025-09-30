// File: promiseTimeContent.js - Promise Time Monitoring for TekFlow Assistant

// Section 1: Self-Executing Function to Encapsulate Variables
(() => {
    if (window.isPromiseTimeContentScriptActive) {
        console.log("PromiseTimeContent.js - Content script is already active. Skipping initialization.");
        return;
    }

    // Set a flag to prevent reinjection
    window.isPromiseTimeContentScriptActive = true;
    console.log("PromiseTimeContent.js - Content script loaded: Ready to check Promised Time Out field.");

    let isCheckingActive = false;
    let checkInterval;

    // Section 2: Function to Check and Highlight the Promised Time Out Field
    function checkAndHighlightPromisedTimeout() {
        console.log("PromiseTimeContent.js - Executing checkAndHighlightPromisedTimeout function.");

        // Multiple selectors to find the Promised Time Out field
        const selectors = [
            // Look for label with "Promised Time Out" text
            'label:contains("Promised Time Out")',
            // Look for elements with specific text content
            '*[title*="Promised Time Out"]',
            // Look for the specific area shown in screenshot
            '*:contains("Add time out")'
        ];

        let timeoutLabel = null;
        let timeoutField = null;

        // Try to find the label first
        timeoutLabel = Array.from(document.querySelectorAll("*")).find(el => 
            el.textContent && el.textContent.includes("Promised Time Out") && 
            (el.tagName === 'LABEL' || el.classList.contains('label') || el.getAttribute('role') === 'label')
        );

        if (timeoutLabel) {
            console.log("PromiseTimeContent.js - Found 'Promised Time Out' label:", timeoutLabel);

            // Look for the associated field in multiple ways
            timeoutField = timeoutLabel.nextElementSibling ||
                         timeoutLabel.parentElement.querySelector("*:contains('Add time out')") ||
                         timeoutLabel.parentElement.nextElementSibling ||
                         document.querySelector("*:contains('Add time out')");

        } else {
            // If no label found, look directly for "Add time out" text
            timeoutField = Array.from(document.querySelectorAll("*")).find(el => 
                el.textContent && el.textContent.trim() === "Add time out..."
            );
            
            if (timeoutField) {
                // Try to find the associated label
                timeoutLabel = timeoutField.previousElementSibling ||
                              timeoutField.parentElement.querySelector("*:contains('Promised Time Out')") ||
                              Array.from(document.querySelectorAll("*")).find(el => 
                                  el.textContent && el.textContent.includes("Promised Time Out")
                              );
            }
        }

        if (timeoutField) {
            const contentText = timeoutField.textContent.trim();
            console.log("PromiseTimeContent.js - Timeout field text content:", contentText);

            // Apply highlighting if the field is empty or shows "Add time out"
            if (contentText.includes("Add time out") || contentText === "" || contentText === "—") {
                console.log("PromiseTimeContent.js - Field is empty. Applying highlighting.");

                // Enhanced highlighting styles
                const highlightStyle = "color: white !important; background-color: #ff6b6b !important; padding: 4px 8px !important; border-radius: 6px !important; font-weight: bold !important; box-shadow: 0 2px 4px rgba(255, 107, 107, 0.3) !important; animation: pulse 2s infinite !important;";
                
                if (timeoutLabel) {
                    timeoutLabel.style.cssText = highlightStyle;
                }
                timeoutField.style.cssText = highlightStyle;

                // Add pulsing animation if not already added
                if (!document.getElementById('promise-time-pulse-animation')) {
                    const style = document.createElement('style');
                    style.id = 'promise-time-pulse-animation';
                    style.textContent = `
                        @keyframes pulse {
                            0% { opacity: 1; }
                            50% { opacity: 0.7; }
                            100% { opacity: 1; }
                        }
                    `;
                    document.head.appendChild(style);
                }

                // Continue checking for changes
                setTimeout(checkAndHighlightPromisedTimeout, 5000);
            } else {
                console.log("PromiseTimeContent.js - Promised Time Out is set. Removing custom styles.");
                if (timeoutLabel) {
                    timeoutLabel.style.cssText = "";
                }
                timeoutField.style.cssText = "";
                stopCheckInterval();
            }
        } else {
            console.warn("PromiseTimeContent.js - No 'Promised Time Out' field found on the page.");
            // Keep trying if we're on a repair order page
            if (window.location.href.includes('/repair-orders/')) {
                setTimeout(checkAndHighlightPromisedTimeout, 3000);
            }
        }
    }

    // Section 3: Manage Interval for Checking the Field
    function startCheckInterval() {
        if (!isCheckingActive) {
            console.log("PromiseTimeContent.js - Starting interval to check Promised Time Out field.");
            isCheckingActive = true;
            checkInterval = setInterval(checkAndHighlightPromisedTimeout, 3000);
        } else {
            console.log("PromiseTimeContent.js - Check interval is already active. Skipping duplicate start.");
        }
    }

    function stopCheckInterval() {
        if (isCheckingActive) {
            console.log("PromiseTimeContent.js - Stopping interval checking.");
            clearInterval(checkInterval);
            isCheckingActive = false;
        }
    }

    // Section 4: Listen for Messages from Background Script and Dashboard
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'start_promise_check') {
            console.log("PromiseTimeContent.js - Message received to start checking Promised Time Out field.");
            startCheckInterval();
            sendResponse({status: 'promise_check_started'});
        } else if (message.action === 'extractPromiseTimeData') {
            console.log("PromiseTimeContent.js - Message received to extract promise time data from current page.");
            extractPromiseTimeDataFromPage(message.shopId, message.roId, sendResponse);
            return true; // Keep the message channel open for async response
        }
    });

    // Section 5: Extract Promise Time Data from Current Page
    function extractPromiseTimeDataFromPage(shopId, roId, sendResponse) {
        try {
            // Look for customer information
            const customerName = extractCustomerName();
            const vehicleDescription = extractVehicleDescription();
            const promiseTimeData = extractPromiseTimeFromPage();
            const serviceWriter = extractServiceWriter();
            
            // Extract RO number from URL if not provided
            let repairOrderNumber = roId;
            const urlMatch = window.location.href.match(/repair-orders\/(\d+)/);
            if (urlMatch) {
                repairOrderNumber = urlMatch[1];
            }

            if (promiseTimeData && promiseTimeData.timeOut) {
                // Send data to background script for storage
                chrome.runtime.sendMessage({
                    action: 'storePromiseTimeData',
                    data: {
                        customerTimeOut: promiseTimeData.timeOut,
                        customerFullName: customerName,
                        vehicleDescription: vehicleDescription,
                        repairOrderNumber: repairOrderNumber,
                        serviceWriterName: serviceWriter,
                        shopId: shopId,
                        roId: roId
                    }
                });

                sendResponse({ success: true, message: 'Promise time data extracted and stored' });
            } else {
                sendResponse({ success: false, message: 'No promise time found on this page' });
            }
        } catch (error) {
            console.error('Error extracting promise time data:', error);
            sendResponse({ success: false, message: 'Error extracting data: ' + error.message });
        }
    }

    function extractCustomerName() {
        // Look for customer name in various possible locations
        const selectors = [
            '*[data-testid*="customer"]',
            '.customer-name',
            '*:contains("Customer:")',
            'h1, h2, h3'
        ];

        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
                const text = el.textContent.trim();
                if (text && text.length > 3 && !text.includes('RO') && !text.includes('Repair Order')) {
                    return text;
                }
            }
        }
        return 'Unknown Customer';
    }

    function extractVehicleDescription() {
        // Look for vehicle information
        const selectors = [
            '*[data-testid*="vehicle"]',
            '.vehicle-info',
            '*:contains("Year:")',
            '*:contains("Make:")',
            '*:contains("Model:")'
        ];

        let vehicleInfo = [];
        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
                const text = el.textContent.trim();
                if (text && !vehicleInfo.includes(text) && text.length < 50) {
                    vehicleInfo.push(text);
                }
            }
        }
        
        return vehicleInfo.join(' ') || 'Unknown Vehicle';
    }

    function extractPromiseTimeFromPage() {
        console.log('PromiseTimeContent.js - Extracting promise time from page...');
        
        // Strategy 1: Look for existing promise time fields/values
        const promiseTimeSelectors = [
            'input[placeholder*="promise" i]',
            'input[placeholder*="time out" i]', 
            'input[name*="promise" i]',
            'input[name*="timeout" i]',
            '*[data-testid*="promise" i]',
            '*[data-testid*="timeout" i]'
        ];
        
        for (const selector of promiseTimeSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
                const value = el.value || el.textContent || el.innerText;
                console.log(`PromiseTimeContent.js - Checking element with selector "${selector}":`, value);
                
                if (value && value.trim()) {
                    const timeOut = parseDateTime(value.trim());
                    if (timeOut) {
                        console.log('PromiseTimeContent.js - Found promise time via input field:', timeOut);
                        return { timeOut: timeOut.toISOString() };
                    }
                }
            }
        }
        
        // Strategy 2: Look for text containing date/time patterns near "promise" keywords
        const allElements = document.querySelectorAll('*');
        const promiseKeywords = ['promise', 'promised', 'timeout', 'time out', 'due'];
        
        for (const el of allElements) {
            const text = (el.textContent || '').toLowerCase();
            const hasPromiseKeyword = promiseKeywords.some(keyword => text.includes(keyword));
            
            if (hasPromiseKeyword || el.closest('[class*="promise" i]') || el.closest('[class*="timeout" i]')) {
                // Look for date patterns in this element and nearby elements
                const datePatterns = [
                    /\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}(?:\s*[AP]M)?/gi,
                    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d{3})?Z?/gi,
                    /\w{3}\s+\w{3}\s+\d{1,2}\s+\d{4}\s+\d{1,2}:\d{2}/gi,
                    /\d{1,2}-\d{1,2}-\d{4}\s+\d{1,2}:\d{2}(?:\s*[AP]M)?/gi
                ];
                
                // Check current element and siblings
                const elementsToCheck = [el, ...Array.from(el.parentElement?.children || [])];
                
                for (const checkEl of elementsToCheck) {
                    const checkText = checkEl.textContent || checkEl.value || '';
                    
                    for (const pattern of datePatterns) {
                        const matches = checkText.match(pattern);
                        if (matches) {
                            for (const match of matches) {
                                const timeOut = parseDateTime(match);
                                if (timeOut && timeOut > new Date()) {
                                    console.log('PromiseTimeContent.js - Found promise time via text pattern:', timeOut);
                                    return { timeOut: timeOut.toISOString() };
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Strategy 3: Look for any future date/time on the page (less specific)
        const timeElements = document.querySelectorAll('*');
        
        for (const el of timeElements) {
            const text = el.textContent || el.value || '';
            if (!text || text.length > 100) continue; // Skip very long text blocks
            
            const dateTimePatterns = [
                /\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}\s*[AP]M/gi,
                /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/gi,
                /\w{3}\s+\w{3}\s+\d{1,2}\s+\d{4}\s+\d{1,2}:\d{2}/gi
            ];
            
            for (const pattern of dateTimePatterns) {
                const matches = text.match(pattern);
                if (matches) {
                    for (const match of matches) {
                        const timeOut = parseDateTime(match);
                        if (timeOut && timeOut > new Date()) {
                            // Only consider it if it's within a reasonable timeframe (next 30 days)
                            const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                            if (timeOut <= thirtyDaysFromNow) {
                                console.log('PromiseTimeContent.js - Found potential promise time:', timeOut);
                                return { timeOut: timeOut.toISOString() };
                            }
                        }
                    }
                }
            }
        }
        
        console.log('PromiseTimeContent.js - No promise time found on page');
        return null;
    }

    // Helper function to parse various date/time formats
    function parseDateTime(dateStr) {
        try {
            // Remove extra whitespace
            dateStr = dateStr.trim();
            
            // Try different parsing approaches
            const parseAttempts = [
                () => new Date(dateStr),
                () => new Date(dateStr.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/, '$3-$1-$2')),
                () => new Date(dateStr.replace(/(\d{1,2})-(\d{1,2})-(\d{4})/, '$3-$1-$2')),
                () => {
                    // Handle MM/DD/YYYY HH:MM AM/PM format
                    const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*([AP]M)?/i);
                    if (match) {
                        const [, month, day, year, hour, minute, ampm] = match;
                        let hour24 = parseInt(hour);
                        if (ampm && ampm.toLowerCase() === 'pm' && hour24 !== 12) hour24 += 12;
                        if (ampm && ampm.toLowerCase() === 'am' && hour24 === 12) hour24 = 0;
                        return new Date(year, month - 1, day, hour24, minute);
                    }
                    return null;
                }
            ];
            
            for (const attempt of parseAttempts) {
                const result = attempt();
                if (result && !isNaN(result.getTime())) {
                    return result;
                }
            }
            
            return null;
        } catch (error) {
            console.log('PromiseTimeContent.js - Error parsing date:', dateStr, error);
            return null;
        }
    }

    function extractServiceWriter() {
        // Look for service writer information
        const selectors = [
            '*[data-testid*="writer"]',
            '*[data-testid*="advisor"]',
            '.service-writer',
            '*:contains("Service Writer:")',
            '*:contains("Advisor:")'
        ];

        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
                const text = el.textContent.trim();
                if (text && text.length > 2 && text.length < 50) {
                    return text.replace(/^(Service Writer:|Advisor:)\s*/i, '');
                }
            }
        }
        return 'Unknown Service Writer';
    }

    // Auto-start checking when script loads on repair order pages
    if (window.location.href.includes('/repair-orders/')) {
        setTimeout(startCheckInterval, 1000);
        
        // Also try to extract promise time data immediately
        setTimeout(() => {
            const urlMatch = window.location.href.match(/\/shop\/(\d+)\/repair-orders\/(\d+)/);
            if (urlMatch) {
                const shopId = urlMatch[1];
                const roId = urlMatch[2];
                console.log('PromiseTimeContent.js - Auto-scanning for promise time data...');
                extractPromiseTimeDataFromPage(shopId, roId, (response) => {
                    console.log('PromiseTimeContent.js - Auto-scan result:', response);
                });
            }
        }, 3000); // Wait 3 seconds for page to fully load
    }
})();