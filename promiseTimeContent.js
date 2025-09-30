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

    // Section 4: Listen for Messages from Background Script to Start Checking
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'start_promise_check') {
            console.log("PromiseTimeContent.js - Message received to start checking Promised Time Out field.");
            startCheckInterval();
            sendResponse({status: 'promise_check_started'});
        }
    });

    // Auto-start checking when script loads on repair order pages
    if (window.location.href.includes('/repair-orders/')) {
        setTimeout(startCheckInterval, 1000);
    }
})();