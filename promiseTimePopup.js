// File: promiseTimePopup.js - Promise Time Alert Popup for TekFlow Assistant

// Section 1: Retrieve Data from Local Storage and Initialize Popup
chrome.storage.local.get(
    [
        'customerTimeOut',
        'serviceWriterName',
        'customerFullName',
        'repairOrderNumber',
        'vehicleDescription',
        'tekmetric_token',
        'roId'
    ],
    (result) => {
        console.log("PromiseTimePopup.js - Retrieved data from local storage:", result);

        const {
            customerTimeOut,
            serviceWriterName,
            customerFullName,
            repairOrderNumber,
            vehicleDescription,
            roId
        } = result;

        const shopId = result.tekmetric_token ? result.tekmetric_token.shopId : 'N/A';

        if (customerTimeOut) {
            const timeoutDate = new Date(customerTimeOut);
            console.log("PromiseTimePopup.js - Customer Time Out:", timeoutDate.toLocaleString());

            updateTimer(timeoutDate);

            // Section 1.1: Display Customer Information
            document.getElementById('serviceWriter').textContent = serviceWriterName || 'N/A';
            document.getElementById('customerName').textContent = customerFullName || 'N/A';
            document.getElementById('vehicle').textContent = vehicleDescription || 'N/A';

            const roLink = document.getElementById('repairOrder');
            roLink.textContent = `Repair Order #${repairOrderNumber || 'N/A'}`;
            if (shopId !== 'N/A' && roId) {
                roLink.href = `https://shop.tekmetric.com/admin/shop/${shopId}/repair-orders/${roId}/estimate`;
            } else {
                roLink.href = '#';
                roLink.style.color = '#666';
            }

            // Section 1.2: Update Timer Every Minute
            setInterval(() => updateTimer(timeoutDate), 60 * 1000);
        } else {
            document.getElementById('timer').textContent = 'No timeout set';
            document.getElementById('serviceWriter').textContent = 'N/A';
            document.getElementById('customerName').textContent = 'N/A';
            document.getElementById('vehicle').textContent = 'N/A';
            document.getElementById('repairOrder').textContent = 'No repair order data';
            console.warn("PromiseTimePopup.js - No customerTimeOut found in local storage.");
        }
    }
);

// Section 2: Timer Update Function
function updateTimer(timeoutDate) {
    const currentTime = new Date();
    const timeLeft = timeoutDate - currentTime;

    console.log("PromiseTimePopup.js - Updating timer. Current time:", currentTime.toLocaleString(), "Timeout time:", timeoutDate.toLocaleString());

    const timerElement = document.getElementById('timer');
    
    if (timeLeft <= 0) {
        timerElement.textContent = '⚠️ TIME EXPIRED ⚠️';
        timerElement.classList.add('time-expired');
    } else {
        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        timerElement.textContent = `${hours}h ${minutes}m remaining`;
        timerElement.classList.remove('time-expired');
    }
}

// Section 3: Snooze Functionality
document.addEventListener('DOMContentLoaded', () => {
    const snoozeButton = document.getElementById('snooze-button');
    const snoozeTimeSelect = document.getElementById('snooze-time');

    snoozeButton.addEventListener('click', () => {
        let snoozeTime = parseInt(snoozeTimeSelect.value, 10);

        // Section 3.1: Handle Custom Snooze Time
        if (snoozeTimeSelect.value === 'custom') {
            const customTime = prompt("Enter snooze time in minutes:", "10");
            snoozeTime = customTime ? parseInt(customTime, 10) : 10;
        }

        // Section 3.2: Set Snooze and Close Popup
        if (snoozeTime && snoozeTime > 0) {
            chrome.storage.local.set({ snoozeUntil: Date.now() + snoozeTime * 60000 }, () => {
                console.log(`PromiseTimePopup.js - Snoozed for ${snoozeTime} minutes.`);
                window.close(); // Close popup
            });
        } else {
            console.warn("PromiseTimePopup.js - Invalid snooze time entered.");
        }
    });
});