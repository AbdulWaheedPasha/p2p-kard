import axios from "axios";
import { useAuthStore } from "../state/authStore.js";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

// ✅ Set this to your real refresh endpoint path
// Common SimpleJWT paths:
// - "/api/v1/auth/token/refresh"
// - "/api/v1/token/refresh/"
// Update if your backend differs.
const REFRESH_PATH = "/api/v1/auth/token/refresh";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach access token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let queue = [];

function flushQueue(error, newToken = null) {
  queue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(newToken);
  });
  queue = [];
}

function isExpiredTokenError(err) {
  const data = err?.response?.data;
  // Your backend sometimes wraps errors like: { error: { details: { ... } } }
  const wrapped = data?.error?.details;
  const direct = data;

  const msg1 = wrapped?.detail || wrapped?.message;
  const msg2 = direct?.detail || direct?.message;

  const combined = String(msg1 || msg2 || "");
  const code =
    wrapped?.code ||
    direct?.code ||
    data?.error?.details?.code ||
    data?.error?.code;

  // DRF SimpleJWT uses code: "token_not_valid", and messages often mention "Token is expired"
  const expired =
    combined.toLowerCase().includes("token is expired") ||
    (wrapped?.messages || []).some((m) =>
      String(m?.message || "")
        .toLowerCase()
        .includes("expired")
    );

  return code === "token_not_valid" || expired;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const original = error?.config;

    if (status !== 401 || !original) {
      return Promise.reject(error);
    }

    // Only attempt refresh if it looks like an expired-token issue
    if (!isExpiredTokenError(error)) {
      return Promise.reject(error);
    }

    // Prevent infinite loops
    if (original._retry) return Promise.reject(error);
    original._retry = true;

    const { refreshToken } = useAuthStore.getState();

    // No refresh token -> logout
    if (!refreshToken) {
      useAuthStore.getState().logout();
      return Promise.reject(error);
    }

    // If refresh already happening, wait
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        queue.push({
          resolve: (newToken) => {
            original.headers.Authorization = `Bearer ${newToken}`;
            resolve(api(original));
          },
          reject,
        });
      });
    }

    isRefreshing = true;

    try {
      // Call refresh endpoint with refresh token
      const refreshRes = await axios.post(
        `${BASE_URL}${REFRESH_PATH}`,
        { refresh: refreshToken },
        { headers: { "Content-Type": "application/json" } }
      );

      const newAccess = refreshRes.data?.access;
      if (!newAccess)
        throw new Error("Refresh succeeded but no access token returned.");

      // Save new access token
      useAuthStore.setState({ token: newAccess, isAuthed: true });

      // Retry everyone waiting
      flushQueue(null, newAccess);

      // Retry original
      original.headers.Authorization = `Bearer ${newAccess}`;
      return api(original);
    } catch (refreshErr) {
      flushQueue(refreshErr, null);
      useAuthStore.getState().logout();
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);
