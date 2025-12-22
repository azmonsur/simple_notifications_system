import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth, triggerLogout } from "../utils/auth";
import api from "../utils/api";
import {
  FiHome,
  FiMessageSquare,
  FiAlertCircle,
  FiMail,
  FiBarChart2,
  FiLogOut,
  FiSun,
  FiMoon,
} from "react-icons/fi";

const NavItem = ({
  to,
  icon,
  children,
}: {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200
       hover:bg-gray-200 dark:hover:bg-gray-700 ${
         isActive
           ? "bg-blue-100 dark:bg-blue-600 font-semibold dark:text-white"
           : "text-gray-900 dark:text-gray-300"
       }`
    }
  >
    {icon}
    <span className="whitespace-nowrap">{children}</span>
  </NavLink>
);

interface SidebarProps {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
}

export default function Sidebar({ darkMode, setDarkMode }: SidebarProps) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false); // mobile menu toggle

  const { accessToken, logout } = auth;

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout"); // call backend logout
    } catch (err) {
      console.error("Logout API failed", err);
    } finally {
      triggerLogout(); // clears local accessToken and navigates to /login
    }

    // logout()
  };

  return (
    <>
      {/* Top Navbar for small screens */}
      <div className="sm:hidden flex justify-between items-center bg-white dark:bg-gray-900 border-b px-4 py-3 fixed top-0 left-0 w-full z-20">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">
            CyberBridge
          </h1>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white"
          >
            {darkMode ? (
              <FiSun className="inline mr-1" />
            ) : (
              <FiMoon className="inline mr-1" />
            )}
            {darkMode ? "Light" : "Dark"}
          </button>

          <button
            onClick={() => setOpen(!open)}
            className="text-gray-600 dark:text-gray-200 focus:outline-none"
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
      </div>

      {/* Sidebar */}
      <aside
        className={`bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 p-6 flex flex-col fixed top-0 left-0 h-full z-30 w-64 transform transition-transform duration-300 ease-in-out
        ${open ? "translate-x-0" : "-translate-x-full"}
        sm:translate-x-0 sm:static sm:h-auto sm:w-64`}
      >
        {/* Logo */}
        <div className="hidden sm:flex flex-col mb-6">
          <h1 className="text-2xl font-bold text-gray-600 dark:text-blue-400">
            CyberBridge
          </h1>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Notification Dashboard
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-2 mt-16 sm:mt-0">
          <NavItem to="/" icon={<FiHome />}>
            Dashboard
          </NavItem>
          <NavItem to="/queues" icon={<FiMessageSquare />}>
            Message Queue
          </NavItem>
          <NavItem to="/failed" icon={<FiAlertCircle />}>
            Failed Messages
          </NavItem>
          <NavItem to="/webhook-dlr" icon={<FiMail />}>
            Webhook DLR
          </NavItem>
          <NavItem to="/metrics" icon={<FiBarChart2 />}>
            Metrics
          </NavItem>
          <NavItem to="/signup" icon={<FiBarChart2 />}>
            Signup
          </NavItem>
        </nav>

        {/* Footer */}
        {auth.accessToken && (
          <div className="mt-auto flex flex-col gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-red-500 hover:text-red-600 transition-all"
            >
              <FiLogOut />
              Logout
            </button>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className="flex items-center gap-2 px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
            >
              {darkMode ? <FiSun /> : <FiMoon />}
              {darkMode ? "Light Mode" : "Dark Mode"}
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
