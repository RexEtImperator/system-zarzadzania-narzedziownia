const API_BASE_URL = '';

class ApiClient {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
    // Preferuj token z localStorage ('token'); fallback do tokenu z obiektu 'user'
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
      // Aktualizuj token w obiekcie user w localStorage
      const user = localStorage.getItem('user');
      if (user) {
        const userData = JSON.parse(user);
        userData.token = token;
        localStorage.setItem('user', JSON.stringify(userData));
      }
    } else {
      // Usuń cały obiekt user przy wylogowaniu
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

    // Sprawdź czy body jest obiektem i nie jest null ani string
    if (config.body && typeof config.body === 'object' && config.body !== null && typeof config.body !== 'string') {
      config.body = JSON.stringify(config.body);
    }

    const requestConfig = {
      ...config,
      headers
    };

    try {
      // Debug: pokaż szczegóły żądania w konsoli
      const method = requestConfig.method || 'GET';
      const authHeader = requestConfig.headers?.Authorization || requestConfig.headers?.authorization;
      const tokenSnippet = this.token ? String(this.token).substring(0, 20) + '...' : null;
      console.log('[API DEBUG] Request:', { url: fullUrl, method, authHeader, tokenSnippet });

      const response = await fetch(fullUrl, requestConfig);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
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

  // Alias dla zgodności ze starym wywołaniem
  async del(endpoint) {
    return this.delete(endpoint);
  }

  // Metody specyficzne dla API
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

  // Wsparcie dla multipart/form-data (FormData) bez ustawiania Content-Type
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
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
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