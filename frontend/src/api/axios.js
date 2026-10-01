import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

const authApi = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

const refreshApi = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue = [];

function processQueue(error) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve();
    }
  });

  failedQueue = [];
}

api.interceptors.response.use(
  response => response,

  async error => {
    const originalRequest = error.config;

    if (
      error.response?.status !== 401 ||
      originalRequest?._retry
    ) {
      return Promise.reject(error);
    }

    if (
      originalRequest?.url?.includes('/auth/refresh') ||
      originalRequest?.url?.includes('/auth/login-user') ||
      originalRequest?.url?.includes('/auth/me')
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve,
          reject
        });
      })
        .then(() => api(originalRequest))
        .catch(err => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      await refreshApi.get('/auth/refresh');

      processQueue(null);

      return api(originalRequest);

    } catch (refreshError) {
      processQueue(refreshError);

      return Promise.reject(refreshError);

    } finally {
      isRefreshing = false;
    }
  }
);

export { authApi };

export default api;

