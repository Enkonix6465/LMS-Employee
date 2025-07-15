import React, { useEffect, useRef, useState } from "react";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  collection,
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

    // ✅ Declare once only
    let currentLat = 0;
    let currentLng = 0;
    let address = "Unknown";
    const alreadyChecked = sessionStorage.getItem("locationChecked");

    if (!workFromHome) {
      const getPublicIP = async (): Promise<string | null> => {
        try {
          const res = await fetch("https://api64.ipify.org?format=json");
          if (!res.ok) throw new Error("Failed to fetch IP");
          const data = await res.json();
          return data.ip;
        } catch (error) {
          console.error("Failed to fetch public IP:", error);
          return null;
        }
      };

      const userIP = await getPublicIP();
      console.log("🌐 Public IP:", userIP);

      const officeRef = doc(db, "officeNetwork", "allowedIPs");
      const officeSnap = await getDoc(officeRef);
      const allowedIPs = officeSnap.exists() ? officeSnap.data().ips || [] : [];

      if (!userIP || !allowedIPs.includes(userIP)) {
        alert(
          `❌ You are not connected to an allowed office Wi-Fi.\nYour IP: ${userIP}`
        );
        await signOut(auth);
        window.location.href = "/login";
        return;
      }

      const permissionGranted = await checkLocationPermission();
      if (permissionGranted) {
        const loc = await new Promise<{ lat: number; lng: number } | null>(
          (resolve) => {
            let watchId: number;
            const success = (pos: GeolocationPosition) => {
              const { latitude, longitude, accuracy } = pos.coords;
              console.log(`📍 Login Accuracy: ${accuracy.toFixed(2)} meters`);
              if (accuracy <= 200) {
                navigator.geolocation.clearWatch(watchId);
                resolve({ lat: latitude, lng: longitude });
              }
            };
            const error = () => {
              navigator.geolocation.clearWatch(watchId);
              resolve(null);
            };
            watchId = navigator.geolocation.watchPosition(success, error, {
              enableHighAccuracy: true,
              timeout: 35000,
              maximumAge: 0,
            });
          }
        );

        if (loc) {
          currentLat = loc.lat;
          currentLng = loc.lng;
          address = await getAddressFromCoords(currentLat, currentLng);
        }
      }

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

    if (workFromHome) {
      const permissionGranted = await checkLocationPermission();
      if (permissionGranted) {
        const loc = await new Promise<{ lat: number; lng: number } | null>(
          (resolve) => {
            let watchId: number;
            const success = (pos: GeolocationPosition) => {
              const { latitude, longitude, accuracy } = pos.coords;
              console.log(
                `📍 WFH Login Accuracy: ${accuracy.toFixed(2)} meters`
              );
              if (accuracy <= 300) {
                navigator.geolocation.clearWatch(watchId);
                resolve({ lat: latitude, lng: longitude });
              }
            };
            const error = () => {
              navigator.geolocation.clearWatch(watchId);
              resolve(null);
            };
            watchId = navigator.geolocation.watchPosition(success, error, {
              enableHighAccuracy: true,
              timeout: 35000,
              maximumAge: 0,
            });
          }
        );

        if (loc) {
          currentLat = loc.lat;
          currentLng = loc.lng;
          address = await getAddressFromCoords(currentLat, currentLng);
        }
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
    const today = new Date(date);
    const monthKey = date.slice(0, 7); // yyyy-mm
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
          dailyHours: {},
          countedDates: [],
          extraWorkLog: {},
        };

    // ⛔ Reclassification of old count if already present
    const alreadyCounted = base.countedDates.includes(date);
    if (alreadyCounted) {
      const prev = base.dailyHours[date] || "0h 0m 0s";
      const [ph, pm, ps] = prev
        .split(/[hms ]+/)
        .filter(Boolean)
        .map(Number);
      const prevHours = ph + pm / 60 + ps / 3600;

      if (prevHours >= 9) base.presentDays -= 1;
      else if (prevHours >= 4.5) base.halfDays -= 1;
      else base.absentDays -= 1;

      const totalUsedLeaves = base.leavesTaken + base.extraLeaves;
      if (prevHours === 0 && totalUsedLeaves > 0) {
        if (base.extraLeaves > 0) base.extraLeaves -= 1;
        else base.leavesTaken -= 1;
      }
    } else {
      base.countedDates.push(date);
    }

    // ✅ Reclassify based on new value
    base.dailyHours[date] = todayWorkingStr;
    if (H >= 9) base.presentDays += 1;
    else if (H >= 4.5) base.halfDays += 1;
    else base.absentDays += 1;

    // ✅ Leave logic
    // ✅ Leave logic (only for first time counts)
    if (!alreadyCounted && H === 0) {
      const usedLeaves = base.leavesTaken + base.extraLeaves;
      const allowed = 1 + (base.carryForwardLeaves || 0);
      if (usedLeaves < allowed) base.leavesTaken += 1;
      else base.extraLeaves += 1;
    }

    // ✅ Extra work tracking
    const extraSeconds = secToday - 32400;
    if (extraSeconds > 0) {
      base.extraWorkLog = base.extraWorkLog || {};
      base.extraWorkLog[date] = `${Math.floor(
        extraSeconds / 3600
      )}h ${Math.floor((extraSeconds % 3600) / 60)}m ${Math.floor(
        extraSeconds % 60
      )}s`;
    }

    // ✅ Total working days (recalculate full month)
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-indexed
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const workingDays = Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, month, i + 1);
      return d.getDay() !== 0 && d.getDay() !== 6; // Skip Sunday(0), Saturday(6)
    }).filter(Boolean).length;
    base.totalWorkingDays = workingDays;

    // ✅ Carry forward logic (only on 1st day)
    if (today.getDate() === 1) {
      const prevMonth = new Date(year, month - 1, 1);
      const prevKey = prevMonth.toISOString().slice(0, 7);
      const prevSummarySnap = await getDoc(
        doc(db, "attendanceSummary", `${auth.currentUser!.uid}_${prevKey}`)
      );
      if (prevSummarySnap.exists()) {
        const prevData = prevSummarySnap.data();
        if ((prevData.leavesTaken || 0) === 0) {
          base.carryForwardLeaves = Math.min(
            2,
            (base.carryForwardLeaves || 0) + 1
          );
        }
      } else {
        base.carryForwardLeaves = 1;
      }
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

    // Declare once here
    let logoutLat = 0;
    let logoutLng = 0;
    let logoutAddress = "Unknown";

    const permissionGranted = await checkLocationPermission();
    if (permissionGranted) {
      const loc = await new Promise<{ lat: number; lng: number } | null>(
        (resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude, accuracy } = pos.coords;
              console.log(`📍 Logout Accuracy: ${accuracy.toFixed(2)} meters`);
              resolve({ lat: latitude, lng: longitude });
            },
            (err) => {
              console.warn("📍 Logout location fetch failed:", err);
              resolve(null);
            },
            {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 0,
            }
          );
        }
      );

      if (loc) {
        logoutLat = loc.lat;
        logoutLng = loc.lng;
        logoutAddress = await getAddressFromCoords(logoutLat, logoutLng);
      }
    }

    // Only validate distance if not WFH
    if (!workFromHome && logoutLat && logoutLng) {
      const distance = haversineDistance(logoutLat, logoutLng, lat, lng);
      if (distance > 0.05) {
        const shouldRetry =
          confirm(`❌ You are too far from the assigned office location.

Assigned: (${lat.toFixed(6)}, ${lng.toFixed(6)})
You: (${logoutLat.toFixed(6)}, ${logoutLng.toFixed(6)})
Address: ${logoutAddress}
Distance: ${(distance * 1000).toFixed(2)} meters

Would you like to retry fetching your location before logout?`);

        if (shouldRetry) {
          return await handleLogoutUpdate(); // 🔁 Retry recursively
        } else {
          alert(
            "⛔ Logout canceled. Please retry when you are at the correct location."
          );
          return null;
        }
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
        console.log("🟢 Auth user detected:", user.email);

        try {
          const empsSnap = await getDocs(collection(db, "employees"));
          const all = empsSnap.docs.map((d) => d.data());
          console.log("📄 All employees fetched:", all);

          const matched = empsSnap.docs.find(
            (doc) =>
              doc.data().email?.toLowerCase() === user.email?.toLowerCase()
          );

          if (!matched) {
            console.warn("⚠️ No matching employee found for:", user.email);
            return;
          }

          const userProfile = matched.data();
          const docId = matched.id;
          const loginTime = new Date().toLocaleTimeString();

          const updatedProfile = {
            ...userProfile,
            uid: docId,
            login: loginTime,
          };

          setProfile((prev: any) => ({ ...updatedProfile }));

          const activeRef = doc(db, "activeUsers", docId);

          await setDoc(activeRef, updatedProfile, { merge: true });
          console.log("✅ Active user updated:", updatedProfile);

          const onlineSnap = await getDocs(collection(db, "activeUsers"));
          const allActive = onlineSnap.docs
            .map((d) => d.data())
            .filter((emp) => emp.email !== user.email);

          setEmployees(allActive);
          console.log("🟢 Other online users:", allActive);
        } catch (err) {
          console.error("❌ Failed to update activeUsers:", err);
        }
      } else {
        console.log("🔴 No auth user");
      }
    });

    return () => unsub();
  }, []);
  const [badge, setBadge] = useState("");

  useEffect(() => {
    const calculateBadge = async () => {
      if (!auth.currentUser) return;
      const userId = auth.currentUser.uid;
      const date = getCurrentDate();
      const monthKey = date.slice(0, 7);

      const summaryRef = doc(db, "attendanceSummary", `${userId}_${monthKey}`);
      const summarySnap = await getDoc(summaryRef);

      if (!summarySnap.exists()) {
        console.warn("⚠️ No summary found for badge");
        setBadge("🥉 Bronze");
        return;
      }

      const data = summarySnap.data();
      const dailyHours = data.dailyHours || {};
      const counted = data.countedDates || [];

      let punctualDays = 0;
      let fullDays = 0;

      for (const day of counted) {
        const attRef = doc(db, "attendance", `${userId}_${day}`);
        const attSnap = await getDoc(attRef);

        if (attSnap.exists()) {
          const sessions = attSnap.data().sessions || [];
          const firstLogin = sessions?.[0]?.login || "";
          if (firstLogin) {
            const loginTime = parseTimeToDate(firstLogin);
            const loginHour = loginTime.getHours();
            if (loginHour < 10) punctualDays += 1;
          }
        }

        const hoursStr = dailyHours[day];
        if (hoursStr) {
          const [h, m, s] = hoursStr
            .split(/[hms ]+/)
            .filter(Boolean)
            .map(Number);
          const totalHrs = h + m / 60 + s / 3600;
          if (totalHrs >= 9) fullDays += 1;
        }
      }

      const total = counted.length || 1;
      const punctualRate = (punctualDays / total) * 100;
      const fullDayRate = (fullDays / total) * 100;

      // 🧾 Log stats for debugging
      console.log("✅ Badge Evaluation:");
      console.log("Total Counted Days:", total);
      console.log("Punctual Days (<10AM):", punctualDays);
      console.log("Full Days (≥9h):", fullDays);
      console.log("Punctuality %:", punctualRate.toFixed(2));
      console.log("Full-Day %:", fullDayRate.toFixed(2));

      if (punctualRate >= 80 && fullDayRate >= 80) {
        setBadge("🥇 Gold");
      } else if (punctualRate >= 60 && fullDayRate >= 60) {
        setBadge("🥈 Silver");
      } else {
        setBadge("🥉 Bronze");
      }
    };

    calculateBadge();
  }, [auth.currentUser]);
  const [specialAlerts, setSpecialAlerts] = useState<string[]>([]);

  useEffect(() => {
    const fetchSpecialAlerts = async () => {
      const db = getFirestore();
      const employeesRef = collection(db, "employees");
      const snapshot = await getDocs(employeesRef);

      const today = new Date();
      const currentMonthDay = `${String(today.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(today.getDate()).padStart(2, "0")}`;

      const messages: string[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const dob = data.dob; // format: YYYY-MM-DD
        const joiningDate = data.joiningDate; // format: YYYY-MM-DD

        if (dob?.slice(5) === currentMonthDay) {
          messages.push(
            `🌸 Wishing a Happy Birthday to ${data.name} – from Team Enkonix`
          );
        }

        if (joiningDate?.slice(5) === currentMonthDay) {
          messages.push(
            `🎊 Celebrating ${data.name}'s Work Anniversary Today!`
          );
        }
      });

      setSpecialAlerts(messages);
    };

    fetchSpecialAlerts();
  }, []);

  // ✅ AUTO IP CHECKER THAT FORCES LOGOUT ON WIFI CHANGE
  useEffect(() => {
    let ipCheckInterval: NodeJS.Timeout;

    const startPeriodicIPCheck = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const date = getCurrentDate();
      const assignmentRef = doc(db, "geoAssignments", user.uid, "dates", date);
      const assignmentSnap = await getDoc(assignmentRef);

      if (!assignmentSnap.exists()) {
        console.warn("No geo assignment found for IP check");
        return;
      }

      const { workFromHome } = assignmentSnap.data();

      // ❌ If WFH, skip periodic IP check
      if (workFromHome) {
        console.log("🛑 Skipping IP check — WFH user");
        return;
      }

      const getPublicIP = async (): Promise<string | null> => {
        try {
          const res = await fetch("https://api64.ipify.org?format=json");
          if (!res.ok) throw new Error("Failed to fetch IP");
          const data = await res.json();
          return data.ip;
        } catch (error) {
          console.error("Failed to fetch public IP:", error);
          return null;
        }
      };

      let retryCount = 0;

      const checkIPAndLogoutIfChanged = async () => {
        const userIP = await getPublicIP();
        console.log("🌐 Periodic IP Check:", userIP);

        const officeRef = doc(db, "officeNetwork", "allowedIPs");
        const officeSnap = await getDoc(officeRef);
        const allowedIPs = officeSnap.exists()
          ? officeSnap.data().ips || []
          : [];

        if (!userIP || !allowedIPs.includes(userIP)) {
          if (retryCount < 3) {
            console.warn(
              `⚠️ IP not allowed. Retrying in 10s... (${retryCount + 1}/3)`
            );
            retryCount++;
            return;
          }

          alert(
            `❌ You are not connected to an allowed office Wi-Fi.\nYour IP: ${userIP}\nYou will be logged out.`
          );

          if (auth.currentUser && profile?.uid) {
            setLoggingOut(true);
            await handleLogoutUpdate();
            await updateMonthlySummary();
            await signOut(auth);
            setLoggingOut(false);
            window.location.href = "/login";
          }
        } else {
          retryCount = 0; // Reset if IP becomes valid
        }
      };

      ipCheckInterval = setInterval(checkIPAndLogoutIfChanged, 600000);

      const handleVisibility = () => {
        if (document.visibilityState === "visible") {
          checkIPAndLogoutIfChanged();
        }
      };
      document.addEventListener("visibilitychange", handleVisibility);

      // Cleanup
      return () => {
        clearInterval(ipCheckInterval);
        document.removeEventListener("visibilitychange", handleVisibility);
      };
    };

    startPeriodicIPCheck();
  }, [auth, profile]);

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
  const presentDays = profile.presentDays || 0;
  const totalDays = profile.totalDays || 0;
  const leavesTaken = profile.leavesTaken || 0;
  const extraLeaves = profile.extraLeaves || 0;
  const carryForward = profile.carryForward || 0;

  const attendancePercentage =
    totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(2) : "0.00";

  const badgeStats = {
    badge: badge || "🥉 Bronze",
    presentDays,
    totalDays,
    leavesTaken,
    extraLeaves,
    carryForward,
    attendancePercentage,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 transition-colors duration-300">
      {specialAlerts.length > 0 && (
        <div className="relative overflow-hidden bg-gradient-to-r from-pink-100 to-purple-200 dark:from-gray-800 dark:to-gray-700 py-3 px-6 mb-6 rounded shadow transition-colors duration-300">
          <div className="animate-scroll whitespace-nowrap text-lg font-semibold text-purple-800 dark:text-purple-200">
            {specialAlerts.map((msg, idx) => (
              <span key={idx} className="inline-block mr-12">
                {msg} 🎉
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
          👋 Welcome, {profile.name}
        </h1>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className={`flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-lg shadow-md hover:bg-red-700 transition-all duration-300 ${
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
        <div className="text-green-600 dark:text-green-400 mb-4 font-semibold text-center">
          {message}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Panel */}
        <div className="flex-1 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
            <div className="bg-yellow-50 dark:bg-yellow-900 p-4 rounded-lg shadow-sm border dark:border-gray-700 transition">
              <p className="font-medium text-gray-700 dark:text-yellow-100 mb-1">
                Compliance Badge
              </p>
              <div className="text-2xl text-gray-800 dark:text-white mb-2">
                {badgeStats.badge}
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-100 space-y-1">
                <p>
                  🎯 Present Days: <strong>{badgeStats.presentDays}</strong>
                </p>
                <p>
                  📆 Total Days: <strong>{badgeStats.totalDays}</strong>
                </p>
                <p>
                  📋 Leaves Taken: <strong>{badgeStats.leavesTaken}</strong>
                </p>
                <p>
                  ➕ Extra Leaves: <strong>{badgeStats.extraLeaves}</strong>
                </p>
                <p>
                  🔁 Carry Forward: <strong>{badgeStats.carryForward}</strong>
                </p>
                <p>
                  📊 Attendance %:{" "}
                  <strong>{badgeStats.attendancePercentage}%</strong>
                </p>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg shadow-sm border dark:border-gray-700">
              <p className="font-medium text-gray-700 dark:text-blue-100 mb-1">
                Login Time
              </p>
              <div className="text-lg text-gray-800 dark:text-white">
                {loginTime || "N/A"}
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg shadow-sm border dark:border-gray-700">
              <p className="font-medium text-gray-700 dark:text-blue-100 mb-1">
                Total Worked
              </p>
              <div className="text-lg text-gray-800 dark:text-white">
                {totalHours || "0h 0m"}
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg shadow-sm border dark:border-gray-700">
              <p className="font-medium text-gray-700 dark:text-blue-100 mb-1">
                Date
              </p>
              <div className="text-lg text-gray-800 dark:text-white">
                {getCurrentDate()}
              </div>
            </div>
          </div>

          {/* Profile Section */}
          <div className="flex flex-col md:flex-row gap-6">
            {/* Profile Card */}
            <div className="md:w-1/3 bg-white dark:bg-gray-800 shadow rounded-xl p-6 flex flex-col items-center text-center transition">
              {profile.photo && profile.photo !== "NA" ? (
                <img
                  src={profile.photo}
                  alt="Profile"
                  className="w-32 h-32 rounded-full object-cover border"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-4xl">
                  👤
                </div>
              )}
              <p className="mt-4 text-xl font-semibold text-gray-800 dark:text-white">
                {profile.name}
              </p>
              <p className="text-gray-500 dark:text-gray-300">
                {profile.title}
              </p>
            </div>

            {/* Editable Info */}
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
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                      {field.label}
                    </label>
                    <input
                      name={field.name}
                      value={profile[field.name] || ""}
                      onChange={
                        field.editable && editable ? handleChange : undefined
                      }
                      disabled={!field.editable || !editable}
                      className={`w-full p-2 border rounded-lg text-sm transition-colors duration-300 ${
                        !field.editable
                          ? "bg-gray-100 dark:bg-gray-700"
                          : "bg-white dark:bg-gray-900"
                      } text-gray-800 dark:text-white`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Profile Buttons */}
          <div className="mt-4 text-center space-x-4">
            {!editable ? (
              <button
                onClick={() => setEditable(true)}
                className="bg-blue-600 text-white px-6 py-2 rounded-full hover:bg-blue-700 shadow transition"
              >
                ✏️ Edit Profile
              </button>
            ) : (
              <button
                onClick={handleUpdate}
                className="bg-green-600 text-white px-6 py-2 rounded-full hover:bg-green-700 shadow transition"
              >
                ✅ Save Changes
              </button>
            )}
            <button
              onClick={() => setShowMore((prev) => !prev)}
              className="bg-gray-600 text-white px-6 py-2 rounded-full hover:bg-gray-700 shadow transition"
            >
              {showMore ? "🔽 Hide Details" : "🔼 View More"}
            </button>
          </div>
        </div>

        {/* Right Panel: Online Users */}
        <div className="w-full lg:w-[300px] bg-white dark:bg-gray-800 rounded-xl shadow p-4 overflow-y-auto max-h-[80vh] transition-colors duration-300">
          <h2 className="text-lg font-bold mb-4 text-center text-blue-700 dark:text-blue-300">
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
                  className="bg-blue-100 dark:bg-blue-950 p-3 rounded-lg flex items-center gap-3 transition"
                >
                  <div className="relative">
                    <div className="h-10 w-10 bg-blue-200 dark:bg-blue-700 rounded-full flex items-center justify-center">
                      <span className="text-blue-700 dark:text-white font-bold text-lg">
                        {emp.name?.[0] || "?"}
                      </span>
                    </div>
                    <span className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full" />
                  </div>
                  <div className="text-left text-sm">
                    <p className="font-semibold text-blue-800 dark:text-white">
                      {emp.name}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      {emp.email}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Login: {emp.login || "N/A"}
                    </p>
                  </div>
                </div>
              ))}
            {employees.length === 0 && (
              <p className="text-gray-500 dark:text-gray-300 text-sm text-center">
                No other employees online
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
