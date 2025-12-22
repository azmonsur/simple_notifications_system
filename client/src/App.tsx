import React, { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import MessageQueue from "./pages/MessageQueue";
import FailedMessages from "./pages/FailedMessages";
import WebhookDLR from "./pages/WebhookDLR";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import LiveMetricsDashboard from "./pages/Metrics";
import Protected from "./utils/Protected";
import Signup from "./pages/Signup";

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(
    localStorage.getItem("theme") === "dark" ||
      window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  return (
    <div className="flex h-screen">
      <Sidebar darkMode={darkMode} setDarkMode={setDarkMode} />
      <main className="flex-1 p-6 sm:pt-6 pt-20 overflow-auto">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <Protected>
                <Dashboard darkMode={darkMode} setDarkMode={setDarkMode} />
              </Protected>
            }
          />
          <Route
            path="/queues"
            element={
              <Protected>
                <MessageQueue darkMode={darkMode} />
              </Protected>
            }
          />
          <Route
            path="/failed"
            element={
              <Protected>
                <FailedMessages />
              </Protected>
            }
          />
          <Route
            path="/webhook-dlr"
            element={
              <Protected>
                <WebhookDLR darkMode={darkMode} />
              </Protected>
            }
          />
          <Route
            path="/metrics"
            element={
              <Protected>
                <LiveMetricsDashboard darkMode={darkMode} />
              </Protected>
            }
          />
          <Route
            path="/signup"
            element={
              <Protected>
                <Signup darkMode={darkMode} />
              </Protected>
            }
          />
          <Route
            path="*"
            element={
              <Protected>
                <NotFound />
              </Protected>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
