import { create } from "zustand";
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import toast from "react-hot-toast";

// === Utility Functions ===
const getCurrentDate = () => new Date().toLocaleDateString("en-CA");
const getCurrentTime = () => new Date().toLocaleTimeString();

const toSeconds = (timeStr: string) => {
  const [time, modifier] = timeStr.split(" ");
  let [hours, minutes, seconds] = time.split(":").map(Number);
  if (modifier === "PM" && hours < 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;
  return hours * 3600 + minutes * 60 + seconds;
};

const calculateTotalHours = (
  sessions: { login: string; logout: string }[],
  includeCurrent = false
): string => {
  let totalSec = 0;
  for (let { login, logout } of sessions) {
    if (!login || (!logout && !includeCurrent)) continue;
    const loginSec = toSeconds(login);
    const logoutSec = logout ? toSeconds(logout) : toSeconds(getCurrentTime());
    let diff = logoutSec - loginSec;
    if (diff < 0) diff += 86400;
    totalSec += diff;
  }
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = Math.floor(totalSec % 60);
  return `${hrs}h ${mins}m ${secs}s`;
};

// === Types ===
interface UserData {
  uid: string;
  email: string | null;
  role: string;
  fullName: string;
  department?: string;
  permissions: string[];
}

interface AuthState {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User | null) => void;
  setUserData: (userData: UserData | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  userData: null,
  loading: true,

  signIn: async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      set({ user: userCredential.user });

      const usersRef = collection(db, "users");
      const q = query(usersRef, where("uid", "==", userCredential.user.uid));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data() as UserData;
        set({ userData });
      }

      toast.success("Successfully signed in!");
    } catch (error: any) {
      console.error("Sign in error:", error);
      toast.error(error.message || "Failed to sign in");
      throw error;
    }
  },

  signOut: async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const date = getCurrentDate();
        const time = getCurrentTime();
        const ref = doc(db, "attendance", `${user.uid}_${date}`);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data();
          const sessions = [...data.sessions];

          if (sessions.length > 0 && !sessions[sessions.length - 1].logout) {
            sessions[sessions.length - 1].logout = time;
            const total = calculateTotalHours(sessions);
            await updateDoc(ref, { sessions, totalHours: total });
          }
        }

        await firebaseSignOut(auth);
        set({ user: null, userData: null });
        toast.success("Successfully signed out!");
        window.location.href = "/login";
      }
    } catch (error: any) {
      console.error("Sign out error:", error);
      toast.error(error.message || "Failed to sign out");
      throw error;
    }
  },

  setUser: (user) => set({ user, loading: false }),
  setUserData: (userData) => set({ userData }),
}));

// === Auth State Listener ===
onAuthStateChanged(auth, async (user) => {
  const state = useAuthStore.getState();
  if (user) {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("uid", "==", user.uid));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const userData = snapshot.docs[0].data() as UserData;
      state.setUserData(userData);
    }
  } else {
    state.setUserData(null);
  }

  state.setUser(user);
});
