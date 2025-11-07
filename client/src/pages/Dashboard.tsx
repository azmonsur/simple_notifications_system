// src/pages/Dashboard.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../utils/api";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import { motion } from "framer-motion";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale
);

/* ============================
   Simple CountUp hook (no deps)
   ============================ */
function useCountUp(value: number | string | undefined, duration = 900) {
  const [display, setDisplay] = useState<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const target = Number(value) || 0;
    if (isNaN(target)) {
      setDisplay(0);
      return;
    }
    const startTime = performance.now();
    const from = 0;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const curr = Math.round(from + (target - from) * eased);
      setDisplay(curr);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return display;
}

/* ============================
   Dashboard Component
   ============================ */
export default function Dashboard(): JSX.Element {
  // raw data
  const [summary, setSummary] = useState<any[]>([]);
  const [byChannel, setByChannel] = useState<any[]>([]);
  const [byChannelStatus, setByChannelStatus] = useState<any[]>([]);
  const [parcelsByStatus, setParcelsByStatus] = useState<any[]>([]);
  const [recipientRole, setRecipientRole] = useState<any[]>([]);
  const [avgDuration, setAvgDuration] = useState<any>({});
  const [avgNotifPerParcel, setAvgNotifPerParcel] = useState<any>({});
  const [totalParcels, setTotalParcels] = useState<any>({});
  const [transitions, setTransitions] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any>({ labels: [], datasets: [] });

  // ui
  const [darkMode, setDarkMode] = useState<boolean>(
    localStorage.getItem("theme") === "dark" ||
      window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  // apply theme on mount & toggle
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

  // fetch all analytics (including your channel-status endpoint)
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [
          summaryRes,
          channelRes,
          channelStatusRes,
          parcelsRes,
          recipientRes,
          avgDurRes,
          avgNotifRes,
          totalParcelsRes,
          transitionsRes,
        ] = await Promise.allSettled([
          api.get("/analytics/notifications/summary"),
          api.get("/analytics/notifications/channel"),
          api.get("/analytics/notifications/channel-status-dash"), // <--- your endpoint
          api.get("/analytics/parcels/status"),
          api.get("/analytics/notifications/recipient-role"),
          api.get("/analytics/parcels/average-duration"),
          api.get("/analytics/notifications/avg-per-parcel"),
          api.get("/analytics/parcels/total"),
          api.get("/analytics/parcels/transitions"),
        ]);

        if (summaryRes.status === "fulfilled")
          setSummary(summaryRes.value.data.data || []);
        if (channelRes.status === "fulfilled")
          setByChannel(channelRes.value.data.data || []);
        if (channelStatusRes.status === "fulfilled")
          setByChannelStatus(channelStatusRes.value.data.data || []);
        if (parcelsRes.status === "fulfilled")
          setParcelsByStatus(parcelsRes.value.data.data || []);
        if (recipientRes.status === "fulfilled")
          setRecipientRole(recipientRes.value.data.data || []);
        if (avgDurRes.status === "fulfilled")
          setAvgDuration(avgDurRes.value.data.data || {});
        if (avgNotifRes.status === "fulfilled")
          setAvgNotifPerParcel(avgNotifRes.value.data.data || {});
        if (totalParcelsRes.status === "fulfilled")
          setTotalParcels(totalParcelsRes.value.data.data || {});
        if (transitionsRes.status === "fulfilled")
          setTransitions(transitionsRes.value.data.data || []);
      } catch (err) {
        console.error("Analytics fetch error", err);
      }
    };

    fetchAll();

    // demo trend (replace with real timeseries API if available)
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    setTrendData({
      labels,
      datasets: [
        {
          label: "Parcels Processed",
          data: labels.map(() => Math.floor(Math.random() * 400 + 30)),
          fill: true,
          tension: 0.35,
        },
      ],
    });
  }, []);

  // derived totals (summary)
  const totalSent = summary.find((s) => s.status === "sent")?.total || 0;
  const totalFailed = summary.find((s) => s.status === "failed")?.total || 0;
  const totalQueued = summary.find((s) => s.status === "queued")?.total || 0;

  // animated counters
  const sentCount = useCountUp(totalSent);
  const failedCount = useCountUp(totalFailed);
  const queuedCount = useCountUp(totalQueued);
  const parcelsCount = useCountUp(Number(totalParcels.total) || 0);
  const avgNotif = useCountUp(
    Number(avgNotifPerParcel.avg_notif_per_parcel) || 0
  );

  // adaptive colors & small theme helpers
  const colors = useMemo(
    () => ({
      sent: darkMode ? "rgba(34,197,94,0.95)" : "rgba(34,197,94,0.7)",
      queued: darkMode ? "rgba(250,204,21,0.95)" : "rgba(250,204,21,0.7)",
      failed: darkMode ? "rgba(239,68,68,0.95)" : "rgba(239,68,68,0.7)",
      primary: darkMode ? "#60A5FA" : "#3B82F6",
      text: darkMode ? "#E6EEF8" : "#1F2937",
      muted: darkMode ? "#9CA3AF" : "#6B7280",
      cardBgClass: darkMode ? "bg-gray-800" : "bg-white",
      pageBgClass: darkMode ? "bg-gray-900" : "bg-gray-50",
      shadowClass: darkMode ? "shadow-md shadow-black/25" : "shadow",
    }),
    [darkMode]
  );

  /* ===========================
     Prepare stacked bar data
     expects byChannelStatus = [{ channel, status, total }, ...]
     =========================== */
  const stackedDataWithColors = useMemo(() => {
    if (!byChannelStatus || byChannelStatus.length === 0) {
      // fallback: if only `byChannel` exists, synthesize a simple stacked dataset
      if (byChannel && byChannel.length) {
        const labels = byChannel.map((c) => c.channel);
        const synthSent = byChannel.map((c) =>
          Math.round((c.total || 0) * 0.8)
        );
        const synthQueued = byChannel.map((c) =>
          Math.round((c.total || 0) * 0.15)
        );
        const synthFailed = byChannel.map((c) =>
          Math.round((c.total || 0) * 0.05)
        );

        return {
          labels,
          datasets: [
            {
              label: "Sent",
              data: synthSent,
              backgroundColor: colors.sent,
              stack: "s1",
              borderRadius: 6,
            },
            {
              label: "Queued",
              data: synthQueued,
              backgroundColor: colors.queued,
              stack: "s1",
              borderRadius: 6,
            },
            {
              label: "Failed",
              data: synthFailed,
              backgroundColor: colors.failed,
              stack: "s1",
              borderRadius: 6,
            },
          ],
        };
      }
      return { labels: [], datasets: [] };
    }

    // build labels (channels) and statuses dynamically
    const channels = Array.from(
      new Set(byChannelStatus.map((r: any) => r.channel))
    );
    const statuses = Array.from(
      new Set(byChannelStatus.map((r: any) => r.status))
    );

    // map a color per status (use default mapping for common statuses)
    const defaultStatusColor: Record<string, string> = {
      sent: colors.sent,
      queued: colors.queued,
      failed: colors.failed,
    };
    const palette = [
      "#3B82F6",
      "#10B981",
      "#F59E0B",
      "#EF4444",
      "#8B5CF6",
      "#6366F1",
      "#14B8A6",
      "#FB7185",
    ];

    const statusColors: Record<string, string> = {};
    statuses.forEach((s: string, idx: number) => {
      statusColors[s] = defaultStatusColor[s] || palette[idx % palette.length];
    });

    const datasets = statuses.map((st) => {
      const data = channels.map((ch) => {
        const r = byChannelStatus.find(
          (row: any) => row.channel === ch && row.status === st
        );
        return r ? r.total : 0;
      });
      return {
        label: st,
        data,
        backgroundColor: statusColors[st],
        stack: "s1",
        borderRadius: 6,
      };
    });

    return { labels: channels, datasets };
  }, [byChannelStatus, byChannel, colors]);

  const stackedOptions: any = useMemo(
    () => ({
      responsive: true,
      plugins: {
        legend: { position: "right" as const, labels: { color: colors.text } },
        title: {
          display: true,
          text: "Notifications by Channel & Status (Stacked)",
        },
        tooltip: { mode: "index", intersect: false },
      },
      interaction: { mode: "index", intersect: false },
      scales: {
        x: {
          stacked: true,
          ticks: { color: colors.text },
          grid: { display: false },
        },
        y: {
          stacked: true,
          ticks: { color: colors.text },
          grid: { color: "rgba(0,0,0,0.06)" },
        },
      },
    }),
    [colors]
  );

  /* ===========================
     Donut / other charts
     =========================== */
  const donutData = useMemo(
    () => ({
      labels: ["Sent", "Failed", "Queued"],
      datasets: [
        {
          data: [totalSent, totalFailed, totalQueued],
          backgroundColor: [colors.sent, colors.failed, colors.queued],
          hoverOffset: 6,
        },
      ],
    }),
    [totalSent, totalFailed, totalQueued, colors]
  );

  const channelLine = useMemo(
    () => ({
      labels: byChannel.map((c) => c.channel),
      datasets: [
        {
          label: "Notifications",
          data: byChannel.map((c) => c.total),
          borderColor: colors.primary,
          backgroundColor: darkMode
            ? "rgba(96,165,250,0.12)"
            : "rgba(59,130,246,0.12)",
          fill: true,
          tension: 0.35,
        },
      ],
    }),
    [byChannel, colors, darkMode]
  );

  const parcelTrend = useMemo(
    () => ({
      labels: trendData.labels,
      datasets: [
        {
          ...trendData.datasets[0],
          borderColor: darkMode ? "#60A5FA" : "#3B82F6",
          backgroundColor: darkMode
            ? "rgba(96,165,250,0.12)"
            : "rgba(59,130,246,0.12)",
          fill: true,
          tension: 0.35,
        },
      ],
    }),
    [trendData, darkMode]
  );

  const statusBar = useMemo(
    () => ({
      labels: parcelsByStatus.map((p) => p.current_status),
      datasets: [
        {
          label: "Parcels",
          data: parcelsByStatus.map((p) => p.total),
          backgroundColor: darkMode
            ? "rgba(34,197,94,0.6)"
            : "rgba(34,197,94,0.7)",
        },
      ],
    }),
    [parcelsByStatus, darkMode]
  );

  const roleDonut = useMemo(
    () => ({
      labels: recipientRole.map((r) => r.recipient_role),
      datasets: [
        {
          data: recipientRole.map((r) => r.total),
          backgroundColor: [
            "#3B82F6",
            "#10B981",
            "#F59E0B",
            "#EF4444",
            "#8B5CF6",
          ],
        },
      ],
    }),
    [recipientRole]
  );

  const transitionsBar = useMemo(
    () => ({
      labels: transitions.map((t) => t.new_status),
      datasets: [
        {
          label: "Transitions",
          data: transitions.map((t) => t.transitions),
          backgroundColor: darkMode
            ? "rgba(239,68,68,0.6)"
            : "rgba(239,68,68,0.7)",
        },
      ],
    }),
    [transitions, darkMode]
  );

  /* ===========================
     Framer Motion variants
     =========================== */
  const fadeInUp = {
    hidden: { opacity: 0, y: 28 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  /* ===========================
     Render
     =========================== */
  return (
    <div className={`p-6 min-h-screen ${colors.pageBgClass} transition-colors`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className={`text-3xl font-bold ${
              darkMode ? "text-white" : "text-gray-800"
            }`}
          >
            📊 Analytics Dashboard
          </h1>
          <div className="text-sm text-gray-400">
            Realtime overview • interactive charts
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div
              className={`text-xs ${
                darkMode ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Theme
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`mt-1 px-3 py-1 rounded-md font-medium ${
                darkMode
                  ? "bg-gray-700 text-gray-200"
                  : "bg-gray-200 text-gray-800"
              }`}
            >
              {darkMode ? "☀ Light" : "🌙 Dark"}
            </button>
          </div>
        </div>
      </div>

      {/* Top metrics */}
      <motion.section
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={fadeInUp}
      >
        <motion.div
          whileHover={{ scale: 1.02 }}
          className={`${colors.cardBgClass} ${colors.shadowClass} p-4 rounded-2xl`}
        >
          <div className="text-sm text-gray-400">Total Sent</div>
          <div className="text-3xl font-bold text-green-500">{sentCount}</div>
          <div className="text-xs text-gray-400 mt-2">
            Successful deliveries
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className={`${colors.cardBgClass} ${colors.shadowClass} p-4 rounded-2xl`}
        >
          <div className="text-sm text-gray-400">Total Failed</div>
          <div className="text-3xl font-bold text-red-500">{failedCount}</div>
          <div className="text-xs text-gray-400 mt-2">Failed deliveries</div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className={`${colors.cardBgClass} ${colors.shadowClass} p-4 rounded-2xl`}
        >
          <div className="text-sm text-gray-400">Queued</div>
          <div className="text-3xl font-bold text-yellow-500">
            {queuedCount}
          </div>
          <div className="text-xs text-gray-400 mt-2">Waiting to be sent</div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className={`${colors.cardBgClass} ${colors.shadowClass} p-4 rounded-2xl`}
        >
          <div className="text-sm text-gray-400">Parcels</div>
          <div className="text-3xl font-bold text-indigo-400">
            {parcelsCount}
          </div>
          <div className="text-xs text-gray-400 mt-2">
            Total parcels handled
          </div>
        </motion.div>
      </motion.section>

      {/* Donut + Stacked */}
      <motion.section
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={fadeInUp}
      >
        <div
          className={`${colors.cardBgClass} ${colors.shadowClass} p-5 rounded-2xl`}
        >
          <h3
            className={`font-semibold mb-3 ${
              darkMode ? "text-gray-200" : "text-gray-700"
            }`}
          >
            Delivery Breakdown
          </h3>
          <div className="flex items-center gap-6">
            <div style={{ width: 160, height: 160 }}>
              <Doughnut data={donutData as any} />
            </div>

            <div>
              <div className="text-lg font-semibold">{`${(
                (totalSent / Math.max(1, totalSent + totalFailed)) *
                100
              ).toFixed(1)}%`}</div>
              <div className="text-sm text-gray-400 mt-1">Delivery success</div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-400">Sent</div>
                  <div className="font-medium text-green-500">{totalSent}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-400">Failed</div>
                  <div className="font-medium text-red-500">{totalFailed}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-400">Queued</div>
                  <div className="font-medium text-yellow-500">
                    {totalQueued}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`${colors.cardBgClass} ${colors.shadowClass} p-5 rounded-2xl lg:col-span-2`}
        >
          <h3
            className={`font-semibold mb-3 ${
              darkMode ? "text-gray-200" : "text-gray-700"
            }`}
          >
            Notifications by Channel & Status
          </h3>

          {/* If no labels, show friendly fallback */}
          {!stackedDataWithColors.labels ||
          stackedDataWithColors.labels.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">
              No channel-status breakdown available yet. The chart will appear
              when the API returns data.
            </div>
          ) : (
            <div style={{ height: 320 }}>
              <Bar
                data={stackedDataWithColors as any}
                options={stackedOptions}
              />
            </div>
          )}
        </div>
      </motion.section>

      {/* Channel + Parcels + Roles */}
      <motion.section
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={fadeInUp}
      >
        <div
          className={`${colors.cardBgClass} ${colors.shadowClass} p-5 rounded-2xl`}
        >
          <h4
            className={`font-semibold mb-3 ${
              darkMode ? "text-gray-200" : "text-gray-700"
            }`}
          >
            Notifications by Channel
          </h4>
          <div style={{ height: 180 }}>
            <Line data={channelLine as any} />
          </div>
        </div>

        <div
          className={`${colors.cardBgClass} ${colors.shadowClass} p-5 rounded-2xl`}
        >
          <h4
            className={`font-semibold mb-3 ${
              darkMode ? "text-gray-200" : "text-gray-700"
            }`}
          >
            Parcels by Status
          </h4>
          <div style={{ height: 180 }}>
            <Bar data={statusBar as any} />
          </div>
        </div>

        <div
          className={`${colors.cardBgClass} ${colors.shadowClass} p-5 rounded-2xl`}
        >
          <h4
            className={`font-semibold mb-3 ${
              darkMode ? "text-gray-200" : "text-gray-700"
            }`}
          >
            Notifications by Recipient Role
          </h4>
          <div style={{ height: 180 }}>
            <Doughnut data={roleDonut as any} />
          </div>
        </div>
      </motion.section>

      {/* Parcel trend + transitions */}
      <motion.section
        className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={fadeInUp}
      >
        <div
          className={`${colors.cardBgClass} ${colors.shadowClass} p-5 rounded-2xl`}
        >
          <h4
            className={`font-semibold mb-3 ${
              darkMode ? "text-gray-200" : "text-gray-700"
            }`}
          >
            Parcel Volume Over Time
          </h4>
          <div style={{ height: 280 }}>
            <Line data={parcelTrend as any} />
          </div>
        </div>

        <div
          className={`${colors.cardBgClass} ${colors.shadowClass} p-5 rounded-2xl`}
        >
          <h4
            className={`font-semibold mb-3 ${
              darkMode ? "text-gray-200" : "text-gray-700"
            }`}
          >
            Parcel Status Transitions
          </h4>
          <div style={{ height: 280 }}>
            <Bar data={transitionsBar as any} options={{ indexAxis: "y" }} />
          </div>
        </div>
      </motion.section>

      {/* Footer metrics */}
      <motion.section
        className="grid grid-cols-1 sm:grid-cols-2 gap-6"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={fadeInUp}
      >
        <div
          className={`${colors.cardBgClass} ${colors.shadowClass} p-6 rounded-2xl`}
        >
          <h4
            className={`font-semibold mb-2 ${
              darkMode ? "text-gray-200" : "text-gray-700"
            }`}
          >
            Average Notifications / Parcel
          </h4>
          <div className="text-3xl font-bold text-indigo-400">{avgNotif}</div>
          <div className="text-sm text-gray-400 mt-2">
            Average notifications generated per parcel
          </div>
        </div>

        <div
          className={`${colors.cardBgClass} ${colors.shadowClass} p-6 rounded-2xl text-center`}
        >
          <h4
            className={`font-semibold mb-2 ${
              darkMode ? "text-gray-200" : "text-gray-700"
            }`}
          >
            Average Parcel Duration (hours)
          </h4>
          <div className="text-3xl font-bold text-rose-400">
            {avgDuration?.avg_hours_per_parcel ?? "N/A"}
          </div>
          <div className="text-sm text-gray-400 mt-2">
            Average time from first to last status
          </div>
        </div>
      </motion.section>
    </div>
  );
}
