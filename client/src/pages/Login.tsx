import React, { useState } from "react";
import api from "../utils/api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../utils/auth";

export default function Login() {
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("someStrongPassword");
  const [loading, setLoading] = useState(false);
  const auth = useAuth();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Expecting backend endpoint: POST /auth/login -> { token }
      const res = await api.post("/auth/login", { email, password });
      const token = res.data?.token;
      if (token) {
        localStorage.setItem("auth_token", token);
        auth.login(token);
        navigate("/");
      } else {
        alert("Login failed: token not returned");
      }
    } catch (err) {
      alert("Login failed");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20">
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">Admin Login</h2>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-sm">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border px-3 py-2 rounded"
            />
          </div>
          <div>
            <label className="text-sm">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border px-3 py-2 rounded"
            />
          </div>
          <div className="text-right">
            <button
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
