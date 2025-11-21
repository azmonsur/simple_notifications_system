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
import Sidebar from "../components/Sidebar";

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

// Animated CountUp Hook
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
      const eased = 1 - Math.pow(1 - t, 3);
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

// Get current month
function getMonthName() {
  return new Date().toLocaleString("default", { month: "short" });
}

export default function Dashboard(): JSX.Element {
  // Data states
  const [summary, setSummary] = useState<any[]>([]);
  const [sentThisMonth, setSentThisMonth] = useState<any[]>([]);
  const [byChannel, setByChannel] = useState<any[]>([]);
  const [byChannelStatus, setByChannelStatus] = useState<any[]>([]);
  const [parcelsByStatus, setParcelsByStatus] = useState<any[]>([]);
  const [recipientRole, setRecipientRole] = useState<any[]>([]);
  const [avgNotifPerParcel, setAvgNotifPerParcel] = useState<any>({});
  const [totalParcels, setTotalParcels] = useState<any>({});
  const [transitions, setTransitions] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any>({ labels: [], datasets: [] });

  // UI state
  const [darkMode, setDarkMode] = useState<boolean>(
    localStorage.getItem("theme") === "dark" ||
      window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  // Apply theme
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

  // Fetch analytics
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [
          summaryRes,
          sentThisMonthRes,
          channelRes,
          channelStatusRes,
          parcelsRes,
          recipientRes,
          avgNotifRes,
          totalParcelsRes,
          transitionsRes,
        ] = await Promise.allSettled([
          api.get("/analytics/notifications/summary"),
          api.get("/analytics/notifications/sent-this-month"),
          api.get("/analytics/notifications/channel"),
          api.get("/analytics/notifications/channel-status-dash"),
          api.get("/analytics/parcels/status"),
          api.get("/analytics/notifications/recipient-role"),
          api.get("/analytics/notifications/avg-per-parcel"),
          api.get("/analytics/parcels/total"),
          api.get("/analytics/parcels/transitions"),
        ]);

        if (summaryRes.status === "fulfilled")
          setSummary(summaryRes.value.data.data || []);
        if (sentThisMonthRes.status === "fulfilled")
          setSentThisMonth(sentThisMonthRes.value.data.data || []);
        if (channelRes.status === "fulfilled")
          setByChannel(channelRes.value.data.data || []);
        if (channelStatusRes.status === "fulfilled")
          setByChannelStatus(channelStatusRes.value.data.data || []);
        if (parcelsRes.status === "fulfilled")
          setParcelsByStatus(parcelsRes.value.data.data || []);
        if (recipientRes.status === "fulfilled")
          setRecipientRole(recipientRes.value.data.data || []);
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

    // Demo trend
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

  // Derived totals
  const totalSent = summary.find((s) => s.status === "sent")?.total || 0;
  const totalFailed = summary.find((s) => s.status === "failed")?.total || 0;
  const totalQueued = summary.find((s) => s.status === "queued")?.total || 0;
  const totalSentThisMonthRaw = parseInt(
    sentThisMonth[0]?.sent_this_month || "0"
  );

  // Animated counts
  const sentCount = useCountUp(totalSent);
  const failedCount = useCountUp(totalFailed);
  const queuedCount = useCountUp(totalQueued);
  const parcelsCount = useCountUp(Number(totalParcels.total) || 0);
  const avgNotif = useCountUp(
    Number(avgNotifPerParcel.avg_notif_per_parcel) || 0
  );
  const sentThisMonthCount = useCountUp(totalSentThisMonthRaw); // <-- Animated counter

  // Colors
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

  // Stacked bar data
  const stackedDataWithColors = useMemo(() => {
    if (!byChannelStatus?.length) {
      if (byChannel?.length) {
        const labels = byChannel.map((c) => c.channel);
        return {
          labels,
          datasets: [
            {
              label: "Sent",
              data: byChannel.map((c) => Math.round(c.total * 0.8)),
              backgroundColor: colors.sent,
              stack: "s1",
              borderRadius: 6,
            },
            {
              label: "Queued",
              data: byChannel.map((c) => Math.round(c.total * 0.15)),
              backgroundColor: colors.queued,
              stack: "s1",
              borderRadius: 6,
            },
            {
              label: "Failed",
              data: byChannel.map((c) => Math.round(c.total * 0.05)),
              backgroundColor: colors.failed,
              stack: "s1",
              borderRadius: 6,
            },
          ],
        };
      }
      return { labels: [], datasets: [] };
    }

    const channels = Array.from(new Set(byChannelStatus.map((r) => r.channel)));
    const statuses = Array.from(new Set(byChannelStatus.map((r) => r.status)));
    const defaultStatusColor: Record<string, string> = {
      sent: colors.sent,
      queued: colors.queued,
      failed: colors.failed,
    };
    const palette = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];
    const statusColors: Record<string, string> = {};
    statuses.forEach(
      (s, idx) =>
        (statusColors[s] =
          defaultStatusColor[s] || palette[idx % palette.length])
    );
    const datasets = statuses.map((st) => ({
      label: st,
      data: channels.map(
        (ch) =>
          byChannelStatus.find((r) => r.channel === ch && r.status === st)
            ?.total || 0
      ),
      backgroundColor: statusColors[st],
      stack: "s1",
      borderRadius: 6,
    }));
    return { labels: channels, datasets };
  }, [byChannelStatus, byChannel, colors]);

  const stackedOptions: any = useMemo(
    () => ({
      responsive: true,
      plugins: {
        legend: { position: "right", labels: { color: colors.text } },
        title: {
          display: true,
          text: "Notifications by Channel & Status (stacked)",
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

  // Donut chart
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

  const fadeInUp = {
    hidden: { opacity: 0, y: 28 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      {/* <Sidebar /> */}

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto transition-colors bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            📊 Analytics Dashboard
          </h1>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
          >
            {darkMode ? "☀ Light" : "🌙 Dark"}
          </button>
        </div>

        {/* Top metrics */}
        <motion.section
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
        >
          {[
            {
              label: "Total Sent",
              value: sentCount,
              color: "text-green-500",
              subtitle: "Successful deliveries",
            },
            {
              label: `Total Sent (${getMonthName()})`,
              value: sentThisMonthCount, // <-- Fixed animated counter
              color: "text-orange-500",
              subtitle: "This month",
            },
            {
              label: "Total Failed",
              value: failedCount,
              color: "text-red-500",
              subtitle: "Failed deliveries",
            },
            {
              label: "Total Queued",
              value: queuedCount,
              color: "text-yellow-500",
              subtitle: "Waiting to be sent",
            },
            {
              label: "Total Parcels",
              value: parcelsCount,
              color: "text-indigo-400",
              subtitle: "Handled parcels",
            },
          ].map((card) => (
            <motion.div
              whileHover={{ scale: 1.02 }}
              className={`${colors.cardBgClass} ${colors.shadowClass} p-4 rounded-2xl`}
              key={card.label}
            >
              <div className="text-sm text-gray-400">{card.label}</div>
              <div className={`text-3xl font-bold ${card.color}`}>
                {Number(card.value).toLocaleString()}
              </div>
              <div className="text-xs text-gray-400 mt-2">{card.subtitle}</div>
            </motion.div>
          ))}
        </motion.section>

        {/* Charts */}
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
            <h3 className="font-semibold mb-3 text-gray-700 dark:text-gray-200">
              Delivery Breakdown
            </h3>
            <div className="flex items-center gap-6">
              <div style={{ width: 160, height: 160 }}>
                <Doughnut data={donutData as any} />
              </div>
            </div>
          </div>
          <div
            className={`${colors.cardBgClass} ${colors.shadowClass} p-5 rounded-2xl lg:col-span-2`}
          >
            <h3 className="font-semibold mb-3 text-gray-700 dark:text-gray-200">
              Channel & Status
            </h3>
            {stackedDataWithColors.labels.length ? (
              <Bar
                data={stackedDataWithColors as any}
                options={stackedOptions}
              />
            ) : (
              <div className="text-center text-gray-400 py-12">
                No data available
              </div>
            )}
          </div>
        </motion.section>
      </main>
    </div>
  );
}
