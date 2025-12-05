// src/utils/auth.ts
import { createContext, useContext, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  accessToken: string | null;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let globalLogout: (() => void) | null = null;

export const setGlobalLogout = (fn: () => void) => {
  globalLogout = fn;
};

export const triggerLogout = () => {
  if (globalLogout) globalLogout();
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const [accessToken, setAccessToken] = useState<string | null>(
    localStorage.getItem("accessToken")
  );

  const login = (token: string) => {
    localStorage.setItem("accessToken", token);
    setAccessToken(token);
  };

  const logout = () => {
    localStorage.removeItem("accessToken");
    setAccessToken(null);
    navigate("/login");
  };

  // expose global logout for API interceptor
  setGlobalLogout(logout);

  return (
    <AuthContext.Provider value={{ accessToken, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
