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
});

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

// Attach event listener for the Send to Tekmetric button
document.getElementById('sendToTekmetricButton').addEventListener('click', sendToTekmetric);

// Other event listeners
document.getElementById('submitConcernButton').addEventListener('click', handleSubmitConcern);
document.getElementById('clearFormButton').addEventListener('click', clearForm);
document.getElementById('submitForReviewButton').addEventListener('click', submitConversationForReview);
document.getElementById('doneButton').addEventListener('click', handleDone);
document.getElementById('copyConversationButton').addEventListener('click', copyConversation);
