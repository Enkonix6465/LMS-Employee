import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

interface LeaveHistoryRecord {
  date: string;
  month: string;
  leaveType: string;
  reason: string;
  status: string;
  hrComment?: string;
  carryForwardAtThatTime: number;
  carryForwardUsed: boolean;
  finalCarryForwardLeft: number;
  markedAs: "present" | "absent";
  timestamp: string;
}

export default function EmployeeLeaveHistory() {
  const [userId, setUserId] = useState<string | null>(null);
  const [history, setHistory] = useState<LeaveHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        const snapshot = await getDocs(collection(db, "leaveHistory"));
        const records: LeaveHistoryRecord[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as LeaveHistoryRecord;
          if (data.userId === user.uid) {
            records.push(data);
          }
        });

        records.sort((a, b) => (a.date < b.date ? 1 : -1));
        setHistory(records);
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  if (!userId) return <p className="p-6 text-center">Loading user...</p>;
  if (loading)
    return <p className="p-6 text-center">Loading leave history...</p>;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto transition-all duration-500 ease-in-out">
      <h2 className="text-3xl font-bold mb-6 text-center text-purple-700 dark:text-purple-300">
        📜 My Leave History
      </h2>

      {history.length === 0 ? (
        <p className="text-center text-gray-600 dark:text-gray-400">
          No leave history found.
        </p>
      ) : (
        <div className="overflow-x-auto rounded shadow-sm">
          <table className="min-w-full table-auto text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 transition-all duration-300">
            <thead className="bg-purple-100 dark:bg-purple-900 text-gray-800 dark:text-white">
              <tr>
                <th className="border px-4 py-2">Date</th>
                <th className="border px-4 py-2">Leave Type</th>
                <th className="border px-4 py-2">Reason</th>
                <th className="border px-4 py-2">Status</th>
                <th className="border px-4 py-2">Marked As</th>
                <th className="border px-4 py-2">CF Before</th>
                <th className="border px-4 py-2">CF Used</th>
                <th className="border px-4 py-2">CF After</th>
                <th className="border px-4 py-2">HR Comment</th>
              </tr>
            </thead>
            <tbody>
              {history.map((rec, i) => (
                <tr
                  key={i}
                  className="text-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
                >
                  <td className="border px-3 py-2">{rec.date}</td>
                  <td className="border px-3 py-2">{rec.leaveType}</td>
                  <td className="border px-3 py-2">{rec.reason}</td>
                  <td
                    className={`border px-3 py-2 capitalize font-semibold ${
                      rec.status === "accepted"
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {rec.status}
                  </td>
                  <td className="border px-3 py-2 capitalize">
                    {rec.markedAs}
                  </td>
                  <td className="border px-3 py-2">
                    {rec.carryForwardAtThatTime}
                  </td>
                  <td className="border px-3 py-2">
                    {rec.carryForwardUsed ? "✅" : "❌"}
                  </td>
                  <td className="border px-3 py-2">
                    {rec.finalCarryForwardLeft}
                  </td>
                  <td className="border px-3 py-2">{rec.hrComment || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
