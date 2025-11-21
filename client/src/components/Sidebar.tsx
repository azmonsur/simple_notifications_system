import React, { useEffect, useState } from "react";
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

export default function SidebarLayout() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false); // mobile menu toggle

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
    <>
      {/* Top Navbar for small screens */}
      <div className="sm:hidden flex justify-between items-center bg-white border-b px-4 py-3 fixed top-0 left-0 w-full z-20">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold">CyberBridge</h1>
          <span className="text-sm text-gray-500">Notification Dashboard</span>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="text-gray-600 focus:outline-none"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            {open ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`bg-white border-r p-6 flex flex-col fixed top-0 left-0 h-full z-30 w-64 transform transition-transform duration-300 ease-in-out
        ${open ? "translate-x-0" : "-translate-x-full"}
        sm:translate-x-0 sm:static sm:h-auto sm:w-64`}
      >
        {/* Title & Subtitle for desktop */}
        <div className="hidden sm:flex flex-col mb-6">
          <h1 className="text-xl font-bold">CyberBridge</h1>
          <span className="text-sm text-gray-500">Notification Dashboard</span>
        </div>

        <nav className="flex-1 space-y-2 mt-16 sm:mt-0">
          <NavItem to="/">🏠 Dashboard</NavItem>
          <NavItem to="/queues">📬 Message Queue</NavItem>
          <NavItem to="/failed">❌ Failed Messages</NavItem>
          <NavItem to="/webhook-dlr">📩 Webhook DLR</NavItem>
        </nav>

        {auth.token && (
          <div className="mt-auto text-xs text-gray-500">
            <button
              className="mt-3 text-sm text-blue-600"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Logout
            </button>
          </div>
        )}
      </aside>

      {/* Overlay for mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black bg-opacity-25 z-20 sm:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
