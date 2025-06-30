import React, { useState } from "react";
import { useQuery } from "react-query";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Calendar as CalendarIcon, Clock, Users } from "lucide-react";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  extendedProps: {
    description?: string;
    type: "task" | "project";
    status: string;
    assignedTo?: string;
  };
}

// Helper function to safely get date string
const getDateString = (date: any): string | null => {
  if (!date) return null;
  if (date.toDate) return date.toDate().toISOString();
  if (typeof date === "string") return new Date(date).toISOString();
  return null;
};

function Calendar() {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );

  const { data: events = [], isLoading } = useQuery(
    "calendar-events",
    async () => {
      const events: CalendarEvent[] = [];

      // Fetch tasks with proper ordering
      const tasksRef = collection(db, "tasks");
      const tasksQuery = query(tasksRef, orderBy("due_date"));
      const tasksSnapshot = await getDocs(tasksQuery);
      tasksSnapshot.forEach((doc) => {
        const task = doc.data();
        const dueDate = getDateString(task.due_date);
        if (dueDate) {
          events.push({
            id: doc.id,
            title: task.title,
            start: dueDate,
            allDay: true,
            extendedProps: {
              description: task.description,
              type: "task",
              status: task.status,
              assignedTo: task.assigned_to,
            },
          });
        }
      });

      // Fetch projects with proper ordering
      const projectsRef = collection(db, "projects");
      const projectsQuery = query(projectsRef, orderBy("deadline"));
      const projectsSnapshot = await getDocs(projectsQuery);
      projectsSnapshot.forEach((doc) => {
        const project = doc.data();
        const deadline = getDateString(project.deadline);
        if (deadline) {
          events.push({
            id: doc.id,
            title: project.name,
            start: deadline,
            allDay: true,
            extendedProps: {
              description: project.description,
              type: "project",
              status: project.status,
            },
          });
        }
      });

      return events;
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  const handleEventClick = (info: any) => {
    setSelectedEvent(info.event.toPlainObject());
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "in_progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "delayed":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Calendar
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          View and manage your tasks and project deadlines
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
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
                // Add custom styling based on event type and status
                if (info.event.extendedProps.type === "task") {
                  info.el.style.backgroundColor = "rgb(147, 197, 253)";
                  info.el.style.borderColor = "rgb(59, 130, 246)";
                } else {
                  info.el.style.backgroundColor = "rgb(248, 113, 113)";
                  info.el.style.borderColor = "rgb(239, 68, 68)";
                }
              }}
              themeSystem="standard"
              className="dark:fc-theme-dark"
            />
          </div>
        </div>

        <div className="lg:col-span-1">
          {selectedEvent ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Event Details
              </h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Title
                  </h3>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {selectedEvent.title}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Type
                  </h3>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white capitalize">
                    {selectedEvent.extendedProps.type}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Date
                  </h3>
                  <div className="mt-1 flex items-center text-sm text-gray-900 dark:text-white">
                    <CalendarIcon className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" />
                    {format(new Date(selectedEvent.start), "PPP")}
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
                    {selectedEvent.extendedProps.status
                      .replace("_", " ")
                      .toUpperCase()}
                  </span>
                </div>

                {selectedEvent.extendedProps.description && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Description
                    </h3>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {selectedEvent.extendedProps.description}
                    </p>
                  </div>
                )}

                {selectedEvent.extendedProps.assignedTo && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Assigned To
                    </h3>
                    <div className="mt-1 flex items-center text-sm text-gray-900 dark:text-white">
                      <Users className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" />
                      {selectedEvent.extendedProps.assignedTo}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="text-center">
                <CalendarIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                  No event selected
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Click on an event to view its details
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Legend
            </h2>
            <div className="space-y-3">
              <div className="flex items-center">
                <div className="w-4 h-4 rounded bg-blue-400 dark:bg-blue-500"></div>
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                  Tasks
                </span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded bg-red-400 dark:bg-red-500"></div>
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                  Projects
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Calendar;
