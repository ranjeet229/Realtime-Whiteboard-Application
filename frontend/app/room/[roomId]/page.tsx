"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";

const Whiteboard = dynamic(() => import("../../../components/Whiteboard"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950">
      <div className="h-10 w-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
    </div>
  ),
});

type Session = { roomToken: string; role: string; displayName: string };

function sessionKey(roomId: string) {
  return `cq_room_${roomId}`;
}

export default function RoomPage() {
  const params = useParams();
  const roomId = params?.roomId as string;
  const [session, setSession] = useState<Session | null>(null);
  const [gateError, setGateError] = useState("");
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [joinRole, setJoinRole] = useState<"editor" | "viewer">("editor");

  useEffect(() => {
    if (!roomId) return;
    try {
      const raw = sessionStorage.getItem(sessionKey(roomId));
      if (raw) setSession(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, [roomId]);

  const persistSession = useCallback(
    (s: Session) => {
      sessionStorage.setItem(sessionKey(roomId), JSON.stringify(s));
      setSession(s);
    },
    [roomId]
  );

  const joinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setGateError("");
    const trimmed = displayName.trim();
    if (!trimmed) {
      setGateError("Enter your name to join.");
      return;
    }
    if (trimmed.length > 48) {
      setGateError("Name must be 48 characters or fewer.");
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
        body: JSON.stringify({
          password: password || undefined,
          displayName: trimmed,
          role: joinRole,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not join room");
      persistSession({
        roomToken: data.roomToken,
        role: data.role,
        displayName: trimmed,
      });
    } catch (err: unknown) {
      setGateError(err instanceof Error ? err.message : "Join failed");
    } finally {
      setBusy(false);
    }
  };

  if (!roomId) return null;

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200 dark:from-slate-950 dark:to-slate-900 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-xl p-8">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">
            Join room
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-mono break-all">
            {roomId}
          </p>
          <form className="space-y-4" onSubmit={joinRoom}>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Your name <span className="text-red-500">*</span>
              </label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                minLength={1}
                maxLength={48}
                autoComplete="name"
                placeholder="Your name"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                suppressHydrationWarning
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Room password (if the host set one)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                suppressHydrationWarning
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Role
              </label>
              <select
                value={joinRole}
                onChange={(e) => setJoinRole(e.target.value as "editor" | "viewer")}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white"
                suppressHydrationWarning
              >
                <option value="editor">Editor (draw)</option>
                <option value="viewer">Viewer (read-only)</option>
              </select>
            </div>
            {gateError && (
              <p className="text-sm text-red-600 dark:text-red-400">{gateError}</p>
            )}
            <button
              type="submit"
              disabled={busy || !displayName.trim()}
              suppressHydrationWarning
              className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium py-2.5"
            >
              {busy ? "Joining…" : "Enter room"}
            </button>
          </form>
          <p className="mt-6 text-center">
            <Link href="/" className="text-sm text-slate-500 hover:underline">
              ← Home
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <Whiteboard
      roomId={roomId}
      roomToken={session.roomToken}
      role={session.role}
      displayName={session.displayName}
      canDraw={session.role !== "viewer"}
    />
  );
}
