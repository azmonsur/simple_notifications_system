import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api"; // assuming your axios instance
import { motion } from "framer-motion";
import axios from "axios";

interface SignupProps {
  darkMode: boolean;
}

export default function Signup({ darkMode }: SignupProps) {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
    firstName: "",
    lastName: "",
    gender: "",
    roleName: "",
  });

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post("/auth/signup", form);
      alert("User created with default password.");
      navigate("/");
    } catch (err: any) {
      alert(err.response?.data?.message?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const cardBg = darkMode ? "bg-gray-800" : "bg-white";
  const inputBg = darkMode
    ? "bg-gray-700 text-white"
    : "bg-gray-100 text-gray-900";
  const labelColor = darkMode ? "text-gray-300" : "text-gray-700";

  return (
    <div
      className={`min-h-screen flex items-center justify-center ${
        darkMode ? "bg-gray-900" : "bg-gray-50"
      } px-4 sm:px-6 lg:px-8`}
    >
      <motion.div
        className={`${cardBg} w-full max-w-md p-6 sm:p-8 rounded-lg shadow-md`}
        initial="hidden"
        animate="show"
        variants={fadeInUp}
      >
        <h2 className="text-2xl font-semibold mb-6 text-center text-gray-50 dark:text-white">
          Create an Account
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className={`block text-sm font-medium mb-1 ${labelColor}`}>
              Email
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className={`w-full border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${inputBg}`}
              placeholder="you@example.com"
              required
            />
          </div>

          {/* Username */}
          <div>
            <label className={`block text-sm font-medium mb-1 ${labelColor}`}>
              Username
            </label>
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              className={`w-full border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${inputBg}`}
              placeholder="Username"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className={`block text-sm font-medium mb-1 ${labelColor}`}>
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={handleChange}
                className={`w-full border border-gray-300 px-3 py-2 rounded-md pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${inputBg}`}
                placeholder="********"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? "👁️" : "🙈"}
              </button>
            </div>
          </div>

          {/* First Name */}
          <div>
            <label className={`block text-sm font-medium mb-1 ${labelColor}`}>
              First Name
            </label>
            <input
              type="text"
              name="firstName"
              value={form.firstName}
              onChange={handleChange}
              className={`w-full border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${inputBg}`}
              required
            />
          </div>

          {/* Last Name */}
          <div>
            <label className={`block text-sm font-medium mb-1 ${labelColor}`}>
              Last Name
            </label>
            <input
              type="text"
              name="lastName"
              value={form.lastName}
              onChange={handleChange}
              className={`w-full border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${inputBg}`}
              required
            />
          </div>

          {/* Gender */}
          <div>
            <label className={`block text-sm font-medium mb-1 ${labelColor}`}>
              Gender
            </label>
            <select
              name="gender"
              value={form.gender}
              onChange={handleChange}
              className={`w-full border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${inputBg}`}
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Role Name */}
          <div>
            <label className={`block text-sm font-medium mb-1 ${labelColor}`}>
              Role Name
            </label>
            <input
              type="text"
              name="roleName"
              value={form.roleName}
              onChange={handleChange}
              className={`w-full border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${inputBg}`}
              placeholder="Admin / User"
              required
            />
          </div>

          {/* Submit */}
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Signing up..." : "Sign Up"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
