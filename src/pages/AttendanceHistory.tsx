import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState({
    totalDays: 0,
    presentDays: 0,
    absentDays: 0,
    totalHours: "",
    workingDays: 0,
    leavesTaken: 0,
    extraLeaves: 0,
    remaining: 0,
    month: "",
    name: "",
  });

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

          if (!snapshot.empty) {
            const allData = snapshot.docs.map((doc) => doc.data());
            const sorted = allData.sort((a, b) => a.date.localeCompare(b.date));

            const presentDays = sorted.length;
            const firstMonth = sorted[0].date.slice(0, 7);
            const workingDays = 21; // constant for simplicity
            const leavesTaken = workingDays - presentDays;
            const allowedLeaves = 10;
            const extraLeaves = Math.max(0, leavesTaken - allowedLeaves);
            const remaining = Math.max(0, allowedLeaves - leavesTaken);
            const name = sorted[0].name;

            const totalSecSum = sorted.reduce((acc, curr) => {
              const convertTo24 = (time12h: string): number => {
                const [time, modifier] = time12h.split(" ");
                let [h, m, s] = time.split(":").map(Number);
                if (modifier === "PM" && h < 12) h += 12;
                if (modifier === "AM" && h === 12) h = 0;
                return h * 3600 + m * 60 + s;
              };
              const sessions = curr.sessions || [];
              let total = 0;
              sessions.forEach(({ login, logout }: any) => {
                if (login && logout) {
                  const diff = convertTo24(logout) - convertTo24(login);
                  total += diff > 0 ? diff : diff + 86400;
                }
              });
              return acc + total;
            }, 0);

            const hrs = Math.floor(totalSecSum / 3600);
            const mins = Math.floor((totalSecSum % 3600) / 60);
            const secs = totalSecSum % 60;
            const totalHours = `${hrs}h ${mins}m ${secs}s`;

            setAttendanceList(sorted);
            setSummary({
              totalDays: presentDays,
              presentDays,
              absentDays: leavesTaken,
              totalHours,
              workingDays,
              leavesTaken,
              extraLeaves,
              remaining,
              month: firstMonth,
              name,
            });
          } else {
            setError("No attendance records found.");
          }
        } catch (err) {
          console.error("Error fetching attendance:", err);
          setError("Failed to load attendance.");
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
    return (
      <div className="text-center py-20">Loading attendance history...</div>
    );
  if (error)
    return <div className="text-center text-red-600 py-20">{error}</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mt-2 text-gray-700 font-semibold text-center">
        👤 {summary.name}
      </div>
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">
        📅 Attendance History
      </h1>

      <table className="w-full mb-8 border text-sm text-center">
        <thead className="bg-gray-200">
          <tr>
            <th className="border px-2 py-2">#</th>
            <th className="border px-2 py-2">Date</th>
            <th className="border px-2 py-2">Location</th>
            <th className="border px-2 py-2">Total Hours</th>
            <th className="border px-2 py-2">Sessions</th>
          </tr>
        </thead>
        <tbody>
          {attendanceList.map((att, index) => (
            <tr key={index}>
              <td className="border px-2 py-1">{index + 1}</td>
              <td className="border px-2 py-1">{att.date}</td>
              <td className="border px-2 py-1">{att.location}</td>
              <td className="border px-2 py-1">{att.totalHours || "0h 0m"}</td>
              <td className="border px-2 py-1">
                <ul className="list-disc list-inside text-left">
                  {att.sessions.map((s: any, i: number) => (
                    <li key={i}>
                      <span className="text-green-600">Login:</span> {s.login},
                      <span className="text-red-600"> Logout:</span>{" "}
                      {s.logout || "⏳"}
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="bg-gray-50 border rounded p-6 mt-8">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
          🗓️ Monthly Attendance Overview
        </h2>

        {/* Summary Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-center text-sm mb-4">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="py-2">Month</th>
                <th>Working Days</th>
                <th>Present</th>
                <th>Leaves Taken</th>
                <th className="text-red-600">Extra Leaves</th>
                <th className="text-green-600">Remaining</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white font-medium">
                <td className="py-2">{summary.month}</td>
                <td>{summary.workingDays}</td>
                <td>{summary.presentDays}</td>
                <td>{summary.leavesTaken}</td>
                <td className="text-red-600">{summary.extraLeaves}</td>
                <td className="text-green-600">{summary.remaining}</td>
              </tr>
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
                    { name: "Present", value: summary.presentDays },
                    { name: "Leaves Taken", value: summary.leavesTaken },
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
                    ?.split("h")
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
    </div>
  );
}
