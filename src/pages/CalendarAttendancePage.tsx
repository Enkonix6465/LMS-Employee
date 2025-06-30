import React, { useEffect, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

type AttendanceMap = {
  [date: string]: boolean; // true = present, false = absent
};

const getDaysInMonth = (year: number, month: number) => {
  const date = new Date(year, month, 1);
  const days: string[] = [];

  while (date.getMonth() === month) {
    days.push(date.toISOString().split("T")[0]); // Format: YYYY-MM-DD
    date.setDate(date.getDate() + 1);
  }

  return days;
};

const CalendarAttendancePage = () => {
  const [value, setValue] = useState(new Date());
  const [attendanceMap, setAttendanceMap] = useState<AttendanceMap>({});
  const [userId, setUserId] = useState<string | null>(
    "2HmmLRW5rdadgDVO2bFm64HZ9I23"
  );
  const [loading, setLoading] = useState(false);

  const db = getFirestore();
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("Authenticated user ID:", user.uid);
        setUserId(user.uid);
      } else {
        console.log("No authenticated user. Using default userId.");
        setUserId("2HmmLRW5rdadgDVO2bFm64HZ9I23");
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetchMonthlyAttendance(value);
  }, [userId, value]);

  const fetchMonthlyAttendance = async (selectedDate: Date) => {
    setLoading(true);
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const days = getDaysInMonth(year, month);
    console.log("Fetching attendance for month:", year, month + 1);

    const updatedMap: AttendanceMap = {};

    await Promise.all(
      days.map(async (day) => {
        const docId = `${userId}_${day}`;
        const docRef = doc(db, "attendance", docId);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
          const data = snap.data();
          const present = (data.sessions || []).length > 0;
          updatedMap[day] = present;
          console.log(`✅ Present on ${day}`);
        } else {
          updatedMap[day] = false;
          console.log(`❌ Absent on ${day}`);
        }
      })
    );

    setAttendanceMap(updatedMap);
    setLoading(false);
  };

  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view !== "month") return null;
    const dateStr = date.toISOString().split("T")[0];
    const isPresent = attendanceMap[dateStr];

    if (isPresent === true) {
      return <div style={{ color: "green", fontSize: "1.5rem" }}>•</div>;
    } else if (isPresent === false) {
      return <div style={{ color: "red", fontSize: "1.5rem" }}>•</div>;
    }
    return null;
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-4 shadow-xl rounded-xl bg-white">
      <h2 className="text-xl font-bold text-center mb-4">
        Attendance Calendar
      </h2>

      {loading ? (
        <div className="text-center text-gray-500">Loading attendance...</div>
      ) : (
        <Calendar
          onChange={setValue}
          value={value}
          tileContent={tileContent}
          // ❌ Removed calendarType
        />
      )}

      <div className="flex justify-center gap-4 mt-4">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-green-500 rounded-full inline-block"></span>
          Present
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-red-500 rounded-full inline-block"></span>
          Absent
        </div>
      </div>
    </div>
  );
};

export default CalendarAttendancePage;
