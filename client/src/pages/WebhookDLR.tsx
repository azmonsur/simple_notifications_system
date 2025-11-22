import React, { useEffect, useMemo, useState } from "react";
import api from "../utils/api";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Title,
  Filler,
  TimeScale,
  ChartOptions,
} from "chart.js";

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

interface WebhookDLRProps {
  darkMode: boolean; // prop to control dark/light mode
}

export default function WebhookDLR({ darkMode }: WebhookDLRProps) {
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [dlrSummary, setDlrSummary] = useState<any[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<any[]>([]);
  const [totalRetries, setTotalRetries] = useState<any[]>([]);
  const [totalCost, setTotalCost] = useState<any[]>([]);
  const [channelBreakdown, setChannelBreakdown] = useState<any[]>([]);
  const [successRate, setSuccessRate] = useState<any[]>([]);
  const [dailyTrend, setDailyTrend] = useState<any[]>([]);
  const [providerStatus, setProviderStatus] = useState<any[]>([]);
  const [providerStatusPercent, setProviderStatusPercent] = useState<any[]>([]);

  const today = new Date().toISOString().split("T")[0];

  const fetchDLR = async () => {
    try {
      const query = new URLSearchParams();
      if (from) query.append("from", from);
      if (to) query.append("to", to);

      const [
        summaryRes,
        statusRes,
        retriesRes,
        costRes,
        channelRes,
        successRes,
        dailyRes,
        providerStatusRes,
        providerStatusPercentRes,
      ] = await Promise.all([
        api.get(`dlr/analysis/total?${query}`),
        api.get(`dlr/analysis/status?${query}`),
        api.get(`dlr/analysis/retries?${query}`),
        api.get(`dlr/analysis/cost?${query}`),
        api.get(`dlr/analysis/channel?${query}`),
        api.get(`dlr/analysis/success-rate?${query}`),
        api.get(`dlr/analysis/daily-trend?${query}`),
        api.get(`dlr/analysis/provider-status?${query}`),
        api.get(`dlr/analysis/provider-status-percentage?${query}`),
      ]);

      if (summaryRes.status === 200) setDlrSummary(summaryRes.data || []);
      if (statusRes.status === 200) setStatusBreakdown(statusRes.data || []);
      if (retriesRes.status === 200) setTotalRetries(retriesRes.data || []);
      if (costRes.status === 200) setTotalCost(costRes.data || []);
      if (channelRes.status === 200) setChannelBreakdown(channelRes.data || []);
      if (successRes.status === 200) setSuccessRate(successRes.data || []);
      if (dailyRes.status === 200) setDailyTrend(dailyRes.data || []);
      if (providerStatusRes.status === 200)
        setProviderStatus(providerStatusRes.data?.data || []);
      if (providerStatusPercentRes.status === 200)
        setProviderStatusPercent(providerStatusPercentRes.data?.data || []);
    } catch (err) {
      console.error("Webhook DLR fetch error", err);
    }
  };

  useEffect(() => {
    fetchDLR();
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

  /** Dynamic colors based on darkMode prop */
  const textColor = darkMode ? "#E5E7EB" : "#1F2937";
  const gridColor = darkMode ? "#374151" : "#D1D5DB";
  const cardBg = darkMode ? "bg-gray-800" : "bg-white";

  // ---------------- CHART DATA ---------------- //
  const donutData = useMemo(() => {
    const labels = Array.from(new Set(statusBreakdown.map((s) => s.status)));
    const data = labels.map((label) =>
      statusBreakdown
        .filter((s) => s.status === label)
        .reduce((sum, s) => sum + Number(s.count), 0)
    );
    const colors = ["#34D399", "#FBBF24", "#F87171", "#60A5FA", "#8B5CF6"];
    return {
      labels,
      datasets: [{ data, backgroundColor: colors, hoverOffset: 6 }],
    };
  }, [statusBreakdown]);

  const barData = useMemo(
    () => ({
      labels: dlrSummary.map((s) => s.provider),
      datasets: [
        {
          label: "Total Messages",
          data: dlrSummary.map((s) => Number(s.total)),
          backgroundColor: "#3B82F6",
        },
      ],
    }),
    [dlrSummary]
  );

  const channelData = useMemo(
    () => ({
      labels: channelBreakdown.map((c) => c.channel),
      datasets: [
        {
          label: "Messages by Channel",
          data: channelBreakdown.map((c) => Number(c.total)),
          backgroundColor: "#F59E0B",
        },
      ],
    }),
    [channelBreakdown]
  );

  const successData = useMemo(
    () => ({
      labels: successRate.map((s) => s.provider),
      datasets: [
        {
          label: "Success Rate (%)",
          data: successRate.map((s) => Number(s.success_rate)),
          borderColor: "#10B981",
          backgroundColor: "#A7F3D0",
          fill: true,
        },
      ],
    }),
    [successRate]
  );

  const dailyData = useMemo(
    () => ({
      labels: dailyTrend.map((d) => d.date),
      datasets: [
        {
          label: "Messages per Day",
          data: dailyTrend.map((d) => Number(d.total)),
          borderColor: "#3B82F6",
          backgroundColor: "#93C5FD",
          fill: true,
        },
      ],
    }),
    [dailyTrend]
  );

  const providerStatusChart = useMemo(() => {
    if (!providerStatus.length) return null;
    const providers = Array.from(
      new Set(providerStatus.map((r) => r.provider))
    );
    const statuses = Array.from(new Set(providerStatus.map((r) => r.status)));
    const colors = [
      "#3B82F6",
      "#10B981",
      "#F59E0B",
      "#EF4444",
      "#8B5CF6",
      "#14B8A6",
    ];
    const datasets = statuses.map((status, i) => ({
      label: status,
      data: providers.map(
        (p) =>
          providerStatus.find((r) => r.provider === p && r.status === status)
            ?.total || 0
      ),
      backgroundColor: colors[i % colors.length],
    }));
    return { labels: providers, datasets };
  }, [providerStatus]);

  const providerPercentChart = useMemo(() => {
    if (!providerStatusPercent.length) return null;
    const providers = Array.from(
      new Set(providerStatusPercent.map((r) => r.provider))
    );
    const statuses = Array.from(
      new Set(providerStatusPercent.map((r) => r.status))
    );
    const colors = [
      "#3B82F6",
      "#10B981",
      "#F59E0B",
      "#EF4444",
      "#8B5CF6",
      "#14B8A6",
    ];
    const datasets = statuses.map((status, i) => ({
      label: status,
      data: providers.map(
        (p) =>
          providerStatusPercent.find(
            (r) => r.provider === p && r.status === status
          )?.percentage || 0
      ),
      backgroundColor: colors[i % colors.length],
      stack: "percent",
    }));
    return { labels: providers, datasets };
  }, [providerStatusPercent]);

  // ---------------- CHART OPTIONS ---------------- //
  const chartOptions: ChartOptions<"line"> &
    ChartOptions<"bar"> &
    ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", labels: { color: textColor } },
      title: { display: false },
    },
    scales: {
      x: { ticks: { color: textColor }, grid: { color: gridColor } },
      y: { ticks: { color: textColor }, grid: { color: gridColor } },
    },
  };

  const stackedOptions: ChartOptions<"bar"> = {
    ...chartOptions,
    scales: {
      x: {
        stacked: true,
        ticks: { color: textColor },
        grid: { color: gridColor },
      },
      y: {
        stacked: true,
        ticks: { color: textColor },
        grid: { color: gridColor },
      },
    },
  };

  const stackedPercentOptions: ChartOptions<"bar"> = {
    ...stackedOptions,
    scales: {
      ...stackedOptions.scales,
      y: {
        stacked: true,
        max: 100,
        ticks: { color: textColor },
        grid: { color: gridColor },
      },
    },
  };

  // ---------------- JSX ---------------- //
  return (
    <div className="flex min-h-screen">
      <main className="flex-1 p-6 pt-2 overflow-auto bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            📩 Webhook DLR Analytics
          </h1>
          <div className="flex flex-col sm:flex-row gap-4 mb-6 items-start sm:items-end">
            <div className="flex flex-col w-full sm:w-auto">
              <label className="block text-gray-600 dark:text-gray-300 text-sm mb-1">
                From
              </label>
              <input
                type="date"
                className="border rounded px-2 py-1 w-full sm:w-auto dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
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
                className="border rounded px-2 py-1 w-full sm:w-auto dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
                max={today}
                value={to}
                onChange={(e) => handleToChange(e.target.value)}
              />
            </div>
            <button
              onClick={fetchDLR}
              className="px-4 py-2 mt-2 sm:mt-0 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition w-full sm:w-auto"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className={`${cardBg} p-6 rounded-2xl shadow h-64`}>
            <h3 className="font-semibold mb-3 text-gray-700 dark:text-gray-200">
              Status Breakdown
            </h3>
            {donutData.labels.length ? (
              <Doughnut data={donutData as any} options={chartOptions as any} />
            ) : (
              <div className="text-center text-gray-400 py-12">
                No data available
              </div>
            )}
          </div>
          <div className={`${cardBg} p-6 rounded-2xl shadow h-64`}>
            <h3 className="font-semibold mb-3 text-gray-700 dark:text-gray-200">
              Total Messages by Provider
            </h3>
            {barData.labels.length ? (
              <Bar data={barData as any} options={chartOptions as any} />
            ) : (
              <div className="text-center text-gray-400 py-12">
                No data available
              </div>
            )}
          </div>
          <div className={`${cardBg} p-6 rounded-2xl shadow h-64`}>
            <h3 className="font-semibold mb-3 text-gray-700 dark:text-gray-200">
              Messages by Channel
            </h3>
            {channelData.labels.length ? (
              <Bar data={channelData as any} options={chartOptions as any} />
            ) : (
              <div className="text-center text-gray-400 py-12">
                No data available
              </div>
            )}
          </div>
          <div className={`${cardBg} p-6 rounded-2xl shadow h-64`}>
            <h3 className="font-semibold mb-3 text-gray-700 dark:text-gray-200">
              Success Rate
            </h3>
            {successData.labels.length ? (
              <Line data={successData as any} options={chartOptions as any} />
            ) : (
              <div className="text-center text-gray-400 py-12">
                No data available
              </div>
            )}
          </div>
          <div className={`${cardBg} p-6 rounded-2xl shadow h-64`}>
            <h3 className="font-semibold mb-3 text-gray-700 dark:text-gray-200">
              Daily Trend
            </h3>
            {dailyData.labels.length ? (
              <Line data={dailyData as any} options={chartOptions as any} />
            ) : (
              <div className="text-center text-gray-400 py-12">
                No data available
              </div>
            )}
          </div>
          <div className={`${cardBg} p-6 rounded-2xl shadow h-64`}>
            <h3 className="font-semibold mb-3 text-gray-700 dark:text-gray-200">
              Provider Status Breakdown (Counts)
            </h3>
            {providerStatusChart ? (
              <Bar
                data={providerStatusChart as any}
                options={stackedOptions as any}
              />
            ) : (
              <div className="text-center text-gray-400 py-12">
                No data available
              </div>
            )}
          </div>
          <div className={`${cardBg} p-6 rounded-2xl shadow h-64`}>
            <h3 className="font-semibold mb-3 text-gray-700 dark:text-gray-200">
              Provider Status Percentage (%)
            </h3>
            {providerPercentChart ? (
              <Bar
                data={providerPercentChart as any}
                options={stackedPercentOptions as any}
              />
            ) : (
              <div className="text-center text-gray-400 py-12">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Retries & Cost */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className={`${cardBg} p-6 rounded-2xl shadow`}>
            <h3 className="font-semibold mb-3 text-gray-700 dark:text-gray-200">
              Average Retries
            </h3>
            <ul className="space-y-2 dark:text-gray-200">
              {totalRetries.map((r) => (
                <li key={r.provider} className="flex justify-between">
                  <span>{r.provider}</span>
                  <span>{Number(r.avg_retries).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className={`${cardBg} p-6 rounded-2xl shadow`}>
            <h3 className="font-semibold mb-3 text-gray-700 dark:text-gray-200">
              Total Cost (SMS)
            </h3>
            <ul className="space-y-2 dark:text-gray-200">
              {totalCost.map((c) => (
                <li key={c.provider} className="flex justify-between">
                  <span>{c.provider}</span>
                  <span>₦{Number(c.total_cost || 0).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
