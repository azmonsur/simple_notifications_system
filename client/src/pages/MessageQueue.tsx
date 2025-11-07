import React, { useEffect, useState } from "react";
import api from "../utils/api";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { motion } from "framer-motion";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function MessageQueue() {
  const [channelStats, setChannelStats] = useState([]);
  const [filterChannel, setFilterChannel] = useState("all");

  useEffect(() => {
    api
      .get("/analytics/notifications/channel-status")
      .then((r) => setChannelStats(r.data.data || []))
      .catch((err) => console.error("Error fetching analytics:", err));
  }, []);

  const filtered =
    filterChannel === "all"
      ? channelStats
      : channelStats.filter((c: any) => c.channel === filterChannel);

  // Chart.js data
  const chartLabels = filtered.map((row: any) => row.channel);
  const sentData = filtered.map((row: any) => row.sent || 0);
  const queuedData = filtered.map((row: any) => row.queued || 0);
  const failedData = filtered.map((row: any) => row.failed || 0);

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: "Sent",
        data: sentData,
        backgroundColor: "rgba(34, 197, 94, 0.8)",
        stack: "combined",
        borderRadius: 6,
      },
      {
        label: "Queued",
        data: queuedData,
        backgroundColor: "rgba(250, 204, 21, 0.8)",
        stack: "combined",
        borderRadius: 6,
      },
      {
        label: "Failed",
        data: failedData,
        backgroundColor: "rgba(239, 68, 68, 0.8)",
        stack: "combined",
        borderRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 1000,
      easing: "easeOutQuart",
    },
    plugins: {
      legend: { position: "top" as const },
      title: {
        display: true,
        text: "Notifications by Channel & Status",
        font: { size: 16, weight: "bold" },
      },
    },
    scales: {
      x: {
        stacked: true,
        ticks: { color: "#555" },
        grid: { display: false },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: { color: "#555" },
        grid: { color: "rgba(0,0,0,0.05)" },
      },
    },
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-semibold">Message Queue Analytics</h2>
        <div>
          <label className="text-sm mr-2">Channel</label>
          <select
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value)}
            className="border px-3 py-1.5 rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-300"
          >
            <option value="all">All</option>
            {channelStats.map((ch: any) => (
              <option key={ch.channel} value={ch.channel}>
                {ch.channel}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table with entry animation */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="overflow-x-auto"
      >
        <table className="min-w-full bg-white border rounded-lg shadow-lg">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="px-4 py-2 border">Channel</th>
              <th className="px-4 py-2 border text-green-700">Sent</th>
              <th className="px-4 py-2 border text-yellow-600">Queued</th>
              <th className="px-4 py-2 border text-red-600">Failed</th>
              <th className="px-4 py-2 border">Total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row: any) => (
              <tr key={row.channel} className="hover:bg-gray-50">
                <td className="px-4 py-2 border font-medium">{row.channel}</td>
                <td className="px-4 py-2 border">{row.sent || 0}</td>
                <td className="px-4 py-2 border">{row.queued || 0}</td>
                <td className="px-4 py-2 border">{row.failed || 0}</td>
                <td className="px-4 py-2 border font-semibold">
                  {row.total || 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      {/* Chart with smooth animation */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className="bg-white p-6 rounded-lg shadow-lg h-[400px]"
      >
        <Bar options={chartOptions} data={chartData} />
      </motion.div>
    </div>
  );
}
