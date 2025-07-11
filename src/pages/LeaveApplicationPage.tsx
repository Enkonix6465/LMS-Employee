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
  getDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

interface LeaveRecord {
  date: string;
  reason: string;
  status: string;
  leaveType: string;
  isExtra: boolean;
  appliedOnDate?: string;
  appliedOnTime?: string;
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
                appliedOnDate: data.appliedOnDate,
                appliedOnTime: data.appliedOnTime,
              };
            }
          });
          setLeaveMap(map);
        });
      }
    });
    return () => unsub();
  }, []);

  const getCurrentDateStr = () => new Date().toLocaleDateString("en-CA");
  const formatDateLocal = (date: Date) => date.toLocaleDateString("en-CA");

  const getCurrentTimeStr = () => {
    const now = new Date();
    return now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const evaluateLeaveType = async (date: Date) => {
    if (!user) return;
    const yyyyMM = date.toISOString().slice(0, 7);
    const thisMonthLeaves = Object.values(leaveMap).filter(
      (l) =>
        l.leaveType === "Casual Leave" &&
        l.status !== "rejected" &&
        l.date.startsWith(yyyyMM)
    );
    const summaryRef = doc(db, "leaveSummary", `${user.uid}_${yyyyMM}`);
    const summarySnap = await getDoc(summaryRef);
    const carryForward = summarySnap.exists()
      ? summarySnap.data().carryForwardLeaves || 0
      : 0;

    if (thisMonthLeaves.length === 0) {
      setLeaveType("Casual Leave");
      setIsExtra(false);
    } else if (carryForward > 0) {
      setLeaveType("Casual Leave");
      setIsExtra(false);
    } else {
      setLeaveType("Casual Leave");
      setIsExtra(true);
    }
  };

  const onSubmit = async () => {
    if (!user || !selectedDate || !reason) return;
    const selectedDateStr = formatDateLocal(selectedDate);
    const todayStr = getCurrentDateStr();

    if (selectedDateStr < todayStr) {
      alert("❌ Cannot apply leave for past dates.");
      return;
    }

    const ref = doc(db, "leaveManage", `${user.uid}_${selectedDateStr}`);
    await setDoc(ref, {
      userId: user.uid,
      date: selectedDateStr,
      reason,
      status: "pending",
      leaveType,
      isExtra,
      timestamp: serverTimestamp(),
      appliedOnDate: todayStr,
      appliedOnTime: getCurrentTimeStr(),
    });

    setReason("");
    setSelectedDate(null);
    setIsExtra(false);
    alert("✅ Leave request submitted successfully!");
  };

  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    const dateStr = date.toLocaleDateString("en-CA");
    const leave = leaveMap[dateStr];
    if (view === "month" && leave) {
      if (leave.status === "accepted")
        return "bg-green-300 dark:bg-green-600 text-black dark:text-white";
      if (leave.status === "rejected")
        return "bg-red-300 dark:bg-red-600 text-black dark:text-white";
      if (leave.status === "pending")
        return "bg-yellow-200 dark:bg-yellow-500 text-black dark:text-white";
    }
    return null;
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto transition-all duration-300">
      <h2 className="text-3xl font-bold text-center mb-6 text-blue-800 dark:text-blue-300">
        📝 Leave Application Portal
      </h2>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Calendar */}
        <div className="transition-all duration-300">
          <h3 className="font-semibold mb-2 text-lg text-gray-800 dark:text-gray-200">
            📅 Select Leave Date
          </h3>
          <div className="rounded-md border dark:border-gray-700 shadow bg-white dark:bg-gray-800 p-2 transition">
            <Calendar
              onClickDay={(val) => {
                setSelectedDate(val);
                evaluateLeaveType(val);
              }}
              value={selectedDate}
              tileClassName={tileClassName}
              className="rounded w-full"
            />
          </div>
          <div className="mt-3 text-sm text-gray-600 dark:text-gray-300 space-y-1">
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

        {/* Form */}
        {selectedDate && (
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow p-4 transition-all duration-300">
            <p className="text-base font-semibold mb-4 text-gray-800 dark:text-gray-200">
              Selected Date:{" "}
              <span className="text-blue-700 dark:text-blue-400">
                {selectedDate.toDateString()}
              </span>
            </p>

            <label className="block font-medium mb-1 dark:text-gray-300">
              Leave Type:
            </label>
            <select
              className="w-full border dark:border-gray-600 px-3 py-2 mb-4 rounded bg-white dark:bg-gray-700 dark:text-white"
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
            >
              <option>Sick Leave</option>
              <option>Casual Leave</option>
              <option>Emergency Leave</option>
              <option>Work From Home</option>
            </select>

            <label className="block font-medium mb-1 dark:text-gray-300">
              Reason:
            </label>
            <textarea
              className="w-full border dark:border-gray-600 px-3 py-2 mb-4 rounded bg-white dark:bg-gray-700 dark:text-white"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe your reason for leave..."
            ></textarea>

            <label className="inline-flex items-center mb-4 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                className="mr-2"
                checked={isExtra}
                onChange={() => setIsExtra(!isExtra)}
              />
              Mark as Extra Leave
            </label>

            <button
              className="block w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition duration-300"
              onClick={onSubmit}
            >
              Submit Leave Request
            </button>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 shadow rounded p-4 overflow-auto transition-all duration-300">
        <h3 className="text-xl font-semibold mb-4 text-center text-gray-800 dark:text-gray-200">
          📊 Leave Summary
        </h3>
        <table className="w-full text-sm table-auto border dark:border-gray-700">
          <thead className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
            <tr>
              <th className="border px-3 py-2">Date</th>
              <th className="border px-3 py-2">Type</th>
              <th className="border px-3 py-2">Status</th>
              <th className="border px-3 py-2">Extra</th>
              <th className="border px-3 py-2">Reason</th>
              <th className="border px-3 py-2">Applied On</th>
              <th className="border px-3 py-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(leaveMap)
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .map((leave, i) => (
                <tr
                  key={i}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
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
                  <td className="border px-3 py-2">
                    {leave.appliedOnDate || "-"}
                  </td>
                  <td className="border px-3 py-2">
                    {leave.appliedOnTime || "-"}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
