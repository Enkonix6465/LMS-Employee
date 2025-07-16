import React, { useState } from "react";
import { useAuthStore } from "../store/authStore";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Lock, Mail } from "lucide-react";
import axios from "axios";
import { getAuth } from "firebase/auth";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

// Detect device type
const getDeviceType = () => {
  const ua = navigator.userAgent;
  if (/mobile/i.test(ua)) return "Mobile";
  if (/tablet/i.test(ua)) return "Tablet";
  return "Desktop";
};

// Fetch public IP
const getPublicIP = async () => {
  try {
    const res = await axios.get("https://api.ipify.org?format=json");
    return res.data.ip;
  } catch {
    return "Unavailable";
  }
};

// Detect OS
const getOS = () => {
  const { userAgent } = navigator;
  if (/Windows NT/.test(userAgent)) return "Windows";
  if (/Mac OS X/.test(userAgent)) return "macOS";
  if (/Linux/.test(userAgent)) return "Linux";
  if (/Android/.test(userAgent)) return "Android";
  if (/iPhone|iPad/.test(userAgent)) return "iOS";
  return "Unknown";
};

// Detect browser
const getBrowser = () => {
  const { userAgent } = navigator;
  let match =
    userAgent.match(
      /(firefox|msie|trident|chrome|safari|edg|opera|opr)\/?\s*(\d+)/i
    ) || [];
  if (/trident/i.test(match[1])) return "IE";
  if (match[1] === "Chrome" && /Edg\//.test(userAgent)) return "Edge";
  if (match[1] === "OPR") return "Opera";
  return match.length > 1 ? `${match[1]} ${match[2]}` : "Unknown";
};

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signIn(email, password);

      const auth = getAuth();
      const user = auth.currentUser;

      if (user) {
        const ipAddress = await getPublicIP();
        const deviceType = getDeviceType();
        const os = getOS();
        const browser = getBrowser();
        const screenSize = `${window.screen.width}x${window.screen.height}`;

        await addDoc(collection(db, "loginLogs", user.uid, "entries"), {
          email: user.email,
          ipAddress,
          deviceType,
          os,
          browser,
          screenSize,
          loginTime: new Date().toISOString(),
        });

        if (deviceType === "Mobile" || deviceType === "Tablet") {
          toast.error(
            "Mobile or tablet login is not allowed for this dashboard."
          );
          window.location.reload();
          return;
        }

        navigate("/ShiftCheckPage");
      }
    } catch (err) {
      toast.error("Invalid login credentials");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
            <Lock className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          Welcome to ENKONIX
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Sign in to access your dashboard
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow-xl rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Email address
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full pl-10 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Password
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full pl-10 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  isLoading ? "opacity-75 cursor-not-allowed" : ""
                }`}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  "Sign in"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;
