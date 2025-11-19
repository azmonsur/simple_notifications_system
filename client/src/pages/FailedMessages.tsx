import React, { useEffect, useState } from "react";
import api from "../utils/api";

export default function FailedMessages() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // --- Load failed messages ---
  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/notifications/failed?limit=200");
      setRows(res.data.data || []);
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // --- Retry a failed notification ---
  const retry = async (id: string) => {
    try {
      await api.post(`/notifications/${id}/retry`);
      load();
    } catch (err) {
      console.error("Retry failed:", err);
    }
  };

  // --- Resolve a failed notification ---
  const resolve = async (id: string) => {
    try {
      await api.post(`/notifications/${id}/resolve`);
      load();
    } catch (err) {
      console.error("Resolve failed:", err);
    }
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
        <h2 className="text-2xl font-semibold">Failed Messages</h2>
        <button
          onClick={load}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Refresh
        </button>
      </div>

      {/* List */}
      <div className="space-y-4">
        {loading && (
          <div className="text-gray-500 text-center py-6">Loading...</div>
        )}

        {!loading && rows.length === 0 && (
          <div className="text-gray-400 text-center py-6">
            No failed messages found.
          </div>
        )}

        {rows.map((r: any) => (
          <div
            key={r.id}
            className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition hover:shadow-md"
          >
            {/* Message info */}
            <div>
              <div className="font-medium">
                {r.recipient_name} ({r.recipient_role})
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {r.channel} • {new Date(r.created_at).toLocaleString()}
              </div>
              {r.last_error && (
                <div className="text-sm mt-2 text-red-600 dark:text-red-400">
                  {r.last_error}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-2 text-right">
              <button
                onClick={() => retry(r.id)}
                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition"
              >
                Retry
              </button>
              <button
                onClick={() => resolve(r.id)}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
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
