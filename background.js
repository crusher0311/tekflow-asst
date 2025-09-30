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
    
    // Handle clearing notification tracking for testing
    if (message.action === 'clearNotificationTracking') {
        chrome.storage.local.remove(['lastNotificationCheck'], () => {
            console.log('Background.js - Notification tracking cleared for testing');
            sendResponse({status: 'notification_tracking_cleared'});
        });
        return true;
    }
    
    if (message.action === 'clearBlinkingBadge') {
        console.log('Background.js - Manual badge clear requested');
        clearBlinkingBadge();
        // Force recheck of expired items
        setTimeout(checkExpiredPromiseTimes, 100);
        sendResponse({status: 'badge_cleared'});
        return true;
    }
    
    if (message.action === 'forceExpiredCheck') {
        console.log('Background.js - Forced expired items check requested');
        checkExpiredPromiseTimes();
        sendResponse({status: 'expired_check_completed'});
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
                    width: 500,
                    height: 450
                });
            } else {
                intervals.forEach((interval, index) => {
                    if (timeLeft <= interval && !triggeredAlerts[index]) {
                        console.log(`Background.js - Interval alert for ${interval / (60 * 1000)} minutes remaining. Opening popup.`);
                        triggeredAlerts[index] = true;
                        chrome.windows.create({
                            url: 'promiseTimePopup.html',
                            type: 'popup',
                            width: 500,
                            height: 450
                        });
                    }
                });
            }
        }, 5 * 1000); // Check every 5 seconds
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
        roUrl: data.roUrl, // Add URL for click functionality
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
        roId: data.roId,
        roUrl: data.roUrl // Store URL for quick access
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
        const currentTimeReadable = new Date(currentTime).toLocaleString();
        
        console.log(`Background.js - updatePromiseTimeDashboard: Current time is ${currentTimeReadable}`);
        console.log(`Background.js - Processing ${tracking.length} promise time entries`);
        
        // Filter out expired timeouts and calculate remaining time
        const activePromises = tracking
            .map(item => {
                const timeoutDate = new Date(item.customerTimeOut).getTime();
                const timeoutDateReadable = new Date(timeoutDate).toLocaleString();
                const timeRemaining = timeoutDate - currentTime;
                const minutesRemaining = Math.floor(timeRemaining / (1000 * 60));
                
                console.log(`Background.js - RO ${item.repairOrderNumber}:`);
                console.log(`  Promise Time: ${timeoutDateReadable}`);
                console.log(`  Current Time: ${currentTimeReadable}`);
                console.log(`  Time Remaining: ${minutesRemaining} minutes (${timeRemaining}ms)`);
                console.log(`  Is Expired: ${timeRemaining <= 0}`);
                
                return {
                    ...item,
                    timeRemaining: timeRemaining,
                    isExpired: timeRemaining <= 0,
                    urgencyLevel: getUrgencyLevel(timeRemaining)
                };
            })
            .sort((a, b) => {
                // Sort expired items first (most urgent), then by time remaining
                if (a.isExpired && !b.isExpired) return -1;
                if (!a.isExpired && b.isExpired) return 1;
                return a.timeRemaining - b.timeRemaining;
            }); // Sort expired first, then by urgency (least time first)
        
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
    
    if (minutes <= 0) return 'expired';  // New: expired status
    if (minutes <= 30) return 'urgent';
    if (minutes <= 60) return 'warning';
    return 'safe';
}

// Check for Promise Time notifications
function checkForPromiseTimeNotifications(activePromises) {
    console.log('Background.js - Checking for notifications, active promises:', activePromises.length);
    
    chrome.storage.local.get(['promiseTimeAlerts', 'lastNotificationCheck'], (result) => {
        const alertIntervals = result.promiseTimeAlerts || [60, 30, 10, 5, 1]; // Default intervals in minutes
        const lastCheck = result.lastNotificationCheck || {};
        const currentTime = Date.now();
        
        console.log('Background.js - Alert intervals:', alertIntervals);
        console.log('Background.js - Last notification check:', lastCheck);
        
        activePromises.forEach(promise => {
            const minutesRemaining = Math.floor(promise.timeRemaining / (1000 * 60));
            const secondsRemaining = Math.floor(promise.timeRemaining / 1000);
            const roId = promise.roId;
            
            console.log(`Background.js - Checking RO ${promise.repairOrderNumber}:`);
            console.log(`  Time remaining: ${minutesRemaining} minutes (${secondsRemaining} seconds)`);
            console.log(`  Raw milliseconds: ${promise.timeRemaining}`);
            
            alertIntervals.forEach(interval => {
                // More precise trigger logic: trigger only when exactly crossing the threshold
                let shouldTrigger = false;
                
                if (interval === 1) {
                    // 1-minute alert: trigger when 0-1 minutes remaining
                    shouldTrigger = minutesRemaining <= 1;
                } else if (interval === 5) {
                    // 5-minute alert: trigger when 4-5 minutes remaining
                    shouldTrigger = minutesRemaining <= 5 && minutesRemaining > 3;
                } else if (interval === 10) {
                    // 10-minute alert: trigger when 9-10 minutes remaining
                    shouldTrigger = minutesRemaining <= 10 && minutesRemaining > 8;
                } else if (interval === 30) {
                    // 30-minute alert: trigger when 29-30 minutes remaining
                    shouldTrigger = minutesRemaining <= 30 && minutesRemaining > 28;
                } else if (interval === 60) {
                    // 60-minute alert: trigger when 58-62 minutes remaining (wider window for reliability)
                    shouldTrigger = minutesRemaining <= 62 && minutesRemaining >= 58;
                } else {
                    // Generic logic for other intervals
                    shouldTrigger = minutesRemaining <= interval && minutesRemaining > (interval - 2);
                }
                
                const notificationKey = `${roId}_${interval}`;
                const alreadyNotified = lastCheck[notificationKey];
                
                console.log(`Background.js - Interval ${interval}min: minutes=${minutesRemaining}, shouldTrigger=${shouldTrigger}, alreadyNotified=${!!alreadyNotified}`);
                
                if (shouldTrigger && !alreadyNotified) {
                    console.log(`Background.js - 🔔 TRIGGERING notification for RO ${promise.repairOrderNumber}: ${interval} minute alert`);
                    showPromiseTimeNotification(promise, interval);
                    lastCheck[notificationKey] = currentTime;
                } else if (shouldTrigger && alreadyNotified) {
                    console.log(`Background.js - ⏭️ Skipping notification for RO ${promise.repairOrderNumber}: ${interval} minute alert (already notified)`);
                } else {
                    console.log(`Background.js - ❌ No trigger for ${interval}min: minutes=${minutesRemaining}, not in range`);
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
    console.log(`Background.js - showPromiseTimeNotification called for RO ${promise.repairOrderNumber}: ${minutesRemaining} minutes`);
    
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
    
    const notificationId = `promise_${promise.roId}_${minutesRemaining}_${Date.now()}`;
    console.log(`Background.js - Creating notification with ID: ${notificationId}`);
    
    // Clear any existing notifications for this RO to avoid clutter
    chrome.notifications.clear(`promise_${promise.roId}_${minutesRemaining}`, () => {
        // Create new notification with enhanced Windows visibility
        chrome.notifications.create(notificationId, {
            type: 'basic',
            iconUrl: 'images/icon48.png',
            title: title,
            message: message,
            priority: minutesRemaining <= 5 ? 2 : 1, // High priority for urgent notifications
            requireInteraction: minutesRemaining <= 5, // Keep urgent notifications visible
            silent: false, // Ensure sound plays
            eventTime: Date.now() + 60000 // Keep visible for 1 minute
        }, (notificationId) => {
            if (chrome.runtime.lastError) {
                console.error('Background.js - Error creating notification:', chrome.runtime.lastError);
            } else {
                console.log(`Background.js - Notification created successfully: ${notificationId}`);
                
                // Play audio alert for ALL interval notifications (60, 30, 10, 5, 1 minutes)
                console.log(`Background.js - Playing audio alert for ${minutesRemaining} minutes remaining`);
                playAudioAlert(minutesRemaining);
                
                // Create popup window for important alerts (60, 30, 10, 5, 1 minutes)
                if ([60, 30, 10, 5, 1].includes(minutesRemaining)) {
                    console.log(`Background.js - Creating popup window for ${minutesRemaining} minute alert`);
                    createAlertPopup(promise, minutesRemaining);
                }
                
                // For Windows: Try to bring extension to front for urgent notifications
                if (minutesRemaining <= 1) {
                    try {
                        chrome.action.setBadgeText({text: '!'});
                        chrome.action.setBadgeBackgroundColor({color: '#ff0000'});
                        
                        // Clear badge after 30 seconds
                        setTimeout(() => {
                            chrome.action.setBadgeText({text: ''});
                        }, 30000);
                    } catch (error) {
                        console.log('Background.js - Could not set badge:', error);
                    }
                }
            }
        });
    });
}

// Play audio alert for urgent notifications
function playAudioAlert(minutesRemaining) {
    try {
        // Create audio context for sound alerts
        console.log(`Background.js - Playing audio alert for ${minutesRemaining} minutes remaining`);
        
        // Inject script into active tab to play audio (since service workers can't directly play audio)
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs.length > 0) {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: (minutes) => {
                        console.log(`Playing audio alert for ${minutes} minutes remaining`);
                        
                        try {
                            // Create audio context and play alert tone
                            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                            
                            // Resume audio context if suspended (required for Chrome)
                            if (audioContext.state === 'suspended') {
                                audioContext.resume().then(() => {
                                    console.log('Audio context resumed');
                                    playBeeps();
                                });
                            } else {
                                playBeeps();
                            }
                            
                            function playBeeps() {
                                // Play different tones based on urgency
                                const frequencies = minutes <= 5 ? [800, 1000, 800, 1000] : [600, 800]; 
                                let beepIndex = 0;
                                
                                function playBeep(frequency, duration = 300) {
                                    const oscillator = audioContext.createOscillator();
                                    const gainNode = audioContext.createGain();
                                    
                                    oscillator.connect(gainNode);
                                    gainNode.connect(audioContext.destination);
                                    
                                    oscillator.frequency.value = frequency;
                                    oscillator.type = 'sine';
                                    
                                    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                                    gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.01);
                                    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration / 1000);
                                    
                                    oscillator.start(audioContext.currentTime);
                                    oscillator.stop(audioContext.currentTime + duration / 1000);
                                    
                                    console.log(`Played beep ${beepIndex + 1} at ${frequency}Hz`);
                                    
                                    beepIndex++;
                                    if (beepIndex < frequencies.length) {
                                        setTimeout(() => playBeep(frequencies[beepIndex]), duration + 100);
                                    }
                                }
                                
                                playBeep(frequencies[0]);
                            }
                        } catch (error) {
                            console.error('Audio alert error:', error);
                            
                            // Fallback: Try to play a simple beep using system bell
                            try {
                                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjaAy/DQgDAFIWmz8N2PQAoUXrTp66hVFApGn+DyvmwhBTp1wPDGgjQGI2mk7+CZQQQ=');
                                audio.play().catch(e => console.log('Fallback audio failed:', e));
                            } catch (fallbackError) {
                                console.log('All audio methods failed');
                            }
                        }
                    },
                    args: [minutesRemaining]
                }, (result) => {
                    if (chrome.runtime.lastError) {
                        console.error('Background.js - Error injecting audio script:', chrome.runtime.lastError);
                    } else {
                        console.log('Background.js - Audio script injected successfully');
                    }
                });
            } else {
                console.log('Background.js - No active tab found for audio alert');
            }
        });
    } catch (error) {
        console.error('Background.js - Error setting up audio alert:', error);
    }
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

// Check for expired promise times and set blinking hazard badge
function checkExpiredPromiseTimes() {
    chrome.storage.local.get(['promiseTimeDashboardData'], (result) => {
        const dashboardData = result.promiseTimeDashboardData || [];
        const currentTime = Date.now();
        
        const expiredItems = dashboardData.filter(item => {
            const promiseTime = new Date(item.customerTimeOut).getTime();
            return promiseTime <= currentTime;
        });
        
        console.log(`Background.js - Checking expired items: ${expiredItems.length} of ${dashboardData.length} total`);
        
        if (expiredItems.length > 0) {
            console.log(`Background.js - Found ${expiredItems.length} expired promise time(s):`);
            expiredItems.forEach(item => {
                console.log(`  - RO #${item.repairOrderNumber}: expired ${Math.round((currentTime - new Date(item.customerTimeOut).getTime()) / (1000 * 60))} minutes ago`);
            });
            setBlinkingHazardBadge(expiredItems.length);
        } else {
            console.log('Background.js - No expired items found, clearing badge');
            clearBlinkingBadge();
        }
    });
}

let blinkInterval = null;

function clearBlinkingBadge() {
    // Clear any existing blink interval
    if (blinkInterval) {
        clearInterval(blinkInterval);
        blinkInterval = null;
        console.log('Background.js - Cleared blinking badge interval');
    }
    
    // Clear the badge completely
    chrome.action.setBadgeText({text: ''});
    chrome.action.setBadgeBackgroundColor({color: '#666666'}); // Reset to default
}

function setBlinkingHazardBadge(expiredCount) {
    // Clear any existing blink interval first
    clearBlinkingBadge();
    
    let isVisible = true;
    
    blinkInterval = setInterval(() => {
        if (isVisible) {
            chrome.action.setBadgeText({text: '⚠️'});
            chrome.action.setBadgeBackgroundColor({color: '#ff0000'});
        } else {
            chrome.action.setBadgeText({text: ''});
        }
        isVisible = !isVisible;
    }, 1000); // Blink every second
}

// Start checking for expired items every 5 seconds
setInterval(checkExpiredPromiseTimes, 5000);

// Listen for changes to promise time data and immediately recheck expired items
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.promiseTimeDashboardData) {
        console.log('Background.js - Promise time data changed, rechecking expired items');
        // Force immediate recheck when data changes
        setTimeout(checkExpiredPromiseTimes, 100);
    }
});

// Force initial check when background script starts
setTimeout(checkExpiredPromiseTimes, 1000);

// Create visible alert popup for critical notifications
let activePopups = new Set(); // Track active popup windows by RO ID

function createAlertPopup(promise, minutesRemaining) {
    const popupKey = `${promise.roId}_${minutesRemaining}`;
    
    // Prevent duplicate popups for the same RO and interval
    if (activePopups.has(popupKey)) {
        console.log(`Background.js - Popup already exists for RO ${promise.repairOrderNumber} at ${minutesRemaining} minutes, skipping`);
        return;
    }
    
    activePopups.add(popupKey);
    console.log(`Background.js - Creating alert popup for RO ${promise.repairOrderNumber}: ${minutesRemaining} minutes`);
    
    // Auto-cleanup: remove from activePopups after 5 minutes to prevent memory leaks
    setTimeout(() => {
        activePopups.delete(popupKey);
        console.log(`Background.js - Auto-cleaned up popup key: ${popupKey}`);
    }, 5 * 60 * 1000);
    
    // Store the promise data for the popup
    chrome.storage.local.set({
        customerTimeOut: promise.customerTimeOut,
        serviceWriterName: promise.serviceWriterName,
        customerFullName: promise.customerFullName,
        repairOrderNumber: promise.repairOrderNumber,
        vehicleDescription: promise.vehicleDescription,
        roId: promise.roId,
        alertMinutes: minutesRemaining
    });
    
    // Create a popup window that's hard to miss
    const popupUrl = chrome.runtime.getURL('promiseTimePopup.html');
    
    // Get display info to center the popup properly
    if (chrome.system && chrome.system.display) {
        chrome.system.display.getInfo((displays) => {
            if (chrome.runtime.lastError) {
                console.error('Background.js - Error getting display info:', chrome.runtime.lastError);
                createPopupWindow(popupUrl, promise, 100, 100, popupKey); // Fallback positioning
                return;
            }
            
            const primaryDisplay = displays.find(d => d.isPrimary) || displays[0];
            const centerX = Math.floor((primaryDisplay.bounds.width - 500) / 2); // Wider window for snooze function
            const centerY = Math.floor((primaryDisplay.bounds.height - 450) / 3); // Taller window for snooze function
            
            createPopupWindow(popupUrl, promise, centerY, centerX, popupKey);
        });
    } else {
        console.log('Background.js - system.display API not available, using fallback positioning');
        createPopupWindow(popupUrl, promise, 100, 100, popupKey); // Fallback positioning
    }
}

function createPopupWindow(popupUrl, promise, top, left, popupKey) {
    chrome.windows.create({
        url: popupUrl,
        type: 'popup',
        width: 500,  // Increased from 450 to show snooze function
        height: 450, // Increased from 350 to show snooze function
        focused: true, // Bring to front
        top: top,
        left: left,
    }, (window) => {
        if (chrome.runtime.lastError) {
            console.error('Background.js - Error creating popup window:', chrome.runtime.lastError);
            // Remove from active popups if creation failed
            if (popupKey) {
                activePopups.delete(popupKey);
            }
        } else {
            console.log(`Background.js - Alert popup created for RO ${promise.repairOrderNumber} (${window.id})`);
            
            // Track window closure to clean up activePopups
            if (popupKey) {
                chrome.windows.onRemoved.addListener(function windowClosedHandler(windowId) {
                    if (windowId === window.id) {
                        activePopups.delete(popupKey);
                        console.log(`Background.js - Popup window ${windowId} closed, removed ${popupKey} from active popups`);
                        chrome.windows.onRemoved.removeListener(windowClosedHandler);
                    }
                });
            }
            
            // For extra visibility, flash the popup window
            setTimeout(() => {
                if (window && window.id) {
                    chrome.windows.update(window.id, { focused: true });
                }
            }, 500);
        }
    });
}

// Periodic dashboard update
setInterval(updatePromiseTimeDashboard, 5000); // Update every 5 seconds
