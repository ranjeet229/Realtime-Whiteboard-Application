"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api";
import { ThemeToggleButton } from "../components/ThemeToggleButton";

export default function LandingPage() {
  const router = useRouter();
  const [roomInput, setRoomInput] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [hostName, setHostName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [nameFieldError, setNameFieldError] = useState("");
  const createRoomCardRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!nameFieldError) return undefined;
    const onPointerDown = (e: MouseEvent) => {
      const el = createRoomCardRef.current;
      if (!el || el.contains(e.target as Node)) return;
      setNameFieldError("");
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [nameFieldError]);

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    setNameFieldError("");
    const trimmed = hostName.trim();
    if (!trimmed) {
      setNameFieldError("this field cannot be empty");
      return;
    }
    if (trimmed.length > 48) {
      setMsg("Name must be 48 characters or fewer.");
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch("/api/rooms", {
        method: "POST",
        body: JSON.stringify({
          password: createPassword || undefined,
          title: "New board",
          displayName: trimmed,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not create room");
      sessionStorage.setItem(
        `cq_room_${data.roomId}`,
        JSON.stringify({
          roomToken: data.roomToken,
          role: "host",
          displayName: trimmed,
        })
      );
      router.push(`/room/${data.roomId}`);
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const goJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const id = roomInput.trim();
    if (!id) return;
    router.push(`/room/${id}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100">
      <header className="w-full border-b border-slate-200/80 dark:border-slate-800/80 backdrop-blur bg-white/70 dark:bg-slate-950/70 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white text-sm font-bold shadow-lg shadow-indigo-500/30">
              CQ
            </span>
            <span>CanvasQuill</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <ThemeToggleButton />
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto px-4 py-16 md:py-24 w-full">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mb-4">
              Collaborate instantly on a shared canvas
            </h1>
            <p className="text-base md:text-lg font-normal text-slate-600 dark:text-slate-400 leading-relaxed">
              Create a private room, invite others, and start drawing together in real
              time.
            </p>
          </div>

          <div className="space-y-6">
            <form
              ref={createRoomCardRef}
              onSubmit={createRoom}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-6 space-y-4"
            >
              <h2 className="text-lg font-semibold">Create a room</h2>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Your name <span className="text-red-500">*</span> (shown to others)
                </label>
                <input
                  type="text"
                  value={hostName}
                  onChange={(e) => {
                    setHostName(e.target.value);
                    setNameFieldError("");
                  }}
                  maxLength={48}
                  autoComplete="name"
                  aria-invalid={nameFieldError ? "true" : "false"}
                  className={`w-full rounded-lg border px-3 py-2 outline-none transition focus:ring-2 focus:ring-indigo-500 ${
                    nameFieldError
                      ? "border-red-500 bg-red-50 ring-2 ring-red-200 dark:border-red-500 dark:bg-red-950/40 dark:ring-red-900/50"
                      : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950"
                  }`}
                  placeholder="your name"
                  suppressHydrationWarning
                />
                {nameFieldError ? (
                  <p className="mt-1.5 text-sm text-red-600 dark:text-red-400" role="alert">
                    {nameFieldError}
                  </p>
                ) : null}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Optional room password
                </label>
                <input
                  type="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Leave empty for link-only access"
                  suppressHydrationWarning
                />
              </div>
              {msg && <p className="text-sm text-red-600 dark:text-red-400">{msg}</p>}
              <button
                type="submit"
                disabled={busy}
                suppressHydrationWarning
                className="w-full cursor-pointer rounded-xl bg-indigo-600 py-3 font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Creating…" : "Create room"}
              </button>
            </form>

            <form
              onSubmit={goJoin}
              className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-none backdrop-blur transition-shadow duration-200 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900/80"
            >
              <h2 className="text-lg font-semibold">Join a room</h2>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Room ID
                </label>
                <input
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="room id"
                  suppressHydrationWarning
                />
              </div>
              <button
                type="submit"
                suppressHydrationWarning
                className="w-full cursor-pointer rounded-xl border border-slate-200 py-3 font-medium transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Continue
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
