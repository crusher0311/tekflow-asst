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
    
    // Handle Promise Time Dashboard refresh
    if (message.action === 'refreshPromiseDashboard') {
        updatePromiseTimeDashboard();
        sendResponse({status: 'dashboard_refreshed'});
        return true;
    }
    
    // Handle storing promise time data from page scanning
    if (message.action === 'storePromiseTimeData') {
        storePromiseTimeData(message.data);
        sendResponse({status: 'promise_time_data_stored'});
        return true;
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

                    // Store in Promise Time tracking array
                    if (customerTimeOut) {
                        addToPromiseTimeTracking({
                            roId: roId,
                            shopId: shopId,
                            customerFullName: customerFullName || "N/A",
                            repairOrderNumber: repairOrderNumber || "N/A",
                            serviceWriterName: serviceWriterName || "N/A",
                            vehicleDescription: vehicleDescription || "N/A",
                            customerTimeOut: customerTimeOut,
                            addedAt: Date.now()
                        });
                        
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

// ===============================
// PROMISE TIME TRACKING SYSTEM
// ===============================

// Add RO to Promise Time tracking
function addToPromiseTimeTracking(roData) {
    chrome.storage.local.get(['promiseTimeTracking'], (result) => {
        let tracking = result.promiseTimeTracking || [];
        
        // Remove existing entry for this RO if it exists
        tracking = tracking.filter(item => item.roId !== roData.roId);
        
        // Add new entry
        tracking.push(roData);
        
        // Store updated tracking
        chrome.storage.local.set({ promiseTimeTracking: tracking }, () => {
            console.log("Background.js - Added RO to Promise Time tracking:", roData.repairOrderNumber);
            updatePromiseTimeDashboard();
        });
    });
}

// Store promise time data extracted from page scanning
function storePromiseTimeData(data) {
    console.log("Background.js - Storing promise time data from page:", data);
    
    // Create a properly formatted RO data object
    const roData = {
        customerTimeOut: data.customerTimeOut,
        customerFullName: data.customerFullName,
        vehicleDescription: data.vehicleDescription,
        repairOrderNumber: data.repairOrderNumber,
        serviceWriterName: data.serviceWriterName,
        shopId: data.shopId,
        roId: data.roId,
        lastUpdated: new Date().toISOString()
    };
    
    // Add to tracking system
    addToPromiseTimeTracking(roData);
    
    // Also store in individual storage for sidepanel monitor
    chrome.storage.local.set({
        customerTimeOut: data.customerTimeOut,
        customerFullName: data.customerFullName,
        vehicleDescription: data.vehicleDescription,
        repairOrderNumber: data.repairOrderNumber,
        roId: data.roId
    });
}

// Remove RO from Promise Time tracking (when timeout expires or is cancelled)
function removeFromPromiseTimeTracking(roId) {
    chrome.storage.local.get(['promiseTimeTracking'], (result) => {
        let tracking = result.promiseTimeTracking || [];
        tracking = tracking.filter(item => item.roId !== roId);
        
        chrome.storage.local.set({ promiseTimeTracking: tracking }, () => {
            console.log("Background.js - Removed RO from Promise Time tracking:", roId);
            updatePromiseTimeDashboard();
        });
    });
}

// Update Promise Time Dashboard data
function updatePromiseTimeDashboard() {
    chrome.storage.local.get(['promiseTimeTracking'], (result) => {
        const tracking = result.promiseTimeTracking || [];
        const currentTime = Date.now();
        
        // Filter out expired timeouts and calculate remaining time
        const activePromises = tracking
            .map(item => {
                const timeoutDate = new Date(item.customerTimeOut).getTime();
                const timeRemaining = timeoutDate - currentTime;
                
                return {
                    ...item,
                    timeRemaining: timeRemaining,
                    isExpired: timeRemaining <= 0,
                    urgencyLevel: getUrgencyLevel(timeRemaining)
                };
            })
            .filter(item => !item.isExpired) // Remove expired ones
            .sort((a, b) => a.timeRemaining - b.timeRemaining); // Sort by urgency (least time first)
        
        // Update storage with cleaned data
        const cleanedTracking = activePromises.map(item => {
            const { timeRemaining, isExpired, urgencyLevel, ...cleanItem } = item;
            return cleanItem;
        });
        
        chrome.storage.local.set({ 
            promiseTimeTracking: cleanedTracking,
            promiseTimeDashboardData: activePromises 
        });
        
        // Check for notifications
        checkForPromiseTimeNotifications(activePromises);
    });
}

// Get urgency level based on time remaining
function getUrgencyLevel(timeRemaining) {
    const minutes = timeRemaining / (1000 * 60);
    
    if (minutes <= 30) return 'urgent';
    if (minutes <= 60) return 'warning';
    return 'safe';
}

// Check for Promise Time notifications
function checkForPromiseTimeNotifications(activePromises) {
    chrome.storage.local.get(['promiseTimeAlerts', 'lastNotificationCheck'], (result) => {
        const alertIntervals = result.promiseTimeAlerts || [60, 30, 10, 5, 1]; // Default intervals in minutes
        const lastCheck = result.lastNotificationCheck || {};
        const currentTime = Date.now();
        
        activePromises.forEach(promise => {
            const minutesRemaining = promise.timeRemaining / (1000 * 60);
            const roId = promise.roId;
            
            alertIntervals.forEach(interval => {
                // Check if we need to show notification for this interval
                if (minutesRemaining <= interval && minutesRemaining > (interval - 1)) {
                    const notificationKey = `${roId}_${interval}`;
                    
                    // Only show if we haven't already notified for this RO and interval
                    if (!lastCheck[notificationKey]) {
                        showPromiseTimeNotification(promise, interval);
                        lastCheck[notificationKey] = currentTime;
                    }
                }
            });
        });
        
        // Clean up old notification tracking (older than 24 hours)
        const dayOld = currentTime - (24 * 60 * 60 * 1000);
        Object.keys(lastCheck).forEach(key => {
            if (lastCheck[key] < dayOld) {
                delete lastCheck[key];
            }
        });
        
        chrome.storage.local.set({ lastNotificationCheck: lastCheck });
    });
}

// Show Promise Time notification
function showPromiseTimeNotification(promise, minutesRemaining) {
    const title = `Promise Time Alert - RO #${promise.repairOrderNumber}`;
    let message;
    
    if (minutesRemaining <= 1) {
        message = `⚠️ URGENT: Promise time expires in 1 minute or less!\nCustomer: ${promise.customerFullName}\nVehicle: ${promise.vehicleDescription}`;
    } else if (minutesRemaining <= 5) {
        message = `🚨 Promise time expires in ${minutesRemaining} minutes!\nCustomer: ${promise.customerFullName}\nVehicle: ${promise.vehicleDescription}`;
    } else if (minutesRemaining <= 10) {
        message = `⏰ Promise time expires in ${minutesRemaining} minutes\nCustomer: ${promise.customerFullName}\nVehicle: ${promise.vehicleDescription}`;
    } else {
        message = `📋 Promise time reminder: ${minutesRemaining} minutes remaining\nCustomer: ${promise.customerFullName}\nVehicle: ${promise.vehicleDescription}`;
    }
    
    chrome.notifications.create(`promise_${promise.roId}_${minutesRemaining}`, {
        type: 'basic',
        iconUrl: 'images/icon48.png',
        title: title,
        message: message,
        priority: minutesRemaining <= 5 ? 2 : 1 // High priority for urgent notifications
    });
    
    console.log(`Background.js - Notification shown for RO ${promise.repairOrderNumber}: ${minutesRemaining} minutes remaining`);
}

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
    if (notificationId.startsWith('promise_')) {
        // Extract RO ID from notification ID
        const parts = notificationId.split('_');
        const roId = parts[1];
        
        // Find the RO data to get shop ID
        chrome.storage.local.get(['promiseTimeTracking'], (result) => {
            const tracking = result.promiseTimeTracking || [];
            const roData = tracking.find(item => item.roId === roId);
            
            if (roData && roData.shopId) {
                // Open the repair order in Tekmetric
                chrome.tabs.create({
                    url: `https://shop.tekmetric.com/admin/shop/${roData.shopId}/repair-orders/${roId}/estimate`
                });
            }
        });
        
        // Clear the notification
        chrome.notifications.clear(notificationId);
    }
});

// Periodic dashboard update
setInterval(updatePromiseTimeDashboard, 60000); // Update every minute
