import React, { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import {
  doc,
  setDoc,
  onSnapshot,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function LeaveFormWithFirebase() {
  const [user, setUser] = useState<any>(null);
  const [form, setForm] = useState({
    days: "",
    hours: "",
    startDate: "",
    endDate: "",
    reason: "",
    otherReason: "",
    durationType: "",
  });

  const reasons = [
    "Vacation",
    "Family Reasons",
    "Jury Duty",
    "Personal Leave",
    "Medical Leave",
    "To Vote",
    "Parental Leave",
    "Funeral/Bereavement",
    "Other",
  ];

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (authUser) => {
      if (authUser) {
        setUser(authUser);
      }
    });
    return () => unsub();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (checked ? value : "") : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("User not logged in.");
      return;
    }

    if (!form.startDate || !form.reason || !form.durationType) {
      alert("Please fill required fields (start date, reason, duration type).");
      return;
    }

    const dateStr = form.startDate;
    const leaveId = `${user.uid}_${dateStr}`;
    const ref = doc(db, "leaveManage", leaveId);

    const leaveData = {
      userId: user.uid,
      date: dateStr,
      reason: form.reason === "Other" ? form.otherReason : form.reason,
      status: "pending",
      leaveType: form.durationType === "Hours" ? "Hourly" : "Full Day",
      isExtra: false,
      timestamp: serverTimestamp(),
    };

    try {
      await setDoc(ref, leaveData);
      alert("Leave request submitted successfully!");

      // Reset form
      setForm({
        days: "",
        hours: "",
        startDate: "",
        endDate: "",
        reason: "",
        otherReason: "",
        durationType: "",
      });
    } catch (error) {
      alert("Failed to submit leave request.");
      console.error("Error submitting leave:", error);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-6 bg-white rounded-lg shadow-md space-y-6"
    >
      {/* Leave Request Details */}
      <div className="border-2 border-purple-900">
        <div className="bg-purple-900 text-white text-sm font-semibold p-2">
          Leave request details
        </div>
        <div className="grid grid-cols-4 gap-4 p-4 bg-blue-100">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Leave request
            </label>
            <input
              type="number"
              name="days"
              placeholder="[Number]"
              value={form.days}
              onChange={handleChange}
              className="mt-1 w-full p-1 border rounded"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="durationType"
              value="Days"
              checked={form.durationType === "Days"}
              onChange={handleChange}
            />{" "}
            Days
            <input
              type="checkbox"
              name="durationType"
              value="Hours"
              checked={form.durationType === "Hours"}
              onChange={handleChange}
            />{" "}
            Hours
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 p-4 border-t">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Starting on
            </label>
            <input
              type="date"
              name="startDate"
              value={form.startDate}
              onChange={handleChange}
              className="mt-1 w-full p-1 border rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Ending on
            </label>
            <input
              type="date"
              name="endDate"
              value={form.endDate}
              onChange={handleChange}
              className="mt-1 w-full p-1 border rounded"
            />
          </div>
        </div>
      </div>

      {/* Reason for leave */}
      <div className="border-2 border-purple-900">
        <div className="bg-purple-900 text-white text-sm font-semibold p-2">
          Reason for leave request
        </div>
        <div className="grid grid-cols-3 gap-3 p-4 bg-gray-100 text-sm">
          {reasons.map((r) => (
            <label key={r} className="flex items-center gap-2">
              <input
                type="radio"
                name="reason"
                value={r}
                checked={form.reason === r}
                onChange={handleChange}
              />
              {r}
            </label>
          ))}
        </div>
        {form.reason === "Other" && (
          <div className="p-4 bg-gray-50">
            <textarea
              name="otherReason"
              value={form.otherReason}
              onChange={handleChange}
              placeholder="Please specify..."
              className="w-full border rounded p-2"
            />
          </div>
        )}
      </div>

      {/* Declaration */}
      <div className="border-2 border-purple-900 bg-purple-900 text-white text-sm p-4">
        I confirm that the information provided in this leave request form is
        accurate and complete. I understand that this request is subject to
        approval by my employer.
      </div>

      {/* Signature */}
      <div className="grid grid-cols-2 border-2 border-purple-900 text-sm">
        <div className="bg-blue-100 p-4 border-r border-purple-900">
          <label className="block font-medium">Employee signature</label>
          <input type="text" className="mt-2 w-full p-1 border rounded" />
        </div>
        <div className="bg-blue-100 p-4">
          <label className="block font-medium">Date</label>
          <input type="date" className="mt-2 w-full p-1 border rounded" />
        </div>
      </div>

      <div className="pt-4 text-center">
        <button
          type="submit"
          className="bg-blue-700 text-white py-2 px-6 rounded hover:bg-blue-800"
        >
          Apply Leave
        </button>
      </div>
    </form>
  );
}
