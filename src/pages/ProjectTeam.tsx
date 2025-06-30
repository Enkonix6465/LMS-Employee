import React, { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { Pencil, Trash2 } from "lucide-react";

// Basic UI Components
const Input = (props) => (
  <input {...props} className="border px-3 py-2 rounded w-full" />
);
const Textarea = (props) => (
  <textarea {...props} className="border px-3 py-2 rounded w-full" />
);
const Button = ({ children, className = "", ...props }) => (
  <button
    {...props}
    className={`bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 ${className}`}
  >
    {children}
  </button>
);

export default function TeamManager() {
  const [employees, setEmployees] = useState([]);
  const [teams, setTeams] = useState([]);
  const [search, setSearch] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const empSnap = await getDocs(collection(db, "employees"));
      setEmployees(empSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      refreshTeams();
    };

    fetchData();
  }, []);

  const refreshTeams = async () => {
    const teamSnap = await getDocs(collection(db, "teams"));
    setTeams(teamSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  const handleCreateOrUpdate = async () => {
    const payload = {
      teamName,
      description: teamDescription,
      members: selectedMembers,
    };

    if (editId) {
      await updateDoc(doc(db, "teams", editId), payload);
    } else {
      const teamRef = doc(collection(db, "teams"));
      await setDoc(teamRef, payload);
    }

    resetForm();
    refreshTeams();
  };

  const resetForm = () => {
    setTeamName("");
    setTeamDescription("");
    setSelectedMembers([]);
    setEditId(null);
    setSearch("");
  };

  const handleEdit = (team) => {
    setTeamName(team.teamName);
    setTeamDescription(team.description || "");
    setSelectedMembers(team.members || []);
    setEditId(team.id);
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, "teams", id));
    refreshTeams();
  };

  const toggleMember = (id) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((mid) => mid !== id) : [...prev, id]
    );
  };

  const filteredEmployees = employees.filter((emp) =>
    emp.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-center">Team Manager</h2>

      {/* Team Form */}
      <div className="bg-white shadow rounded p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold mb-1">Team Name</label>
            <Input
              placeholder="Team name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Description</label>
            <Textarea
              placeholder="Team description"
              value={teamDescription}
              onChange={(e) => setTeamDescription(e.target.value)}
            />
          </div>
        </div>

        {/* Search + Scrollable List */}
        <div className="mt-6">
          <label className="block font-semibold mb-2">
            Search & Select Members
          </label>
          <Input
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="mt-3 border rounded max-h-[250px] overflow-y-auto divide-y">
            {filteredEmployees.map((emp) => {
              const isSelected = selectedMembers.includes(emp.id);
              return (
                <div
                  key={emp.id}
                  onClick={() => toggleMember(emp.id)}
                  className={`p-2 cursor-pointer hover:bg-blue-50 flex justify-between items-center ${
                    isSelected ? "bg-blue-100 font-semibold text-blue-700" : ""
                  }`}
                >
                  <div>
                    {emp.name}
                    <span className="text-sm text-gray-500 ml-2">
                      ({emp.title})
                    </span>
                  </div>
                  {isSelected && (
                    <span className="text-xs bg-blue-200 px-2 py-1 rounded">
                      Selected
                    </span>
                  )}
                </div>
              );
            })}
            {filteredEmployees.length === 0 && (
              <div className="text-gray-500 text-center py-3">
                No employees found.
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <Button onClick={handleCreateOrUpdate}>
            {editId ? "Update Team" : "Create Team"}
          </Button>
          {editId && (
            <Button
              onClick={resetForm}
              className="ml-2 bg-gray-600 hover:bg-gray-700"
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Team List */}
      <h3 className="text-xl font-semibold mb-3">Teams</h3>
      <div className="overflow-auto bg-white shadow rounded">
        <table className="w-full table-auto text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left px-4 py-2">Team</th>
              <th className="text-left px-4 py-2">Description</th>
              <th className="text-left px-4 py-2">Members</th>
              <th className="text-left px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <tr key={team.id} className="border-t">
                <td className="px-4 py-2 font-medium">{team.teamName}</td>
                <td className="px-4 py-2">{team.description}</td>
                <td className="px-4 py-2">
                  {team.members
                    ?.map((id) => {
                      const emp = employees.find((e) => e.id === id);
                      return emp ? emp.name : id;
                    })
                    .join(", ")}
                </td>
                <td className="px-4 py-2 space-x-2">
                  <Button onClick={() => handleEdit(team)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => handleDelete(team.id)}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {teams.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-gray-500 py-4">
                  No teams created yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
