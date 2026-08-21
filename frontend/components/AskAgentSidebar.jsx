"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api";
import {
  WELCOME_MESSAGE,
  addNewChat,
  deleteChat,
  formatChatWhen,
  getActiveChat,
  loadAgentChatStore,
  saveAgentChatStore,
  setActiveChat,
  sortedChatHistory,
  updateActiveChat,
  welcomeMessage,
} from "../lib/agentChatStorage";

function IconSparkle({ className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3l1.2 3.6L17 8l-3.8 1.4L12 13l-1.2-3.6L7 8l3.8-1.4L12 3z" />
      <path d="M5 15l.7 2.1L8 18l-2.3.9L5 21l-.7-2.1L2 18l2.3-.9L5 15z" />
      <path d="M19 14l.5 1.5L21 16l-1.5.5L19 18l-.5-1.5L17 16l1.5-.5L19 14z" />
    </svg>
  );
}

function IconSend({ className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function IconHistory({ className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function IconBack({ className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function IconTrash({ className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function IconAskAgentNav({ className = "h-4 w-4" }) {
  return <IconSparkle className={className} />;
}

export default function AskAgentSidebar({ roomId, displayName, role, onClose }) {
  const [store, setStore] = useState(() => loadAgentChatStore(roomId));
  const [historyOpen, setHistoryOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const activeChat = getActiveChat(store);
  const messages = activeChat?.messages ?? [welcomeMessage()];

  useEffect(() => {
    saveAgentChatStore(roomId, store);
  }, [roomId, store]);

  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [historyOpen]);

  useEffect(() => {
    if (historyOpen) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, historyOpen]);

  const startNewChat = useCallback(() => {
    setStore((prev) => addNewChat(prev));
    setDraft("");
    setError("");
    setBusy(false);
    setHistoryOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const removeChatFromHistory = useCallback((chatId, e) => {
    e.stopPropagation();
    setStore((prev) => deleteChat(prev, chatId));
    setError("");
  }, []);

  const openChatFromHistory = useCallback((chatId) => {
    setStore((prev) => setActiveChat(prev, chatId));
    setHistoryOpen(false);
    setError("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const sendMessage = useCallback(async () => {
    const text = draft.trim();
    if (!text || busy) return;

    const userMsg = { id: `u-${Date.now()}`, role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setDraft("");
    setStore((prev) => updateActiveChat(prev, nextMessages));
    setBusy(true);
    setError("");

    const apiMessages = nextMessages
      .filter((m) => m.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await apiFetch("/api/agent/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: apiMessages,
          roomId: roomId || undefined,
          displayName: displayName || undefined,
          role: role || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Agent request failed");
      }
      setStore((prev) => {
        const current = getActiveChat(prev);
        const withReply = [
          ...(current?.messages ?? []),
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: data.reply || "(empty reply)",
          },
        ];
        return updateActiveChat(prev, withReply);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Agent request failed");
    } finally {
      setBusy(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [busy, draft, displayName, messages, role, roomId]);

  const historyItems = sortedChatHistory(store);

  return (
    <aside
      className="cq-agent-sidebar cq-sidebar flex h-full min-h-0 w-[min(21rem,calc(100vw-2rem))] shrink-0 flex-col overflow-hidden border-l border-cq-border-subtle shadow-cq"
      aria-label="Ask agent"
    >
      <div className="flex shrink-0 items-center gap-1.5 border-b border-cq-border-subtle px-3 py-2.5">
        {historyOpen ? (
          <button
            type="button"
            title="Back to chat"
            aria-label="Back to chat"
            onClick={() => setHistoryOpen(false)}
            className="cq-transition flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-cq-muted hover:bg-cq-raised"
          >
            <IconBack className="h-4 w-4" />
          </button>
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--cq-accent)] text-[var(--cq-on-accent)] shadow-cq-sm">
            <IconSparkle className="h-4 w-4" />
          </span>
        )}
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-cq-text">
          {historyOpen ? "Chat history" : "Ask agent"}
        </h2>
        {!historyOpen && (
          <>
            <button
              type="button"
              title="Chat history"
              aria-label="Chat history"
              onClick={() => setHistoryOpen(true)}
              className="cq-transition flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-cq-muted hover:border-cq-border hover:bg-cq-raised"
            >
              <IconHistory className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={startNewChat}
              className="cq-transition shrink-0 rounded-lg border border-cq-border bg-[var(--cq-card-bg-solid)] px-2.5 py-1 text-[11px] font-medium text-cq-text hover:border-cq-accent-soft hover:bg-cq-raised disabled:opacity-50"
            >
              New chat
            </button>
          </>
        )}
        <button
          type="button"
          title="Close"
          aria-label="Close ask agent"
          onClick={onClose}
          className="cq-transition flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent text-cq-muted hover:bg-cq-raised"
        >
          <span className="text-lg leading-none" aria-hidden>
            ×
          </span>
        </button>
      </div>

      {historyOpen ? (
        <div className="cq-agent-history min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 [scrollbar-width:thin]">
          {historyItems.length === 0 ? (
            <p className="px-2 py-6 text-center text-[13px] text-cq-muted">
              No chats yet. Start a conversation to see it here.
            </p>
          ) : (
            <ul className="space-y-1">
              {historyItems.map((chat) => {
                const isActive = chat.id === store.activeChatId;
                const preview =
                  chat.messages.find((m) => m.role === "user")?.content ||
                  WELCOME_MESSAGE.slice(0, 60);
                return (
                  <li key={chat.id} className="flex items-stretch gap-1">
                    <button
                      type="button"
                      onClick={() => openChatFromHistory(chat.id)}
                      className={`cq-agent-history-item cq-transition min-w-0 flex-1 rounded-xl px-3 py-2.5 text-left ${
                        isActive
                          ? "border border-cq-accent-soft bg-[color-mix(in_srgb,var(--cq-accent)_8%,transparent)]"
                          : "border border-transparent hover:border-cq-border-subtle hover:bg-cq-raised"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-cq-text">
                          {chat.title}
                        </span>
                        <span className="shrink-0 text-[10px] text-cq-muted">
                          {formatChatWhen(chat.updatedAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-cq-muted">
                        {preview}
                      </p>
                    </button>
                    <button
                      type="button"
                      title="Delete chat"
                      aria-label={`Delete chat: ${chat.title}`}
                      onClick={(e) => removeChatFromHistory(chat.id, e)}
                      className="cq-transition flex w-9 shrink-0 items-center justify-center rounded-xl border border-transparent text-cq-muted hover:border-[color-mix(in_srgb,var(--cq-danger)_35%,transparent)] hover:bg-[color-mix(in_srgb,var(--cq-danger)_8%,transparent)] hover:text-cq-danger"
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="cq-agent-messages min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 [scrollbar-width:thin]"
        >
          <div className="space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[92%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                    m.role === "user"
                      ? "bg-[var(--cq-accent)] text-[var(--cq-on-accent)]"
                      : "border border-cq-border-subtle bg-[var(--cq-card-bg-solid)] text-cq-text"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-cq-border-subtle bg-[var(--cq-card-bg-solid)] px-3.5 py-2 text-[13px] text-cq-muted">
                  Thinking…
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!historyOpen && (
        <div className="cq-agent-footer shrink-0 border-t border-cq-border-subtle bg-[var(--cq-surface-soft)] p-3">
          {error && (
            <p className="mb-2 rounded-lg border border-[color-mix(in_srgb,var(--cq-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--cq-danger)_8%,transparent)] px-2.5 py-1.5 text-[11px] text-cq-danger">
              {error}
            </p>
          )}

          <form
            className="cq-agent-composer-row"
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage();
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={draft}
              disabled={busy}
              placeholder="Ask anything…"
              aria-label="Message to agent"
              autoComplete="off"
              className="cq-agent-input min-w-0 flex-1 border-0 bg-transparent text-sm text-cq-text outline-none placeholder:text-cq-muted disabled:opacity-60"
              onChange={(e) => setDraft(e.target.value)}
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              title="Send"
              aria-label="Send message"
              className="cq-agent-send cq-transition shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconSend className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </aside>
  );
}
