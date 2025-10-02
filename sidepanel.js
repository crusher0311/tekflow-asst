/**
 * TekFlow SaaS Sidepanel - Authentication and Cloud Sync
 */

document.addEventListener('DOMContentLoaded', async () => {
    await initializeSidepanel();
});

async function initializeSidepanel() {
    try {
        console.log('Initializing TekFlow SaaS sidepanel...');
        
        // Check authentication status
        const isAuthenticated = await checkAuthentication();
        
        if (!isAuthenticated) {
            showAuthenticationRequired();
            return;
        }
        
        // Load user data and subscription status
        await loadUserData();
        
        // Initialize feature flags
        await loadFeatureFlags();
        
        // Setup event listeners
        setupEventListeners();
        
        // Sync configuration from cloud
        await syncConfigurationFromCloud();
        
        console.log('TekFlow SaaS sidepanel initialized successfully');
        
    } catch (error) {
        console.error('Error initializing sidepanel:', error);
        showError('Failed to initialize TekFlow. Please try refreshing.');
    }
}

async function checkAuthentication() {
    const api = window.TekFlowAPI;
    
    if (!api.isAuthenticated()) {
        return false;
    }
    
    // Verify token with backend
    const result = await api.verifyToken();
    return result.success;
}

function showAuthenticationRequired() {
    const authOverlay = document.getElementById('auth-overlay');
    const extensionContent = document.getElementById('extension-content');
    
    authOverlay.style.display = 'flex';
    extensionContent.style.filter = 'blur(5px)';
    extensionContent.style.pointerEvents = 'none';
    
    // Setup auth button
    const showAuthButton = document.getElementById('showAuthButton');
    showAuthButton.addEventListener('click', () => {
        window.location.href = 'auth.html';
    });
}

async function loadUserData() {
    const api = window.TekFlowAPI;
    const user = api.getCurrentUser();
    
    if (!user) {
        console.warn('No user data available');
        return;
    }
    
    // Update user header
    const userHeader = document.getElementById('user-header');
    const userName = document.getElementById('user-name');
    const userStatus = document.getElementById('user-status');
    
    userHeader.style.display = 'flex';
    userName.textContent = `Welcome, ${user.firstName}`;
    
    // Get fresh subscription data
    const subscriptionResult = await api.getSubscriptionStatus();
    if (subscriptionResult.success) {
        const subscription = subscriptionResult.data.subscription;
        updateSubscriptionDisplay(subscription);
    }
    
    // Update status based on subscription
    if (user.subscriptionActive) {
        userStatus.textContent = `(${user.subscriptionPlan || 'Pro'})`;
        userStatus.style.color = 'var(--accent-green)';
    } else {
        userStatus.textContent = '(Trial)';
        userStatus.style.color = 'var(--text-muted)';
    }
}

function updateSubscriptionDisplay(subscription) {
    const subscriptionBanner = document.getElementById('subscription-banner');
    const subscriptionMessage = document.getElementById('subscription-message');
    
    if (!subscription.active) {
        subscriptionBanner.style.display = 'block';
        
        if (subscription.status === 'trial') {
            const daysRemaining = Math.max(0, Math.ceil((new Date(subscription.trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24)));
            subscriptionMessage.textContent = `🎁 Free Trial - ${daysRemaining} days remaining`;
            
            if (daysRemaining <= 3) {
                subscriptionBanner.style.background = 'linear-gradient(135deg, #dc2626, #b91c1c)';
                subscriptionMessage.textContent = `⚠️ Trial expires in ${daysRemaining} days`;
            }
        } else if (subscription.status === 'trial_expired') {
            subscriptionBanner.style.background = 'linear-gradient(135deg, #dc2626, #b91c1c)';
            subscriptionMessage.textContent = '⚠️ Trial expired - Upgrade to continue using TekFlow';
        } else if (subscription.status === 'payment_failed') {
            subscriptionBanner.style.background = 'linear-gradient(135deg, #dc2626, #b91c1c)';
            subscriptionMessage.textContent = '⚠️ Payment failed - Please update your payment method';
        }
    } else {
        subscriptionBanner.style.display = 'none';
    }
}

async function loadFeatureFlags() {
    const api = window.TekFlowAPI;
    const result = await api.getFeatureFlags();
    
    if (result.success) {
        const features = result.data.features;
        window.tekflowFeatures = features;
        
        // Apply feature flags to UI
        applyFeatureFlags(features);
    }
}

function applyFeatureFlags(features) {
    // Hide/show features based on subscription
    const promiseTimeButton = document.getElementById('openPromiseDashboardButton');
    
    if (!features.basicAlerts) {
        // Disable basic features for expired accounts
        if (promiseTimeButton) {
            promiseTimeButton.disabled = true;
            promiseTimeButton.title = 'Subscription required';
        }
    }
    
    // Add premium indicators
    if (!features.advancedScheduling) {
        // Add "Pro" badges to premium features
        addPremiumBadges();
    }
}

function addPremiumBadges() {
    // Add premium badges to advanced features
    const advancedElements = document.querySelectorAll('[data-premium="true"]');
    advancedElements.forEach(element => {
        if (!element.querySelector('.premium-badge')) {
            const badge = document.createElement('span');
            badge.className = 'premium-badge';
            badge.textContent = 'PRO';
            badge.style.cssText = 'background: linear-gradient(45deg, #f59e0b, #d97706); color: white; font-size: 10px; padding: 2px 6px; border-radius: 3px; margin-left: 8px; font-weight: bold;';
            element.appendChild(badge);
        }
    });
}

async function syncConfigurationFromCloud() {
    const api = window.TekFlowAPI;
    const result = await api.getExtensionConfig();
    
    if (result.success) {
        const cloudConfig = result.data.config;
        
        // Merge cloud config with local config
        const localConfig = await getLocalConfig();
        const mergedConfig = { ...localConfig, ...cloudConfig };
        
        // Save merged config locally
        await saveLocalConfig(mergedConfig);
        
        console.log('Configuration synced from cloud:', mergedConfig);
        
        // Apply configuration to extension
        applyConfiguration(mergedConfig);
    }
}

async function getLocalConfig() {
    try {
        const result = await chrome.storage.local.get(['extensionConfig']);
        return result.extensionConfig || {};
    } catch (error) {
        console.error('Error getting local config:', error);
        return {};
    }
}

async function saveLocalConfig(config) {
    try {
        await chrome.storage.local.set({ extensionConfig: config });
    } catch (error) {
        console.error('Error saving local config:', error);
    }
}

function applyConfiguration(config) {
    // Apply configuration to the extension
    // This will be used by other components
    window.tekflowConfig = config;
    
    // Dispatch event to notify other components
    window.dispatchEvent(new CustomEvent('tekflowConfigUpdated', { detail: config }));
}

function setupEventListeners() {
    // Logout button
    const logoutButton = document.getElementById('logoutButton');
    logoutButton?.addEventListener('click', handleLogout);
    
    // Settings button
    const settingsButton = document.getElementById('settingsButton');
    settingsButton?.addEventListener('click', showSettings);
    
    // Upgrade button
    const upgradeButton = document.getElementById('upgradeButton');
    upgradeButton?.addEventListener('click', handleUpgrade);
    
    // Original concern submission
    const submitConcernButton = document.getElementById('submitConcernButton');
    submitConcernButton?.addEventListener('click', handleConcernSubmission);
    
    // Listen for configuration changes
    window.addEventListener('tekflowConfigChange', handleConfigChange);
}

async function handleConcernSubmission() {
    const concern = document.getElementById('concernInput').value;
    if (concern) {
        console.log("Customer concern submitted:", concern);
        
        // Track usage
        const api = window.TekFlowAPI;
        if (api.isAuthenticated()) {
            await api.trackUsage('concern_submitted', { concern_length: concern.length });
        }
        
        // Further logic to handle submission
    } else {
        console.log("No concern entered.");
    }
}

async function handleLogout() {
    const api = window.TekFlowAPI;
    const result = await api.logout();
    
    if (result.success) {
        // Refresh the page to show authentication
        window.location.reload();
    } else {
        showError('Failed to logout');
    }
}

function showSettings() {
    // TODO: Implement settings modal
    console.log('Settings clicked');
}

function handleUpgrade() {
    // TODO: Implement upgrade flow (redirect to GoHighLevel checkout)
    console.log('Upgrade clicked');
    showInfo('Upgrade functionality coming soon!');
}

async function handleConfigChange(event) {
    const newConfig = event.detail;
    
    // Sync configuration to cloud
    const api = window.TekFlowAPI;
    const result = await api.updateExtensionConfig(newConfig);
    
    if (result.success) {
        console.log('Configuration synced to cloud');
    } else {
        console.error('Failed to sync configuration to cloud:', result.error);
    }
}

// Utility functions
function showError(message) {
    // Create and show error notification
    const notification = createNotification(message, 'error');
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

function showInfo(message) {
    // Create and show info notification
    const notification = createNotification(message, 'info');
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function createNotification(message, type) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#dc2626' : '#3182ce'};
        color: white;
        padding: 12px 16px;
        border-radius: 6px;
        font-size: 14px;
        z-index: 1000;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        animation: slideIn 0.3s ease;
    `;
    
    notification.textContent = message;
    
    // Add slide-in animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    return notification;
}

// Track page view
window.addEventListener('load', async () => {
    const api = window.TekFlowAPI;
    if (api.isAuthenticated()) {
        await api.trackUsage('page_view', { page: 'sidepanel' });
    }
});

// Export for use by other scripts
window.TekFlowSidepanel = {
    isAuthenticated: () => window.TekFlowAPI?.isAuthenticated() || false,
    hasActiveSubscription: () => window.TekFlowAPI?.hasActiveSubscription() || false,
    getFeatures: () => window.tekflowFeatures || {},
    getConfig: () => window.tekflowConfig || {},
    syncConfig: syncConfigurationFromCloud,
    trackUsage: (eventType, metadata) => window.TekFlowAPI?.trackUsage(eventType, metadata)
};
