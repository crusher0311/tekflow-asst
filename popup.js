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

    // Initialize Promise Time monitoring
    initializePromiseTimeMonitor();
    
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
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="color: var(--text-primary); margin: 0;">Promise Time Dashboard</h2>
                <button id="backToConcernBtn" style="background-color: var(--accent-blue); color: white; border: none; padding: 8px 16px; border-radius: var(--radius); cursor: pointer; transition: background-color 0.2s;">← Back</button>
            </div>
            <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
                <button id="refreshDashboardBtn" style="background-color: var(--accent-green); color: white; border: none; padding: 8px 16px; border-radius: var(--radius); cursor: pointer; transition: background-color 0.2s;">🔄 Refresh</button>
                <button id="scanCurrentPageBtn" style="background-color: var(--accent-blue); color: white; border: none; padding: 8px 16px; border-radius: var(--radius); cursor: pointer; transition: background-color 0.2s;">🔍 Scan Current Page</button>
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
        const scanBtn = dashboardDiv.querySelector('#scanCurrentPageBtn');
        
        // Add hover effects
        backBtn?.addEventListener('mouseenter', (e) => e.target.style.backgroundColor = 'var(--accent-blue-hover)');
        backBtn?.addEventListener('mouseleave', (e) => e.target.style.backgroundColor = 'var(--accent-blue)');
        refreshBtn?.addEventListener('mouseenter', (e) => e.target.style.backgroundColor = 'var(--accent-green-hover)');
        refreshBtn?.addEventListener('mouseleave', (e) => e.target.style.backgroundColor = 'var(--accent-green)');
        scanBtn?.addEventListener('mouseenter', (e) => e.target.style.backgroundColor = 'var(--accent-blue-hover)');
        scanBtn?.addEventListener('mouseleave', (e) => e.target.style.backgroundColor = 'var(--accent-blue)');
        
        backBtn?.addEventListener('click', closeDashboard);
        refreshBtn?.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'refreshPromiseDashboard' });
            loadDashboardData();
        });
        scanBtn?.addEventListener('click', scanCurrentPageForPromiseTime);
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
    chrome.storage.local.get(['promiseTimeDashboardData'], (result) => {
        const dashboardData = result.promiseTimeDashboardData || [];
        const listContainer = document.querySelector('#promise-dashboard-content #promiseTimeList');
        const countElement = document.querySelector('#promise-dashboard-content #dashboardCount');
        
        if (!listContainer || !countElement) return;
        
        // Update count
        countElement.textContent = dashboardData.length > 0 
            ? `${dashboardData.length} active promise time${dashboardData.length === 1 ? '' : 's'}`
            : 'No active promise times';
        
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
                        setTimeout(loadDashboardData, 500);
                    }
                });
            } else {
                alert('Please navigate to a Tekmetric repair order page to scan for promise times.');
            }
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
        'roId'
    ], (result) => {
        if (result.customerTimeOut) {
            updatePromiseTimeDisplay(result);
            // Update every minute
            setInterval(() => updatePromiseTimeDisplay(result), 60 * 1000);
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
                'roId'
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
        if (shopId && data.roId) {
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
    setInterval(updateDashboardDisplay, 60000);
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
