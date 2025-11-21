// Use environment variable for API base URL in development
// If not set, fall back to relative paths (CRA proxy)
const API_BASE_URL = (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE_URL) ? process.env.REACT_APP_API_BASE_URL : '';

class ApiClient {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
    // Prefer token from localStorage ('token'); fallback to token from 'user' object
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      this.token = storedToken;
    } else {
      const user = localStorage.getItem('user');
      this.token = user ? JSON.parse(user).token : null;
    }
  }

  setToken(token) {
    this.token = token;
    if (token) {
      // Update token in the user object stored in localStorage
      const user = localStorage.getItem('user');
      if (user) {
        const userData = JSON.parse(user);
        userData.token = token;
        localStorage.setItem('user', JSON.stringify(userData));
      }
    } else {
      // Remove the entire user object on logout
      localStorage.removeItem('user');
    }
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  async request(url, config = {}) {
    const fullUrl = `${this.baseURL}${url}`;
    
    const headers = {
      'Content-Type': 'application/json',
      ...config.headers
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    // If body is a non-null object and not a string, stringify it
    if (config.body && typeof config.body === 'object' && config.body !== null && typeof config.body !== 'string') {
      config.body = JSON.stringify(config.body);
    }

    const requestConfig = {
      ...config,
      headers
    };

    try {
      // Debug: log request details to the console
      const method = requestConfig.method || 'GET';
      const authHeader = requestConfig.headers?.Authorization || requestConfig.headers?.authorization;
      const tokenSnippet = this.token ? String(this.token).substring(0, 20) + '...' : null;
      console.log('[API DEBUG] Request:', { url: fullUrl, method, authHeader, tokenSnippet });

      const response = await fetch(fullUrl, requestConfig);
      
      if (!response.ok) {
        const errorText = await response.text();
        // Try to extract a message from JSON
        let message = errorText;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed && parsed.message) message = parsed.message;
        } catch (_) {}

        // If the token is invalid or expired, clear it to force re-login
        // Only 401 (Unauthorized) or an explicit "invalid token" message should force logout.
        // 403 (Forbidden) usually means insufficient permissions — do not logout in this case.
        if (
          response.status === 401 ||
          (response.status === 403 && typeof message === 'string' && message.toLowerCase().includes('invalid token')) ||
          (typeof message === 'string' && message.includes('Nieprawidłowy token'))
        ) {
          console.warn('[API] Invalid or expired token detected. Clearing token and requiring re-login.');
          // Clear token from the client and localStorage
          this.setToken(null);
          localStorage.removeItem('token');

          // Notify the app about authorization error (automatic logout)
          try {
            if (typeof window !== 'undefined' && window.dispatchEvent) {
              const detail = { reason: message || 'Invalid or expired token', status: response.status };
              window.dispatchEvent(new CustomEvent('auth:invalid', { detail }));
            }
          } catch (e) {
            console.warn('[API] Failed to dispatch auth:invalid event:', e);
          }
        }

        const err = new Error(message || `HTTP error! status: ${response.status}`);
        // Attach HTTP status to the error for better handling by callers
        err.status = response.status;
        throw err;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async get(endpoint) {
    return this.request(endpoint, {
      method: 'GET',
    });
  }

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: data,
    });
  }

  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data,
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, {
      method: 'DELETE',
    });
  }

  // Alias for backward compatibility
  async del(endpoint) {
    return this.delete(endpoint);
  }

  // API-specific methods
  async getAuditLogs(params = {}) {
    const queryParams = new URLSearchParams();
    
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        queryParams.append(key, params[key]);
      }
    });

    const queryString = queryParams.toString();
    const endpoint = `/api/audit${queryString ? `?${queryString}` : ''}`;
    
    return this.get(endpoint);
  }

  // Support multipart/form-data (FormData) without setting Content-Type
  async postForm(endpoint, formData) {
    const fullUrl = `${this.baseURL}${endpoint}`;
    const headers = {};
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      console.log('[API DEBUG] Multipart Request:', { url: fullUrl, method: 'POST' });
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        let message = errorText;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed && parsed.message) message = parsed.message;
        } catch (_) {}
        if (
          response.status === 401 ||
          (response.status === 403 && typeof message === 'string' && message.toLowerCase().includes('invalid token')) ||
          (typeof message === 'string' && message.includes('Nieprawidłowy token'))
        ) {
          console.warn('[API] Invalid or expired token detected (multipart). Clearing token and requiring re-login.');
          this.setToken(null);
          localStorage.removeItem('token');
        }

        const err = new Error(message || `HTTP error! status: ${response.status}`);
        err.status = response.status;
        throw err;
      }

      try {
        return await response.json();
      } catch (_) {
        return {};
      }
    } catch (error) {
      console.error('API multipart request failed:', error);
      throw error;
    }
  }
}

const api = new ApiClient();

export default api;