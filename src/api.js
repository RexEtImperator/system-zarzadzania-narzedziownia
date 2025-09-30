const API_BASE_URL = 'http://localhost:3000';

class ApiClient {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('token'); // Zmieniono z 'authToken' na 'token'
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token); // Zmieniono z 'authToken' na 'token'
    } else {
      localStorage.removeItem('token'); // Zmieniono z 'authToken' na 'token'
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
}

const api = new ApiClient();

export default api;