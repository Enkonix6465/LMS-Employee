import React, { useEffect, useRef, useState } from "react";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
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

// ✅ ADD HERE
const checkLocationPermission = async (): Promise<boolean> => {
  try {
    const status = await navigator.permissions.query({
      name: "geolocation" as PermissionName,
    });
    return status.state === "granted" || status.state === "prompt";
  } catch (error) {
    console.error("Permission check failed", error);
    return false;
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
  const [authUser, setAuthUser] = useState(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  // For optional search in online users

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

    const alreadyChecked = sessionStorage.getItem("locationChecked");

    if (!workFromHome) {
      // Always get current location
      const loc = await new Promise<{ lat: number; lng: number } | null>(
        (resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude } = pos.coords;
              resolve({ lat: latitude, lng: longitude });
            },
            () => resolve(null),
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 30000,
            }
          );
        }
      );

      if (!loc) {
        alert("❌ Could not determine your location.");
        return;
      }

      currentLat = loc.lat;
      currentLng = loc.lng;
      address = await getAddressFromCoords(currentLat, currentLng);

      // Check location only once per day
      if (alreadyChecked !== date) {
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

        sessionStorage.setItem("locationChecked", date);
      }
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
  const recalculateTotalHours = (
    dailyHours: Record<string, string>
  ): string => {
    let totalSec = 0;
    Object.values(dailyHours).forEach((str) => {
      const [h, m, s] = str
        .split(/[hms ]+/)
        .filter(Boolean)
        .map(Number);
      totalSec += h * 3600 + m * 60 + s;
    });
    const H = Math.floor(totalSec / 3600);
    const M = Math.floor((totalSec % 3600) / 60);
    const S = totalSec % 60;
    return `${H}h ${M}m ${S}s`;
  };
  const updateMonthlySummary = async () => {
    const date = getCurrentDate();
    const monthKey = date.slice(0, 7);
    const summaryRef = doc(
      db,
      "attendanceSummary",
      `${auth.currentUser!.uid}_${monthKey}`
    );
    const summarySnap = await getDoc(summaryRef);

    const attSnap = await getDoc(
      doc(db, "attendance", `${auth.currentUser!.uid}_${date}`)
    );
    const sessions = attSnap.exists() ? attSnap.data().sessions || [] : [];

    const secToday = sessions.reduce((acc: number, s: any) => {
      if (!s.login || !s.logout) return acc;
      const login = parseTimeToDate(s.login);
      const logout = parseTimeToDate(s.logout);
      let d = (logout.getTime() - login.getTime()) / 1000;
      if (d < 0) d += 86400;
      return acc + d;
    }, 0);

    const H = Math.floor(secToday / 3600);
    const M = Math.floor((secToday % 3600) / 60);
    const S = Math.floor(secToday % 60);
    const todayWorkingStr = `${H}h ${M}m ${S}s`;

    const base = summarySnap.exists()
      ? summarySnap.data()
      : {
          userId: auth.currentUser!.uid,
          name: profile.name,
          email: profile.email || "",
          department: profile.department || "",
          month: monthKey,
          presentDays: 0,
          halfDays: 0,
          absentDays: 0,
          leavesTaken: 0,
          extraLeaves: 0,
          carryForwardLeaves: 0,
          totalWorkingDays: 0,
          totalmonthHours: "0h 0m 0s",
          dailyHours: {}, // new
          countedDates: [], // new
        };

    // avoid recounting same date
    if (base.countedDates.includes(date)) {
      // only update today's working time
      base.dailyHours[date] = todayWorkingStr;
      base.totalmonthHours = recalculateTotalHours(base.dailyHours);
      await setDoc(summaryRef, base);
      return;
    }

    base.countedDates.push(date);
    base.totalWorkingDays += 1;
    base.dailyHours[date] = todayWorkingStr;

    const hrs = secToday / 3600;
    if (hrs >= 9) base.presentDays += 1;
    else if (hrs >= 4.5) base.halfDays += 1;
    else base.absentDays += 1;

    const usedLeaves = base.leavesTaken + base.extraLeaves;
    const allowed = 1 + (base.carryForwardLeaves || 0);

    if (hrs === 0) {
      if (usedLeaves < allowed) base.leavesTaken += 1;
      else base.extraLeaves += 1;
    }

    // carry forward only at month-end
    const todayDate = new Date(date);
    const lastDate = new Date(
      todayDate.getFullYear(),
      todayDate.getMonth() + 1,
      0
    ).getDate();
    if (todayDate.getDate() === lastDate && base.leavesTaken === 0) {
      base.carryForwardLeaves = (base.carryForwardLeaves || 0) + 1;
    }

    base.totalmonthHours = recalculateTotalHours(base.dailyHours);
    await setDoc(summaryRef, base);
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
      // ✅ Check permission before requesting location
      const permissionGranted = await checkLocationPermission();
      if (!permissionGranted) {
        alert(
          "❌ Location permission denied. Please allow access to continue."
        );
        return null;
      }

      const loc = await new Promise<{ lat: number; lng: number } | null>(
        (resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) =>
              resolve({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              }),
            (error) => {
              console.error("Logout geolocation error:", error);
              resolve(null);
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 30000,
            }
          );
        }
      );

      if (!loc) {
        alert("❌ Could not determine logout location.");
        return null;
      }

      logoutLat = loc.lat;
      logoutLng = loc.lng;
      logoutAddress = await getAddressFromCoords(logoutLat, logoutLng); // ✅ FIXED

      const distance = haversineDistance(logoutLat, logoutLng, lat, lng);
      if (distance > 0.05) {
        alert(`❌ Too far from assigned location at logout.
Assigned: (${lat.toFixed(6)}, ${lng.toFixed(6)})
You: (${logoutLat.toFixed(6)}, ${logoutLng.toFixed(6)})
Address: ${logoutAddress}
Distance: ${(distance * 1000).toFixed(2)} meters`);

        await signOut(auth);
        sessionStorage.removeItem("locationChecked");
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
    if (!auth.currentUser || !profile?.uid) {
      console.error(
        "⛔ Skipping logout - Missing user or UID",
        auth.currentUser,
        profile?.uid
      );
      return;
    }

    try {
      setLoggingOut(true); // 👈 Start loading

      didLogout.current = true;

      const activeRef = doc(db, "activeUsers", profile.uid);
      await setDoc(
        activeRef,
        { logout: new Date().toLocaleTimeString() },
        { merge: true }
      );

      await deleteDoc(activeRef);
      await handleLogoutUpdate();
      await updateMonthlySummary();
      await signOut(auth);
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setLoggingOut(false); // 👈 Stop loading regardless of success
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserEmail(user.email || "");
        const profileSnap = await getDoc(doc(db, "employees", user.uid));
        if (profileSnap.exists()) {
          const prof = profileSnap.data();
          setProfile({ ...prof, uid: user.uid }); // ✅ Inject uid for later use
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
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setAuthUser(user);

        const empsSnap = await getDocs(collection(db, "employees"));
        const matched = empsSnap.docs.find(
          (doc) => doc.data().email === user.email
        );

        if (matched) {
          const userProfile = matched.data();
          const docId = matched.id;
          setProfile((prev: any) => ({ ...prev, uid: docId }));

          const activeRef = doc(db, "activeUsers", docId);
          const exists = await getDoc(activeRef);
          if (!exists.exists()) {
            await setDoc(activeRef, {
              ...userProfile,
              uid: docId,
              login: new Date().toLocaleTimeString(),
            });
          }

          // Fetch all other online users
          const onlineSnap = await getDocs(collection(db, "activeUsers"));
          const allActive = onlineSnap.docs
            .map((d) => d.data())
            .filter((emp) => emp.email !== user.email);
          setEmployees(allActive);
        }
      }
    });

    return () => unsub();
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
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          👋 Welcome, {profile.name}
        </h1>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className={`bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 flex items-center gap-2 ${
            loggingOut ? "opacity-70 cursor-not-allowed" : ""
          }`}
        >
          🚪 Logout
          {loggingOut && (
            <svg
              className="animate-spin h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 11-8 8z"
              />
            </svg>
          )}
        </button>
      </div>

      {message && (
        <div className="text-green-600 mb-4 font-semibold text-center">
          {message}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        {/* LEFT SECTION (Main Content) */}
        <div className="flex-1">
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
                  {
                    label: "Joining Date",
                    name: "joiningDate",
                    editable: false,
                  },
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

        {/* RIGHT SECTION (Online Users) */}
        <div className="w-full lg:w-[300px] bg-white rounded-xl shadow p-4 overflow-y-auto max-h-[80vh]">
          <h2 className="text-lg font-bold mb-4 text-center text-blue-700">
            🟢 Online Users
          </h2>
          <div className="space-y-3">
            {employees
              .filter((emp) =>
                emp.name?.toLowerCase().includes(search.toLowerCase())
              )
              .map((emp, i) => (
                <div
                  key={i}
                  className="bg-blue-100 p-2 rounded flex items-center gap-3"
                >
                  <div className="relative">
                    <div className="h-10 w-10 bg-blue-200 rounded-full flex items-center justify-center">
                      <span className="text-blue-700 font-bold text-lg">
                        {emp.name?.[0] || "?"}
                      </span>
                    </div>
                    <span className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 border-2 border-white rounded-full" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-blue-800">
                      {emp.name}
                    </p>
                    <p className="text-xs text-gray-600">{emp.email}</p>
                    <p className="text-xs text-gray-500">
                      Login: {emp.login || "N/A"}
                    </p>
                  </div>
                </div>
              ))}
            {employees.length === 0 && (
              <p className="text-gray-500 text-sm text-center">
                No other employees online
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
