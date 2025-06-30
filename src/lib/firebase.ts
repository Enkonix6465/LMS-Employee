import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  limit,
  Timestamp,
  updateDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD-ImxZuQhxOah-ZFolZQVFtFh1pncrFYw",
  authDomain: "ems-project-16b6c.firebaseapp.com",
  projectId: "ems-project-16b6c",
  storageBucket: "ems-project-16b6c.firebasestorage.app",
  messagingSenderId: "699401308840",
  appId: "1:699401308840:web:4edb6bbce4369fdbc3109d",
  measurementId: "G-9QEXS0L5CT",
};

const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  PROJECT_MANAGER: "project_manager",
  TEAM_LEAD: "team_lead",
  DEVELOPER: "developer",
  DESIGNER: "designer",
  QA: "qa",
  MARKETING: "marketing",
  SALES: "sales",
  HR: "hr",
  MEMBER: "member",
} as const;

export const DEPARTMENTS = {
  ENGINEERING: "Engineering",
  DESIGN: "Design",
  PRODUCT: "Product",
  MARKETING: "Marketing",
  SALES: "Sales",
  HR: "Human Resources",
  OPERATIONS: "Operations",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
export type Department = (typeof DEPARTMENTS)[keyof typeof DEPARTMENTS];

// Helper function to safely convert Firestore date to JS Date
const getDateFromFirestore = (date: any): Date | null => {
  if (!date) return null;
  if (date instanceof Timestamp) return date.toDate();
  if (typeof date === "string") return new Date(date);
  return null;
};

// Interfaces for dashboard data
export interface ProjectStats {
  total: number;
  active: number;
  completed: number;
  delayed: number;
}

export interface TaskStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

export interface TeamStats {
  totalMembers: number;
  activeProjects: number;
  departmentDistribution: Record<string, number>;
  roleDistribution: Record<string, number>;
}

// User management functions
export const createNewUser = async (userData: {
  email: string;
  password: string;
  fullName: string;
  role: Role;
  department?: Department;
  permissions?: string[];
}) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      userData.email,
      userData.password
    );
    const uid = userCredential.user.uid;

    const userRef = doc(db, "users", uid);
    await setDoc(userRef, {
      uid: uid,
      email: userData.email,
      fullName: userData.fullName,
      role: userData.role,
      department: userData.department || "",
      permissions:
        userData.permissions || getRoleDefaultPermissions(userData.role),
      createdAt: serverTimestamp(),
      status: "active",
    });

    return {
      id: uid,
      uid: uid,
      ...userData,
      status: "active",
    };
  } catch (error: any) {
    console.error("Error creating user:", error);
    throw new Error(error.message || "Failed to create user");
  }
};

export const updateUser = async (
  userId: string,
  userData: {
    fullName?: string;
    role?: Role;
    department?: Department;
    permissions?: string[];
    status?: string;
  }
) => {
  try {
    const userRef = doc(db, "users", userId);
    const updateData = {
      ...userData,
      updatedAt: serverTimestamp(),
    };

    if (userData.role && !userData.permissions) {
      updateData.permissions = getRoleDefaultPermissions(userData.role);
    }

    await updateDoc(userRef, updateData);
    return { id: userId, ...updateData };
  } catch (error: any) {
    console.error("Error updating user:", error);
    throw new Error(error.message || "Failed to update user");
  }
};

export const deleteUser = async (userId: string) => {
  try {
    const userRef = doc(db, "users", userId);
    await deleteDoc(userRef);
    return true;
  } catch (error: any) {
    console.error("Error deleting user:", error);
    throw new Error(error.message || "Failed to delete user");
  }
};

export const getUsers = async () => {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
    }));
  } catch (error: any) {
    console.error("Error fetching users:", error);
    throw new Error(error.message || "Failed to fetch users");
  }
};

export const getUsersByRole = async (role: Role) => {
  try {
    const usersRef = collection(db, "users");
    const q = query(
      usersRef,
      where("role", "==", role),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
    }));
  } catch (error: any) {
    console.error("Error fetching users by role:", error);
    throw new Error(error.message || "Failed to fetch users");
  }
};

// Dashboard data functions
export const getProjectStats = async (): Promise<ProjectStats> => {
  try {
    const projectsRef = collection(db, "projects");
    const [totalQ, activeQ, completedQ, delayedQ] = await Promise.all([
      getDocs(query(projectsRef)),
      getDocs(query(projectsRef, where("status", "==", "active"))),
      getDocs(query(projectsRef, where("status", "==", "completed"))),
      getDocs(query(projectsRef, where("status", "==", "delayed"))),
    ]);

    return {
      total: totalQ.size,
      active: activeQ.size,
      completed: completedQ.size,
      delayed: delayedQ.size,
    };
  } catch (error) {
    console.error("Error fetching project stats:", error);
    throw error;
  }
};

export const getTaskStats = async (): Promise<TaskStats> => {
  try {
    const tasksRef = collection(db, "tasks");
    const now = new Date();

    const allTasksSnapshot = await getDocs(tasksRef);
    const allTasks = allTasksSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const stats = {
      total: allTasks.length,
      pending: 0,
      inProgress: 0,
      completed: 0,
      overdue: 0,
    };

    allTasks.forEach((task) => {
      switch (task.status) {
        case "pending":
          stats.pending++;
          break;
        case "in_progress":
          stats.inProgress++;
          break;
        case "completed":
          stats.completed++;
          break;
      }

      const dueDate = getDateFromFirestore(task.due_date);
      if (dueDate && dueDate < now && task.status !== "completed") {
        stats.overdue++;
      }
    });

    return stats;
  } catch (error) {
    console.error("Error fetching task stats:", error);
    throw error;
  }
};

export const getTeamStats = async (): Promise<TeamStats> => {
  try {
    const usersRef = collection(db, "users");
    const usersSnapshot = await getDocs(usersRef);

    const departmentDistribution: Record<string, number> = {};
    const roleDistribution: Record<string, number> = {};
    let activeProjectsCount = 0;

    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      if (userData.department) {
        departmentDistribution[userData.department] =
          (departmentDistribution[userData.department] || 0) + 1;
      }
      if (userData.role) {
        roleDistribution[userData.role] =
          (roleDistribution[userData.role] || 0) + 1;
      }
      if (userData.activeProjects) {
        activeProjectsCount += userData.activeProjects;
      }
    });

    return {
      totalMembers: usersSnapshot.size,
      activeProjects: activeProjectsCount,
      departmentDistribution,
      roleDistribution,
    };
  } catch (error) {
    console.error("Error fetching team stats:", error);
    throw error;
  }
};

export const getRecentActivity = async () => {
  try {
    const logsRef = collection(db, "activity_logs");
    const q = query(logsRef, orderBy("created_at", "desc"), limit(10));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      created_at: doc.data().created_at?.toDate?.()?.toISOString() || null,
    }));
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    throw error;
  }
};

// Helper function for default permissions
function getRoleDefaultPermissions(role: Role): string[] {
  switch (role) {
    case ROLES.SUPER_ADMIN:
      return ["all"];
    case ROLES.ADMIN:
      return [
        "manage_users",
        "manage_projects",
        "manage_settings",
        "view_reports",
      ];
    case ROLES.PROJECT_MANAGER:
      return ["manage_projects", "assign_tasks", "view_reports"];
    case ROLES.TEAM_LEAD:
      return ["manage_team", "assign_tasks", "view_team_reports"];
    case ROLES.DEVELOPER:
    case ROLES.DESIGNER:
    case ROLES.QA:
      return ["view_projects", "manage_tasks"];
    case ROLES.MARKETING:
    case ROLES.SALES:
      return ["view_projects", "manage_campaigns"];
    case ROLES.HR:
      return ["view_users", "manage_profiles"];
    default:
      return ["view_assigned"];
  }
}
