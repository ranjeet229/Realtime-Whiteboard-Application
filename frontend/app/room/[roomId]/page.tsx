"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";

const Whiteboard = dynamic(
  () =>
    import("../../../components/Whiteboard").then((m) => {
      const C = m.default;
      if (typeof C !== "function") {
        return {
          default: function WhiteboardLoadError() {
            return (
              <div className="cq-shell flex min-h-screen items-center justify-center p-4 text-center text-sm text-cq-danger">
                Could not load the whiteboard. Try a hard refresh or clear the site cache.
              </div>
            );
          },
        };
      }
      return { default: C };
    }),
  {
    ssr: false,
    loading: () => (
      <div className="cq-shell flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-cq-accent border-t-transparent" />
      </div>
    ),
  }
);

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
      <div className="cq-shell flex min-h-screen flex-col items-center justify-center px-4">
        <div className="cq-card w-full max-w-md p-8 md:p-9">
          <h1 className="mb-1 text-xl font-semibold text-cq-text">Join room</h1>
          <p className="mb-7 font-mono text-sm break-all text-cq-muted">{roomId}</p>
          <form className="space-y-4" onSubmit={joinRoom}>
            <div>
              <label className="cq-label">
                Your name <span className="text-cq-danger">*</span>
              </label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                minLength={1}
                maxLength={48}
                autoComplete="name"
                placeholder="Your name"
                className="cq-input cq-transition"
                suppressHydrationWarning
              />
            </div>
            <div>
              <label className="cq-label">Room password (if the host set one)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="cq-input cq-transition"
                suppressHydrationWarning
              />
            </div>
            <div>
              <label className="cq-label">Role</label>
              <select
                value={joinRole}
                onChange={(e) => setJoinRole(e.target.value as "editor" | "viewer")}
                className="cq-input cq-transition cursor-pointer"
                suppressHydrationWarning
              >
                <option value="editor">Editor (draw)</option>
                <option value="viewer">Viewer (read-only)</option>
              </select>
            </div>
            {gateError && <p className="text-sm text-cq-danger">{gateError}</p>}
            <button
              type="submit"
              disabled={busy || !displayName.trim()}
              suppressHydrationWarning
              className="cq-btn-primary cq-transition py-2.5 disabled:opacity-60"
            >
              {busy ? "Joining…" : "Enter room"}
            </button>
          </form>
          <p className="mt-7 text-center">
            <Link href="/" className="cq-transition text-sm text-cq-accent hover:text-cq-accent-hover hover:underline">
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
