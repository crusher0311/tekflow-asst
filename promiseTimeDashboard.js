// File: promiseTimeDashboard.js - Promise Time Dashboard Popup

// Initialize theme on page load
chrome.storage.sync.get(['theme'], function(result) {
    const theme = result.theme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
});

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
    setupEventListeners();
    updateDashboardDisplay();
});

function initializeDashboard() {
    // Update dashboard every minute
    setInterval(updateDashboardDisplay, 5000);
    
    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.promiseTimeDashboardData) {
            updateDashboardDisplay();
        }
    });
}

function setupEventListeners() {
    // Refresh button
    document.getElementById('refreshDashboardBtn').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'refreshPromiseDashboard' });
        updateDashboardDisplay();
    });
    
    // Scan current page button
    document.getElementById('scanCurrentPageBtn').addEventListener('click', () => {
        scanCurrentPageForPromiseTime();
    });
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
            listContainer.innerHTML = `
                <div class="empty-dashboard">
                    <h3>No Active Promise Times</h3>
                    <p>Promise times will appear here when they are detected on Tekmetric repair order pages.</p>
                </div>
            `;
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
        if (tabs.length > 0) {
            const currentTab = tabs[0];
            
            // Check if we're on a Tekmetric repair order page
            const roPattern = /https:\/\/shop\.tekmetric\.com\/admin\/shop\/(\d+)\/repair-orders\/(\d+)/;
            const match = currentTab.url.match(roPattern);
            
            if (match) {
                const shopId = match[1];
                const roId = match[2];
                
                // Send message to content script to extract promise time data
                chrome.tabs.sendMessage(currentTab.id, { 
                    action: 'extractPromiseTimeData',
                    shopId: shopId,
                    roId: roId
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log('No content script available, injecting...');
                        // Inject content script if not present
                        chrome.scripting.executeScript({
                            target: { tabId: currentTab.id },
                            files: ['promiseTimeContent.js']
                        }, () => {
                            // Try again after injection
                            setTimeout(() => {
                                chrome.tabs.sendMessage(currentTab.id, { 
                                    action: 'extractPromiseTimeData',
                                    shopId: shopId,
                                    roId: roId
                                });
                            }, 1000);
                        });
                    } else if (response && response.success) {
                        // Force refresh the dashboard
                        chrome.runtime.sendMessage({ action: 'refreshPromiseDashboard' });
                        setTimeout(updateDashboardDisplay, 500);
                    }
                });
            } else {
                alert('Please navigate to a Tekmetric repair order page to scan for promise times.');
            }
        }
    });
}