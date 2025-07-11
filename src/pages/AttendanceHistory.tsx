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
          const q = query(
            collection(db, "attendance"),
            where("userId", "==", user.uid)
          );
          const snapshot = await getDocs(q);
          let allData = snapshot.docs.map((doc) => doc.data());

          const today = new Date().toISOString().slice(0, 10);
          const todayDocId = `${user.uid}_${today}`;
          const todayDocRef = doc(db, "attendance", todayDocId);
          const todayDocSnap = await getDoc(todayDocRef);

          if (todayDocSnap.exists()) {
            const todayData = todayDocSnap.data();
            const alreadyExists = allData.some(
              (item) => item.date === todayData.date
            );
            if (!alreadyExists) {
              allData.push(todayData);
            }
          }

          const sorted = allData.sort((a, b) => a.date.localeCompare(b.date));
          setAttendanceList(sorted);

          const currentMonth = new Date().toISOString().slice(0, 7);
          const summaryRef = doc(
            db,
            "attendanceSummary",
            `${user.uid}_${currentMonth}`
          );
          const summarySnap = await getDoc(summaryRef);

          if (summarySnap.exists()) {
            const summaryData = summarySnap.data();
            const countedDates = summaryData.countedDates || [];
            setSummary({
              ...summaryData,
              workingDaysTillToday: countedDates.length,
            });
          } else {
            const empRef = doc(db, "employees", user.uid);
            const empSnap = await getDoc(empRef);

            if (empSnap.exists()) {
              const empData = empSnap.data();
              setSummary({
                name: empData.name || "N/A",
                email: empData.email || "N/A",
                department: empData.department || "N/A",
                month: currentMonth,
                presentDays: 0,
                halfDays: 0,
                absentDays: 0,
                leavesTaken: 0,
                extraLeaves: 0,
                carryForwardLeaves: 0,
                totalWorkingDays: 0,
                workingDaysTillToday: 0,
                totalmonthHours: "0h 0m",
              });
            } else {
              setSummary({
                name: "N/A",
                email: "N/A",
                department: "N/A",
                month: currentMonth,
                presentDays: 0,
                halfDays: 0,
                absentDays: 0,
                leavesTaken: 0,
                extraLeaves: 0,
                carryForwardLeaves: 0,
                totalWorkingDays: 0,
                totalmonthHours: "0h 0m",
              });
            }
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

  if (loading)
    return <div className="text-center py-20 animate-pulse">Loading...</div>;
  if (error)
    return <div className="text-center text-red-600 py-20">{error}</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 transition-all duration-300">
      <h1 className="text-3xl font-bold text-center mb-2 dark:text-white transition-colors">
        📅 Attendance History
      </h1>
      <p className="text-center text-gray-600 dark:text-gray-300 mb-6">
        👤 {summary?.name}
      </p>

      {/* Attendance Table */}
      <div className="overflow-x-auto mb-10">
        <table className="w-full table-auto text-sm border rounded-md overflow-hidden min-w-[800px]">
          <thead className="bg-sky-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-semibold">
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
                <tr
                  key={index}
                  className="bg-white dark:bg-gray-800 hover:bg-sky-50 dark:hover:bg-gray-700 transition"
                >
                  <td className="border px-3 py-2">{index + 1}</td>
                  <td className="border px-3 py-2 font-medium">{att.date}</td>
                  <td
                    className={`border px-3 py-2 font-semibold ${
                      isUnderworked
                        ? "text-red-600 dark:text-red-400"
                        : "text-green-600 dark:text-green-400"
                    }`}
                  >
                    {att.totalHours || "0h 0m"}
                  </td>
                  <td className="border px-3 py-2 text-left">
                    <ul className="space-y-3">
                      {att.sessions.map((s: any, i: number) => (
                        <li
                          key={i}
                          className="pb-2 border-b last:border-b-0 border-dashed"
                        >
                          <div className="text-sm">
                            <span className="text-green-600 dark:text-green-400 font-semibold">
                              🟢 Login:
                            </span>{" "}
                            {s.login || "—"}
                          </div>
                          {s.loginLocation && (
                            <div className="ml-4 text-xs text-gray-600 dark:text-gray-400">
                              📍 {s.loginLocation.address}
                              <br />({s.loginLocation.lat.toFixed(5)},{" "}
                              {s.loginLocation.lng.toFixed(5)})
                            </div>
                          )}
                          <div className="text-sm mt-1">
                            <span className="text-red-600 dark:text-red-400 font-semibold">
                              🔴 Logout:
                            </span>{" "}
                            {s.logout || "⏳"}
                          </div>
                          {s.logout && s.logoutLocation && (
                            <div className="ml-4 text-xs text-gray-600 dark:text-gray-400">
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

      {/* Summary Table */}
      <div className="p-6 bg-white dark:bg-gray-800 rounded shadow-md transition">
        <h2 className="text-2xl font-bold text-center mb-4 text-green-700 dark:text-green-400">
          📋 Monthly Attendance Summary
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full table-auto border text-sm text-center shadow min-w-[900px]">
            <thead className="bg-green-100 dark:bg-green-900 text-black dark:text-white font-bold">
              <tr>
                {[
                  "Name",
                  "Email",
                  "Department",
                  "Month",
                  "Present",
                  "Half",
                  "Absent",
                  "Leaves Taken",
                  "Extra Leaves",
                  "Carry Forward",
                  "Total Days",
                  "Working Days (Till Today)",
                  "Total Hours",
                ].map((head, i) => (
                  <th
                    key={i}
                    className={`border px-3 py-2 ${
                      head.includes("Working Days") ? "text-blue-600" : ""
                    }`}
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary && (
                <tr className="bg-white dark:bg-gray-800 transition">
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
                  <td className="border px-3 py-2">
                    {summary.totalWorkingDays}
                  </td>
                  <td className="border px-3 py-2 text-blue-600">
                    {summary.workingDaysTillToday}
                  </td>
                  <td className="border px-3 py-2">
                    {summary.totalmonthHours}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts */}
      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-gray-800 shadow rounded p-4 transition">
          <h2 className="text-center font-semibold text-gray-700 dark:text-gray-200 mb-2">
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

        <div className="bg-white dark:bg-gray-800 shadow rounded p-4 transition">
          <h2 className="text-center font-semibold text-gray-700 dark:text-gray-200 mb-2">
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
