import { handleSubmitConcern, submitConversationForReview, handleDone, copyConversation, clearForm, sendToTekmetric } from './ui.js';

// Initialize theme on page load
document.addEventListener('DOMContentLoaded', function() {
    chrome.storage.sync.get(['theme'], function(result) {
        const theme = result.theme || 'dark';
        document.documentElement.setAttribute('data-theme', theme);
    });

    // Add Enter key event listener for concern input
    const concernInput = document.getElementById('concernInput');
    if (concernInput) {
        concernInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault(); // Prevents the default behavior (like line break)
                handleSubmitConcern(); // Triggers the concern submission
            }
        });
    }

    // Initialize Promise Time Dashboard
    initializePromiseTimeDashboard();
    
    // Add event listener for Promise Time Dashboard button
    const promiseTimeDashboardBtn = document.getElementById('openPromiseDashboardButton');
    if (promiseTimeDashboardBtn) {
        promiseTimeDashboardBtn.addEventListener('click', openPromiseTimeDashboard);
    }
});

// ===============================
// PROMISE TIME DASHBOARD POPUP
// ===============================

function openPromiseTimeDashboard() {
    // Hide the main customer concern content and show promise time dashboard
    const customerConcernContent = document.getElementById('extension-content');
    let dashboardContent = document.getElementById('promise-dashboard-content');
    
    if (!dashboardContent) {
        // Create dashboard content dynamically
        dashboardContent = createPromiseTimeDashboardContent();
        document.body.appendChild(dashboardContent);
    }
    
    // Hide main content and show dashboard
    customerConcernContent.style.display = 'none';
    dashboardContent.style.display = 'block';
    
    // Initialize dashboard
    loadDashboardData();
}

function createPromiseTimeDashboardContent() {
    const dashboardDiv = document.createElement('div');
    dashboardDiv.id = 'promise-dashboard-content';
    dashboardDiv.style.display = 'none';
    dashboardDiv.style.padding = '16px';
    dashboardDiv.style.backgroundColor = 'var(--bg-primary)';
    dashboardDiv.style.color = 'var(--text-primary)';
    dashboardDiv.style.height = '100vh';
    dashboardDiv.style.overflow = 'auto';
    
    dashboardDiv.innerHTML = `
        <div id="dashboard-header">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
                <button id="backToConcernBtn" style="background-color: var(--bg-tertiary); color: var(--text-muted); border: 1px solid var(--border-color); padding: 6px; border-radius: var(--radius); cursor: pointer; transition: all 0.2s; font-size: 16px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;" title="Back to concerns">←</button>
                <h2 style="color: var(--text-primary); margin: 0; font-size: 20px; white-space: nowrap; flex-grow: 1; text-align: center;">Promise Time Dashboard</h2>
                <button id="testNotificationsBtn" style="background-color: var(--bg-tertiary); color: var(--text-muted); border: 1px solid var(--border-color); padding: 6px; border-radius: var(--radius); cursor: pointer; transition: all 0.2s; font-size: 11px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;" title="Test notifications">🔔</button>
            </div>
            <div style="display: flex; justify-content: center; gap: 10px; margin-bottom: 20px;">
                <button id="refreshDashboardBtn" style="background-color: var(--accent-blue); color: white; border: none; padding: 8px 16px; border-radius: var(--radius); cursor: pointer; transition: background-color 0.2s; width: auto; display: inline-flex; align-items: center; gap: 6px;">🔄 Refresh</button>
                <button id="clearBadgeBtn" style="background-color: var(--accent-red, #f28b82); color: white; border: none; padding: 8px 16px; border-radius: var(--radius); cursor: pointer; transition: background-color 0.2s; width: auto; display: inline-flex; align-items: center; gap: 6px;" title="Clear blinking badge">🚫 Clear Badge</button>
            </div>
            <div id="dashboardCount" style="color: var(--text-muted); margin-bottom: 15px; font-size: 14px;">Loading...</div>
        </div>
        <div id="promiseTimeList" style="max-height: 400px; overflow-y: auto;">
            <div class="empty-dashboard" style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
                <h3 style="color: var(--text-secondary); margin-bottom: 10px;">Loading Promise Times...</h3>
                <p style="margin: 0;">Please wait while we load your active promise times.</p>
            </div>
        </div>
    `;
    
    // Add event listeners
    setTimeout(() => {
        const backBtn = dashboardDiv.querySelector('#backToConcernBtn');
        const refreshBtn = dashboardDiv.querySelector('#refreshDashboardBtn');
        const clearBadgeBtn = dashboardDiv.querySelector('#clearBadgeBtn');
        const testBtn = dashboardDiv.querySelector('#testNotificationsBtn');
        
        // Add hover effects
        backBtn?.addEventListener('mouseenter', (e) => {
            e.target.style.backgroundColor = 'var(--border-color)';
            e.target.style.color = 'var(--text-primary)';
        });
        backBtn?.addEventListener('mouseleave', (e) => {
            e.target.style.backgroundColor = 'var(--bg-tertiary)';
            e.target.style.color = 'var(--text-muted)';
        });
        refreshBtn?.addEventListener('mouseenter', (e) => e.target.style.backgroundColor = 'var(--accent-blue-hover)');
        refreshBtn?.addEventListener('mouseleave', (e) => e.target.style.backgroundColor = 'var(--accent-blue)');
        testBtn?.addEventListener('mouseenter', (e) => {
            e.target.style.backgroundColor = 'var(--border-color)';
            e.target.style.color = 'var(--text-primary)';
        });
        testBtn?.addEventListener('mouseleave', (e) => {
            e.target.style.backgroundColor = 'var(--bg-tertiary)';
            e.target.style.color = 'var(--text-muted)';
        });
        
        backBtn?.addEventListener('click', closeDashboard);
        refreshBtn?.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'refreshPromiseDashboard' });
            loadDashboardData();
        });
        clearBadgeBtn?.addEventListener('click', () => {
            // Clear the blinking badge and force recheck
            chrome.runtime.sendMessage({ action: 'clearBlinkingBadge' }, (response) => {
                console.log('Clear badge response:', response);
            });
            chrome.runtime.sendMessage({ action: 'forceExpiredCheck' }, (response) => {
                console.log('Force expired check response:', response);
            });
            alert('Badge cleared and expired items rechecked!');
        });
        testBtn?.addEventListener('click', () => {
            // Clear notification tracking and test notifications
            chrome.runtime.sendMessage({ action: 'clearNotificationTracking' }, (response) => {
                console.log('Notification tracking cleared:', response);
                
                // Also send a test 60-minute notification
                chrome.runtime.sendMessage({ action: 'testNotification', interval: 60 }, (testResponse) => {
                    console.log('Test notification response:', testResponse);
                });
                
                alert('Notification tracking cleared and 60-minute test notification sent! Check console for details.');
                // Force refresh to trigger notifications
                setTimeout(() => {
                    chrome.runtime.sendMessage({ action: 'refreshPromiseDashboard' });
                    loadDashboardData();
                }, 500);
            });
        });
    }, 100);
    
    return dashboardDiv;
}

function closeDashboard() {
    const customerConcernContent = document.getElementById('extension-content');
    const dashboardContent = document.getElementById('promise-dashboard-content');
    
    // Show main content and hide dashboard
    customerConcernContent.style.display = 'block';
    dashboardContent.style.display = 'none';
}

function loadDashboardData() {
    // First trigger a dashboard refresh to ensure we have the latest data
    chrome.runtime.sendMessage({ action: 'refreshPromiseDashboard' }, (response) => {
        console.log('loadDashboardData - Dashboard refresh response:', response);
        
        // Then load the refreshed data
        chrome.storage.local.get(['promiseTimeDashboardData'], (result) => {
            console.log('loadDashboardData - Raw storage data:', result);
            const dashboardData = result.promiseTimeDashboardData || [];
            console.log('loadDashboardData - Dashboard data:', dashboardData);
            console.log('loadDashboardData - Dashboard data length:', dashboardData.length);
            
            const listContainer = document.querySelector('#promise-dashboard-content #promiseTimeList');
            const countElement = document.querySelector('#promise-dashboard-content #dashboardCount');
            
            if (!listContainer || !countElement) return;
            
            // Update count with expired items consideration
            const expiredCount = dashboardData.filter(item => item.isExpired).length;
            const activeCount = dashboardData.length - expiredCount;
            
            console.log('loadDashboardData - Active count:', activeCount, 'Expired count:', expiredCount);
            
            let countText = '';
            if (dashboardData.length === 0) {
                countText = 'No active promise times';
            } else if (expiredCount > 0 && activeCount > 0) {
                countText = `${activeCount} active, ${expiredCount} expired promise time${(activeCount + expiredCount) === 1 ? '' : 's'}`;
            } else if (expiredCount > 0) {
                countText = `${expiredCount} expired promise time${expiredCount === 1 ? '' : 's'}`;
            } else {
                countText = `${activeCount} active promise time${activeCount === 1 ? '' : 's'}`;
            }
            countElement.textContent = countText;
            
            // Clear existing items
            listContainer.innerHTML = '';
            
            if (dashboardData.length === 0) {
                listContainer.innerHTML = `
                    <div class="empty-dashboard" style="text-align: center; padding: 40px 20px; background-color: var(--bg-secondary); border-radius: var(--radius); border: 1px solid var(--border-color);">
                        <h3 style="color: var(--text-secondary); margin-bottom: 15px;">No Active Promise Times</h3>
                        <p style="color: var(--text-muted); margin-bottom: 10px;">Promise times will appear here when they are detected on Tekmetric repair order pages.</p>
                        <p style="color: var(--text-muted); margin: 0; font-weight: 500;"><strong>Tip:</strong> Navigate to a repair order with a promise time set and click "Scan Current Page".</p>
                    </div>
                `;
                return;
            }
            
            // Create items for each promise time (already sorted by urgency)
            dashboardData.forEach(item => {
                const promiseItem = createDashboardPromiseTimeItem(item);
                listContainer.appendChild(promiseItem);
            });
        });
    });
}

function createDashboardPromiseTimeItem(data) {
    const item = document.createElement('div');
    item.className = `promise-item ${data.urgencyLevel}`;
    
    const timeRemaining = data.timeRemaining;
    const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
    
    let timeText;
    if (timeRemaining <= 0) {
        timeText = '⚠️ EXPIRED';
    } else if (hours > 0) {
        timeText = `${hours}h ${minutes}m left`;
    } else {
        timeText = `${minutes}m left`;
    }
    
    // Format promise time date
    const promiseDate = new Date(data.customerTimeOut);
    const promiseTimeFormatted = promiseDate.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
    
    item.innerHTML = `
        <div class="promise-header">
            <div class="promise-ro">RO #${data.repairOrderNumber}</div>
            <div class="promise-time ${data.urgencyLevel}">${timeText}</div>
        </div>
        <div class="promise-details">
            <div class="promise-customer"><strong>Customer:</strong> ${data.customerFullName}</div>
            <div class="promise-vehicle"><strong>Vehicle:</strong> ${data.vehicleDescription}</div>
        </div>
        <div class="promise-writer">
            <strong>Service Writer:</strong> ${data.serviceWriterName} | 
            <strong>Promise Time:</strong> ${promiseTimeFormatted}
        </div>
    `;
    
    // Add click handler to open repair order
    item.addEventListener('click', () => {
        if (data.shopId && data.roId) {
            chrome.tabs.create({
                url: `https://shop.tekmetric.com/admin/shop/${data.shopId}/repair-orders/${data.roId}/estimate`
            });
        }
    });
    
    return item;
}

function scanCurrentPageForPromiseTime() {
    // Get current active tab and scan for promise time data
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        console.log('scanCurrentPageForPromiseTime - tabs found:', tabs);
        
        if (tabs.length > 0) {
            const currentTab = tabs[0];
            console.log('scanCurrentPageForPromiseTime - current tab:', currentTab);
            
            // Check if currentTab exists
            if (!currentTab) {
                console.log('No current tab available');
                alert('Unable to access current tab. Please try again.');
                return;
            }
            
            // Check URL with more flexible matching
            const url = currentTab.url || '';
            console.log('scanCurrentPageForPromiseTime - URL:', url);
            
            // More flexible URL patterns for Tekmetric
            const tekmetricPatterns = [
                /https:\/\/shop\.tekmetric\.com\/admin\/shop\/(\d+)\/repair-orders\/(\d+)/,
                /https:\/\/shop\.tekmetric\.com\/.*\/repair-orders\/(\d+)/,
                /tekmetric\.com.*repair-orders.*(\d+)/
            ];
            
            let match = null;
            let shopId = null;
            let roId = null;
            
            // Try each pattern to find a match
            for (const pattern of tekmetricPatterns) {
                match = url.match(pattern);
                if (match) {
                    console.log('URL matched pattern:', pattern, 'match:', match);
                    if (match.length >= 3) {
                        shopId = match[1];
                        roId = match[2];
                    } else if (match.length >= 2) {
                        roId = match[1];
                        // Try to extract shop ID from URL differently
                        const shopMatch = url.match(/shop\/(\d+)/);
                        shopId = shopMatch ? shopMatch[1] : '12345'; // fallback shop ID
                    }
                    break;
                }
            }
            
            // Also check if we're on any Tekmetric page
            const isTekmetricPage = url.includes('tekmetric.com') || url.includes('shop.tekmetric.com');
            
            if (match && roId) {
                console.log('Scanning for promise time on:', url, 'shopId:', shopId, 'roId:', roId);
                
                // Send message to content script to extract promise time data
                chrome.tabs.sendMessage(currentTab.id, { 
                    action: 'extractPromiseTimeData',
                    shopId: shopId || 'unknown',
                    roId: roId
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log('No content script available, injecting...', chrome.runtime.lastError);
                        // Inject content script if not present
                        chrome.scripting.executeScript({
                            target: { tabId: currentTab.id },
                            files: ['promiseTimeContent.js']
                        }, () => {
                            if (chrome.runtime.lastError) {
                                console.error('Failed to inject content script:', chrome.runtime.lastError);
                                alert('Failed to scan page. Please refresh the page and try again.');
                                return;
                            }
                            // Try again after injection
                            setTimeout(() => {
                                chrome.tabs.sendMessage(currentTab.id, { 
                                    action: 'extractPromiseTimeData',
                                    shopId: shopId || 'unknown',
                                    roId: roId
                                }, (retryResponse) => {
                                    console.log('Retry scan response:', retryResponse);
                                    if (retryResponse && retryResponse.success) {
                                        // Force refresh the dashboard
                                        chrome.runtime.sendMessage({ action: 'refreshPromiseDashboard' });
                                        setTimeout(loadDashboardData, 500);
                                        alert('Promise time data found and added to dashboard!');
                                    } else {
                                        console.log('Scan completed but no promise time found');
                                        alert('No promise time found on this page. The page may not have a promise time set.');
                                    }
                                });
                            }, 1000);
                        });
                    } else {
                        console.log('Scan response:', response);
                        if (response && response.success) {
                            // Force refresh the dashboard
                            chrome.runtime.sendMessage({ action: 'refreshPromiseDashboard' });
                            setTimeout(loadDashboardData, 500);
                            alert('Promise time data found and added to dashboard!');
                        } else {
                            console.log('Scan completed but no promise time found');
                            alert('No promise time found on this page. The page may not have a promise time set.');
                        }
                    }
                });
            } else if (isTekmetricPage) {
                alert('This appears to be a Tekmetric page, but not a repair order page. Please navigate to a specific repair order to scan for promise times.');
            } else {
                alert('Please navigate to a Tekmetric repair order page to scan for promise times.\n\nCurrent URL: ' + url);
            }
        } else {
            alert('No active tab found. Please make sure you have a Tekmetric page open.');
        }
    });
}

// ===============================
// PROMISE TIME MONITORING
// ===============================

function initializePromiseTimeMonitor() {
    // Check for active promise time data
    chrome.storage.local.get([
        'customerTimeOut',
        'customerFullName',
        'vehicleDescription',
        'repairOrderNumber',
        'tekmetric_token',
        'roId',
        'roUrl'
    ], (result) => {
        if (result.customerTimeOut) {
            updatePromiseTimeDisplay(result);
            // Update every minute
            setInterval(() => updatePromiseTimeDisplay(result), 5 * 1000);
        }
    });

    // Listen for storage changes to update display
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && (changes.customerTimeOut || changes.customerFullName || changes.vehicleDescription)) {
            chrome.storage.local.get([
                'customerTimeOut',
                'customerFullName', 
                'vehicleDescription',
                'repairOrderNumber',
                'tekmetric_token',
                'roId',
                'roUrl'
            ], (result) => {
                updatePromiseTimeDisplay(result);
            });
        }
    });
}

function updatePromiseTimeDisplay(data) {
    const monitorSection = document.getElementById('promise-time-monitor');
    const customerNameSpan = document.getElementById('ptCustomerName');
    const vehicleSpan = document.getElementById('ptVehicle');
    const timeRemainingSpan = document.getElementById('ptTimeRemaining');
    const openROButton = document.getElementById('openRepairOrderButton');

    if (data.customerTimeOut) {
        const timeoutDate = new Date(data.customerTimeOut);
        const currentTime = new Date();
        
        // DEBUG: Show time comparison to understand the issue
        console.log('=== PROMISE TIME DISPLAY DEBUG ===');
        console.log('Stored promise time string:', data.customerTimeOut);
        console.log('Parsed promise date:', timeoutDate.toString());
        console.log('Current time:', currentTime.toString());
        console.log('Current timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
        console.log('Time difference (ms):', timeoutDate.getTime() - currentTime.getTime());
        console.log('Time difference (hours):', Math.round((timeoutDate.getTime() - currentTime.getTime()) / (1000 * 60 * 60)));
        console.log('=====================================');
        
        const timeLeft = timeoutDate - currentTime;

        // Show the monitor section
        monitorSection.style.display = 'block';

        // Update customer info
        customerNameSpan.textContent = data.customerFullName || 'N/A';
        vehicleSpan.textContent = data.vehicleDescription || 'N/A';

        // Update time remaining
        if (timeLeft <= 0) {
            timeRemainingSpan.textContent = '⚠️ TIME EXPIRED';
            timeRemainingSpan.style.color = 'var(--accent-red, #f28b82)';
            timeRemainingSpan.style.fontWeight = 'bold';
        } else {
            const hours = Math.floor(timeLeft / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            timeRemainingSpan.textContent = `${hours}h ${minutes}m`;
            timeRemainingSpan.style.color = timeLeft < 30 * 60 * 1000 ? 'var(--accent-red, #f28b82)' : 'var(--text-primary, #333)';
            timeRemainingSpan.style.fontWeight = timeLeft < 30 * 60 * 1000 ? 'bold' : 'normal';
        }

        // Setup repair order link
        const shopId = data.tekmetric_token ? data.tekmetric_token.shopId : null;
        if (data.roUrl) {
            // Use stored URL for direct navigation
            openROButton.style.display = 'inline-block';
            openROButton.onclick = () => {
                chrome.tabs.create({ url: data.roUrl });
            };
        } else if (shopId && data.roId) {
            // Fallback to constructed URL
            openROButton.style.display = 'inline-block';
            openROButton.onclick = () => {
                chrome.tabs.create({
                    url: `https://shop.tekmetric.com/admin/shop/${shopId}/repair-orders/${data.roId}/estimate`
                });
            };
        } else {
            openROButton.style.display = 'none';
        }
    } else {
        // Hide the monitor section if no promise time data
        monitorSection.style.display = 'none';
    }
}

// ===============================
// PROMISE TIME DASHBOARD
// ===============================

function initializePromiseTimeDashboard() {
    // Load initial dashboard data
    updateDashboardDisplay();
    
    // Set up refresh button
    const refreshButton = document.getElementById('refreshDashboardButton');
    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
            // Trigger background script to update dashboard
            chrome.runtime.sendMessage({ action: 'refreshPromiseDashboard' });
            updateDashboardDisplay();
        });
    }
    
    // Listen for storage changes to update dashboard
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.promiseTimeDashboardData) {
            updateDashboardDisplay();
        }
    });
    
    // Update dashboard every minute
    setInterval(updateDashboardDisplay, 5000);
}

function updateDashboardDisplay() {
    chrome.storage.local.get(['promiseTimeDashboardData'], (result) => {
        const dashboardData = result.promiseTimeDashboardData || [];
        const listContainer = document.getElementById('promiseTimeList');
        const countElement = document.getElementById('dashboardCount');
        
        if (!listContainer || !countElement) return;
        
        // Update count
        countElement.textContent = dashboardData.length > 0 
            ? `${dashboardData.length} active promise time${dashboardData.length === 1 ? '' : 's'}`
            : 'No active promise times';
        
        // Clear existing items
        listContainer.innerHTML = '';
        
        if (dashboardData.length === 0) {
            listContainer.innerHTML = '<div class="empty-dashboard">No active promise times</div>';
            return;
        }
        
        // Create items for each promise time (already sorted by urgency)
        dashboardData.forEach(item => {
            const promiseItem = createPromiseTimeItem(item);
            listContainer.appendChild(promiseItem);
        });
    });
}

function createPromiseTimeItem(data) {
    const item = document.createElement('div');
    item.className = `promise-item ${data.urgencyLevel}`;
    
    const timeRemaining = data.timeRemaining;
    const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
    
    let timeText;
    if (timeRemaining <= 0) {
        timeText = 'EXPIRED';
    } else if (hours > 0) {
        timeText = `${hours}h ${minutes}m`;
    } else {
        timeText = `${minutes}m`;
    }
    
    item.innerHTML = `
        <div class="promise-header">
            <div class="promise-ro">RO #${data.repairOrderNumber}</div>
            <div class="promise-time ${data.urgencyLevel}">${timeText}</div>
        </div>
        <div class="promise-customer">${data.customerFullName}</div>
        <div class="promise-vehicle">${data.vehicleDescription}</div>
    `;
    
    // Add click handler to open repair order
    item.addEventListener('click', () => {
        if (data.shopId && data.roId) {
            chrome.tabs.create({
                url: `https://shop.tekmetric.com/admin/shop/${data.shopId}/repair-orders/${data.roId}/estimate`
            });
        }
    });
    
    return item;
}

// Attach event listener for the Send to Tekmetric button
document.getElementById('sendToTekmetricButton').addEventListener('click', sendToTekmetric);

// Other event listeners
document.getElementById('submitConcernButton').addEventListener('click', handleSubmitConcern);
document.getElementById('clearFormButton').addEventListener('click', clearForm);
document.getElementById('submitForReviewButton').addEventListener('click', submitConversationForReview);
document.getElementById('doneButton').addEventListener('click', handleDone);
document.getElementById('copyConversationButton').addEventListener('click', copyConversation);
