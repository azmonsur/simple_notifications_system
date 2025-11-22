import React, { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface Metric {
  name: string;
  value: number;
}

const parsePrometheus = (text: string): Metric[] => {
  return text
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((line) => {
      const [key, value] = line.split(" ");
      return { name: key.trim(), value: Number(value) };
    });
};

const MAX_POINTS = 20;

const METRIC_URL = import.meta.env.VITE_API_METRIC;

interface LiveMetricsDashboardProps {
  darkMode: boolean;
}

export default function LiveMetricsDashboard({
  darkMode,
}: LiveMetricsDashboardProps) {
  const [history, setHistory] = useState<Metric[][]>([]);

  const fetchMetrics = async () => {
    try {
      const res = await fetch(METRIC_URL);
      const text = await res.text();
      const parsed = parsePrometheus(text);

      setHistory((prev) => {
        const newHistory = [...prev, parsed];
        if (newHistory.length > MAX_POINTS) newHistory.shift();
        return newHistory;
      });
    } catch (err) {
      console.error("Error fetching metrics:", err);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000);
    return () => clearInterval(interval);
  }, []);

  const getCurrentValue = (name: string) => {
    if (!history.length) return 0;
    return history[history.length - 1].find((m) => m.name === name)?.value || 0;
  };

  const getDelta = (name: string) => {
    if (history.length < 2) return 0;
    const prev =
      history[history.length - 2].find((m) => m.name === name)?.value || 0;
    const curr = getCurrentValue(name);
    return curr - prev;
  };

  const metricGroups = [
    {
      title: "CPU Usage",
      metrics: [
        "process_cpu_user_seconds_total",
        "process_cpu_system_seconds_total",
        "process_cpu_children_user_seconds_total",
        "process_cpu_children_system_seconds_total",
      ],
    },
    {
      title: "Memory Usage",
      metrics: [
        "nodejs_heap_size_used_bytes",
        "nodejs_heap_size_total_bytes",
        "process_resident_memory_bytes",
      ],
    },
    {
      title: "Event Loop Lag (s)",
      metrics: [
        "nodejs_eventloop_lag_mean_seconds",
        "nodejs_eventloop_lag_max_seconds",
        "nodejs_eventloop_lag_p99_seconds",
      ],
    },
    {
      title: "Garbage Collection (s)",
      metrics: [
        "nodejs_gc_minor_seconds_total",
        "nodejs_gc_major_seconds_total",
        "nodejs_gc_incremental_seconds_total",
        "nodejs_gc_weakcb_seconds_total",
      ],
    },
  ];

  const chartColors = ["#3B82F6", "#F59E0B", "#10B981", "#EF4444"];

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">
        ⚡ Server Live Metrics
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {metricGroups.map((group, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow flex flex-col"
          >
            <h3 className="font-semibold mb-3 text-gray-700 dark:text-gray-200">
              {group.title}
            </h3>

            {/* Metric Cards */}
            <div className="flex flex-wrap gap-2 mb-3">
              {group.metrics.map((m) => (
                <div
                  key={m}
                  title={m}
                  className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg shadow text-xs flex flex-col justify-between items-center w-full break-words"
                >
                  <div className="flex justify-center items-center gap-1 mb-1">
                    <span className="font-bold text-gray-800 dark:text-gray-200">
                      {getCurrentValue(m).toFixed(2)}
                    </span>
                    <span
                      className={`text-[10px] ${
                        getDelta(m) >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {getDelta(m) >= 0 ? "▲" : "▼"}{" "}
                      {Math.abs(getDelta(m)).toFixed(2)}
                    </span>
                  </div>
                  <div className="text-[9px] text-gray-600 dark:text-gray-300 text-center break-words">
                    {m}
                  </div>
                  {/* Mini Sparkline */}
                  <div className="w-full" style={{ height: "30px" }}>
                    <Line
                      data={{
                        labels: history.map((_, i) => i),
                        datasets: [
                          {
                            data: history.map(
                              (h) => h.find((x) => x.name === m)?.value || 0
                            ),
                            borderColor:
                              getDelta(m) >= 0 ? "#10B981" : "#EF4444",
                            backgroundColor: "transparent",
                            tension: 0.3,
                            pointRadius: 0,
                          },
                        ],
                      }}
                      options={{
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                          x: { display: false },
                          y: { display: false },
                        },
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Group Line Chart */}
            <div style={{ height: "120px" }}>
              <Line
                data={{
                  labels: Array(history.length).fill(""),
                  datasets: group.metrics.map((name, idx) => ({
                    label: name,
                    data: history.map(
                      (h) => h.find((m) => m.name === name)?.value || 0
                    ),
                    fill: false,
                    borderColor: chartColors[idx % chartColors.length],
                    tension: 0.3,
                    pointRadius: 0,
                  })),
                }}
                options={{
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: {
                      display: false,
                      grid: { color: darkMode ? "#374151" : "#E5E7EB" },
                    },
                    y: {
                      ticks: { color: darkMode ? "#D1D5DB" : "#374151" },
                      grid: { color: darkMode ? "#374151" : "#E5E7EB" },
                    },
                  },
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
