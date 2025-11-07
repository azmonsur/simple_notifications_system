import React, { useEffect, useState } from "react";
import api from "../utils/api";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Dashboard() {
  const [summary, setSummary] = useState([]);
  const [byChannel, setByChannel] = useState([]);
  const [parcelsByStatus, setParcelsByStatus] = useState([]);
  const [avgDuration, setAvgDuration] = useState({});
  const [trendData, setTrendData] = useState({ labels: [], datasets: [] });

  useEffect(() => {
    api
      .get("/analytics/notifications/summary")
      .then((r) => setSummary(r.data.data || []));
    api
      .get("/analytics/notifications/channel")
      .then((r) => setByChannel(r.data.data || []));
    api
      .get("/analytics/parcels/status")
      .then((r) => setParcelsByStatus(r.data.data || []));
    api
      .get("/analytics/parcels/average-duration")
      .then((r) => setAvgDuration(r.data.data || {}));
    // For demo: build a small time series from notifications by day endpoint if exists; otherwise mock
    api.get("/analytics/notifications/summary").then((r) => {
      const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const data = r.data.data || [];
      setTrendData({
        labels,
        datasets: [
          {
            label: "Notifications (mock)",
            data: labels.map(() => Math.floor(Math.random() * 200 + 20)),
            fill: true,
            tension: 0.4,
          },
        ],
      });
    });
  }, []);

  const channelLine = {
    labels: byChannel.map((c: any) => c.channel),
    datasets: [
      {
        label: "Notifications",
        data: byChannel.map((c: any) => c.total),
        tension: 0.3,
        borderWidth: 2,
      },
    ],
  };

  const statusBar = {
    labels: parcelsByStatus.map((p: any) => p.current_status),
    datasets: [
      {
        label: "Parcels",
        data: parcelsByStatus.map((p: any) => p.total),
        backgroundColor: "rgba(59,130,246,0.6)",
      },
    ],
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <div className="text-sm text-gray-500">Overview</div>
      </div>

      <section className="grid grid-cols-3 gap-4 mb-6">
        {summary.map((s: any) => (
          <div
            key={s.status}
            className="bg-white p-4 rounded shadow flex flex-col justify-between"
          >
            <div className="text-sm text-gray-500">{s.status}</div>
            <div className="text-3xl font-bold">{s.total}</div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-2">Notifications by Channel</h3>
          <Line data={channelLine} />
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-2">Parcels by Status</h3>
          <Bar data={statusBar} />
        </div>
      </section>

      <section className="bg-white p-4 rounded shadow mb-6">
        <h3 className="font-semibold mb-2">Weekly Activity</h3>
        <Line data={trendData} />
      </section>

      <section className="bg-white p-4 rounded shadow">
        <h3 className="font-semibold mb-2">Average Parcel Duration (hours)</h3>
        <div className="text-3xl font-bold">
          {(avgDuration as any).avg_hours_per_parcel ?? "N/A"}
        </div>
      </section>
    </div>
  );
}
