chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel.setPanelBehavior({
        openPanelOnActionClick: true
    }).catch((error) => console.error("Failed to set panel behavior:", error));
});

chrome.action.onClicked.addListener(() => {
    chrome.windows.getCurrent({populate: true}, (currentWindow) => {
        chrome.sidePanel.open({
            windowId: currentWindow.id
        }).catch((error) => {
            console.error("Error opening side panel:", error);
        });
    });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "openSidePanel") {
        chrome.windows.getCurrent({populate: true}, (currentWindow) => {
            chrome.sidePanel.open({
                windowId: currentWindow.id
            }).catch((error) => {
                console.error("Error opening side panel:", error);
            });
        });
    }

    if (message.action === 'sendToTekmetric') {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'insertConversation',
                    cleanedConversation: message.cleanedConversation
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('Error forwarding message to content script:', chrome.runtime.lastError);
                    } else if (response && response.status === 'success') {
                        sendResponse({status: 'message delivered'});
                    }
                });
            } else {
                sendResponse({status: 'failed', reason: 'No active tab'});
            }
        });

        return true;
    }

    // New logic: Trigger form clearing in the side panel
    if (message.action === 'clearFormInSidePanel') {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'clearFormInSidePanel'
                });
            }
        });
    }
});

// ===============================
// PROMISE TIME FUNCTIONALITY 
// ===============================

// Section 1: Save Token and Shop ID
function saveToken(token, expirationTime, shopIdValue) {
    chrome.storage.local.set({ tekmetric_token: { token, expirationTime, shopId: shopIdValue } }, () => {
        console.log("Background.js - Token and shop_id saved for future use.");
    });
}

// Section 2: Listen for Token Requests
chrome.webRequest.onSendHeaders.addListener(
    (details) => {
        const tokenPattern = /https:\/\/shop\.tekmetric\.com\/api\/token\/shop\/(\d+)/;
        const match = details.url.match(tokenPattern);

        if (match) {
            const shopIdValue = match[1];
            console.log('Background.js - Checking URL for Tekmetric token:', details.url);

            setTimeout(() => {
                const tokenHeader = details.requestHeaders.find(header => header.name.toLowerCase() === 'x-auth-token');
                const token = tokenHeader ? tokenHeader.value : null;
                const expirationTime = Date.now() + (8 * 24 * 60 * 60 * 1000); // Token expires in 8 days

                if (token) {
                    console.log('Background.js - Captured Tekmetric Token:', token);
                    console.log('Background.js - Token expiration set for:', new Date(expirationTime));
                    saveToken(token, expirationTime, shopIdValue); // Save token and shop_id
                } else {
                    console.error('Background.js - x-auth-token not found in request headers.');
                }
            }, 500);
        }
    },
    { urls: ["https://shop.tekmetric.com/api/token/shop/*"] },
    ["requestHeaders"]
);

// Section 3: Listen for Repair-Order Summary Requests
chrome.webRequest.onCompleted.addListener(
    (details) => {
        const roPattern = /https:\/\/shop\.tekmetric\.com\/api\/repair-order\/(\d+)\/summary/;
        const match = details.url.match(roPattern);

        if (match) {
            const roId = match[1];
            console.log('Background.js - Detected repair-order summary request:', details.url);
            console.log('Background.js - Extracted ro_id:', roId);

            // Store roId in chrome storage for use in popup
            chrome.storage.local.set({ roId }, () => {
                console.log("Background.js - Stored roId for future use:", roId);
            });

            // Retrieve shopId from storage and pass it along with roId to makeApiCall
            chrome.storage.local.get('tekmetric_token', (result) => {
                const shopId = result.tekmetric_token ? result.tekmetric_token.shopId : null;
                if (shopId) {
                    makeApiCall(shopId, roId);
                } else {
                    console.error("Background.js - shopId is missing or invalid.");
                }
            });
        }
    },
    { urls: ["https://shop.tekmetric.com/api/repair-order/*/summary"] }
);

// Section 4: Make API Call to Retrieve Repair Order Details
async function makeApiCall(shopId, roId) {
    if (!shopId || !roId) {
        console.error("Background.js - Missing shopId or roId for API call.");
        return;
    }

    chrome.storage.local.get('tekmetric_token', async (result) => {
        if (result.tekmetric_token && result.tekmetric_token.token) {
            const token = result.tekmetric_token.token;
            const apiUrl = `https://shop.tekmetric.com/api/shop/${shopId}/repair-order/${roId}`;
            console.log(`Background.js - Constructed API URL: ${apiUrl}`);

            try {
                const response = await fetch(apiUrl, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-AUTH-TOKEN': token
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log("Background.js - Full Response Data:", data);

                    // Extract and log each required detail
                    const customerFullName = data.customer?.fullName;
                    const repairOrderNumber = data.repairOrderNumber;
                    const serviceWriterName = data.serviceWriterAccountFullName;
                    const vehicleDescription = data.vehicle?.description;
                    const customerTimeOut = data.customerTimeOut;

                    console.log("Background.js - Customer Full Name:", customerFullName);
                    console.log("Background.js - Repair Order Number:", repairOrderNumber);
                    console.log("Background.js - Service Writer Name:", serviceWriterName);
                    console.log("Background.js - Vehicle Description:", vehicleDescription);
                    console.log("Background.js - Customer Timeout:", customerTimeOut);

                    // Store details in local storage
                    chrome.storage.local.set({
                        customerFullName: customerFullName || "N/A",
                        repairOrderNumber: repairOrderNumber || "N/A",
                        serviceWriterName: serviceWriterName || "N/A",
                        vehicleDescription: vehicleDescription || "N/A",
                        customerTimeOut: customerTimeOut || null
                    }, () => {
                        console.log("Background.js - Stored customer and repair order details.");
                    });

                    // Start timeout check if customerTimeOut is available
                    if (customerTimeOut) {
                        startTimeoutCheck(customerTimeOut);
                    } else {
                        console.warn("Background.js - No customerTimeOut found in response data.");
                    }
                } else {
                    console.error("Background.js - Failed to fetch repair order details:", response.status, response.statusText);
                }
            } catch (error) {
                console.error("Background.js - Error fetching repair order details:", error);
            }
        } else {
            console.error("Background.js - Tekmetric token is missing or invalid.");
        }
    });
}

// Section 5: Start Timeout Check for Alerts
function startTimeoutCheck(customerTimeOut) {
    const timeoutDate = new Date(customerTimeOut).getTime();
    console.log("Background.js - Starting timeout check. Target timeout date (Local):", new Date(timeoutDate).toLocaleString());

    chrome.storage.sync.get(['warningIntervals', 'snoozeUntil'], (data) => {
        const intervals = data.warningIntervals ? data.warningIntervals.map(minutes => minutes * 60 * 1000) : [60 * 60 * 1000, 60 * 1000];
        intervals.sort((a, b) => b - a); // Sort intervals from largest to smallest
        console.log("Background.js - User-defined warning intervals (ms):", intervals);

        let triggeredAlerts = Array(intervals.length).fill(false);

        const intervalCheck = setInterval(() => {
            const currentTime = Date.now();
            const timeLeft = timeoutDate - currentTime;

            console.log("Background.js - Checking intervals. Current time (Local):", new Date(currentTime).toLocaleString());
            console.log("Background.js - Time left until timeout (ms):", timeLeft);

            // Section 5.1: Check for Snooze
            if (data.snoozeUntil && currentTime < data.snoozeUntil) {
                console.log("Background.js - Notification snoozed until:", new Date(data.snoozeUntil).toLocaleString());
                return; // Skip alert if snoozed
            }

            if (timeLeft <= 0) {
                clearInterval(intervalCheck);
                console.log("Background.js - Timeout has passed. Opening final alert popup.");
                chrome.windows.create({
                    url: 'promiseTimePopup.html',
                    type: 'popup',
                    width: 400,
                    height: 300
                });
            } else {
                intervals.forEach((interval, index) => {
                    if (timeLeft <= interval && !triggeredAlerts[index]) {
                        console.log(`Background.js - Interval alert for ${interval / (60 * 1000)} minutes remaining. Opening popup.`);
                        triggeredAlerts[index] = true;
                        chrome.windows.create({
                            url: 'promiseTimePopup.html',
                            type: 'popup',
                            width: 400,
                            height: 300
                        });
                    }
                });
            }
        }, 60 * 1000); // Check every minute
    });
}

// Section 6: SPA URL Change Detection for Content Script Injection
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    const targetUrlPattern = /https:\/\/shop\.tekmetric\.com\/admin\/shop\/\d+\/repair-orders\/\d+/;

    if (targetUrlPattern.test(details.url)) {
        console.log("Background.js - Detected relevant SPA URL change:", details.url);

        // Try sending a message to an existing content script to start checking
        chrome.tabs.sendMessage(details.tabId, { action: 'start_promise_check' }, (response) => {
            if (chrome.runtime.lastError) {
                // If content script is not already present, inject it
                console.log("Background.js - Promise time content script not found, injecting script...");
                chrome.scripting.executeScript({
                    target: { tabId: details.tabId },
                    files: ["promiseTimeContent.js"]
                });
            } else {
                console.log("Background.js - Promise time content script already active, message sent successfully.");
            }
        });
    }
});
