import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
export default function Login() {
  const [key, setKey] = useState("");
  const nav = useNavigate();
  const submit = () => {
    localStorage.setItem("ADMIN_API_KEY", key);
    nav("/notifications");
  };
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="p-6 bg-white rounded shadow w-full max-w-md">
        <h1 className="text-xl mb-4">Admin Login</h1>
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="w-full p-2 border mb-4"
          placeholder="X-API-KEY"
        />
        <button
          onClick={submit}
          className="w-full bg-blue-600 text-white p-2 rounded"
        >
          Sign in
        </button>
      </div>
    </div>
  );
}
