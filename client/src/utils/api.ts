// src/utils/api.ts
import axios from "axios";
import { triggerLogout } from "./auth";
const BASE_URL = import.meta.env.VITE_API_BASE;

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // Send HttpOnly cookies
});

// Attach access token to outgoing requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Refresh access token on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const res = await api.post("/auth/refresh");

        const { accessToken } = res.data;
        if (accessToken) {
          localStorage.setItem("accessToken", accessToken);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;

          // use "api"
          return api(originalRequest);
        }
      } catch (err) {
        triggerLogout();
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
