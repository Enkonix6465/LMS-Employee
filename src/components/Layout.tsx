import React, { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { Sun, Moon } from "lucide-react";
import { useThemeStore } from "../store/themeStore";

import {
  LayoutDashboard,
  Users,
  Calendar,
  Settings,
  LogOut,
  Menu,
  X,
  MessageSquareText,
} from "lucide-react";

function Layout() {
  const { signOut, user } = useAuthStore();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { theme, setTheme } = useThemeStore();

  const isActive = (path: string) => location.pathname === path;

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-sky-50 dark:bg-gray-900 overflow-hidden transition-colors duration-300">
      {/* Mobile menu button */}
      <button
        onClick={toggleSidebar}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-white dark:bg-gray-800 shadow-lg transition-all"
      >
        {isSidebarOpen ? (
          <X className="h-6 w-6 text-gray-600 dark:text-gray-300" />
        ) : (
          <Menu className="h-6 w-6 text-gray-600 dark:text-gray-300" />
        )}
      </button>

      {/* Sidebar */}
      <aside
        className={`${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 fixed md:static inset-y-0 left-0 z-40 w-64 bg-sky-100 dark:bg-gray-800 border-r border-blue-200 dark:border-gray-700 shadow-md md:shadow-none transition-transform duration-300 ease-in-out`}
      >
        <div className="h-20 px-4 py-3 flex items-center justify-between border-b border-blue-200 dark:border-gray-700 bg-sky-200 dark:bg-gray-900">
          <a
            href="https://enkonix.in"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 hover:opacity-90 transition-opacity"
          >
            <img
              src="/logo.jpg"
              alt="Company Logo"
              className="h-10 w-10 rounded shadow-sm object-contain bg-white p-1"
            />
            <div>
              <h1 className="text-lg font-bold text-blue-700 dark:text-blue-400">
                ENKONIX
              </h1>
              <p className="text-xs font-medium text-blue-800 dark:text-blue-300">
                Software Services Pvt Ltd
              </p>
            </div>
          </a>

          <button
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="p-2 rounded hover:bg-blue-300/30 dark:hover:bg-gray-700 transition-colors duration-300"
            title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
          >
            {theme === "light" ? (
              <Moon className="h-5 w-5 text-gray-800 dark:text-gray-200" />
            ) : (
              <Sun className="h-5 w-5 text-yellow-400" />
            )}
          </button>
        </div>

        <nav className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-160px)] scrollbar-thin scrollbar-thumb-blue-300 dark:scrollbar-thumb-gray-600 transition-all duration-300">
          {[
            { path: "/", icon: LayoutDashboard, label: "Dashboard" },

            {
              path: "/AttendanceHistory",
              icon: Calendar,
              label: "Attendance History",
            },

            {
              path: "/ViewPayslip",
              icon: Calendar,
              label: "View Payslip",
            },
            {
              path: "/EmployeeLeaveHistory",
              icon: Calendar,
              label: "Leave History",
            },
            {
              path: "/LeaveApplicationPage ",
              icon: Calendar,
              label: "Leave Application",
            },
            { path: "/users", icon: Users, label: "Users" },
            { path: "/calendar", icon: Calendar, label: "Calendar" },
            {
              path: "/ChatMeetingPage",
              icon: MessageSquareText,
              label: "Chat & Meeting Room",
            },
            { path: "/settings", icon: Settings, label: "Settings" },
          ].map(({ path, icon: Icon, label }) => (
            <Link
              key={path}
              to={path}
              onClick={closeSidebar}
              className={`flex items-center px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                isActive(path)
                  ? "bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-300"
                  : "text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-gray-700"
              }`}
            >
              <Icon className="h-5 w-5 mr-3" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-blue-200 dark:border-gray-700 bg-sky-100 dark:bg-gray-900">
          <div className="flex items-center">
            <img
              src={`https://api.dicebear.com/7.x/initials/svg?seed=${user?.email}`}
              alt="Avatar"
              className="h-8 w-8 rounded-full shadow-sm"
            />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {user?.email}
              </p>
            </div>
          </div>
          {/* <button
            onClick={() => signOut()}
            className="mt-4 flex items-center text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <LogOut className="h-5 w-5 mr-2" />
            Sign out
          </button>*/}
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 z-30 md:hidden transition-opacity duration-300"
          onClick={closeSidebar}
        />
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-sky-50 dark:bg-gray-900 transition-all duration-300 ease-in-out">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
