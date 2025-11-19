import { useState, useEffect } from "react";

export function useAuth() {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("auth_token")
  );

  useEffect(() => {
    // Update token when "auth-changed" event happens (same tab)
    const handler = () => {
      setToken(localStorage.getItem("auth_token"));
    };

    window.addEventListener("auth-changed", handler);

    // Update token when storage changes in other tabs
    window.addEventListener("storage", handler);

    return () => {
      window.removeEventListener("auth-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const broadcast = () => {
    window.dispatchEvent(new Event("auth-changed"));
  };

  return {
    token,
    login: (t: string) => {
      localStorage.setItem("auth_token", t);
      setToken(t);
      broadcast(); // notify UI immediately
    },
    logout: () => {
      localStorage.removeItem("auth_token");
      setToken(null);
      broadcast(); // notify UI immediately
    },
  };
}
