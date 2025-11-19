import React, { useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../utils/auth";

const NavItem = ({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `block px-4 py-2 rounded hover:bg-gray-100 ${
        isActive ? "bg-white shadow" : ""
      }`
    }
  >
    {children}
  </NavLink>
);

export default function Sidebar() {
  const auth = useAuth();
  const navigate = useNavigate();

  const { token, logout } = auth;
  useEffect(() => {
    if (!token) return;

    const payload = JSON.parse(atob(token.split(".")[1]));
    const expiry = payload.exp * 1000;
    const timeout = expiry - Date.now();

    if (timeout <= 0) {
      logout();
      return;
    }

    const timer = setTimeout(() => {
      logout();
    }, timeout);

    return () => clearTimeout(timer);
  }, [token]);

  return (
    <aside className="w-72 bg-white border-r p-6 flex flex-col">
      <div className="mb-6">
        <h1 className="text-xl font-bold">CyberBridge</h1>
        <p className="text-sm text-gray-500">Notifications Dashboard</p>
      </div>

      <nav className="flex-1 space-y-2">
        <NavItem to="/">🏠 Dashboard</NavItem>
        <NavItem to="/queues">📬 Message Queue</NavItem>
        <NavItem to="/failed">❌ Failed Messages</NavItem>
      </nav>

      <div className="mt-6 text-xs text-gray-500">
        {auth.token ? (
          <button
            className="mt-3 text-sm text-blue-600"
            onClick={() => {
              auth.logout();
              navigate("/login");
            }}
          >
            Logout
          </button>
        ) : (
          ""
        )}
      </div>
    </aside>
  );
}
