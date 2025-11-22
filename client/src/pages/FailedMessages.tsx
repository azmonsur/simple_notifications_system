import React, { useEffect, useState } from "react";
import api from "../utils/api";

export default function FailedMessages() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const today = new Date().toISOString().split("T")[0];

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (from) query.append("from", from);
      if (to) query.append("to", to);

      const res = await api.get(`/notifications/failed?limit=200&${query}`);
      setRows(res.data.data || []);
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [from, to]);

  const retry = async (id: string) => {
    try {
      await api.post(`/notifications/${id}/retry`);
      load();
    } catch (err) {
      console.error("Retry failed:", err);
    }
  };

  const resolve = async (id: string) => {
    try {
      await api.post(`/notifications/${id}/resolve`);
      load();
    } catch (err) {
      console.error("Resolve failed:", err);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
          Failed Messages
        </h2>
      </div>

      {/* List */}
      <div className="space-y-4">
        {loading && (
          <div className="text-gray-500 dark:text-gray-400 text-center py-6">
            Loading...
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div className="text-gray-400 dark:text-gray-500 text-center py-6">
            No failed messages found.
          </div>
        )}

        {rows.map((r: any) => (
          <div
            key={r.id}
            className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition hover:shadow-lg"
          >
            {/* Message info */}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                {r.recipient_name} ({r.recipient_role})
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                {r.channel} • {new Date(r.created_at).toLocaleString()}
              </div>
              {r.last_error && (
                <div className="text-sm mt-2 text-red-600 dark:text-red-400 break-words">
                  <div
                    className={`overflow-hidden ${
                      expanded[r.id] ? "" : "line-clamp-2"
                    }`}
                    style={{ wordBreak: "break-word" }}
                  >
                    {r.last_error}
                  </div>
                  {r.last_error.split(" ").length > 15 && (
                    <button
                      onClick={() => toggleExpanded(r.id)}
                      className="text-blue-600 dark:text-blue-400 text-xs mt-1 hover:underline"
                    >
                      {expanded[r.id] ? "Show less" : "See more"}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-3 sm:mt-0 flex-shrink-0">
              <button
                onClick={() => retry(r.id)}
                className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 transition w-full sm:w-auto"
              >
                Retry
              </button>
              <button
                onClick={() => resolve(r.id)}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition w-full sm:w-auto"
              >
                Resolve
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
