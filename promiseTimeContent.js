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

        const timeoutLabel = Array.from(document.querySelectorAll("label")).find(label =>
            label.textContent.includes("Promised Time Out")
        );

        if (timeoutLabel) {
            console.log("PromiseTimeContent.js - Found 'Promised Time Out' label:", timeoutLabel);

            const timeoutField = timeoutLabel.nextElementSibling ||
                timeoutLabel.parentElement.querySelector("div.text-shade-200.text-base.cursor-pointer.hover\\:text-shade-0");

            if (timeoutField) {
                const contentText = timeoutField.textContent.trim();
                console.log("PromiseTimeContent.js - Timeout field text content:", contentText);

                // Apply white text and light red background if the field is empty
                if (contentText.includes("Add time out")) {
                    console.log("PromiseTimeContent.js - Field is empty. Applying white text and light red background.");

                    timeoutLabel.style.cssText = "color: white !important; background-color: #f28b82 !important; padding: 2px 4px; border-radius: 4px;";
                    timeoutField.style.cssText = "color: white !important; background-color: #f28b82 !important; padding: 2px 4px; border-radius: 4px;";

                    stopCheckInterval();
                } else {
                    console.log("PromiseTimeContent.js - Promised Time Out is set. Removing custom styles.");
                    timeoutLabel.style.cssText = "";
                    timeoutField.style.cssText = "";
                    stopCheckInterval();
                }
            } else {
                console.warn("PromiseTimeContent.js - No timeout field found adjacent to the label.");
            }
        } else {
            console.warn("PromiseTimeContent.js - No 'Promised Time Out' label found on the page.");
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