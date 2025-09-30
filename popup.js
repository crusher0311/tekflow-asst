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
    const promiseTimeDashboardBtn = document.getElementById('promiseTimeDashboardBtn');
    if (promiseTimeDashboardBtn) {
        promiseTimeDashboardBtn.addEventListener('click', openPromiseTimeDashboard);
    }
});

// ===============================
// PROMISE TIME DASHBOARD POPUP
// ===============================

function openPromiseTimeDashboard() {
    // Open the Promise Time Dashboard in a new popup window
    chrome.windows.create({
        url: chrome.runtime.getURL('promiseTimeDashboard.html'),
        type: 'popup',
        width: 650,
        height: 700,
        focused: true
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
