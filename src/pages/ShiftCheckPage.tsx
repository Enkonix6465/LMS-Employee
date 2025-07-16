import React, { useEffect, useState } from "react";
import { getAuth, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const getCurrentDate = () => new Date().toLocaleDateString("en-CA");

const ShiftCheckPage = () => {
  const auth = getAuth();
  const db = getFirestore();
  const navigate = useNavigate();

  const [status, setStatus] = useState<"checking" | "valid" | "early" | "none">(
    "checking"
  );
  const [message, setMessage] = useState("");
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString()
  );
  const [countdown, setCountdown] = useState(10);
  const [shiftTime, setShiftTime] = useState({ startTime: "", endTime: "" });

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const logoutAndRedirect = async () => {
    await signOut(auth);
    navigate("/login", { replace: true });
  };

  // Check shift timing once on auth change
  useEffect(() => {
    const checkShift = async (user: any) => {
      const today = getCurrentDate();
      const shiftRef = doc(db, "shiftAssignments", user.uid, "dates", today);
      const shiftSnap = await getDoc(shiftRef);

      if (!shiftSnap.exists()) {
        setStatus("none");
        setMessage("⚠️ No shift assigned for today.");
        return;
      }

      const { startTime, endTime } = shiftSnap.data();
      setShiftTime({ startTime, endTime });

      const now = new Date();
      const [h, m, s] = now.toLocaleTimeString("en-GB").split(":").map(Number);
      const nowSec = h * 3600 + m * 60 + s;

      const [sh, sm, ss] = startTime.split(":").map(Number);
      const [eh, em, es] = endTime.split(":").map(Number);
      const startSec = sh * 3600 + sm * 60 + ss;
      const endSec = eh * 3600 + em * 60 + es;

      if (nowSec < startSec) {
        const waitMin = Math.floor((startSec - nowSec) / 60);
        const waitSec = (startSec - nowSec) % 60;
        setStatus("early");
        setMessage(
          `⏳ Your shift starts at ${startTime}. Please wait ${waitMin}m ${waitSec}s.`
        );
        return;
      }

      if (nowSec > endSec) {
        setStatus("none");
        setMessage("⛔ Your shift is over.");
        return;
      }

      // Inside shift
      setStatus("valid");
      setMessage("✅ You are within your shift time.");
    };

    onAuthStateChanged(auth, (user) => {
      if (user) checkShift(user);
      else navigate("/login", { replace: true });
    });
  }, [auth, db, navigate]);

  // Handle countdown & redirection after message is shown
  useEffect(() => {
    if (status === "none" || status === "early") {
      let sec = 10;
      setCountdown(sec);
      const timer = setInterval(() => {
        sec--;
        setCountdown(sec);
        if (sec === 0) {
          clearInterval(timer);
          logoutAndRedirect();
        }
      }, 1000);
      return () => clearInterval(timer);
    }

    if (status === "valid") {
      let sec = 10;
      setCountdown(sec);
      const timer = setInterval(() => {
        sec--;
        setCountdown(sec);
        if (sec === 0) {
          clearInterval(timer);
          navigate("/", { replace: true });
        }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [status]);

  // Hide shift page if already navigating to dashboard
  if (status === "valid" && countdown === 0) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-200 px-4 text-center">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-indigo-800">🔍 Shift Status</h1>

        <div className="text-lg text-gray-800 font-medium">{message}</div>

        <div className="text-sm text-gray-600">
          🕒 Current Time: <strong className="font-mono">{currentTime}</strong>
        </div>

        {(status === "valid" || status === "early" || status === "none") && (
          <div className="text-sm text-blue-700 font-medium">
            ⏳ Redirecting in <span className="font-bold">{countdown}</span>{" "}
            seconds...
          </div>
        )}

        {status === "valid" && (
          <div className="text-sm text-green-700 bg-green-100 p-3 rounded-lg border border-green-300">
            🗓️ Your Shift: <strong>{shiftTime.startTime}</strong> to{" "}
            <strong>{shiftTime.endTime}</strong>
          </div>
        )}

        {status === "checking" && (
          <div className="flex justify-center mt-4">
            <div className="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
};

export default ShiftCheckPage;
