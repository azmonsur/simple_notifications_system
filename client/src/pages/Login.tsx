import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../utils/auth";
import axios from "axios";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const auth = useAuth();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(
        "http://localhost:3001/api/v1/admin/auth/login",
        { email, password },
        { withCredentials: true }
      );
      const { accessToken } = res.data;

      if (accessToken) {
        localStorage.setItem("accessToken", accessToken);
        auth.login(accessToken);
        navigate("/"); // redirect after login
      } else {
        alert("Login failed: access token not returned");
      }
    } catch (err: any) {
      alert(err.response.data.message.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md bg-white p-6 sm:p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-6 text-center">Admin Login</h2>
        <form onSubmit={submit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="you@example.com"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 px-3 py-2 rounded-md pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="********"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <span>👁️</span> : <span>🙈</span>}
              </button>
            </div>
          </div>

          {/* Submit */}
          <div>
            <button
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
