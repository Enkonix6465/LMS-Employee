import React, { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { getAuth } from "firebase/auth";

interface AttendanceEvent {
  id: string;
  title: string;
  start: string;
  allDay?: boolean;
  extendedProps: {
    date: string;
    hours: string;
    status: string;
  };
}

const Calendar = () => {
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<AttendanceEvent | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAttendanceSummary = async () => {
      setLoading(true);
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;

      const userId = user.uid;
      const currentMonth = format(new Date(), "yyyy-MM");
      const docRef = doc(db, "attendanceSummary", `${userId}_${currentMonth}`);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        setEvents([]);
        setLoading(false);
        return;
      }

      const data = docSnap.data();
      const countedDates: string[] = data.countedDates || [];
      const dailyHours = data.dailyHours || {};
      const events: AttendanceEvent[] = countedDates.map((dateStr: string) => ({
        id: `${userId}_${dateStr}`,
        title: `${dailyHours[dateStr] || "0h 0m 0s"}`,
        start: dateStr,
        allDay: true,
        extendedProps: {
          date: dateStr,
          hours: dailyHours[dateStr] || "0h 0m 0s",
          status:
            parseFloat((dailyHours[dateStr] || "").split("h")[0]) >= 4.5
              ? "Present"
              : "Leave",
        },
      }));

      setEvents(events);
      setLoading(false);
    };

    fetchAttendanceSummary();
  }, []);

  const handleEventClick = (info: any) => {
    setSelectedEvent(info.event.toPlainObject());
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "present":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "leave":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 transition-all duration-500 ease-in-out">
      <div className="mb-6 text-center sm:text-left">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Attendance Calendar
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          View your attendance and working hours by day
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-6 animate-fade-in">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay",
              }}
              events={events}
              eventClick={handleEventClick}
              height="auto"
              eventDidMount={(info) => {
                const status = info.event.extendedProps.status.toLowerCase();
                info.el.style.backgroundColor =
                  status === "present"
                    ? "rgb(34, 197, 94)"
                    : "rgb(239, 68, 68)";
                info.el.style.borderColor =
                  status === "present"
                    ? "rgb(22, 163, 74)"
                    : "rgb(220, 38, 38)";
              }}
            />
          </div>
        </div>

        {/* Event Details */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 transition-all duration-300 animate-fade-in">
            {selectedEvent ? (
              <>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Attendance Details
                </h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Date
                    </h3>
                    <div className="mt-1 flex items-center text-sm text-gray-900 dark:text-white">
                      <CalendarIcon className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" />
                      {format(
                        new Date(selectedEvent.extendedProps.date),
                        "PPP"
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Status
                    </h3>
                    <span
                      className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                        selectedEvent.extendedProps.status
                      )}`}
                    >
                      {selectedEvent.extendedProps.status.toUpperCase()}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Total Hours
                    </h3>
                    <div className="mt-1 flex items-center text-sm text-gray-900 dark:text-white">
                      <Clock className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" />
                      {selectedEvent.extendedProps.hours}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center animate-fade-in">
                <CalendarIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                  No date selected
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Click on a date to view attendance
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;
