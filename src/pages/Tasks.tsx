// Updated Task Manager: Show task form only on project click
import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuthStore } from "../store/authStore";
import toast from "react-hot-toast";

function Projects() {
  const [taskForms, setTaskForms] = useState<{
    [projectId: string]: {
      title: string;
      description: string;
      dueDate: string;
      assignToAll: boolean;
      assignToMember: string;
    };
  }>({});
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<{
    [key: string]: string[];
  }>({});
  const [projectTasks, setProjectTasks] = useState<{
    [projectId: string]: any[];
  }>({});
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const { data: teams = [] } = useQuery("teams", async () => {
    const snap = await getDocs(collection(db, "teams"));
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  });

  const { data: projects = [] } = useQuery("projects", async () => {
    const q = query(
      collection(db, "projects"),
      where("created_by", "==", user?.uid)
    );
    const snap = await getDocs(q);
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  });

  const { data: employees = [] } = useQuery("employees", async () => {
    const snap = await getDocs(collection(db, "employees"));
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  });

  const getEmployeeName = (id: string) =>
    employees.find((e: any) => e.id === id)?.name || id;

  const createTask = useMutation(
    async (taskData: any) => {
      await addDoc(collection(db, "tasks"), taskData);
    },
    {
      onSuccess: () => toast.success("Task(s) assigned successfully"),
      onError: () => toast.error("Failed to assign task"),
    }
  );

  const updateStatus = useMutation(
    async ({ id, status }: { id: string; status: string }) => {
      await updateDoc(doc(db, "tasks", id), { status });
    },
    {
      onSuccess: () => toast.success("Task updated"),
      onError: () => toast.error("Failed to update task"),
    }
  );

  const getProjectTasks = async (projectId: string) => {
    const q = query(
      collection(db, "tasks"),
      where("project_id", "==", projectId)
    );
    const snap = await getDocs(q);
    setProjectTasks((prev) => ({
      ...prev,
      [projectId]: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    }));
  };

  const getTaskForm = (projectId: string) => {
    return (
      taskForms[projectId] || {
        title: "",
        description: "",
        dueDate: "",
        assignToAll: false,
        assignToMember: "",
      }
    );
  };

  const updateTaskForm = (projectId: string, field: string, value: any) => {
    setTaskForms((prev) => ({
      ...prev,
      [projectId]: {
        ...getTaskForm(projectId),
        [field]: value,
      },
    }));
  };

  const handleAssignTask = async (projectId: string, teamId: string) => {
    const form = getTaskForm(projectId);
    if (!form.title || !form.dueDate)
      return toast.error("Title and Due Date required");

    let members: string[] = selectedTeamMembers[teamId];
    if (!members) {
      const teamDoc = await getDoc(doc(db, "teams", teamId));
      const data = teamDoc.data();
      members = data?.members || [];
      setSelectedTeamMembers((prev) => ({ ...prev, [teamId]: members }));
    }

    const commonTask = {
      title: form.title,
      description: form.description,
      due_date: form.dueDate,
      project_id: projectId,
      created_by: user?.uid,
      created_at: serverTimestamp(),
      status: "pending",
    };

    if (form.assignToAll) {
      members.forEach((memberId) => {
        createTask.mutate({ ...commonTask, assigned_to: memberId });
      });
    } else if (form.assignToMember) {
      createTask.mutate({ ...commonTask, assigned_to: form.assignToMember });
    } else {
      toast.error("Select member or choose assign to all");
    }

    setTaskForms((prev) => ({
      ...prev,
      [projectId]: {
        title: "",
        description: "",
        dueDate: "",
        assignToAll: false,
        assignToMember: "",
      },
    }));

    getProjectTasks(projectId);
  };

  return (
    <div className="p-4 space-y-6">
      {teams.map((team) => {
        const teamProjects = projects.filter((p) => p.teamId === team.id);
        return (
          <div key={team.id} className="border rounded-lg p-4 bg-white shadow">
            <h2 className="text-xl font-semibold mb-2">
              Team: {team.teamName}
            </h2>
            <p className="text-sm text-gray-500 mb-3">
              Members: {team.members.map(getEmployeeName).join(", ")}
            </p>
            {teamProjects.map((project) => {
              const form = getTaskForm(project.id);
              const tasks = projectTasks[project.id] || [];
              useEffect(() => {
                getProjectTasks(project.id);
              }, []);
              return (
                <div key={project.id} className="mb-6 border-t pt-4">
                  <h3
                    className="text-lg font-semibold cursor-pointer hover:underline"
                    onClick={() =>
                      setExpandedProject((p) =>
                        p === project.id ? null : project.id
                      )
                    }
                  >
                    {project.name}
                  </h3>
                  <p className="text-sm text-gray-500">{project.description}</p>
                  {expandedProject === project.id && (
                    <div className="mt-3 grid gap-2">
                      <input
                        placeholder="Task Title"
                        value={form.title}
                        onChange={(e) =>
                          updateTaskForm(project.id, "title", e.target.value)
                        }
                        className="border p-2 rounded"
                      />
                      <textarea
                        placeholder="Task Description"
                        value={form.description}
                        onChange={(e) =>
                          updateTaskForm(
                            project.id,
                            "description",
                            e.target.value
                          )
                        }
                        className="border p-2 rounded"
                      />
                      <input
                        type="date"
                        value={form.dueDate}
                        onChange={(e) =>
                          updateTaskForm(project.id, "dueDate", e.target.value)
                        }
                        className="border p-2 rounded"
                      />
                      <label className="flex gap-2 items-center">
                        <input
                          type="checkbox"
                          checked={form.assignToAll}
                          onChange={() =>
                            updateTaskForm(
                              project.id,
                              "assignToAll",
                              !form.assignToAll
                            )
                          }
                        />
                        Assign to all
                      </label>
                      {!form.assignToAll && (
                        <select
                          value={form.assignToMember}
                          onChange={(e) =>
                            updateTaskForm(
                              project.id,
                              "assignToMember",
                              e.target.value
                            )
                          }
                          className="border p-2 rounded"
                        >
                          <option value="">Select Member</option>
                          {team.members.map((id) => (
                            <option key={id} value={id}>
                              {getEmployeeName(id)}
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        onClick={() => handleAssignTask(project.id, team.id)}
                        className="bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                      >
                        Assign Task
                      </button>
                    </div>
                  )}
                  {/* Assigned Tasks List */}
                  {tasks.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold">Assigned Tasks</h4>
                      <ul className="space-y-2 text-sm">
                        {tasks.map((task) => (
                          <li
                            key={task.id}
                            className="border p-2 rounded bg-gray-50 flex justify-between items-center"
                          >
                            <div>
                              <strong>{task.title}</strong> -{" "}
                              {getEmployeeName(task.assigned_to)}
                              <div className="text-xs text-gray-500">
                                Due: {task.due_date}
                              </div>
                            </div>
                            <select
                              value={task.status}
                              onChange={(e) =>
                                updateStatus.mutate({
                                  id: task.id,
                                  status: e.target.value,
                                })
                              }
                              className="text-sm border rounded px-1"
                            >
                              <option value="pending">Pending</option>
                              <option value="in_progress">In Progress</option>
                              <option value="completed">Completed</option>
                              <option value="overdue">Overdue</option>
                            </select>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export default Projects;
