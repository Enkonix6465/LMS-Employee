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

        // Sort by most recent date
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
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold mb-6 text-center">
        📜 My Leave History
      </h2>

      {history.length === 0 ? (
        <p className="text-center text-gray-500">No leave history found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto text-sm border border-gray-300">
            <thead className="bg-purple-100">
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
                <tr key={i} className="text-center">
                  <td className="border px-3 py-2">{rec.date}</td>
                  <td className="border px-3 py-2">{rec.leaveType}</td>
                  <td className="border px-3 py-2">{rec.reason}</td>
                  <td
                    className={`border px-3 py-2 capitalize ${
                      rec.status === "accepted"
                        ? "text-green-600"
                        : "text-red-600"
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
