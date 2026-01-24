import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  selectedUser: null,
  isMessagesLoading: false,
  users: [],
  isUsersLoading: false,

  // ======================
  // USERS (SIDEBAR)
  // ======================
  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (err) {
      console.error(err);
      toast.error("Failed to load users");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  // ======================
  // SELECT USER
  // ======================
  setSelectedUser: (user) => {
    set({ selectedUser: user, messages: [] });

    // Always clean old socket listeners
    get().unsubscribeFromMessages();

    // 🤖 BOT → load local messages only
    if (user.isBot) {
      set({ messages: user.messages || [] });
      return;
    }

    // 👤 REAL USER → backend + socket
    get().subscribeToMessages();
    get().getMessages(user._id);
  },

  // ======================
  // GET MESSAGES
  // ======================
  getMessages: async (receiverId) => {
    // 🚫 Never hit backend for bots
    if (!receiverId || receiverId.startsWith("bot_")) return;

    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${receiverId}`);
      set({ messages: res.data || [] });
    } catch (err) {
      console.error("getMessages error:", err);
      toast.error("Failed to load messages");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  // ======================
  // SEND MESSAGE
  // ======================
  sendMessage: async (text, image = null) => {
    const { selectedUser, messages } = get();
    const { socket } = useAuthStore.getState();

    if (!selectedUser) return toast.error("No user selected");
    if (!text && !image) return toast.error("Message is empty");

    // 🤖 BOT MESSAGE (frontend-only)
    if (selectedUser.isBot) {
      const userMessage = {
        _id: Date.now().toString(),
        senderId: "me",
        receiverId: selectedUser._id,
        text,
        image,
        createdAt: new Date(),
      };

      set({ messages: [...messages, userMessage] });

      // Fake bot reply
      setTimeout(() => {
        const botReply = {
          _id: (Date.now() + 1).toString(),
          senderId: selectedUser._id,
          receiverId: "me",
          text: "🤖 Interesting! Tell me more.",
          createdAt: new Date(),
        };

        set((state) => ({
          messages: [...state.messages, botReply],
        }));
      }, 800);

      return;
    }

    // 👤 REAL USER MESSAGE (backend)
    if (!socket) return toast.error("Socket not initialized");

    try {
      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        { text, image },
      );

      get().addMessage(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to send message");
    }
  },

  // ======================
  // ADD MESSAGE (SAFE)
  // ======================
  addMessage: (msg) => {
    set((state) => {
      if (state.messages.some((m) => m._id === msg._id)) return state;
      return { messages: [...state.messages, msg] };
    });
  },

  // ======================
  // SOCKET SUBSCRIBE
  // ======================
  subscribeToMessages: () => {
    const { socket } = useAuthStore.getState();
    if (!socket) return;

    socket.off("receiveMessage");
    socket.on("receiveMessage", (msg) => {
      const selectedUser = get().selectedUser;
      if (!selectedUser) return;

      if (
        msg.senderId === selectedUser._id ||
        msg.receiverId === selectedUser._id
      ) {
        get().addMessage(msg);
      }
    });
  },

  // ======================
  // SOCKET UNSUBSCRIBE
  // ======================
  unsubscribeFromMessages: () => {
    const { socket } = useAuthStore.getState();
    if (!socket) return;
    socket.off("receiveMessage");
  },
}));
