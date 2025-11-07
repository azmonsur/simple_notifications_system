import axios from "axios";

const BASE = import.meta.env.VITE_API_BASE || "";

const api = axios.create({
  baseURL: BASE,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
