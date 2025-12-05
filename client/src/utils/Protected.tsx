import React, { useEffect, useState } from "react";
import { useAuth } from "./auth";
import api from "./api";
import { Navigate } from "react-router-dom";

export default function Protected({ children }: { children: JSX.Element }) {
  const { accessToken, login, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let timer: number | null = null;

    const refreshToken = async () => {
      try {
        const res = await api.post("/auth/refresh"); // sends refresh cookie automatically
        if (res.data?.accessToken) {
          login(res.data.accessToken);
          scheduleRefresh(res.data.accessToken);
        } else {
          logout();
        }
      } catch {
        logout();
      }
    };

    const scheduleRefresh = (token: string) => {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const expiry = payload.exp * 1000;
        const now = Date.now();

        // Refresh 5 seconds before expiry
        const delay = expiry - now - 2000;

        if (delay <= 0) {
          refreshToken(); // token already near expiry → refresh immediately
          return;
        }

        timer = setTimeout(refreshToken, delay);
      } catch {
        logout(); // invalid token
      }
    };

    if (accessToken) {
      setAllowed(true);
      scheduleRefresh(accessToken);
    } else {
      // try refresh immediately if no access token
      refreshToken().then(() => setAllowed(Boolean(accessToken)));
    }

    setLoading(false);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [accessToken, login, logout]);

  if (loading) return <div>Loading...</div>;
  if (!allowed) return <Navigate to="/login" replace />;

  return children;
}
