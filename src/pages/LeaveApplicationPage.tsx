import React, { useEffect, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { auth, db } from "../lib/firebase";
import {
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  collection,
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
    const unsub = onAuthStateChanged(auth, (authUser) => {
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
    alert("✅ Leave request submitted successfully!");
  };

  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    const dateStr = date.toISOString().split("T")[0];
    const leave = leaveMap[dateStr];
    if (view === "month" && leave) {
      if (leave.status === "accepted") return "bg-green-300 text-black";
      if (leave.status === "rejected") return "bg-red-300 text-black";
      if (leave.status === "pending") return "bg-yellow-200 text-black";
    }
    return null;
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-6 text-blue-800">
        📝 Leave Application Portal
      </h2>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="font-semibold mb-2 text-lg">📅 Select Leave Date</h3>
          <Calendar
            onClickDay={(val) => setSelectedDate(val)}
            value={selectedDate}
            tileClassName={tileClassName}
            className="rounded-md border shadow"
          />
          <div className="mt-2 text-sm text-gray-600 space-y-1">
            <p>
              <span className="inline-block w-3 h-3 bg-yellow-300 mr-2" />{" "}
              Pending
            </p>
            <p>
              <span className="inline-block w-3 h-3 bg-green-300 mr-2" />{" "}
              Approved
            </p>
            <p>
              <span className="inline-block w-3 h-3 bg-red-300 mr-2" /> Rejected
            </p>
          </div>
        </div>

        {selectedDate && (
          <div className="bg-white border rounded shadow p-4">
            <p className="text-base font-semibold mb-4 text-gray-800">
              Selected Date:{" "}
              <span className="text-blue-700">
                {selectedDate.toDateString()}
              </span>
            </p>

            <label className="block font-medium mb-1">Leave Type:</label>
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

            <label className="block font-medium mb-1">Reason:</label>
            <textarea
              className="w-full border px-3 py-2 mb-4 rounded"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe your reason for leave..."
            ></textarea>

            <label className="inline-flex items-center mb-4 text-sm text-gray-700">
              <input
                type="checkbox"
                className="mr-2"
                checked={isExtra}
                onChange={() => setIsExtra(!isExtra)}
              />
              Mark as Extra Leave
            </label>

            <button
              className="block w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
              onClick={onSubmit}
            >
              Submit Leave Request
            </button>
          </div>
        )}
      </div>

      <div className="bg-white border shadow rounded p-4 overflow-auto">
        <h3 className="text-xl font-semibold mb-4 text-center text-gray-800">
          📊 Leave Summary
        </h3>
        <table className="w-full text-sm table-auto border">
          <thead className="bg-gray-100 text-gray-700">
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
                <tr key={i} className="hover:bg-gray-50">
                  <td className="border px-3 py-2">{leave.date}</td>
                  <td className="border px-3 py-2">{leave.leaveType}</td>
                  <td
                    className={`border px-3 py-2 capitalize ${
                      leave.status === "accepted"
                        ? "text-green-600"
                        : leave.status === "rejected"
                        ? "text-red-600"
                        : "text-yellow-600"
                    }`}
                  >
                    {leave.status}
                  </td>
                  <td className="border px-3 py-2 text-center">
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
