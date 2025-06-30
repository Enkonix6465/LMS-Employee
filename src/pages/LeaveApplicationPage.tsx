import React, { useEffect, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { auth, db } from "../lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  collection,
  getDocs,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

interface LeaveRecord {
  date: string;
  reason: string;
  status: string;
  leaveType: string;
  isExtra: boolean;
}

export default function AdvancedLeaveApplication() {
  const [user, setUser] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [reason, setReason] = useState("");
  const [leaveType, setLeaveType] = useState("Sick Leave");
  const [isExtra, setIsExtra] = useState(false);
  const [leaveMap, setLeaveMap] = useState<{ [key: string]: LeaveRecord }>({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setUser(authUser);
        const ref = collection(db, "leaveManage");
        onSnapshot(ref, (snapshot) => {
          const map: { [key: string]: LeaveRecord } = {};
          snapshot.docs.forEach((doc) => {
            const data = doc.data();
            if (data.userId === authUser.uid) {
              map[data.date] = {
                date: data.date,
                reason: data.reason,
                status: data.status,
                leaveType: data.leaveType,
                isExtra: data.isExtra || false,
              };
            }
          });
          setLeaveMap(map);
        });
      }
    });
    return () => unsub();
  }, []);

  const onSubmit = async () => {
    if (!user || !selectedDate || !reason) return;
    const dateStr = selectedDate.toISOString().split("T")[0];
    const ref = doc(db, "leaveManage", `${user.uid}_${dateStr}`);
    await setDoc(ref, {
      userId: user.uid,
      date: dateStr,
      reason,
      status: "pending",
      leaveType,
      isExtra,
      timestamp: serverTimestamp(),
    });
    setReason("");
    setSelectedDate(null);
    setIsExtra(false);
    alert("Leave request submitted");
  };

  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    const dateStr = date.toISOString().split("T")[0];
    const leave = leaveMap[dateStr];
    if (view === "month" && leave) {
      if (leave.status === "accepted") return "bg-green-300";
      if (leave.status === "rejected") return "bg-red-300";
      if (leave.status === "pending") return "bg-yellow-200";
    }
    return null;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-4">
        📆 Advanced Leave Application
      </h2>

      <Calendar
        onClickDay={(val) => setSelectedDate(val)}
        value={selectedDate}
        tileClassName={tileClassName}
        className="mb-6 border rounded shadow"
      />

      {selectedDate && (
        <div className="bg-white shadow p-4 rounded mb-6">
          <p className="mb-2 font-semibold">
            Selected Date: {selectedDate.toDateString()}
          </p>

          <label className="block mb-2 font-semibold">Leave Type:</label>
          <select
            className="w-full border px-3 py-2 mb-4 rounded"
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value)}
          >
            <option>Sick Leave</option>
            <option>Casual Leave</option>
            <option>Emergency Leave</option>
            <option>Work From Home</option>
          </select>

          <label className="block mb-2 font-semibold">Reason:</label>
          <textarea
            className="w-full border px-3 py-2 mb-4 rounded"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          ></textarea>

          <label className="inline-flex items-center mb-4">
            <input
              type="checkbox"
              className="mr-2"
              checked={isExtra}
              onChange={() => setIsExtra(!isExtra)}
            />
            Mark as Extra Leave
          </label>

          <button
            className="block w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            onClick={onSubmit}
          >
            Submit Leave
          </button>
        </div>
      )}

      <div className="bg-white shadow p-4 rounded">
        <h3 className="text-xl font-semibold mb-4 text-center">
          📊 Leave Summary
        </h3>
        <table className="w-full table-auto text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-3 py-2">Date</th>
              <th className="border px-3 py-2">Type</th>
              <th className="border px-3 py-2">Status</th>
              <th className="border px-3 py-2">Extra</th>
              <th className="border px-3 py-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(leaveMap)
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .map((leave, i) => (
                <tr key={i} className="text-sm">
                  <td className="border px-3 py-2">{leave.date}</td>
                  <td className="border px-3 py-2">{leave.leaveType}</td>
                  <td className="border px-3 py-2 capitalize">
                    {leave.status}
                  </td>
                  <td className="border px-3 py-2">
                    {leave.isExtra ? "✅" : "❌"}
                  </td>
                  <td className="border px-3 py-2">{leave.reason}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
