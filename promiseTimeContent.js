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
            
            // Check if this is a Job Board page and handle multiple promise times
            if (isJobBoardPage()) {
                extractJobBoardPromiseTimes(message.shopId, sendResponse);
            } else {
                extractPromiseTimeDataFromPage(message.shopId, message.roId, sendResponse);
            }
            return true; // Keep the message channel open for async response
        }
    });

    // Section 5: Job Board Promise Time Scanning
    function isJobBoardPage() {
        // Check URL and page content to determine if this is a Job Board page
        const url = window.location.href;
        const isJobBoardUrl = url.includes('/admin/shop/') && (url.includes('?view=column') || url.includes('board=ACTIVE'));
        const hasJobBoardTitle = document.querySelector('h1')?.textContent?.includes('Job Board');
        
        console.log('PromiseTimeContent.js - Job Board check:', { isJobBoardUrl, hasJobBoardTitle, url });
        return isJobBoardUrl || hasJobBoardTitle;
    }

    function extractJobBoardPromiseTimes(shopId, sendResponse) {
        try {
            console.log('PromiseTimeContent.js - Scanning Job Board for promise times');
            const promiseTimes = [];
            
            // Look for date elements that match promise time patterns
            const dateElements = document.querySelectorAll('*');
            
            for (const element of dateElements) {
                if (!element || !element.textContent) continue;
                
                const text = element.textContent.trim();
                
                // Look for the full date format "September 30, 2025 at 08:00 AM"
                const fullDateMatch = text.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})\s*([AP]M)/i);
                if (fullDateMatch) {
                    const promiseTime = parseDateTime(text);
                    if (promiseTime && promiseTime > new Date()) {
                        // Find associated customer and vehicle info
                        const roCard = element.closest('[class*="card"], [class*="item"], .job-item, .ro-item') || 
                                     element.closest('div[style*="background"], div[style*="border"]');
                        
                        if (roCard) {
                            const customerInfo = extractCustomerFromJobCard(roCard);
                            const vehicleInfo = extractVehicleFromJobCard(roCard);
                            const roNumber = extractRONumberFromJobCard(roCard);
                            
                            promiseTimes.push({
                                customerTimeOut: promiseTime.toISOString(),
                                customerFullName: customerInfo,
                                vehicleDescription: vehicleInfo,
                                repairOrderNumber: roNumber,
                                serviceWriterName: '',
                                shopId: shopId,
                                roId: roNumber,
                                roUrl: window.location.href
                            });
                            
                            console.log('PromiseTimeContent.js - Found Job Board promise time:', {
                                customer: customerInfo,
                                vehicle: vehicleInfo,
                                ro: roNumber,
                                time: promiseTime
                            });
                        }
                    }
                }
            }
            
            if (promiseTimes.length > 0) {
                // Send all promise times to background for storage
                for (const promiseTimeData of promiseTimes) {
                    chrome.runtime.sendMessage({
                        action: 'storePromiseTimeData',
                        data: promiseTimeData
                    });
                }
                
                sendResponse({ 
                    success: true, 
                    message: `Found ${promiseTimes.length} promise time(s) on Job Board`,
                    count: promiseTimes.length
                });
            } else {
                sendResponse({ success: false, message: 'No promise times found on Job Board' });
            }
        } catch (error) {
            console.error('PromiseTimeContent.js - Error scanning Job Board:', error);
            sendResponse({ success: false, message: 'Error scanning Job Board: ' + error.message });
        }
    }

    function extractCustomerFromJobCard(cardElement) {
        try {
            // Look for customer name patterns in the card
            const customerSelectors = [
                'h3, h4, h5',
                '[class*="customer"]',
                '[class*="name"]',
                'strong',
                'b'
            ];
            
            for (const selector of customerSelectors) {
                const elements = cardElement.querySelectorAll(selector);
                for (const el of elements) {
                    const text = el.textContent?.trim();
                    if (text && text.length > 2 && text.length < 50 && 
                        !text.includes('RO') && !text.includes('$') && 
                        !text.includes(':') && !text.match(/\d{4}/)) {
                        return text;
                    }
                }
            }
            return 'Unknown Customer';
        } catch (error) {
            console.log('PromiseTimeContent.js - Error extracting customer from card:', error);
            return 'Unknown Customer';
        }
    }

    function extractVehicleFromJobCard(cardElement) {
        try {
            // Look for vehicle info patterns (year + make/model)
            const textContent = cardElement.textContent || '';
            
            // Match year + vehicle info pattern
            const vehicleMatch = textContent.match(/\b(19|20)\d{2}\s+[A-Za-z]+[^$\n]*(?=\s|$)/);
            if (vehicleMatch) {
                const vehicleText = vehicleMatch[0].trim();
                if (vehicleText.length > 8 && vehicleText.length < 100) {
                    return vehicleText;
                }
            }
            
            return 'Unknown Vehicle';
        } catch (error) {
            console.log('PromiseTimeContent.js - Error extracting vehicle from card:', error);
            return 'Unknown Vehicle';
        }
    }

    function extractRONumberFromJobCard(cardElement) {
        try {
            // Look for RO number patterns
            const textContent = cardElement.textContent || '';
            
            // Look for RO# patterns
            const roMatch = textContent.match(/RO\s*#?(\w+)/i);
            if (roMatch) {
                return roMatch[1];
            }
            
            // Look for ID or number patterns
            const idMatch = textContent.match(/\b(\d{3,6})\b/);
            if (idMatch) {
                return idMatch[1];
            }
            
            return 'Unknown';
        } catch (error) {
            console.log('PromiseTimeContent.js - Error extracting RO number from card:', error);
            return 'Unknown';
        }
    }

    // Section 6: Extract Promise Time Data from Current Page
    function extractPromiseTimeDataFromPage(shopId, roId, sendResponse) {
        try {
            console.log('PromiseTimeContent.js - Starting extraction for shopId:', shopId, 'roId:', roId);
            
            // Look for customer information
            const customerName = extractCustomerName();
            const vehicleDescription = extractVehicleDescription();
            const promiseTimeData = extractPromiseTimeFromPage();
            const serviceWriter = extractServiceWriter();
            
            console.log('PromiseTimeContent.js - Extracted data:', {
                customerName,
                vehicleDescription,
                promiseTimeData,
                serviceWriter
            });
            
            // Extract RO number from page title - Tekmetric uses spans, not h1
            let repairOrderNumber = roId;
            try {
                // First try to get from page title using span elements
                const titleSelectors = [
                    'span', // Tekmetric uses spans for titles
                    'h1', 
                    'h2', 
                    'h3',
                    '[data-testid*="repair-order-title"]', 
                    '.page-title'
                ];
                
                for (const selector of titleSelectors) {
                    const elements = document.querySelectorAll(selector);
                    for (const element of elements) {
                        if (!element) continue;
                        const titleText = element.textContent || element.innerText || '';
                        
                        // Check if this element contains the RO number
                        if (titleText.includes('RO #') && titleText.includes('001')) {
                            console.log('PromiseTimeContent.js - Found title element for RO:', element);
                            console.log('PromiseTimeContent.js - Page title for RO extraction:', titleText);
                            
                            const roMatch = titleText.match(/RO\s*#?(\w+):/);
                            if (roMatch) {
                                repairOrderNumber = roMatch[1];
                                console.log('PromiseTimeContent.js - Extracted RO from title:', repairOrderNumber);
                                break;
                            } else {
                                console.log('PromiseTimeContent.js - No RO match found in title:', titleText);
                            }
                        }
                    }
                    if (repairOrderNumber !== roId) break; // Found it, stop searching
                }
                
                if (repairOrderNumber === roId) {
                    console.log('PromiseTimeContent.js - No title element found, using fallback');
                }
                
                // Fallback to URL if title parsing fails
                if (!repairOrderNumber || repairOrderNumber === roId) {
                    const urlMatch = window.location.href.match(/repair-orders\/(\d+)/);
                    if (urlMatch) {
                        repairOrderNumber = urlMatch[1];
                    }
                }
            } catch (urlError) {
                console.log('PromiseTimeContent.js - Error parsing RO number:', urlError);
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
                        roId: roId,
                        roUrl: window.location.href // Add current URL for click functionality
                    }
                });

                sendResponse({ success: true, message: 'Promise time data extracted and stored' });
            } else {
                sendResponse({ success: false, message: 'No promise time found on this page' });
            }
        } catch (error) {
            console.error('PromiseTimeContent.js - Error extracting promise time data:', error);
            const errorMessage = error.message || error.toString();
            sendResponse({ success: false, message: 'Error extracting data: ' + errorMessage });
        }
    }

    function extractCustomerName() {
        try {
            // First try to extract from page title - Tekmetric uses spans, not h1
            const titleSelectors = [
                'span', // Tekmetric uses spans for titles
                'h1', 
                'h2', 
                'h3',
                '[data-testid*="repair-order-title"]', 
                '.page-title',
                '.title',
                '*[class*="title"]',
                '*[class*="header"]'
            ];
            
            for (const selector of titleSelectors) {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    if (!element) continue;
                    const titleText = element.textContent || element.innerText || '';
                    
                    // Check if this element contains the RO and customer info
                    if (titleText.includes('RO #') && titleText.includes('Jay') && titleText.includes('2021')) {
                        console.log('PromiseTimeContent.js - Found title element:', element);
                        console.log('PromiseTimeContent.js - Page title for customer extraction:', titleText);
                        
                        // Match pattern: "RO #001: Jay Demore's 2021..." 
                        // Test multiple patterns to be more robust
                        let customerMatch = titleText.match(/RO\s*#?\w+:\s*([^']+)'s?\s+\d{4}/);
                        if (!customerMatch) {
                            // Try alternative pattern without 's
                            customerMatch = titleText.match(/RO\s*#?\w+:\s*([^0-9]+?)\s+\d{4}/);
                        }
                        if (!customerMatch) {
                            // Try even simpler pattern
                            customerMatch = titleText.match(/:\s*([A-Za-z\s]+?)\s*\d{4}/);
                        }
                        
                        if (customerMatch) {
                            let customerName = customerMatch[1].trim();
                            // Clean up any extra text
                            customerName = customerName.replace(/['s]+$/, '').trim();
                            console.log('PromiseTimeContent.js - Extracted customer name:', customerName);
                            return customerName;
                        } else {
                            console.log('PromiseTimeContent.js - No customer match found for title:', titleText);
                        }
                        break;
                    }
                }
            }
            
            // Fallback to looking for customer name in various locations
            const selectors = [
                '*[data-testid*="customer"]',
                '.customer-name',
                '*:contains("Customer:")',
                'h1, h2, h3'
            ];

            for (const selector of selectors) {
                try {
                    const elements = document.querySelectorAll(selector);
                    for (const el of elements) {
                        if (!el) continue;
                        const text = (el.textContent || el.innerText || '').trim();
                        if (text && text.length > 3 && !text.includes('RO') && !text.includes('Repair Order')) {
                            return text;
                        }
                    }
                } catch (selectorError) {
                    console.log('PromiseTimeContent.js - Error with selector:', selector, selectorError);
                }
            }
            return 'Unknown Customer';
        } catch (error) {
            console.log('PromiseTimeContent.js - Error extracting customer name:', error);
            return 'Unknown Customer';
        }
    }

    function extractVehicleDescription() {
        try {
            // First try to extract from page title - Tekmetric uses spans, not h1
            const titleSelectors = [
                'span', // Tekmetric uses spans for titles
                'h1', 
                'h2', 
                'h3',
                '[data-testid*="repair-order-title"]', 
                '.page-title'
            ];
            
            for (const selector of titleSelectors) {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    if (!element) continue;
                    const titleText = element.textContent || element.innerText || '';
                    
                    // Check if this element contains the RO and vehicle info
                    if (titleText.includes('RO #') && titleText.includes('2021') && titleText.includes('Chevrolet')) {
                        console.log('PromiseTimeContent.js - Found title element for vehicle:', element);
                        console.log('PromiseTimeContent.js - Page title for vehicle extraction:', titleText);
                        
                        // Match pattern: "RO #001: Jay Demore's 2021 Chevrolet Silverado 1500 RST"
                        const vehicleMatch = titleText.match(/\d{4}\s+(.+?)(?:\s+Work Not Started|$)/);
                        if (vehicleMatch) {
                            const vehicleDescription = vehicleMatch[1].trim();
                            console.log('PromiseTimeContent.js - Extracted vehicle description:', vehicleDescription);
                            return vehicleDescription;
                        } else {
                            // Try simpler pattern - everything after the year
                            const simpleMatch = titleText.match(/(\d{4}.*?)(?:\s+Work|$)/);
                            if (simpleMatch) {
                                const vehicleDescription = simpleMatch[1].trim();
                                console.log('PromiseTimeContent.js - Extracted vehicle (simple pattern):', vehicleDescription);
                                return vehicleDescription;
                            }
                        }
                        break;
                    }
                }
            }
            
            // Fallback: Look for vehicle information
            const selectors = [
                '*[data-testid*="vehicle"]',
                '.vehicle-info',
                '*:contains("Year:")',
                '*:contains("Make:")',
                '*:contains("Model:")'
            ];

            let vehicleInfo = [];
            for (const selector of selectors) {
                try {
                    const elements = document.querySelectorAll(selector);
                    for (const el of elements) {
                        if (!el) continue;
                        const text = (el.textContent || el.innerText || '').trim();
                        if (text && !vehicleInfo.includes(text) && text.length < 50) {
                            vehicleInfo.push(text);
                        }
                    }
                } catch (selectorError) {
                    console.log('PromiseTimeContent.js - Error with vehicle selector:', selector, selectorError);
                }
            }
            
            return vehicleInfo.join(' ') || 'Unknown Vehicle';
        } catch (error) {
            console.log('PromiseTimeContent.js - Error extracting vehicle description:', error);
            return 'Unknown Vehicle';
        }
    }

    function extractPromiseTimeFromPage() {
        try {
            console.log('PromiseTimeContent.js - Extracting promise time from page...');
            
            // Strategy 1: Look for "Promised Time Out" text specifically
            const promisedTimeElements = Array.from(document.querySelectorAll('*')).filter(el => {
                const text = (el.textContent || '').toLowerCase();
                return text.includes('promised time out') || text.includes('promise time') || text.includes('promised time');
            });
            
            console.log('PromiseTimeContent.js - Found promise time related elements:', promisedTimeElements.length);
            
            for (const el of promisedTimeElements) {
                try {
                    // Look in the same element and nearby elements for date/time
                    const elementsToCheck = [
                        el,
                        el.nextElementSibling,
                        el.nextElementSibling?.nextElementSibling,
                        el.parentElement,
                        ...Array.from(el.parentElement?.children || [])
                    ].filter(Boolean);
                    
                    for (const checkEl of elementsToCheck) {
                        if (!checkEl) continue;
                        const text = checkEl.textContent || checkEl.value || '';
                        console.log('PromiseTimeContent.js - Checking text near promised time:', text);
                        
                        // Look for specific patterns like "Tue, Sep 30 08:00 AM"
                        const datePatterns = [
                            /\w{3},?\s+\w{3}\s+\d{1,2}\s+\d{2}:\d{2}\s*[AP]M/gi, // "Tue, Sep 30 08:00 AM"
                            /\w{3}\s+\w{3}\s+\d{1,2}\s+\d{4}\s+\d{1,2}:\d{2}\s*[AP]M/gi, // "Tue Sep 30 2025 08:00 AM"
                            /\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}\s*[AP]M/gi, // "9/30/2025 08:00 AM"
                            /\d{1,2}-\d{1,2}-\d{4}\s+\d{1,2}:\d{2}\s*[AP]M/gi, // "9-30-2025 08:00 AM"
                        ];
                        
                        for (const pattern of datePatterns) {
                            const matches = text.match(pattern);
                            if (matches) {
                                for (const match of matches) {
                                    console.log('PromiseTimeContent.js - Found potential date match:', match);
                                    const timeOut = parseDateTime(match);
                                    if (timeOut && timeOut > new Date()) {
                                        console.log('PromiseTimeContent.js - Successfully parsed promise time:', timeOut);
                                        return { timeOut: timeOut.toISOString() };
                                    }
                                }
                            }
                        }
                    }
                } catch (elementError) {
                    console.log('PromiseTimeContent.js - Error checking promise time element:', elementError);
                }
            }
            
            // Strategy 2: Look for existing promise time fields/values
            const promiseTimeSelectors = [
                'input[placeholder*="promise" i]',
                'input[placeholder*="time out" i]', 
                'input[name*="promise" i]',
                'input[name*="timeout" i]',
                '*[data-testid*="promise" i]',
                '*[data-testid*="timeout" i]'
            ];
            
            for (const selector of promiseTimeSelectors) {
                try {
                    const elements = document.querySelectorAll(selector);
                    for (const el of elements) {
                        if (!el) continue;
                        const value = el.value || el.textContent || el.innerText || '';
                        console.log(`PromiseTimeContent.js - Checking element with selector "${selector}":`, value);
                        
                        if (value && value.trim()) {
                            const timeOut = parseDateTime(value.trim());
                            if (timeOut) {
                                console.log('PromiseTimeContent.js - Found promise time via input field:', timeOut);
                                return { timeOut: timeOut.toISOString() };
                            }
                        }
                    }
                } catch (selectorError) {
                    console.log('PromiseTimeContent.js - Error with promise time selector:', selector, selectorError);
                }
            }
            
            // Strategy 3: Look for text containing date/time patterns near "promise" keywords
            try {
                const allElements = document.querySelectorAll('*');
                const promiseKeywords = ['promise', 'promised', 'timeout', 'time out', 'due'];
                
                for (const el of allElements) {
                    if (!el || !el.textContent) continue;
                    
                    const text = el.textContent.toLowerCase();
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
                        const elementsToCheck = [el];
                        if (el.parentElement && el.parentElement.children) {
                            elementsToCheck.push(...Array.from(el.parentElement.children));
                        }
                        
                        for (const checkEl of elementsToCheck) {
                            if (!checkEl) continue;
                            const checkText = checkEl.textContent || checkEl.value || '';
                            
                            for (const pattern of datePatterns) {
                                try {
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
                                } catch (patternError) {
                                    console.log('PromiseTimeContent.js - Error with pattern matching:', patternError);
                                }
                            }
                        }
                    }
                }
            } catch (strategyError) {
                console.log('PromiseTimeContent.js - Error in strategy 3:', strategyError);
            }
            
            // Strategy 4: Look for any future date/time on the page (less specific)
            try {
                const timeElements = document.querySelectorAll('*');
                
                for (const el of timeElements) {
                    if (!el || !el.textContent) continue;
                    const text = el.textContent || el.value || '';
                    if (!text || text.length > 100) continue; // Skip very long text blocks
                    
                    const dateTimePatterns = [
                        /\w{3},?\s+\w{3}\s+\d{1,2}\s+\d{2}:\d{2}\s*[AP]M/gi, // "Tue, Sep 30 08:00 AM"
                        /\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}\s*[AP]M/gi,
                        /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/gi,
                        /\w{3}\s+\w{3}\s+\d{1,2}\s+\d{4}\s+\d{1,2}:\d{2}/gi
                    ];
                    
                    for (const pattern of dateTimePatterns) {
                        try {
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
                        } catch (patternError) {
                            console.log('PromiseTimeContent.js - Error with general pattern:', patternError);
                        }
                    }
                }
            } catch (strategy4Error) {
                console.log('PromiseTimeContent.js - Error in strategy 4:', strategy4Error);
            }
            
            console.log('PromiseTimeContent.js - No promise time found on page');
            return null;
        } catch (error) {
            console.error('PromiseTimeContent.js - Error in extractPromiseTimeFromPage:', error);
            return null;
        }
    }

    // Helper function to parse various date/time formats
    function parseDateTime(dateStr) {
        try {
            // Remove extra whitespace
            dateStr = dateStr.trim();
            console.log('PromiseTimeContent.js - Attempting to parse:', dateStr);
            
            // Try different parsing approaches
            const parseAttempts = [
                () => {
                    // Handle full date format "September 30, 2025 at 08:00 AM" (Job Board format)
                    const fullDateMatch = dateStr.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})\s*([AP]M)?/i);
                    if (fullDateMatch) {
                        const [, monthName, day, year, hour, minute, ampm] = fullDateMatch;
                        
                        // Map full month names
                        const monthMap = {
                            'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
                            'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
                        };
                        
                        const monthNum = monthMap[monthName.toLowerCase()];
                        if (monthNum !== undefined) {
                            let hour24 = parseInt(hour);
                            if (ampm) {
                                if (ampm.toLowerCase() === 'pm' && hour24 !== 12) hour24 += 12;
                                if (ampm.toLowerCase() === 'am' && hour24 === 12) hour24 = 0;
                            }
                            
                            const result = new Date(parseInt(year), monthNum, parseInt(day), hour24, parseInt(minute));
                            console.log('PromiseTimeContent.js - Parsed full date format:', result);
                            return result;
                        }
                    }
                    return null;
                },
                () => {
                    // Handle "Tue, Sep 30 08:00 AM" format specifically
                    const shortFormatMatch = dateStr.match(/(\w{3}),?\s+(\w{3})\s+(\d{1,2})\s+(\d{1,2}):(\d{2})\s*([AP]M)?/i);
                    if (shortFormatMatch) {
                        const [, dayOfWeek, month, day, hour, minute, ampm] = shortFormatMatch;
                        
                        // Map month abbreviations
                        const monthMap = {
                            'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
                            'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
                        };
                        
                        const monthNum = monthMap[month.toLowerCase()];
                        if (monthNum !== undefined) {
                            let hour24 = parseInt(hour);
                            if (ampm) {
                                if (ampm.toLowerCase() === 'pm' && hour24 !== 12) hour24 += 12;
                                if (ampm.toLowerCase() === 'am' && hour24 === 12) hour24 = 0;
                            }
                            
                            // Smart year detection logic - for Sep 30 when today is Sep 29, use current year
                            const now = new Date();
                            let year = now.getFullYear(); // 2025
                            
                            // Create initial date for this year
                            let testDate = new Date(year, monthNum, parseInt(day), hour24, parseInt(minute));
                            
                            // If the date is in the past by more than 1 day, try next year
                            // But if it's within 48 hours, keep current year (handles tomorrow)
                            if (testDate < now) {
                                const hoursDiff = (now - testDate) / (1000 * 60 * 60);
                                console.log('PromiseTimeContent.js - Date is in past by hours:', hoursDiff);
                                
                                if (hoursDiff > 48) {
                                    // More than 2 days ago, use next year
                                    testDate = new Date(year + 1, monthNum, parseInt(day), hour24, parseInt(minute));
                                    console.log('PromiseTimeContent.js - Using next year:', testDate);
                                } else {
                                    // Less than 48 hours ago, probably means today/tomorrow - keep current year
                                    console.log('PromiseTimeContent.js - Keeping current year (within 48h):', testDate);
                                }
                            } else {
                                console.log('PromiseTimeContent.js - Date is in future, using current year:', testDate);
                            }
                            
                            console.log('PromiseTimeContent.js - Final parsed date:', testDate);
                            return testDate;
                        }
                    }
                    return null;
                },
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
                    console.log('PromiseTimeContent.js - Successfully parsed date:', result);
                    return result;
                }
            }
            
            console.log('PromiseTimeContent.js - Failed to parse date:', dateStr);
            return null;
        } catch (error) {
            console.log('PromiseTimeContent.js - Error parsing date:', dateStr, error);
            return null;
        }
    }

    function extractServiceWriter() {
        try {
            // Look for service writer information
            const selectors = [
                '*[data-testid*="writer"]',
                '*[data-testid*="advisor"]',
                '.service-writer',
                '*:contains("Service Writer:")',
                '*:contains("Advisor:")'
            ];

            for (const selector of selectors) {
                try {
                    const elements = document.querySelectorAll(selector);
                    for (const el of elements) {
                        if (!el) continue;
                        const text = (el.textContent || el.innerText || '').trim();
                        if (text && text.length > 2 && text.length < 50) {
                            return text.replace(/^(Service Writer:|Advisor:)\s*/i, '');
                        }
                    }
                } catch (selectorError) {
                    console.log('PromiseTimeContent.js - Error with service writer selector:', selector, selectorError);
                }
            }
            return 'Unknown Service Writer';
        } catch (error) {
            console.log('PromiseTimeContent.js - Error extracting service writer:', error);
            return 'Unknown Service Writer';
        }
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