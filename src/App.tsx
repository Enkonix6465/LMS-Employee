import React, { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import { useThemeStore } from "./store/themeStore";
import { Toaster } from "react-hot-toast";

// Pages
import Dashboard from "./pages/Dashboard";
import Calendar from "./pages/Calendar";
import Projects from "./pages/Projects";
import Tasks from "./pages/Tasks";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import UserManagement from "./pages/UserManagement";
import AttendanceHistory from "./pages/AttendanceHistory";
import CalendarAttendancePage from "./pages/CalendarAttendancePage";
import LeaveApplicationPage from "./pages/LeaveApplicationPage";
import ChatMeetingPage from "./pages/ChatMeetingPage";
import ProjectTeam from "./pages/ProjectTeam";
import AttendanceSummaryPage from "./pages/AttendanceSummaryPage";
import EmployeeLeaveHistory from "./pages/EmployeeLeaveHistory";
import ViewPayslip from "./pages/ViewPayslip";
import ShiftCheckPage from "./pages/ShiftCheckPage";

function App() {
  const { user, loading } = useAuthStore();
  const { theme } = useThemeStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
  }, [theme]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        {/* Login Route */}
        <Route
          path="/login"
          element={!user ? <Login /> : <Navigate to="/shift-check" />}
        />

        {/* Shift Check Route */}
        <Route
          path="/shift-check"
          element={user ? <ShiftCheckPage /> : <Navigate to="/login" />}
        />

        {/* Authenticated and Shift-Validated Layout Routes */}
        <Route path="/" element={user ? <Layout /> : <Navigate to="/login" />}>
          <Route index element={<Dashboard />} />
          <Route path="AttendanceHistory" element={<AttendanceHistory />} />
          <Route
            path="AttendanceSummaryPage"
            element={<AttendanceSummaryPage />}
          />
          <Route path="ViewPayslip" element={<ViewPayslip />} />
          <Route
            path="EmployeeLeaveHistory"
            element={<EmployeeLeaveHistory />}
          />
          <Route
            path="CalendarAttendancePage"
            element={<CalendarAttendancePage />}
          />
          <Route
            path="LeaveApplicationPage"
            element={<LeaveApplicationPage />}
          />
          <Route path="settings" element={<Settings />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="projects" element={<Projects />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="ChatMeetingPage" element={<ChatMeetingPage />} />
          <Route path="ProjectTeam" element={<ProjectTeam />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}

export default App;
