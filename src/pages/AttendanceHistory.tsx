import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

export default function AttendanceHistory() {
  const [userId, setUserId] = useState<string | null>(null);
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const auth = getAuth();
  const db = getFirestore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        try {
          // Fetch attendance logs
          const q = query(
            collection(db, "attendance"),
            where("userId", "==", user.uid)
          );
          const snapshot = await getDocs(q);
          const allData = snapshot.docs.map((doc) => doc.data());
          const sorted = allData.sort((a, b) => a.date.localeCompare(b.date));
          setAttendanceList(sorted);

          // Fetch summary for current month
          const currentMonth = new Date().toISOString().slice(0, 7);
          const summaryRef = doc(
            db,
            "attendanceSummary",
            `${user.uid}_${currentMonth}`
          );
          const summarySnap = await getDoc(summaryRef);

          if (summarySnap.exists()) {
            const summaryData = summarySnap.data();
            setSummary(summaryData);
          } else {
            setError("Attendance summary not found for this month.");
          }
        } catch (err) {
          console.error(err);
          setError("Failed to load data.");
        } finally {
          setLoading(false);
        }
      } else {
        setError("User not logged in.");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <div className="text-center py-20">Loading...</div>;
  if (error)
    return <div className="text-center text-red-600 py-20">{error}</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-center mb-4">
        📅 Attendance History
      </h1>
      <p className="text-center text-gray-600 mb-6">👤 {summary?.name}</p>

      <div className="overflow-x-auto">
        <table className="w-full table-auto text-sm border mb-10 min-w-[800px]">
          <thead className="bg-gray-100 text-gray-800 font-semibold">
            <tr>
              <th className="border px-3 py-2">#</th>
              <th className="border px-3 py-2">Date</th>
              <th className="border px-3 py-2">Total Hours</th>
              <th className="border px-3 py-2 text-left">Sessions</th>
            </tr>
          </thead>
          <tbody>
            {attendanceList.map((att, index) => {
              const [h = 0] = att.totalHours
                ?.split("h")
                .map((v: any) => parseInt(v)) || [0];
              const isUnderworked = h < 9;

              return (
                <tr key={index} className="bg-white hover:bg-gray-50">
                  <td className="border px-3 py-2">{index + 1}</td>
                  <td className="border px-3 py-2 font-medium">{att.date}</td>
                  <td
                    className={`border px-3 py-2 font-semibold ${
                      isUnderworked ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {att.totalHours || "0h 0m"}
                  </td>
                  <td className="border px-3 py-2 text-left">
                    <ul className="space-y-3">
                      {att.sessions.map((s: any, i: number) => (
                        <li key={i} className="pb-2 border-b last:border-b-0">
                          <div className="text-sm">
                            <span className="text-green-600 font-semibold">
                              🟢 Login:
                            </span>{" "}
                            {s.login || "—"}
                          </div>
                          {s.loginLocation && (
                            <div className="ml-4 text-xs text-gray-600">
                              📍 {s.loginLocation.address}
                              <br />({s.loginLocation.lat.toFixed(5)},{" "}
                              {s.loginLocation.lng.toFixed(5)})
                            </div>
                          )}
                          <div className="text-sm mt-1">
                            <span className="text-red-600 font-semibold">
                              🔴 Logout:
                            </span>{" "}
                            {s.logout || "⏳"}
                          </div>
                          {s.logout && s.logoutLocation && (
                            <div className="ml-4 text-xs text-gray-600">
                              📍 {s.logoutLocation.address}
                              <br />({s.logoutLocation.lat.toFixed(5)},{" "}
                              {s.logoutLocation.lng.toFixed(5)})
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Monthly Summary Table */}
      <div className="p-6">
        <h2 className="text-2xl font-bold text-center mb-4 text-green-700">
          📋 Monthly Attendance Summary
        </h2>

        <table className="w-full table-auto border text-sm text-center shadow">
          <thead className="bg-green-100 text-black font-bold">
            <tr>
              <th className="border px-3 py-2">Name</th>
              <th className="border px-3 py-2">Email</th>
              <th className="border px-3 py-2">Department</th>
              <th className="border px-3 py-2">Month</th>
              <th className="border px-3 py-2">Present</th>
              <th className="border px-3 py-2">Half</th>
              <th className="border px-3 py-2">Absent</th>
              <th className="border px-3 py-2">Leaves Taken</th>
              <th className="border px-3 py-2">Extra Leaves</th>
              <th className="border px-3 py-2">Carry Forward</th>
              <th className="border px-3 py-2">Total Days</th>
              <th className="border px-3 py-2">Total Hours</th>
            </tr>
          </thead>
          <tbody>
            {summary && (
              <tr className="bg-white">
                <td className="border px-3 py-2">{summary.name}</td>
                <td className="border px-3 py-2">{summary.email}</td>
                <td className="border px-3 py-2">{summary.department}</td>
                <td className="border px-3 py-2">{summary.month}</td>
                <td className="border px-3 py-2">{summary.presentDays}</td>
                <td className="border px-3 py-2">{summary.halfDays}</td>
                <td className="border px-3 py-2">{summary.absentDays}</td>
                <td className="border px-3 py-2">{summary.leavesTaken}</td>
                <td className="border px-3 py-2">{summary.extraLeaves}</td>
                <td className="border px-3 py-2">
                  {summary.carryForwardLeaves}
                </td>
                <td className="border px-3 py-2">{summary.totalWorkingDays}</td>
                <td className="border px-3 py-2">{summary.totalmonthHours}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Charts Section */}
      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Pie Chart */}
        <div className="bg-white shadow rounded p-4">
          <h2 className="text-center font-semibold mb-2">
            📊 Leave vs Presence
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={[
                  { name: "Present", value: summary?.presentDays || 0 },
                  { name: "Leaves Taken", value: summary?.leavesTaken || 0 },
                ]}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={70}
                label
              >
                <Cell fill="#4ade80" />
                <Cell fill="#f87171" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart */}
        <div className="bg-white shadow rounded p-4">
          <h2 className="text-center font-semibold mb-2">
            📅 Daily Work Hours
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={attendanceList.map((att) => {
                const [h = 0, m = 0] = att.totalHours
                  ?.split(/[hm ]+/)
                  .filter(Boolean)
                  .map((s) => parseInt(s)) || [0, 0];
                return { date: att.date, hours: h + m / 60 };
              })}
              margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
            >
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="hours" fill="#3b82f6" name="Hours Worked" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
