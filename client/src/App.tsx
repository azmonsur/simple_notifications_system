import React from "react";
import Sidebar from "./components/Sidebar";
import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import MessageQueue from "./pages/MessageQueue";
import FailedMessages from "./pages/FailedMessages";
import Login from "./pages/Login";
import { useAuth } from "./utils/auth";

function Protected({ children }: { children: JSX.Element }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 p-6 sm:pt-6 pt-20 overflow-auto">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <Protected>
                <Dashboard />
              </Protected>
            }
          />
          <Route
            path="/queues"
            element={
              <Protected>
                <MessageQueue />
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
        </Routes>
      </main>
    </div>
  );
}
