// Enhanced ChatPage with sidebar for global, private, and group chats + group creation
import React, { useEffect, useState, useRef } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDoc,
  where,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { getAuth } from "firebase/auth";
import { v4 as uuidv4 } from "uuid";
import {
  Search,
  Users,
  Globe,
  MessageCircle,
  Trash2,
  Edit2,
  Plus,
} from "lucide-react";

interface Employee {
  id: string;
  name: string;
  online?: boolean;
}

interface GroupChatMeta {
  id: string;
  members: string[];
  name: string;
}

function formatTimestamp(timestamp: any): string {
  if (!timestamp?.toDate) return "";
  const date = timestamp.toDate();
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatPage() {
  const auth = getAuth();
  const user = auth.currentUser;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [chatMode, setChatMode] = useState<"global" | "private" | "group">(
    "global"
  );
  const [chatId, setChatId] = useState<string>("globalRoom");
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [currentUserName, setCurrentUserName] = useState("You");
  const [activeChatName, setActiveChatName] = useState("Global Chat");
  const [userGroups, setUserGroups] = useState<GroupChatMeta[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  useEffect(() => {
    const loadEmployees = async () => {
      const snapshot = await getDocs(collection(db, "employees"));
      const list = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Employee)
      );
      setEmployees(list.filter((e) => e.id !== user?.uid));
      const currentUser = list.find((e) => e.id === user?.uid);
      setCurrentUserName(currentUser?.name || user?.displayName || "You");
    };
    loadEmployees();
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "groupChatsMeta"),
      where("members", "array-contains", user.uid)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const groups = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as GroupChatMeta)
      );
      setUserGroups(groups);
    });
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    if (!chatId) return;
    const base =
      chatMode === "global"
        ? `globalChats/${chatId}`
        : chatMode === "private"
        ? `privateChats/${chatId}`
        : `groupChats/${chatId}`;
    const q = query(collection(db, `${base}/messages`), orderBy("timestamp"));
    const unsub = onSnapshot(q, (snap) => {
      const msgList = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMessages(msgList);
      const unread = msgList.filter(
        (msg) => !msg.readBy?.includes(user?.uid)
      ).length;
      setUnreadCounts((prev) => ({ ...prev, [chatId]: unread }));
    });
    return () => unsub();
  }, [chatId]);

  const clearChatHistory = async () => {
    const base =
      chatMode === "global"
        ? `globalChats/${chatId}`
        : chatMode === "private"
        ? `privateChats/${chatId}`
        : `groupChats/${chatId}`;
    const snap = await getDocs(collection(db, `${base}/messages`));
    const batchDelete = snap.docs.map((docSnap) =>
      deleteDoc(doc(db, `${base}/messages/${docSnap.id}`))
    );
    await Promise.all(batchDelete);
    alert("Chat history cleared.");
  };

  const handleChatSwitch = (
    mode: "global" | "private" | "group",
    id: string,
    name: string
  ) => {
    setChatId(id);
    setChatMode(mode);
    setActiveChatName(name);
    setUnreadCounts((prev) => ({ ...prev, [id]: 0 }));
  };

  const sendMessage = async () => {
    if (!newMsg.trim()) return;
    const base =
      chatMode === "global"
        ? `globalChats/${chatId}`
        : chatMode === "private"
        ? `privateChats/${chatId}`
        : `groupChats/${chatId}`;
    await addDoc(collection(db, `${base}/messages`), {
      text: newMsg,
      sender: user?.uid,
      senderName: currentUserName,
      timestamp: serverTimestamp(),
      readBy: [user?.uid],
    });
    setNewMsg("");
  };

  const deleteMessage = async (msgId: string) => {
    const base =
      chatMode === "global"
        ? `globalChats/${chatId}`
        : chatMode === "private"
        ? `privateChats/${chatId}`
        : `groupChats/${chatId}`;
    await deleteDoc(doc(db, `${base}/messages/${msgId}`));
  };

  const updateMessage = async (msgId: string) => {
    const base =
      chatMode === "global"
        ? `globalChats/${chatId}`
        : chatMode === "private"
        ? `privateChats/${chatId}`
        : `groupChats/${chatId}`;
    await updateDoc(doc(db, `${base}/messages/${msgId}`), {
      text: editingText,
    });
    setEditingId(null);
    setEditingText("");
  };

  const createGroup = async () => {
    if (!groupName.trim() || selectedMembers.length === 0) return;
    const id = uuidv4();
    const groupData = {
      name: groupName,
      members: [...selectedMembers, user?.uid],
    };
    await setDoc(doc(db, "groupChatsMeta", id), groupData);
    setGroupName("");
    setSelectedMembers([]);
    setShowGroupForm(false);
  };

  const toggleMemberSelection = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const filteredEmployees = employees.filter((emp) =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredGroups = userGroups.filter((grp) =>
    grp.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      {/* Sidebar */}
      <div className="w-full md:w-1/4 p-4 border-r border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 transition-all duration-300">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Chats</h2>
          <button
            onClick={() => setShowGroupForm((prev) => !prev)}
            className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Group
          </button>
        </div>

        {showGroupForm && (
          <div className="mb-4 border border-gray-300 dark:border-gray-600 p-3 rounded bg-gray-50 dark:bg-gray-700">
            <input
              placeholder="Group Name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 px-2 py-1 mb-2 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <div className="max-h-40 overflow-y-auto space-y-1 text-sm">
              {employees.map((emp) => (
                <label key={emp.id} className="block">
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(emp.id)}
                    onChange={() => toggleMemberSelection(emp.id)}
                    className="mr-2"
                  />
                  {emp.name}
                </label>
              ))}
            </div>
            <button
              onClick={createGroup}
              className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white py-1 rounded transition"
            >
              Create Group
            </button>
          </div>
        )}

        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 mb-4 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />

        <button
          onClick={() =>
            handleChatSwitch("global", "globalRoom", "Global Chat")
          }
          className="flex items-center gap-2 w-full py-2 px-3 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        >
          <Globe className="w-4 h-4" /> Global Chat
          {unreadCounts["globalRoom"] > 0 && (
            <span className="ml-auto text-xs text-red-500 font-bold">🔴</span>
          )}
        </button>

        <p className="mt-4 font-medium">Private Chats</p>
        <div className="max-h-60 overflow-y-auto space-y-1">
          {filteredEmployees.map((emp) => (
            <button
              key={emp.id}
              onClick={() =>
                handleChatSwitch(
                  "private",
                  [user?.uid, emp.id].sort().join("_"),
                  emp.name
                )
              }
              className="flex items-center gap-2 w-full py-2 px-3 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              <Users className="w-4 h-4" /> {emp.name}
              {unreadCounts[[user?.uid, emp.id].sort().join("_")] > 0 && (
                <span className="ml-auto text-xs text-red-500 font-bold">
                  🔴
                </span>
              )}
            </button>
          ))}
        </div>

        <p className="mt-4 font-medium">Group Chats</p>
        <div className="max-h-60 overflow-y-auto space-y-1">
          {filteredGroups.map((grp) => (
            <button
              key={grp.id}
              onClick={() => handleChatSwitch("group", grp.id, grp.name)}
              className="flex items-center gap-2 w-full py-2 px-3 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              <MessageCircle className="w-4 h-4" /> {grp.name}
              {unreadCounts[grp.id] > 0 && (
                <span className="ml-auto text-xs text-red-500 font-bold">
                  🔴
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chat UI */}
      <div className="flex-1 p-4 flex flex-col bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
        <h2 className="text-xl font-semibold mb-3 text-center">
          💬 {activeChatName}
        </h2>
        <div className="flex-1 overflow-y-auto px-2 space-y-2">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`relative p-3 rounded max-w-xs animate-fade-in transition-all ${
                msg.sender === user?.uid
                  ? "ml-auto bg-blue-200 dark:bg-blue-700 text-right"
                  : "mr-auto bg-green-200 dark:bg-green-700 text-left"
              }`}
            >
              <div className="text-sm font-semibold">{msg.senderName}</div>
              {editingId === msg.id ? (
                <div>
                  <input
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    className="border rounded px-2 py-1 w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                  <button
                    onClick={() => updateMessage(msg.id)}
                    className="text-sm text-blue-600 dark:text-blue-300 mt-1"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div>
                  <div>{msg.text}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    {formatTimestamp(msg.timestamp)}
                  </div>
                  {msg.sender === user?.uid && (
                    <div className="flex justify-end gap-2 mt-1">
                      <button
                        onClick={() => {
                          setEditingId(msg.id);
                          setEditingText(msg.text);
                        }}
                      >
                        <Edit2 className="w-4 h-4 text-blue-500" />
                      </button>
                      <button onClick={() => deleteMessage(msg.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && newMsg.trim() && sendMessage()
            }
            placeholder="Type a message..."
            className="flex-1 border px-3 py-2 rounded shadow bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          <button
            onClick={sendMessage}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow transition"
          >
            Send
          </button>
        </div>

        <div className="text-right mt-2">
          <button
            onClick={clearChatHistory}
            className="text-red-600 dark:text-red-400 text-sm underline"
          >
            Clear Chat History
          </button>
        </div>
      </div>
    </div>
  );
}
