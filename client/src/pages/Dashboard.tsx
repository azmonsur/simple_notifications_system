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

interface DashboardProps {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
}

export default function Dashboard({
  darkMode,
  setDarkMode,
}: DashboardProps): JSX.Element {
  const today = new Date().toISOString().split("T")[0];

  // Date filter state
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  // Analytics state
  const [summary, setSummary] = useState<any[]>([]);
  const [sentThisMonth, setSentThisMonth] = useState<any[]>([]);
  const [byChannel, setByChannel] = useState<any[]>([]);
  const [byChannelStatus, setByChannelStatus] = useState<any[]>([]);
  const [parcelsByStatus, setParcelsByStatus] = useState<any[]>([]);
  const [recipientRole, setRecipientRole] = useState<any[]>([]);
  const [avgNotifPerParcel, setAvgNotifPerParcel] = useState<any>({});
  const [totalParcels, setTotalParcels] = useState<any>({});
  const [transitions, setTransitions] = useState<any[]>([]);
  const [avgParcelDuration, setAvgParcelDuration] = useState<any>({});
  const [trendData, setTrendData] = useState<any>({ labels: [], datasets: [] });

  // Dark mode
  // const [darkMode, setDarkMode] = useState<boolean>(
  //   localStorage.getItem("theme") === "dark" ||
  //     window.matchMedia("(prefers-color-scheme: dark)").matches
  // );

  // useEffect(() => {
  //   const root = document.documentElement;
  //   if (darkMode) {
  //     root.classList.add("dark");
  //     localStorage.setItem("theme", "dark");
  //   } else {
  //     root.classList.remove("dark");
  //     localStorage.setItem("theme", "light");
  //   }
  // }, [darkMode]);

  // ----------------- Fetch analytics with date filters ----------------- //
  const fetchAnalytics = async () => {
    try {
      const query = new URLSearchParams();
      if (from) query.append("from", from);
      if (to) query.append("to", to);

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
        avgDurationRes,
      ] = await Promise.allSettled([
        api.get(`/analytics/notifications/summary?${query}`),
        api.get(`/analytics/notifications/sent-this-month?${query}`),
        api.get(`/analytics/notifications/channel?${query}`),
        api.get(`/analytics/notifications/channel-status-dash?${query}`),
        api.get(`/analytics/parcels/status?${query}`),
        api.get(`/analytics/notifications/recipient-role?${query}`),
        api.get(`/analytics/notifications/avg-per-parcel?${query}`),
        api.get(`/analytics/parcels/total?${query}`),
        api.get(`/analytics/parcels/transitions?${query}`),
        api.get(`/analytics/parcels/average-duration?${query}`),
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
      if (avgDurationRes.status === "fulfilled")
        setAvgParcelDuration(
          avgDurationRes.value.data.data || { avg_hours_per_parcel: 0 }
        );
    } catch (err) {
      console.error("Analytics fetch error", err);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [from, to]);

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

  // ----------------- Derived totals & animated counts ----------------- //
  const totalSent = summary.find((s) => s.status === "sent")?.total || 0;
  const totalFailed = summary.find((s) => s.status === "failed")?.total || 0;
  const totalQueued = summary.find((s) => s.status === "queued")?.total || 0;
  const totalSentThisMonthRaw = parseInt(
    sentThisMonth[0]?.sent_this_month || "0"
  );

  const sentCount = useCountUp(totalSent);
  const failedCount = useCountUp(totalFailed);
  const queuedCount = useCountUp(totalQueued);
  const parcelsCount = useCountUp(Number(totalParcels.total) || 0);
  const avgNotif = useCountUp(
    Number(avgNotifPerParcel.avg_notif_per_parcel) || 0
  );
  const sentThisMonthCount = useCountUp(totalSentThisMonthRaw);
  const avgParcelHours = useCountUp(
    Number(avgParcelDuration.avg_hours_per_parcel) || 0
  );

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

  // ----------------- Charts ----------------- //

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

  // Recipient Role Doughnut
  const recipientRoleData = useMemo(
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
          hoverOffset: 6,
        },
      ],
    }),
    [recipientRole]
  );

  // Parcels by Status
  const parcelsByStatusData = useMemo(
    () => ({
      labels: parcelsByStatus.map((p) => p.new_status),
      datasets: [
        {
          label: "Parcels",
          data: parcelsByStatus.map((p) => p.total),
          backgroundColor: parcelsByStatus.map(() => "#60A5FA"),
          borderRadius: 6,
        },
      ],
    }),
    [parcelsByStatus]
  );

  // Parcel status transitions (stacked)
  const transitionsData = useMemo(() => {
    const statuses = Array.from(new Set(transitions.map((t) => t.new_status)));
    return {
      labels: statuses,
      datasets: [
        {
          label: "Transitions",
          data: statuses.map(
            (st) =>
              transitions.find((t) => t.new_status === st)?.transitions || 0
          ),
          backgroundColor: statuses.map(() => "#10B981"),
          borderRadius: 6,
        },
      ],
    };
  }, [transitions]);

  // Average Parcel Duration (single value) handled above in avgParcelHours

  // Trend over time (mocked if not available, can replace with actual API)
  const trendChartData = useMemo(() => {
    const labels = trendData.labels.length
      ? trendData.labels
      : ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const data = trendData.datasets.length
      ? trendData.datasets
      : [5, 10, 7, 12, 6];
    return {
      labels,
      datasets: [
        {
          label: "Notifications Sent",
          data,
          fill: true,
          backgroundColor: "rgba(59,130,246,0.2)",
          borderColor: "#3B82F6",
          tension: 0.4,
        },
      ],
    };
  }, [trendData]);

  const fadeInUp = {
    hidden: { opacity: 0, y: 28 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 p-6 pt-2 overflow-auto transition-colors bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            📊 Analytics Dashboard
          </h1>
          {/* Date filters */}
          {/* Date filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex flex-col w-full sm:w-auto">
              <label className="block text-gray-600 dark:text-gray-300 text-sm mb-1">
                From
              </label>
              <input
                type="date"
                className="border rounded px-2 py-1 w-full sm:w-auto"
                max={today}
                value={from}
                onChange={(e) => handleFromChange(e.target.value)}
              />
            </div>
            <div className="flex flex-col w-full sm:w-auto">
              <label className="block text-gray-600 dark:text-gray-300 text-sm mb-1">
                To
              </label>
              <input
                type="date"
                className="border rounded px-2 py-1 w-full sm:w-auto"
                max={today}
                value={to}
                onChange={(e) => handleToChange(e.target.value)}
              />
            </div>
          </div>
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
            {
              label: "Avg Parcel Duration (hrs)",
              value: avgParcelHours,
              color: "text-purple-400",
              subtitle: "Avg time per parcel",
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
            <Doughnut data={donutData as any} />
          </div>

          <div
            className={`${colors.cardBgClass} ${colors.shadowClass} p-5 rounded-2xl`}
          >
            <h3 className="font-semibold mb-3 text-gray-700 dark:text-gray-200">
              Notifications by Recipient Role
            </h3>
            <Doughnut data={recipientRoleData as any} />
          </div>

          <div
            className={`${colors.cardBgClass} ${colors.shadowClass} p-5 rounded-2xl`}
          >
            <h3 className="font-semibold mb-3 text-gray-700 dark:text-gray-200">
              Parcels by Status
            </h3>
            {parcelsByStatusData.labels.length ? (
              <Bar
                data={parcelsByStatusData as any}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { display: false },
                    title: { display: true, text: "Parcel Status Count" },
                  },
                  scales: {
                    x: {
                      ticks: { color: colors.text },
                      grid: { display: false },
                    },
                    y: {
                      ticks: { color: colors.text },
                      grid: { color: "rgba(0,0,0,0.06)" },
                    },
                  },
                }}
              />
            ) : (
              <div className="text-center text-gray-400 py-12">
                No data available
              </div>
            )}
          </div>
        </motion.section>

        {/* Stacked Bar chart */}
        <motion.section className="mb-8">
          <div
            className={`${colors.cardBgClass} ${colors.shadowClass} p-5 rounded-2xl`}
          >
            <h3 className="font-semibold mb-3 text-gray-700 dark:text-gray-200">
              Notifications by Channel & Status (Stacked)
            </h3>
            <Bar data={stackedDataWithColors} options={stackedOptions} />
          </div>
        </motion.section>

        {/* Trend chart */}
        <motion.section className="mb-8">
          <div
            className={`${colors.cardBgClass} ${colors.shadowClass} p-5 rounded-2xl`}
          >
            <h3 className="font-semibold mb-3 text-gray-700 dark:text-gray-200">
              Notifications Trend Over Time
            </h3>
            <Line
              data={trendChartData as any}
              options={{
                responsive: true,
                plugins: { legend: { labels: { color: colors.text } } },
                scales: {
                  x: {
                    ticks: { color: colors.text },
                    grid: { display: false },
                  },
                  y: {
                    ticks: { color: colors.text },
                    grid: { color: "rgba(0,0,0,0.06)" },
                  },
                },
              }}
            />
          </div>
        </motion.section>

        {/* Parcel transitions */}
        <motion.section className="mb-8">
          <div
            className={`${colors.cardBgClass} ${colors.shadowClass} p-5 rounded-2xl`}
          >
            <h3 className="font-semibold mb-3 text-gray-700 dark:text-gray-200">
              Parcel Status Transitions
            </h3>
            <Bar
              data={transitionsData as any}
              options={{
                responsive: true,
                plugins: {
                  legend: { display: false },
                  title: { display: true, text: "Parcel Status Transitions" },
                },
                scales: {
                  x: {
                    ticks: { color: colors.text },
                    grid: { display: false },
                  },
                  y: {
                    ticks: { color: colors.text },
                    grid: { color: "rgba(0,0,0,0.06)" },
                  },
                },
              }}
            />
          </div>
        </motion.section>
      </main>
    </div>
  );
}
