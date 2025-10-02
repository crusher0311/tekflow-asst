/**
 * TekFlow SaaS API Client
 * Handles all communication with the TekFlow SaaS backend
 */

class TekFlowAPI {
  constructor() {
    this.baseURL = 'http://localhost:3000/api'; // TODO: Update for production
    this.token = null;
    this.user = null;
    
    // Load token from storage on initialization
    this.loadTokenFromStorage();
  }

  // Authentication Methods
  async register(userData) {
    try {
      const response = await fetch(`${this.baseURL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      const data = await response.json();
      
      if (response.ok) {
        this.token = data.token;
        this.user = data.user;
        await this.saveTokenToStorage();
        await this.trackUsage('login', { action: 'register' });
        return { success: true, data };
      } else {
        return { success: false, error: data.message || 'Registration failed' };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Network error during registration' };
    }
  }

  async login(email, password) {
    try {
      const response = await fetch(`${this.baseURL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      
      if (response.ok) {
        this.token = data.token;
        this.user = data.user;
        await this.saveTokenToStorage();
        await this.trackUsage('login', { action: 'login' });
        return { success: true, data };
      } else {
        return { success: false, error: data.message || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error during login' };
    }
  }

  async logout() {
    try {
      await this.trackUsage('logout');
      this.token = null;
      this.user = null;
      await this.clearTokenFromStorage();
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: 'Logout failed' };
    }
  }

  async verifyToken() {
    if (!this.token) return { success: false, error: 'No token available' };

    try {
      const response = await fetch(`${this.baseURL}/auth/verify`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (response.ok) {
        this.user = data.user;
        return { success: true, data };
      } else {
        // Token is invalid, clear it
        await this.clearTokenFromStorage();
        return { success: false, error: data.message || 'Token verification failed' };
      }
    } catch (error) {
      console.error('Token verification error:', error);
      return { success: false, error: 'Network error during token verification' };
    }
  }

  // User Management Methods
  async getUserProfile() {
    return await this.authenticatedRequest('/users/profile', 'GET');
  }

  async updateUserProfile(updates) {
    return await this.authenticatedRequest('/users/profile', 'PUT', updates);
  }

  async getSubscriptionStatus() {
    return await this.authenticatedRequest('/users/subscription', 'GET');
  }

  async getUserUsage() {
    return await this.authenticatedRequest('/users/usage', 'GET');
  }

  // Extension Configuration Methods
  async getExtensionConfig() {
    return await this.authenticatedRequest('/extension/config', 'GET');
  }

  async updateExtensionConfig(config) {
    const result = await this.authenticatedRequest('/extension/config', 'PUT', config);
    if (result.success) {
      await this.trackUsage('config_updated', { config });
    }
    return result;
  }

  async getFeatureFlags() {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await fetch(`${this.baseURL}/extension/features`, {
        method: 'GET',
        headers
      });

      const data = await response.json();
      return response.ok ? { success: true, data } : { success: false, error: data.message };
    } catch (error) {
      console.error('Feature flags error:', error);
      return { success: false, error: 'Network error getting feature flags' };
    }
  }

  // Usage Tracking
  async trackUsage(eventType, metadata = {}) {
    if (!this.token) return; // Skip tracking if not authenticated

    try {
      await this.authenticatedRequest('/extension/usage', 'POST', {
        eventType,
        metadata
      });
    } catch (error) {
      console.error('Usage tracking error:', error);
      // Don't throw error for tracking failures
    }
  }

  // Generic authenticated request method
  async authenticatedRequest(endpoint, method = 'GET', body = null) {
    if (!this.token) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      const options = {
        method,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      };

      if (body && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${this.baseURL}${endpoint}`, options);
      const data = await response.json();

      if (response.ok) {
        return { success: true, data };
      } else {
        // If token is invalid, clear it
        if (response.status === 401 || response.status === 403) {
          await this.clearTokenFromStorage();
        }
        return { success: false, error: data.message || 'Request failed' };
      }
    } catch (error) {
      console.error(`API request error (${endpoint}):`, error);
      return { success: false, error: 'Network error' };
    }
  }

  // Token Storage Management
  async saveTokenToStorage() {
    try {
      await chrome.storage.local.set({
        'tekflow_auth_token': this.token,
        'tekflow_user_data': this.user
      });
    } catch (error) {
      console.error('Error saving token to storage:', error);
    }
  }

  async loadTokenFromStorage() {
    try {
      const result = await chrome.storage.local.get(['tekflow_auth_token', 'tekflow_user_data']);
      this.token = result.tekflow_auth_token || null;
      this.user = result.tekflow_user_data || null;
    } catch (error) {
      console.error('Error loading token from storage:', error);
    }
  }

  async clearTokenFromStorage() {
    try {
      await chrome.storage.local.remove(['tekflow_auth_token', 'tekflow_user_data']);
      this.token = null;
      this.user = null;
    } catch (error) {
      console.error('Error clearing token from storage:', error);
    }
  }

  // Utility Methods
  isAuthenticated() {
    return !!this.token;
  }

  getCurrentUser() {
    return this.user;
  }

  hasActiveSubscription() {
    return this.user && this.user.subscriptionActive;
  }

  getSubscriptionStatus() {
    return this.user ? this.user.subscriptionStatus : 'none';
  }
}

// Export singleton instance
window.TekFlowAPI = window.TekFlowAPI || new TekFlowAPI();