import React, { useEffect, useRef, useState } from "react";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";

// Utility functions
const getCurrentDate = () => new Date().toLocaleDateString("en-CA");
const getCurrentTime = () => new Date().toLocaleTimeString();

const convertTo24HourFormat = (time12h: string): string => {
  const [time, modifier] = time12h.split(" ");
  let [hours, minutes, seconds] = time.split(":").map(Number);
  if (modifier === "PM" && hours < 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
};

const haversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const parseTimeToDate = (timeStr: string): Date => {
  const [time, modifier] = timeStr.split(" ");
  let [hours, minutes, seconds] = time.split(":").map(Number);
  if (modifier === "PM" && hours < 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;
  return new Date(1970, 0, 1, hours, minutes, seconds);
};

const calculateTotalHours = (
  sessions: { login: string; logout: string }[],
  includeCurrent = false
): string => {
  let totalSec = 0;

  for (let { login, logout } of sessions) {
    if (!login || (!logout && !includeCurrent)) continue;

    try {
      const loginDate = parseTimeToDate(login);
      const logoutDate = logout
        ? parseTimeToDate(logout)
        : parseTimeToDate(new Date().toLocaleTimeString());
      let diff = (logoutDate.getTime() - loginDate.getTime()) / 1000;
      if (diff < 0) diff += 86400;
      totalSec += diff;
    } catch (err) {
      console.error("Time parse error", err);
    }
  }

  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = Math.floor(totalSec % 60);
  return `${hrs}h ${mins}m ${secs}s`;
};

const getAddressFromCoords = async (
  lat: number,
  lon: number
): Promise<string> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
    );
    const data = await response.json();
    return data.display_name || "Unknown Location";
  } catch (error) {
    console.error("Reverse geocoding failed:", error);
    return "Unknown Location";
  }
};

export default function EmployeeSelfProfile() {
  const [userEmail, setUserEmail] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [editable, setEditable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [totalHours, setTotalHours] = useState("");
  const [loginTime, setLoginTime] = useState("");
  const [showMore, setShowMore] = useState(false);

  const auth = getAuth();
  const db = getFirestore();
  const didLogout = useRef(false);

  const setupAttendance = async (userId: string, name: string) => {
    const date = getCurrentDate();
    const time = getCurrentTime();
    const assignmentRef = doc(db, "geoAssignments", userId, "dates", date);
    const assignmentSnap = await getDoc(assignmentRef);

    if (!assignmentSnap.exists()) {
      alert("❌ Location assignment not found for today.");
      return;
    }

    const assignment = assignmentSnap.data();
    const { lat, lng, workFromHome } = assignment;

    let currentLat = 0;
    let currentLng = 0;
    let address = "Unknown";

    if (!workFromHome) {
      const loc = await new Promise<{ lat: number; lng: number } | null>(
        (resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude } = pos.coords;
              resolve({ lat: latitude, lng: longitude });
            },
            () => resolve(null)
          );
        }
      );

      if (!loc) {
        alert("❌ Could not determine your location.");
        return;
      }

      currentLat = loc.lat;
      currentLng = loc.lng;

      const distance = haversineDistance(currentLat, currentLng, lat, lng);
      if (distance > 0.05) {
        alert(`❌ Too far from assigned location.
Assigned: (${lat.toFixed(6)}, ${lng.toFixed(6)})
You: (${currentLat.toFixed(6)}, ${currentLng.toFixed(6)})
Address: ${address}
Distance: ${(distance * 1000).toFixed(2)} meters`);

        await signOut(auth);
        window.location.href = "/login";
        return;
      }

      address = await getAddressFromCoords(currentLat, currentLng);
    }

    const attendanceRef = doc(db, "attendance", `${userId}_${date}`);
    const snap = await getDoc(attendanceRef);

    const newSession = {
      login: time,
      logout: "",
      loginLocation: {
        lat: currentLat,
        lng: currentLng,
        address,
      },
    };

    if (!snap.exists()) {
      await setDoc(attendanceRef, {
        userId,
        name,
        date,
        sessions: [newSession],
        totalHours: "",
      });
      setLoginTime(time);
    } else {
      const data = snap.data();
      const sessions = data.sessions || [];
      if (sessions.length > 0) setLoginTime(sessions[0].login);
      setTotalHours(data.totalHours || "");

      if (!sessions[sessions.length - 1]?.logout) return;

      sessions.push(newSession);
      await updateDoc(attendanceRef, { sessions });
    }
  };

  const handleLogoutUpdate = async (): Promise<string | null> => {
    const user = auth.currentUser;
    if (!user) return null;

    const date = getCurrentDate();
    const time = getCurrentTime();
    const attendanceRef = doc(db, "attendance", `${user.uid}_${date}`);
    const snap = await getDoc(attendanceRef);
    if (!snap.exists()) return null;

    const assignmentSnap = await getDoc(
      doc(db, "geoAssignments", user.uid, "dates", date)
    );
    const assignment = assignmentSnap.exists() ? assignmentSnap.data() : {};
    const { lat, lng, workFromHome } = assignment;

    const sessions = [...snap.data().sessions];
    const lastSession = sessions[sessions.length - 1];

    if (!lastSession || lastSession.logout)
      return snap.data().totalHours || null;

    let logoutLat = 0,
      logoutLng = 0,
      logoutAddress = "Unknown";

    if (!workFromHome) {
      const loc = await new Promise<{ lat: number; lng: number } | null>(
        (resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            },
            () => resolve(null)
          );
        }
      );

      if (!loc) {
        alert("❌ Could not determine logout location.");
        return null;
      }

      logoutLat = loc.lat;
      logoutLng = loc.lng;
      const distance = haversineDistance(logoutLat, logoutLng, lat, lng);
      logoutAddress = await getAddressFromCoords(logoutLat, logoutLng);

      if (distance > 0.05) {
        alert(`❌ Too far from assigned location at logout.
Assigned: (${lat.toFixed(6)}, ${lng.toFixed(6)})
You: (${logoutLat.toFixed(6)}, ${logoutLng.toFixed(6)})
Address: ${logoutAddress}
Distance: ${(distance * 1000).toFixed(2)} meters`);

        await signOut(auth);
        window.location.href = "/login";
        return null;
      }
    }

    lastSession.logout = time;
    lastSession.logoutLocation = {
      lat: logoutLat,
      lng: logoutLng,
      address: logoutAddress,
    };

    const total = calculateTotalHours(sessions);
    await updateDoc(attendanceRef, { sessions, totalHours: total });
    setTotalHours(total);

    return total;
  };

  const handleLogout = async () => {
    didLogout.current = true;
    await handleLogoutUpdate();
    await signOut(auth);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserEmail(user.email || "");
        const profileSnap = await getDoc(doc(db, "employees", user.uid));
        if (profileSnap.exists()) {
          const prof = profileSnap.data();
          setProfile(prof);
          await setupAttendance(user.uid, prof.name);

          const date = getCurrentDate();
          const attendanceRef = doc(db, "attendance", `${user.uid}_${date}`);
          const snap = await getDoc(attendanceRef);
          if (snap.exists()) {
            const data = snap.data();
            const sessions = data.sessions || [];
            if (sessions.length > 0 && !sessions[sessions.length - 1].logout) {
              interval = setInterval(() => {
                const liveTotal = calculateTotalHours(sessions, true);
                setTotalHours(liveTotal);
              }, 1000);
            } else {
              setTotalHours(data.totalHours || "0h 0m 0s");
            }
          }
        }

        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (interval) clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!didLogout.current) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleUpdate = async () => {
    try {
      await updateDoc(doc(db, "employees", auth.currentUser!.uid), {
        phone: profile.phone,
        photo: profile.photo,
        location: profile.location,
      });
      setMessage("✅ Profile updated!");
      setTimeout(() => setMessage(""), 3000);
      setEditable(false);
    } catch {
      alert("❌ Update failed.");
    }
  };

  if (loading) return <div className="text-center py-20">Loading...</div>;
  if (!profile)
    return (
      <div className="text-center text-red-500 py-20">
        Employee data not found.
      </div>
    );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          👋 Welcome, {profile.name}
        </h1>
        <button
          onClick={handleLogout}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          🚪 Logout
        </button>
      </div>

      {message && (
        <div className="text-green-600 mb-4 font-semibold text-center">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-center text-lg">
        <div className="bg-blue-50 p-4 rounded shadow">
          <strong>Login Time:</strong>
          <div>{loginTime || "N/A"}</div>
        </div>
        <div className="bg-blue-50 p-4 rounded shadow">
          <strong>Total Worked:</strong>
          <div>{totalHours || "0h 0m"}</div>
        </div>
        <div className="bg-blue-50 p-4 rounded shadow">
          <strong>Date:</strong>
          <div>{getCurrentDate()}</div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="md:w-1/3 flex flex-col items-center bg-white shadow rounded-xl p-6">
          {profile.photo && profile.photo !== "NA" ? (
            <img
              src={profile.photo}
              alt="Profile"
              className="w-32 h-32 rounded-full object-cover border"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center text-4xl">
              👤
            </div>
          )}
          <p className="mt-4 text-xl font-semibold">{profile.name}</p>
          <p className="text-gray-500">{profile.title}</p>
        </div>

        {showMore && (
          <div className="md:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: "Full Name", name: "name", editable: false },
              { label: "Email", name: "email", editable: false },
              { label: "Phone", name: "phone", editable: true },
              { label: "Photo URL", name: "photo", editable: true },
              { label: "Location", name: "location", editable: true },
              { label: "Job Title", name: "title", editable: false },
              { label: "Department", name: "department", editable: false },
              { label: "DOB", name: "dob", editable: false },
              { label: "Gender", name: "gender", editable: false },
              { label: "Joining Date", name: "joiningDate", editable: false },
              { label: "Manager", name: "manager", editable: false },
              { label: "Status", name: "status", editable: false },
              { label: "Type", name: "type", editable: false },
            ].map((field, idx) => (
              <div key={idx}>
                <label className="block font-medium text-gray-700">
                  {field.label}
                </label>
                <input
                  name={field.name}
                  value={profile[field.name] || ""}
                  onChange={
                    field.editable && editable ? handleChange : undefined
                  }
                  disabled={!field.editable || !editable}
                  className={`w-full p-2 border rounded ${
                    !field.editable ? "bg-gray-100" : ""
                  }`}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 text-center space-x-4">
        {!editable ? (
          <button
            onClick={() => setEditable(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-full hover:bg-blue-700"
          >
            ✏️ Edit Profile
          </button>
        ) : (
          <button
            onClick={handleUpdate}
            className="bg-green-600 text-white px-6 py-2 rounded-full hover:bg-green-700"
          >
            ✅ Save Changes
          </button>
        )}
        <button
          onClick={() => setShowMore((prev) => !prev)}
          className="bg-gray-600 text-white px-6 py-2 rounded-full hover:bg-gray-700"
        >
          {showMore ? "🔽 Hide Details" : "🔼 View More"}
        </button>
      </div>
    </div>
  );
}
