const WELCOME_MESSAGE = "How can I help you today?";

export { WELCOME_MESSAGE };

export function welcomeMessage() {
  return { id: "welcome", role: "assistant", content: WELCOME_MESSAGE };
}

function storageKey(roomId) {
  return `cq-agent-chats:${roomId || "default"}`;
}

function deriveTitle(messages) {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser?.content?.trim()) return "New chat";
  const text = firstUser.content.trim();
  return text.length > 48 ? `${text.slice(0, 48)}…` : text;
}

export function createChatSession() {
  const now = Date.now();
  return {
    id: `chat-${now}-${Math.random().toString(36).slice(2, 8)}`,
    title: "New chat",
    messages: [welcomeMessage()],
    createdAt: now,
    updatedAt: now,
  };
}

export function loadAgentChatStore(roomId) {
  if (typeof window === "undefined") {
    const chat = createChatSession();
    return { activeChatId: chat.id, chats: [chat] };
  }
  try {
    const raw = localStorage.getItem(storageKey(roomId));
    if (!raw) {
      const chat = createChatSession();
      return { activeChatId: chat.id, chats: [chat] };
    }
    const parsed = JSON.parse(raw);
    if (!parsed?.activeChatId || !Array.isArray(parsed.chats) || !parsed.chats.length) {
      const chat = createChatSession();
      return { activeChatId: chat.id, chats: [chat] };
    }
    return parsed;
  } catch {
    const chat = createChatSession();
    return { activeChatId: chat.id, chats: [chat] };
  }
}

export function saveAgentChatStore(roomId, store) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(roomId), JSON.stringify(store));
  } catch {
    /* quota or private mode */
  }
}

export function getActiveChat(store) {
  return store.chats.find((c) => c.id === store.activeChatId) || store.chats[0];
}

export function updateActiveChat(store, messages) {
  const now = Date.now();
  const title = deriveTitle(messages);
  const chats = store.chats.map((c) =>
    c.id === store.activeChatId
      ? { ...c, messages, title, updatedAt: now }
      : c
  );
  return { ...store, chats };
}

export function setActiveChat(store, chatId) {
  if (!store.chats.some((c) => c.id === chatId)) return store;
  return { ...store, activeChatId: chatId };
}

export function addNewChat(store) {
  const chat = createChatSession();
  return {
    activeChatId: chat.id,
    chats: [chat, ...store.chats],
  };
}

export function deleteChat(store, chatId) {
  const remaining = store.chats.filter((c) => c.id !== chatId);
  if (!remaining.length) {
    const chat = createChatSession();
    return { activeChatId: chat.id, chats: [chat] };
  }
  return {
    activeChatId:
      store.activeChatId === chatId ? remaining[0].id : store.activeChatId,
    chats: remaining,
  };
}

export function sortedChatHistory(store) {
  return [...store.chats].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function formatChatWhen(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
