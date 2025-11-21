// src/pages/NotFound.tsx
import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 px-4">
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 120 }}
        className="text-center"
      >
        <h1 className="text-9xl font-extrabold text-red-500 mb-6">404</h1>
        <h2 className="text-3xl font-bold mb-4">Oops! Page not found</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all shadow-lg"
        >
          Go Back Home
        </Link>
      </motion.div>
      {/* <motion.img
        src="/images/astronaut-404.svg" // optional cute illustration
        alt="Not found"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 100 }}
        className="w-96 mt-10 select-none pointer-events-none"
      /> */}
    </div>
  );
}
