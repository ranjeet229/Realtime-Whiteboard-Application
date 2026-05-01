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
    <div className="cq-shell flex flex-col">
      <header className="cq-header-bar sticky top-0 z-20 w-full">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-4 md:px-6">
          <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight">
            <span className="cq-logo-mark">CQ</span>
            <span className="text-cq-text">CanvasQuill</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <ThemeToggleButton />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-14 md:px-6 md:py-20">
        <div className="grid items-center gap-14 md:grid-cols-2 md:gap-16">
          <div className="space-y-5">
            <h1 className="text-3xl font-bold tracking-tight text-cq-text md:text-4xl md:leading-tight">
              Collaborate instantly on a shared canvas
            </h1>
            <p className="text-base font-normal leading-relaxed text-cq-muted md:text-lg">
              Create a private room, invite others, and start drawing together in real
              time.
            </p>
          </div>

          <div className="space-y-6">
            <form
              ref={createRoomCardRef}
              onSubmit={createRoom}
              className="cq-card space-y-5 p-6 md:p-7"
            >
              <h2 className="text-lg font-semibold text-cq-text">Create a room</h2>
              <div>
                <label className="cq-label">
                  Your name <span className="text-cq-danger">*</span> (shown to others)
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
                  className={`cq-input cq-transition ${nameFieldError ? "cq-input-error" : ""}`}
                  placeholder="your name"
                  suppressHydrationWarning
                />
                {nameFieldError ? (
                  <p className="mt-2 text-sm text-cq-danger" role="alert">
                    {nameFieldError}
                  </p>
                ) : null}
              </div>
              <div>
                <label className="cq-label">Optional room password</label>
                <input
                  type="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  className="cq-input cq-transition"
                  placeholder="Leave empty for link-only access"
                  suppressHydrationWarning
                />
              </div>
              {msg && <p className="text-sm text-cq-danger">{msg}</p>}
              <button
                type="submit"
                disabled={busy}
                suppressHydrationWarning
                className="cq-btn-primary cq-transition"
              >
                {busy ? "Creating…" : "Create room"}
              </button>
            </form>

            <form
              onSubmit={goJoin}
              className="cq-card-subtle cq-transition flex flex-col gap-5 p-6 md:p-7"
            >
              <h2 className="text-lg font-semibold text-cq-text">Join a room</h2>
              <div>
                <label className="cq-label">Room ID</label>
                <input
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  className="cq-input cq-transition text-sm"
                  placeholder="room id"
                  suppressHydrationWarning
                />
              </div>
              <button type="submit" suppressHydrationWarning className="cq-btn-secondary cq-transition">
                Continue
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
