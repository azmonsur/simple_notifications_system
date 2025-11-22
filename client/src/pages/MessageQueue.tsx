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

interface ChannelStat {
  channel: string;
  sent: number;
  queued: number;
  failed: number;
  total: number;
}

interface MessageQueueProps {
  darkMode: boolean;
}

export default function MessageQueue({ darkMode }: MessageQueueProps) {
  const [channelStats, setChannelStats] = useState<ChannelStat[]>([]);
  const [filterChannel, setFilterChannel] = useState("all");
  const [loading, setLoading] = useState(false);

  /** DATE FILTERS **/
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const today = new Date().toISOString().split("T")[0];

  const handleFromChange = (value: string) => {
    if (to && value > to) {
      alert("From date cannot be later than To date");
      return;
    }
    setFrom(value);
  };

  const handleToChange = (value: string) => {
    if (from && value < from) {
      alert("To date cannot be earlier than From date");
      return;
    }
    setTo(value);
  };

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        if (from) query.append("from", from);
        if (to) query.append("to", to);

        const res = await api.get(
          `/analytics/notifications/channel-status?${query}`
        );
        setChannelStats(res.data.data || []);
      } catch (err) {
        console.error("Error fetching analytics:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [from, to]);

  const filteredStats =
    filterChannel === "all"
      ? channelStats
      : channelStats.filter((c) => c.channel === filterChannel);

  const chartData = {
    labels: filteredStats.map((row) => row.channel),
    datasets: [
      {
        label: "Sent",
        data: filteredStats.map((row) => row.sent || 0),
        backgroundColor: "rgba(34,197,94,0.8)",
        stack: "combined",
        borderRadius: 6,
      },
      {
        label: "Queued",
        data: filteredStats.map((row) => row.queued || 0),
        backgroundColor: "rgba(250,204,21,0.8)",
        stack: "combined",
        borderRadius: 6,
      },
      {
        label: "Failed",
        data: filteredStats.map((row) => row.failed || 0),
        backgroundColor: "rgba(239,68,68,0.8)",
        stack: "combined",
        borderRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 1000, easing: "easeOutQuart" as const },
    plugins: {
      legend: {
        position: "top" as const,
        labels: { color: darkMode ? "#D1D5DB" : "#374151" },
      },
      title: {
        display: true,
        text: "Notifications by Channel & Status",
        font: { size: 16, weight: "bold" },
        color: darkMode ? "#F9FAFB" : "#111827",
      },
    },
    scales: {
      x: {
        stacked: true,
        ticks: { color: darkMode ? "#D1D5DB" : "#374151" },
        grid: {
          color: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
        },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: { color: darkMode ? "#D1D5DB" : "#374151" },
        grid: {
          color: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
        },
      },
    },
  };

  return (
    <div
      className={`space-y-8 p-4 ${
        darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"
      }`}
    >
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold">Message Queue Analytics</h2>

        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
          {/* Channel filter */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <label className="text-sm">Channel:</label>
            <select
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              className={`border px-3 py-1.5 rounded-md shadow-sm focus:outline-none focus:ring ${
                darkMode
                  ? "bg-gray-800 border-gray-700 text-gray-200 focus:ring-blue-500"
                  : "bg-white border-gray-300 text-gray-900 focus:ring-blue-300"
              }`}
            >
              <option value="all">All</option>
              {channelStats.map((ch) => (
                <option key={ch.channel} value={ch.channel}>
                  {ch.channel}
                </option>
              ))}
            </select>
          </div>

          {/* Date filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <div className="flex flex-col">
              <label className="text-sm">From:</label>
              <input
                type="date"
                max={today}
                value={from}
                onChange={(e) => handleFromChange(e.target.value)}
                className={`border px-2 py-1 rounded-md ${
                  darkMode
                    ? "bg-gray-800 border-gray-700 text-gray-200"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm">To:</label>
              <input
                type="date"
                max={today}
                value={to}
                onChange={(e) => handleToChange(e.target.value)}
                className={`border px-2 py-1 rounded-md ${
                  darkMode
                    ? "bg-gray-800 border-gray-700 text-gray-200"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="overflow-x-auto rounded-lg"
      >
        {loading ? (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
            Loading...
          </div>
        ) : (
          <table
            className={`min-w-full border ${
              darkMode ? "bg-gray-800 text-gray-200" : "bg-white text-gray-900"
            } rounded-lg shadow-lg`}
          >
            <thead>
              <tr className={`bg-gray-100 dark:bg-gray-700 text-left`}>
                <th className="px-4 py-2 border">Channel</th>
                <th className="px-4 py-2 border text-green-400">Sent</th>
                <th className="px-4 py-2 border text-yellow-400">Queued</th>
                <th className="px-4 py-2 border text-red-400">Failed</th>
                <th className="px-4 py-2 border">Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredStats.map((row) => (
                <tr
                  key={row.channel}
                  className={`hover:${
                    darkMode ? "bg-gray-700" : "bg-gray-50"
                  } transition`}
                >
                  <td className="px-4 py-2 border font-medium">
                    {row.channel}
                  </td>
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
        )}
      </motion.div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className={`p-6 rounded-lg shadow-lg h-[400px] ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}
      >
        <Bar data={chartData} options={chartOptions} />
      </motion.div>
    </div>
  );
}
