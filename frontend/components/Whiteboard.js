"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import io from "socket.io-client";
import Link from "next/link";
import { ThemeToggleButton } from "./ThemeToggleButton";
import { IconSidebarClosed, IconSidebarOpen } from "./SidebarPanelIcons";
import {
  ToolRailIcon,
  IconFill,
  IconOutline,
  IconTrash,
  IconImage,
  IconUndo,
  IconRedo,
  IconDownload,
} from "./WhiteboardToolIcons.jsx";

const rawSocket =
  process.env.NEXT_PUBLIC_SOCKET_URL?.trim() ||
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  "http://localhost:5000";
const SOCKET_URL = rawSocket.replace(/\/+$/, "");

/** Read room JWT payload (client) for stable userKey matching server collab. */
function parseRoomJwtPayload(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    if (typeof atob === "undefined") return null;
    const json = atob(b64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const SHAPE_TOOL_TYPES = [
  "line",
  "rectangle",
  "circle",
  "ellipse",
  "arrow",
  "triangle",
  "diamond",
  "roundRect",
  "star",
];

const FILL_CAPABLE_SHAPES = new Set([
  "rectangle",
  "circle",
  "ellipse",
  "triangle",
  "diamond",
  "roundRect",
  "star",
]);

const TEXT_FONT_FAMILY = `"Segoe UI", ui-sans-serif, system-ui, sans-serif`;
const MAX_TEXT_CHARS = 2000;

function fontPxFromPenSize(penSize) {
  const s = Number(penSize) || 4;
  return Math.round(Math.max(12, Math.min(56, 8 + s * 2.35)));
}

function measureTextStrokeDimensions(stroke) {
  const text = String(stroke.text || "");
  const fs = stroke.fontSize || 16;
  const ff = stroke.fontFamily || TEXT_FONT_FAMILY;
  if (typeof document === "undefined") {
    return { w: Math.max(24, text.length * fs * 0.55), h: fs * 1.35 };
  }
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d");
  if (!ctx) return { w: 80, h: fs * 1.35 };
  ctx.font = `${fs}px ${ff}`;
  const m = ctx.measureText(text || "M");
  const w = Math.max(8, m.width);
  const asc = m.actualBoundingBoxAscent ?? fs * 0.72;
  const desc = m.actualBoundingBoxDescent ?? fs * 0.22;
  const h = Math.max(fs * 1.15, asc + desc + 2);
  return { w, h };
}

function buildTextStroke(text, color, fontSize, x, y, pageId) {
  const stroke = {
    type: "text",
    text,
    color,
    fontSize,
    fontFamily: TEXT_FONT_FAMILY,
    fromX: x,
    fromY: y,
    groupId:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `g-${Date.now()}`,
    pageId,
  };
  const { w, h } = measureTextStrokeDimensions(stroke);
  stroke.toX = x + w;
  stroke.toY = y + h;
  return stroke;
}

/** Native `title` tooltips — one short label each */
const TOOL_HINTS = {
  pen: "Pen",
  eraser: "Eraser",
  move: "Move",
  text: "Text (keyboard I)",
  line: "Line",
  rectangle: "Rectangle",
  circle: "Circle",
  ellipse: "Ellipse",
  arrow: "Arrow",
  triangle: "Triangle",
  diamond: "Diamond",
  roundRect: "Round rect",
  star: "Star",
};

/** Full preset list; default quick row from `MAIN_COLOR_ORDER`, rest in “More colors”. */
const ALL_COLOR_SWATCHES = [
  { hex: "#ffffff", label: "White" },
  { hex: "#fafafa", label: "Snow" },
  { hex: "#f5f5f4", label: "Warm white" },
  { hex: "#fef3c7", label: "Cream" },
  { hex: "#fde68a", label: "Butter" },
  { hex: "#fcd34d", label: "Light gold" },
  { hex: "#fbbf24", label: "Gold" },
  { hex: "#f59e0b", label: "Amber" },
  { hex: "#ea580c", label: "Orange" },
  { hex: "#c2410c", label: "Burnt sienna" },
  { hex: "#9a3412", label: "Rust" },
  { hex: "#78350f", label: "Brown" },
  { hex: "#451a03", label: "Dark brown" },
  { hex: "#292524", label: "Umber" },
  { hex: "#fecaca", label: "Rose mist" },
  { hex: "#f87171", label: "Salmon" },
  { hex: "#ef4444", label: "Red" },
  { hex: "#dc2626", label: "Scarlet" },
  { hex: "#b91c1c", label: "Crimson" },
  { hex: "#991b1b", label: "Wine red" },
  { hex: "#7f1d1d", label: "Maroon" },
  { hex: "#fbcfe8", label: "Blush pink" },
  { hex: "#f9a8d4", label: "Pink" },
  { hex: "#ec4899", label: "Hot pink" },
  { hex: "#db2777", label: "Magenta" },
  { hex: "#be185d", label: "Deep pink" },
  { hex: "#fce7f3", label: "Lilac pink" },
  { hex: "#e879f9", label: "Orchid" },
  { hex: "#d946ef", label: "Fuchsia" },
  { hex: "#c026d3", label: "Purple" },
  { hex: "#a855f7", label: "Violet" },
  { hex: "#9333ea", label: "Deep violet" },
  { hex: "#7c3aed", label: "Indigo" },
  { hex: "#6366f1", label: "Periwinkle" },
  { hex: "#4f46e5", label: "Royal blue" },
  { hex: "#312e81", label: "Navy" },
  { hex: "#3b82f6", label: "Blue" },
  { hex: "#2563eb", label: "Azure" },
  { hex: "#1d4ed8", label: "Cobalt" },
  { hex: "#60a5fa", label: "Sky blue" },
  { hex: "#22d3ee", label: "Cyan" },
  { hex: "#06b6d4", label: "Teal blue" },
  { hex: "#14b8a6", label: "Teal" },
  { hex: "#0d9488", label: "Deep teal" },
  { hex: "#10b981", label: "Emerald" },
  { hex: "#22c55e", label: "Green" },
  { hex: "#15803d", label: "Forest green" },
  { hex: "#166534", label: "Pine" },
  { hex: "#84cc16", label: "Lime" },
  { hex: "#ca8a04", label: "Olive gold" },
  { hex: "#eab308", label: "Yellow" },
  { hex: "#facc15", label: "Lemon" },
  { hex: "#cbd5e1", label: "Silver" },
  { hex: "#94a3b8", label: "Grey" },
  { hex: "#64748b", label: "Slate" },
  { hex: "#334155", label: "Charcoal" },
  { hex: "#0f172a", label: "Ink" },
  { hex: "#000000", label: "Black" },
];

const MAIN_COLOR_ORDER = [
  "#000000",
  "#ffffff",
  "#ef4444",
  "#f59e0b",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#a855f7",
  "#78350f",
];
const MAIN_HEX_SET = new Set(MAIN_COLOR_ORDER);
const EXTRA_COLOR_SWATCHES = ALL_COLOR_SWATCHES.filter(
  (s) => !MAIN_HEX_SET.has(s.hex)
);

const RECENT_COLORS_STORAGE_KEY = "cq-whiteboard-recent-colors-v1";
const MAX_RECENT_COLORS = 10;

function normalizeHexColor(input) {
  const s = String(input || "").trim();
  if (!s) return null;
  const m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let x = m[1];
  if (x.length === 3) x = x.split("").map((c) => c + c).join("");
  return `#${x.toLowerCase()}`;
}

function isValidRecentHex(h) {
  return typeof h === "string" && /^#[0-9a-fA-F]{6}$/.test(h);
}

/** Single canonical #rrggbb for recent list, or null. */
function canonicalRecentHex(h) {
  const n = normalizeHexColor(h);
  if (n) return n;
  if (isValidRecentHex(h)) return h.toLowerCase();
  return null;
}

/**
 * Unique colors only, order preserved (first wins). Caps at MAX_RECENT_COLORS.
 * Use after reads and before persist so the quick row never shows duplicates.
 */
function dedupeRecentColorsPreserveOrder(hexes) {
  if (!Array.isArray(hexes)) return [...MAIN_COLOR_ORDER];
  const out = [];
  const seen = new Set();
  for (const raw of hexes) {
    const canon = canonicalRecentHex(raw);
    if (!canon) continue;
    const lc = canon.toLowerCase();
    if (seen.has(lc)) continue;
    seen.add(lc);
    out.push(canon);
    if (out.length >= MAX_RECENT_COLORS) break;
  }
  return out.length > 0 ? out : dedupeRecentColorsPreserveOrder([...MAIN_COLOR_ORDER]);
}

function readRecentColorsFromStorage() {
  try {
    const raw = localStorage.getItem(RECENT_COLORS_STORAGE_KEY);
    if (!raw) return dedupeRecentColorsPreserveOrder([...MAIN_COLOR_ORDER]);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return dedupeRecentColorsPreserveOrder([...MAIN_COLOR_ORDER]);
    return dedupeRecentColorsPreserveOrder(parsed);
  } catch {
    return dedupeRecentColorsPreserveOrder([...MAIN_COLOR_ORDER]);
  }
}

function writeRecentColorsToStorage(hexes) {
  try {
    localStorage.setItem(
      RECENT_COLORS_STORAGE_KEY,
      JSON.stringify(hexes.slice(0, MAX_RECENT_COLORS))
    );
  } catch {
    /* ignore quota / private mode */
  }
}

function swatchForHex(hex) {
  const row = ALL_COLOR_SWATCHES.find(
    (s) => s.hex.toLowerCase() === hex.toLowerCase()
  );
  return row || { hex, label: hex };
}

/** New images use at most this fraction of canvas width/height (Paint-style). */
const IMAGE_INITIAL_MAX_FRAC = 0.4;
const IMAGE_SCALE_SLIDER_MIN = 0.06;
const IMAGE_SCALE_SLIDER_MAX = 3.5;

/** @type {Map<string, HTMLImageElement>} */
const imageElementCache = new Map();
const IMAGE_CACHE_MAX = 48;

function queueImageDecode(dataUrl, onDecoded) {
  if (!dataUrl || typeof dataUrl !== "string") return;
  let img = imageElementCache.get(dataUrl);
  if (img && img.complete && img.naturalWidth) {
    onDecoded?.();
    return;
  }
  if (!img) {
    img = new Image();
    img.decoding = "async";
    imageElementCache.set(dataUrl, img);
    if (imageElementCache.size > IMAGE_CACHE_MAX) {
      const firstKey = imageElementCache.keys().next().value;
      imageElementCache.delete(firstKey);
    }
    img.onload = () => onDecoded?.();
    img.onerror = () => {};
    img.src = dataUrl;
  } else if (!img.complete) {
    img.addEventListener("load", () => onDecoded?.(), { once: true });
  }
}

function defaultCanvasPageId(pages) {
  return pages && pages[0]?.id ? pages[0].id : "";
}

function strokePageId(stroke, pages) {
  return stroke.pageId || defaultCanvasPageId(pages);
}

function strokesVisibleOnPage(fullHistory, pageId, pages) {
  if (!Array.isArray(fullHistory)) return [];
  if (!pages || pages.length === 0) return fullHistory;
  const pid = pageId || defaultCanvasPageId(pages);
  if (!pid) return fullHistory;
  return fullHistory.filter((s) => strokePageId(s, pages) === pid);
}

function buildImageStroke(dataUrl, nw, nh, canvasW, canvasH, cx, cy, pageId) {
  const maxW = canvasW * IMAGE_INITIAL_MAX_FRAC;
  const maxH = canvasH * IMAGE_INITIAL_MAX_FRAC;
  const scale = Math.min(maxW / Math.max(1, nw), maxH / Math.max(1, nh), 1);
  const w = nw * scale;
  const h = nh * scale;
  return {
    type: "image",
    dataUrl,
    fromX: cx - w / 2,
    fromY: cy - h / 2,
    toX: cx + w / 2,
    toY: cy + h / 2,
    naturalWidth: nw,
    naturalHeight: nh,
    imageScale: scale,
    groupId: crypto.randomUUID(),
    pageId,
  };
}

function resizeImageStrokeByScale(stroke, newScale) {
  if (stroke.type !== "image") return stroke;
  const nw = stroke.naturalWidth;
  const nh = stroke.naturalHeight;
  if (!nw || !nh) return stroke;
  const sc = Math.max(
    IMAGE_SCALE_SLIDER_MIN,
    Math.min(IMAGE_SCALE_SLIDER_MAX, newScale)
  );
  const cx = (stroke.fromX + stroke.toX) / 2;
  const cy = (stroke.fromY + stroke.toY) / 2;
  const w = nw * sc;
  const h = nh * sc;
  return {
    ...stroke,
    fromX: cx - w / 2,
    fromY: cy - h / 2,
    toX: cx + w / 2,
    toY: cy + h / 2,
    imageScale: sc,
  };
}

function assignLegacyGroupIdsClient(history) {
  if (!Array.isArray(history)) return;
  let chainId = null;
  for (let i = 0; i < history.length; i++) {
    const s = history[i];
    if (s.groupId) {
      chainId = null;
      continue;
    }
    if (s.type === "image") {
      s.groupId = crypto.randomUUID();
      chainId = null;
      continue;
    }
    if (s.type === "text") {
      s.groupId = crypto.randomUUID();
      chainId = null;
      continue;
    }
    if (SHAPE_TOOL_TYPES.includes(s.type)) {
      s.groupId = crypto.randomUUID();
      chainId = null;
      continue;
    }
    if (s.type !== "draw" && s.type !== "erase") {
      chainId = null;
      continue;
    }
    const prev = history[i - 1];
    const sameChain =
      prev &&
      (prev.type === "draw" || prev.type === "erase") &&
      prev.socketId === s.socketId &&
      Math.hypot(s.fromX - prev.toX, s.fromY - prev.toY) < 3;
    if (!sameChain) chainId = crypto.randomUUID();
    s.groupId = chainId;
  }
}

function pointInHitBounds(px, py, b) {
  return px >= b.minX && px <= b.maxX && py >= b.minY && py <= b.maxY;
}

function getEventHitBounds(evt) {
  const PAD = 10;
  const sz = evt.size ?? 3;
  const esz = evt.eraserSize ?? sz;
  if (evt.type === "draw" || evt.type === "erase") {
    const lw = (evt.type === "erase" ? esz : sz) * 0.5 + PAD;
    return {
      minX: Math.min(evt.fromX, evt.toX) - lw,
      minY: Math.min(evt.fromY, evt.toY) - lw,
      maxX: Math.max(evt.fromX, evt.toX) + lw,
      maxY: Math.max(evt.fromY, evt.toY) + lw,
    };
  }
  if (evt.type === "line" || evt.type === "arrow") {
    const lw = sz * 0.5 + PAD + 8;
    return {
      minX: Math.min(evt.fromX, evt.toX) - lw,
      minY: Math.min(evt.fromY, evt.toY) - lw,
      maxX: Math.max(evt.fromX, evt.toX) + lw,
      maxY: Math.max(evt.fromY, evt.toY) + lw,
    };
  }
  if (
    evt.type === "rectangle" ||
    evt.type === "triangle" ||
    evt.type === "diamond" ||
    evt.type === "roundRect" ||
    evt.type === "star"
  ) {
    const lw = sz * 0.5 + PAD + (evt.filled ? 2 : 8);
    const { x, y, w, h } = normalizedRect(
      evt.fromX,
      evt.fromY,
      evt.toX,
      evt.toY
    );
    return { minX: x - lw, minY: y - lw, maxX: x + w + lw, maxY: y + h + lw };
  }
  if (evt.type === "circle") {
    const r = Math.hypot(evt.toX - evt.fromX, evt.toY - evt.fromY) + sz * 0.5 + PAD;
    return {
      minX: evt.fromX - r,
      minY: evt.fromY - r,
      maxX: evt.fromX + r,
      maxY: evt.fromY + r,
    };
  }
  if (evt.type === "ellipse") {
    const rx = Math.abs(evt.toX - evt.fromX) + sz * 0.5 + PAD;
    const ry = Math.abs(evt.toY - evt.fromY) + sz * 0.5 + PAD;
    return {
      minX: evt.fromX - rx,
      minY: evt.fromY - ry,
      maxX: evt.fromX + rx,
      maxY: evt.fromY + ry,
    };
  }
  if (evt.type === "image") {
    const { x, y, w, h } = normalizedRect(
      evt.fromX,
      evt.fromY,
      evt.toX,
      evt.toY
    );
    const pad = 6;
    return {
      minX: x - pad,
      minY: y - pad,
      maxX: x + w + pad,
      maxY: y + h + pad,
    };
  }
  if (evt.type === "text") {
    const pad = 8;
    const { w, h } = measureTextStrokeDimensions(evt);
    return {
      minX: evt.fromX - pad,
      minY: evt.fromY - pad,
      maxX: evt.fromX + w + pad,
      maxY: evt.fromY + h + pad,
    };
  }
  return null;
}

function findHitGroupAt(strokes, px, py) {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const evt = strokes[i];
    if (!evt.groupId) continue;
    const b = getEventHitBounds(evt);
    if (b && pointInHitBounds(px, py, b)) return evt.groupId;
  }
  return null;
}

function boundsBoxesIntersect(a, b) {
  return !(
    b.maxX < a.minX ||
    b.minX > a.maxX ||
    b.maxY < a.minY ||
    b.minY > a.maxY
  );
}

/** All distinct groupIds whose hit bounds intersect the marquee rect (x,y,w,h ≥ 0). */
function collectGroupIdsInMarquee(strokes, rect) {
  const box = {
    minX: rect.x,
    minY: rect.y,
    maxX: rect.x + rect.w,
    maxY: rect.y + rect.h,
  };
  const seen = new Set();
  const out = [];
  for (let i = 0; i < strokes.length; i++) {
    const evt = strokes[i];
    if (!evt.groupId || seen.has(evt.groupId)) continue;
    const eb = getEventHitBounds(evt);
    if (!eb) continue;
    if (boundsBoxesIntersect(box, eb)) {
      seen.add(evt.groupId);
      out.push(evt.groupId);
    }
  }
  return out;
}

/** Geometric bounds for clamping (no hit padding). */
function getEventTightBounds(evt) {
  const sz = evt.size ?? 3;
  const esz = evt.eraserSize ?? sz;
  const half = Math.max(0.75, (evt.type === "erase" ? esz : sz) * 0.5);
  if (evt.type === "draw" || evt.type === "erase") {
    return {
      minX: Math.min(evt.fromX, evt.toX) - half,
      minY: Math.min(evt.fromY, evt.toY) - half,
      maxX: Math.max(evt.fromX, evt.toX) + half,
      maxY: Math.max(evt.fromY, evt.toY) + half,
    };
  }
  if (evt.type === "line" || evt.type === "arrow") {
    const w = half + 1;
    return {
      minX: Math.min(evt.fromX, evt.toX) - w,
      minY: Math.min(evt.fromY, evt.toY) - w,
      maxX: Math.max(evt.fromX, evt.toX) + w,
      maxY: Math.max(evt.fromY, evt.toY) + w,
    };
  }
  if (
    evt.type === "rectangle" ||
    evt.type === "triangle" ||
    evt.type === "diamond" ||
    evt.type === "roundRect" ||
    evt.type === "star"
  ) {
    const pad = evt.filled ? half * 0.35 : half + 0.5;
    const { x, y, w, h } = normalizedRect(
      evt.fromX,
      evt.fromY,
      evt.toX,
      evt.toY
    );
    return { minX: x - pad, minY: y - pad, maxX: x + w + pad, maxY: y + h + pad };
  }
  if (evt.type === "circle") {
    const r = Math.hypot(evt.toX - evt.fromX, evt.toY - evt.fromY) + half;
    return {
      minX: evt.fromX - r,
      minY: evt.fromY - r,
      maxX: evt.fromX + r,
      maxY: evt.fromY + r,
    };
  }
  if (evt.type === "ellipse") {
    const rx = Math.abs(evt.toX - evt.fromX) + half;
    const ry = Math.abs(evt.toY - evt.fromY) + half;
    return {
      minX: evt.fromX - rx,
      minY: evt.fromY - ry,
      maxX: evt.fromX + rx,
      maxY: evt.fromY + ry,
    };
  }
  if (evt.type === "image") {
    const { x, y, w, h } = normalizedRect(
      evt.fromX,
      evt.fromY,
      evt.toX,
      evt.toY
    );
    return { minX: x, minY: y, maxX: x + w, maxY: y + h };
  }
  if (evt.type === "text") {
    const { w, h } = measureTextStrokeDimensions(evt);
    return {
      minX: evt.fromX,
      minY: evt.fromY,
      maxX: evt.fromX + w,
      maxY: evt.fromY + h,
    };
  }
  return null;
}

/** Union of tight bounds for all strokes in the given group ids (+ small padding). */
function unionBoundsForGroups(strokes, groupIds) {
  if (!groupIds || groupIds.length === 0) return null;
  const set = new Set(groupIds);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const e of strokes) {
    if (!e.groupId || !set.has(e.groupId)) continue;
    const b = getEventTightBounds(e);
    if (!b) continue;
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  if (!Number.isFinite(minX)) return null;
  const pad = 4;
  return {
    x: minX - pad,
    y: minY - pad,
    w: Math.max(4, maxX - minX + pad * 2),
    h: Math.max(4, maxY - minY + pad * 2),
  };
}

function boundsUnionAfterDelta(base, groupIds, dx, dy) {
  const set = new Set(groupIds);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const e of base) {
    if (!e.groupId || !set.has(e.groupId)) continue;
    const b = getEventTightBounds(e);
    if (!b) continue;
    minX = Math.min(minX, b.minX + dx);
    minY = Math.min(minY, b.minY + dy);
    maxX = Math.max(maxX, b.maxX + dx);
    maxY = Math.max(maxY, b.maxY + dy);
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

/** Keep union of selected strokes inside [0,cw]×[0,ch] (canvas CSS pixel space). */
function clampMoveDelta(base, groupIds, accDx, accDy, cw, ch) {
  if (!Number.isFinite(cw) || !Number.isFinite(ch) || cw <= 0 || ch <= 0) {
    return { dx: accDx, dy: accDy };
  }
  let dx = accDx;
  let dy = accDy;
  for (let iter = 0; iter < 6; iter++) {
    const u = boundsUnionAfterDelta(base, groupIds, dx, dy);
    if (!u) return { dx: 0, dy: 0 };
    let changed = false;
    if (u.minX < 0) {
      dx -= u.minX;
      changed = true;
    }
    if (u.minY < 0) {
      dy -= u.minY;
      changed = true;
    }
    if (u.maxX > cw) {
      dx -= u.maxX - cw;
      changed = true;
    }
    if (u.maxY > ch) {
      dy -= u.maxY - ch;
      changed = true;
    }
    if (!changed) break;
  }
  return { dx, dy };
}

function applyGroupOffset(strokes, groupId, dx, dy) {
  return applyGroupsOffset(strokes, [groupId], dx, dy);
}

function applyGroupsOffset(strokes, groupIds, dx, dy) {
  if (!groupIds || groupIds.length === 0) return strokes;
  const set = new Set(groupIds);
  return strokes.map((e) =>
    e.groupId &&
    set.has(e.groupId) &&
    typeof e.fromX === "number" &&
    typeof e.fromY === "number" &&
    typeof e.toX === "number" &&
    typeof e.toY === "number"
      ? {
          ...e,
          fromX: e.fromX + dx,
          fromY: e.fromY + dy,
          toX: e.toX + dx,
          toY: e.toY + dy,
        }
      : e
  );
}

/** Drop every stroke whose groupId is in groupIds (Move tool delete). */
function removeHistoryByGroupIds(strokes, groupIds) {
  if (!Array.isArray(strokes) || !Array.isArray(groupIds) || groupIds.length === 0)
    return strokes;
  const set = new Set(groupIds);
  return strokes.filter((e) => !e.groupId || !set.has(e.groupId));
}

function normalizedRect(fromX, fromY, toX, toY) {
  const x = Math.min(fromX, toX);
  const y = Math.min(fromY, toY);
  const w = Math.abs(toX - fromX);
  const h = Math.abs(toY - fromY);
  return { x, y, w, h };
}

function pathTriangle(ctx, x, y, w, h) {
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

function pathDiamond(ctx, x, y, w, h) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.moveTo(cx, y);
  ctx.lineTo(x + w, cy);
  ctx.lineTo(cx, y + h);
  ctx.lineTo(x, cy);
  ctx.closePath();
}

function pathStar(ctx, x, y, w, h) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const outerR = Math.min(w, h) / 2;
  const innerR = outerR * 0.38;
  const n = 5;
  for (let i = 0; i < n * 2; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 === 0 ? outerR : innerR;
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function pathRoundedRect(ctx, x, y, w, h, cornerRadius) {
  const r = Math.min(cornerRadius, w / 2, h / 2);
  if (r <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawOnCanvas(ctx, evt) {
  ctx.save();
  const filled =
    evt.filled === true && FILL_CAPABLE_SHAPES.has(evt.type);

  switch (evt.type) {
    case "line":
      ctx.beginPath();
      ctx.moveTo(evt.fromX, evt.fromY);
      ctx.lineTo(evt.toX, evt.toY);
      ctx.strokeStyle = evt.color;
      ctx.lineWidth = evt.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalCompositeOperation = "source-over";
      ctx.stroke();
      break;
    case "rectangle": {
      ctx.globalCompositeOperation = "source-over";
      const { x, y, w, h } = normalizedRect(
        evt.fromX,
        evt.fromY,
        evt.toX,
        evt.toY
      );
      if (filled) {
        ctx.fillStyle = evt.color;
        ctx.fillRect(x, y, w, h);
      } else {
        ctx.strokeStyle = evt.color;
        ctx.lineWidth = evt.size;
        ctx.strokeRect(x, y, w, h);
      }
      break;
    }
    case "circle": {
      ctx.beginPath();
      const r = Math.hypot(evt.toX - evt.fromX, evt.toY - evt.fromY);
      ctx.arc(evt.fromX, evt.fromY, r, 0, 2 * Math.PI);
      ctx.globalCompositeOperation = "source-over";
      if (filled) {
        ctx.fillStyle = evt.color;
        ctx.fill();
      } else {
        ctx.strokeStyle = evt.color;
        ctx.lineWidth = evt.size;
        ctx.stroke();
      }
      break;
    }
    case "ellipse":
      ctx.beginPath();
      ctx.ellipse(
        evt.fromX,
        evt.fromY,
        Math.abs(evt.toX - evt.fromX),
        Math.abs(evt.toY - evt.fromY),
        0,
        0,
        2 * Math.PI
      );
      ctx.globalCompositeOperation = "source-over";
      if (filled) {
        ctx.fillStyle = evt.color;
        ctx.fill();
      } else {
        ctx.strokeStyle = evt.color;
        ctx.lineWidth = evt.size;
        ctx.stroke();
      }
      break;
    case "triangle":
    case "diamond":
    case "star":
    case "roundRect": {
      ctx.beginPath();
      const { x, y, w, h } = normalizedRect(
        evt.fromX,
        evt.fromY,
        evt.toX,
        evt.toY
      );
      if (evt.type === "triangle") pathTriangle(ctx, x, y, w, h);
      else if (evt.type === "diamond") pathDiamond(ctx, x, y, w, h);
      else if (evt.type === "star") pathStar(ctx, x, y, w, h);
      else
        pathRoundedRect(
          ctx,
          x,
          y,
          w,
          h,
          Math.min(14, Math.min(w, h) * 0.2)
        );
      ctx.globalCompositeOperation = "source-over";
      if (filled) {
        ctx.fillStyle = evt.color;
        ctx.fill();
      } else {
        ctx.strokeStyle = evt.color;
        ctx.lineWidth = evt.size;
        ctx.stroke();
      }
      break;
    }
      case "arrow":
        ctx.beginPath();
        ctx.moveTo(evt.fromX, evt.fromY);
        ctx.lineTo(evt.toX, evt.toY);
        ctx.strokeStyle = evt.color;
        ctx.lineWidth = evt.size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalCompositeOperation = "source-over";
        ctx.stroke();
      {
        const headlen = 10 + evt.size;
        const angle = Math.atan2(evt.toY - evt.fromY, evt.toX - evt.fromX);
        ctx.beginPath();
        ctx.moveTo(evt.toX, evt.toY);
        ctx.lineTo(
          evt.toX - headlen * Math.cos(angle - Math.PI / 6),
          evt.toY - headlen * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(evt.toX, evt.toY);
        ctx.lineTo(
          evt.toX - headlen * Math.cos(angle + Math.PI / 6),
          evt.toY - headlen * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
      }
      break;
    case "erase": {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const ew = evt.eraserSize !== undefined ? evt.eraserSize : evt.size || 10;
      ctx.lineWidth = ew;
      const pin =
        evt.dot === true ||
        (Math.abs(evt.fromX - evt.toX) < 0.02 &&
          Math.abs(evt.fromY - evt.toY) < 0.02);
      if (pin) {
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(evt.fromX, evt.fromY, ew / 2, 0, 2 * Math.PI);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(evt.fromX, evt.fromY);
        ctx.lineTo(evt.toX, evt.toY);
        ctx.stroke();
      }
      break;
    }
    case "image": {
      if (!evt.dataUrl) break;
      const img = imageElementCache.get(evt.dataUrl);
      if (img && img.complete && img.naturalWidth) {
        const { x, y, w, h } = normalizedRect(
          evt.fromX,
          evt.fromY,
          evt.toX,
          evt.toY
        );
        ctx.globalCompositeOperation = "source-over";
        ctx.drawImage(img, x, y, w, h);
      }
      break;
    }
    case "text": {
      const t = String(evt.text || "");
      if (!t) break;
      const fs = evt.fontSize || 16;
      const ff = evt.fontFamily || TEXT_FONT_FAMILY;
      ctx.save();
      ctx.font = `${fs}px ${ff}`;
      ctx.fillStyle = evt.color || "#0f172a";
      ctx.textBaseline = "top";
      ctx.globalCompositeOperation = "source-over";
      ctx.fillText(t, evt.fromX, evt.fromY);
      ctx.restore();
      break;
    }
    default: {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = evt.color;
      ctx.lineWidth = evt.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const pin =
        evt.dot === true ||
        (Math.abs(evt.fromX - evt.toX) < 0.02 &&
          Math.abs(evt.fromY - evt.toY) < 0.02);
      if (pin) {
        ctx.fillStyle = evt.color;
        const r = Math.max(0.5, evt.size / 2);
        ctx.beginPath();
        ctx.arc(evt.fromX, evt.fromY, r, 0, 2 * Math.PI);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(evt.fromX, evt.fromY);
        ctx.lineTo(evt.toX, evt.toY);
        ctx.stroke();
      }
      break;
    }
  }
  ctx.restore();
}

function ensureImageDecodedForExport(dataUrl) {
  return new Promise((resolve) => {
    queueImageDecode(dataUrl, resolve);
  });
}

/** Rasterize strokes (logical CSS size) for export; awaits image bitmaps. */
async function rasterizeStrokesToDataURL(
  strokes,
  cssWidth,
  cssHeight,
  dpr,
  mime,
  quality
) {
  const d = Math.max(1, dpr || 1);
  const cw = Math.max(1, cssWidth);
  const ch = Math.max(1, cssHeight);
  for (const evt of strokes) {
    if (evt.type === "image" && evt.dataUrl) {
      await ensureImageDecodedForExport(evt.dataUrl);
    }
  }
  const c = document.createElement("canvas");
  c.width = Math.round(cw * d);
  c.height = Math.round(ch * d);
  const ctx = c.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(d, d);
  if (String(mime).includes("jpeg")) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cw, ch);
  }
  for (const evt of strokes) {
    drawOnCanvas(ctx, evt);
  }
  return quality != null ? c.toDataURL(mime, quality) : c.toDataURL(mime);
}

function triggerDataUrlDownload(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

async function exportPagesAsPdf({
  pageIds,
  history,
  pages,
  cssW,
  cssH,
  dpr,
  roomId,
}) {
  const { jsPDF } = await import("jspdf");
  const slug = (roomId || "board").slice(0, 8);
  const ori = cssW >= cssH ? "l" : "p";
  let pdf = null;
  for (let i = 0; i < pageIds.length; i++) {
    const strokes = strokesVisibleOnPage(history, pageIds[i], pages);
    const url = await rasterizeStrokesToDataURL(
      strokes,
      cssW,
      cssH,
      dpr,
      "image/png"
    );
    if (i === 0) {
      pdf = new jsPDF({
        unit: "px",
        format: [cssW, cssH],
        orientation: ori,
        compress: true,
      });
      pdf.addImage(url, "PNG", 0, 0, cssW, cssH);
    } else {
      pdf.addPage([cssW, cssH], ori);
      pdf.addImage(url, "PNG", 0, 0, cssW, cssH);
    }
  }
  pdf.save(`whiteboard-${slug}-${pageIds.length}p.pdf`);
}

async function exportPagesAsDocx({
  pageIds,
  history,
  pages,
  cssW,
  cssH,
  dpr,
  roomId,
}) {
  const { Document, Packer, Paragraph, ImageRun } = await import("docx");
  const slug = (roomId || "board").slice(0, 8);
  const maxDocW = 880;
  const tw = Math.min(Math.round(cssW), maxDocW);
  const th = Math.round((cssH * tw) / Math.max(1, cssW));
  const children = [];
  for (let i = 0; i < pageIds.length; i++) {
    const strokes = strokesVisibleOnPage(history, pageIds[i], pages);
    const url = await rasterizeStrokesToDataURL(
      strokes,
      cssW,
      cssH,
      dpr,
      "image/png"
    );
    children.push(
      new Paragraph({
        pageBreakBefore: i > 0,
        children: [
          new ImageRun({
            data: url,
            type: "png",
            transformation: { width: tw, height: th },
          }),
        ],
      })
    );
  }
  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = `whiteboard-${slug}-${pageIds.length}p.docx`;
  a.click();
  URL.revokeObjectURL(href);
}

/** Readable label text on top of a hex stroke color */
function pickContrastingText(hex) {
  if (!hex || typeof hex !== "string") return "#ffffff";
  let h = hex.replace("#", "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  if (h.length !== 6) return "#ffffff";
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.55 ? "#0f172a" : "#ffffff";
}

function nameInitial(name) {
  const t = String(name || "").trim();
  if (!t) return "?";
  return t.charAt(0).toLocaleUpperCase();
}

function avatarHueFromName(name) {
  const s = String(name || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

/**
 * Collaborative canvas: drawing logic is unchanged; transport is room-scoped
 * via Socket.IO auth (room JWT) and server-side `socket.to(roomId)` fan-out.
 */
export default function Whiteboard({
  roomId,
  roomToken,
  role = "editor",
  displayName = "User",
  canDraw = true,
}) {
  const canvasRef = useRef(null);
  const canvasAreaRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState("pen");
  const currentToolRef = useRef("pen");
  currentToolRef.current = currentTool;
  const [currentColor, setCurrentColor] = useState("#3b82f6");
  const [currentSize, setCurrentSize] = useState(3);
  const [eraserSize, setEraserSize] = useState(10);
  /** Paint-style solid fill for closed shapes (rect, circle, …) */
  const [shapeFilled, setShapeFilled] = useState(true);
  const [userCount, setUserCount] = useState(1);
  const [isConnected, setIsConnected] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [shapeStart, setShapeStart] = useState(null);
  const [history, setHistory] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [myUserKey, setMyUserKey] = useState("");
  /** Live draw capability (JWT + host overrides via `draw_permission`). */
  const [drawPermission, setDrawPermission] = useState(canDraw);
  const [cursors, setCursors] = useState({});
  const [socketError, setSocketError] = useState("");
  /** Tool sidebar: open on first load; user toggles via Tools header */
  const [sidebarOpen, setSidebarOpen] = useState(true);
  /** Right “People” rail (does not cover tools sidebar) */
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [mySocketId, setMySocketId] = useState(null);
  const [copyIdCopied, setCopyIdCopied] = useState(false);
  const [copyLinkCopied, setCopyLinkCopied] = useState(false);
  const copyFeedbackTimersRef = useRef({ id: null, link: null });
  const rafPreview = useRef(null);
  const lastCursorEmit = useRef(0);
  const historyRef = useRef([]);
  /** True after pointer moved while drawing pen/eraser (skip click-only dot if moved). */
  const freestyleMovedRef = useRef(false);
  const [moveDragging, setMoveDragging] = useState(false);
  /** groupIds selected for Move tool (Shift+click, marquee, …). */
  const [moveSelection, setMoveSelection] = useState([]);
  /** Marquee selection rect in canvas CSS px while dragging on empty canvas. */
  const [marqueeRect, setMarqueeRect] = useState(null);
  /** During move drag, offset so selection outline tracks the preview. */
  const [moveDragPreview, setMoveDragPreview] = useState(null);
  const [extraColorMenuOpen, setExtraColorMenuOpen] = useState(false);
  const [extraColorSearch, setExtraColorSearch] = useState("");
  const [recentColorHexes, setRecentColorHexes] = useState(() =>
    dedupeRecentColorsPreserveOrder([...MAIN_COLOR_ORDER])
  );
  const moveSessionRef = useRef(null);
  const moveSelectionRef = useRef([]);
  const activePenGroupRef = useRef(null);
  const socketRef = useRef(null);
  const extraColorMenuRef = useRef(null);
  const [canvasPages, setCanvasPages] = useState([]);
  const [activePageId, setActivePageId] = useState("");
  const canvasPagesRef = useRef([]);
  const activePageIdRef = useRef("");
  const imageFileInputRef = useRef(null);
  const [pagesMenuOpen, setPagesMenuOpen] = useState(false);
  const pagesMenuRef = useRef(null);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const downloadMenuRef = useRef(null);
  /** "pdf" | "doc" — multi-page export scope dialog */
  const [exportScopeModal, setExportScopeModal] = useState(null);
  const [exportScopeChoice, setExportScopeChoice] = useState("current");
  /** pageId -> include in PDF/Word when scope is "pick" (any subset, e.g. pages 1+2 of 4) */
  const [exportPickPages, setExportPickPages] = useState({});
  const [exportBusy, setExportBusy] = useState(false);

  /** Inline text placement: canvas coords + draft; `key` remounts the input. */
  const [textComposer, setTextComposer] = useState(null);
  const textDraftRef = useRef("");
  const textInputRef = useRef(null);
  const textComposerRef = useRef(null);

  useEffect(() => {
    textComposerRef.current = textComposer;
  }, [textComposer]);

  useEffect(() => {
    canvasPagesRef.current = canvasPages;
  }, [canvasPages]);
  useEffect(() => {
    activePageIdRef.current = activePageId;
  }, [activePageId]);

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    setDrawPermission(canDraw);
  }, [drawPermission]);

  useEffect(() => {
    const p = parseRoomJwtPayload(roomToken);
    const key =
      (p?.userId != null && String(p.userId)) ||
      (p?.guestId != null && String(p.guestId)) ||
      "";
    setMyUserKey(key);
  }, [roomToken]);

  useEffect(() => {
    moveSelectionRef.current = moveSelection;
  }, [moveSelection]);

  useEffect(() => {
    if (currentTool !== "move") {
      setMoveSelection([]);
      setMarqueeRect(null);
      setMoveDragPreview(null);
      moveSessionRef.current = null;
      setMoveDragging(false);
    }
  }, [currentTool]);

  useEffect(() => {
    const t = copyFeedbackTimersRef.current;
    return () => {
      if (t.id) clearTimeout(t.id);
      if (t.link) clearTimeout(t.link);
    };
  }, []);

  const shapeOptions = [
    { label: "Pen", value: "pen", group: "draw" },
    { label: "Eraser", value: "eraser", group: "draw" },
    { label: "Move", value: "move", group: "draw" },
    { label: "Text", value: "text", group: "draw" },
    { label: "Line", value: "line", group: "shapes" },
    { label: "Rectangle", value: "rectangle", group: "shapes" },
    { label: "Circle", value: "circle", group: "shapes" },
    { label: "Ellipse", value: "ellipse", group: "shapes" },
    { label: "Arrow", value: "arrow", group: "shapes" },
    { label: "Triangle", value: "triangle", group: "shapes" },
    { label: "Diamond", value: "diamond", group: "shapes" },
    { label: "Round rect", value: "roundRect", group: "shapes" },
    { label: "Star", value: "star", group: "shapes" },
  ];

  const redrawCanvas = useCallback((drawings) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const pages = canvasPagesRef.current;
    const pageId = activePageIdRef.current;
    const list = strokesVisibleOnPage(drawings, pageId, pages);
    list.forEach((evt) => {
      if (evt.type === "image" && evt.dataUrl) {
        queueImageDecode(evt.dataUrl, () => {
          requestAnimationFrame(() => {
            const sess = moveSessionRef.current;
            if (sess?.phase === "dragging" && Array.isArray(sess.baseHistory)) {
              redrawCanvas(
                applyGroupsOffset(
                  sess.baseHistory,
                  sess.groupIds,
                  sess.accDx,
                  sess.accDy
                )
              );
            } else {
              redrawCanvas(historyRef.current);
            }
          });
        });
      }
      drawOnCanvas(ctx, evt);
    });
  }, []);

  const finalizeTextFromComposer = useCallback(() => {
    const prev = textComposerRef.current;
    if (!prev) return;
    textComposerRef.current = null;
    const trimmed = (textDraftRef.current || prev.draft || "")
      .trim()
      .slice(0, MAX_TEXT_CHARS);
    textDraftRef.current = "";
    setTextComposer(null);
    if (!trimmed || !drawPermission) return;
    const fontSize = fontPxFromPenSize(currentSize);
    const pageId =
      prev.pageId ||
      activePageIdRef.current ||
      canvasPagesRef.current[0]?.id ||
      undefined;
    const stroke = buildTextStroke(
      trimmed,
      currentColor,
      fontSize,
      prev.x,
      prev.y,
      pageId
    );
    setHistory((hprev) => {
      const next = [...hprev, stroke];
      historyRef.current = next;
      const s = socketRef.current;
      if (s?.connected) s.emit("draw", stroke);
      requestAnimationFrame(() => redrawCanvas(next));
      return next;
    });
  }, [drawPermission, currentColor, currentSize, redrawCanvas]);

  useEffect(() => {
    if (currentTool !== "text" && textComposerRef.current) {
      finalizeTextFromComposer();
    }
  }, [currentTool, finalizeTextFromComposer]);

  /* Only when a new box opens (`key` changes). Do not depend on full `textComposer`
   * or typing would re-select all text and each key replaces the whole field. */
  useEffect(() => {
    if (!textComposer?.key) return undefined;
    const id = requestAnimationFrame(() => {
      const el = textInputRef.current;
      if (el) {
        el.focus();
        try {
          const len = el.value.length;
          el.setSelectionRange(len, len);
        } catch {
          /* ignore */
        }
      }
    });
    return () => cancelAnimationFrame(id);
  }, [textComposer?.key]);

  useEffect(() => {
    if (
      textComposerRef.current &&
      activePageId !== textComposerRef.current.pageId
    ) {
      finalizeTextFromComposer();
    }
  }, [activePageId, finalizeTextFromComposer]);

  useEffect(() => {
    setMoveSelection([]);
    setMarqueeRect(null);
    setMoveDragPreview(null);
    moveSessionRef.current = null;
    setMoveDragging(false);
    requestAnimationFrame(() => redrawCanvas(historyRef.current));
  }, [activePageId, redrawCanvas]);

  useEffect(() => {
    if (!roomToken || !roomId) return undefined;
    setSocketError("");
    const newSocket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: { token: roomToken },
      reconnectionAttempts: 12,
      reconnectionDelayMax: 8000,
    });
    setSocket(newSocket);

    newSocket.on("connect", () => {
      setIsConnected(true);
      setSocketError("");
      setMySocketId(newSocket.id);
    });
    newSocket.on("draw_permission", ({ canDraw: allowed }) => {
      if (typeof allowed === "boolean") setDrawPermission(allowed);
    });
    newSocket.on("disconnect", () => setIsConnected(false));
    newSocket.on("connect_error", (err) => {
      setIsConnected(false);
      setSocketError(err?.message || "Could not connect");
    });

    newSocket.on("user_count_update", setUserCount);
    newSocket.on("drawing_history", (payload) => {
      const raw = Array.isArray(payload)
        ? { strokes: payload, canvasPages: [] }
        : payload || {};
      const list = Array.isArray(raw.strokes)
        ? raw.strokes.map((s) => ({ ...s }))
        : [];
      assignLegacyGroupIdsClient(list);
      let pages = Array.isArray(raw.canvasPages) ? [...raw.canvasPages] : [];
      if (!pages.length) {
        const pid =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `p-${Date.now()}`;
        pages = [{ id: pid, title: "Page 1" }];
        for (const s of list) {
          if (!s.pageId) s.pageId = pid;
        }
      }
      setCanvasPages(pages);
      const first = pages[0]?.id || "";
      setActivePageId((prev) =>
        pages.some((p) => p.id === prev) ? prev : first
      );
      setHistory(list);
      historyRef.current = list;
      requestAnimationFrame(() => redrawCanvas(list));
    });
    newSocket.on("full_resync", ({ strokes }) => {
      const list = Array.isArray(strokes) ? strokes.map((s) => ({ ...s })) : [];
      assignLegacyGroupIdsClient(list);
      setHistory(list);
      historyRef.current = list;
      requestAnimationFrame(() => redrawCanvas(list));
    });

    newSocket.on("canvas_pages_updated", ({ canvasPages: p }) => {
      if (!Array.isArray(p) || !p.length) return;
      setCanvasPages(p);
    });

    newSocket.on("canvas_page_deleted", ({ pageId, canvasPages: p, fallbackFirstId }) => {
      if (!pageId || !Array.isArray(p)) return;
      setCanvasPages(p);
      const fb =
        typeof fallbackFirstId === "string" ? fallbackFirstId : p[0]?.id;
      setHistory((prev) => {
        const next = prev.filter((evt) => {
          const eff = evt.pageId || fb;
          return eff !== pageId;
        });
        historyRef.current = next;
        requestAnimationFrame(() => redrawCanvas(next));
        return next;
      });
      setActivePageId((cur) => {
        if (cur !== pageId) return cur;
        return p[0]?.id || cur;
      });
    });

    newSocket.on("groups_page_changed", ({ groupIds, pageId }) => {
      if (!Array.isArray(groupIds) || !groupIds.length || typeof pageId !== "string")
        return;
      const idSet = new Set(groupIds);
      setHistory((prev) => {
        const next = prev.map((evt) =>
          evt.groupId && idSet.has(evt.groupId) ? { ...evt, pageId } : evt
        );
        historyRef.current = next;
        requestAnimationFrame(() => redrawCanvas(next));
        return next;
      });
    });

    newSocket.on("image_group_resized", (p) => {
      const groupId = p?.groupId;
      if (!groupId) return;
      const fx = Number(p?.fromX);
      const fy = Number(p?.fromY);
      const tx = Number(p?.toX);
      const ty = Number(p?.toY);
      if (![fx, fy, tx, ty].every(Number.isFinite)) return;
      setHistory((prev) => {
        const next = prev.map((evt) =>
          evt.groupId === groupId && evt.type === "image"
            ? {
                ...evt,
                fromX: fx,
                fromY: fy,
                toX: tx,
                toY: ty,
                ...(typeof p.imageScale === "number" &&
                Number.isFinite(p.imageScale)
                  ? { imageScale: p.imageScale }
                  : {}),
              }
            : evt
        );
        historyRef.current = next;
        requestAnimationFrame(() => redrawCanvas(next));
        return next;
      });
    });

    newSocket.on("groups_moved", ({ groupIds, dx, dy }) => {
      if (!Array.isArray(groupIds) || groupIds.length === 0) return;
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
      setHistory((prev) => {
        const next = applyGroupsOffset(prev, groupIds, dx, dy);
        historyRef.current = next;
        requestAnimationFrame(() => redrawCanvas(next));
        return next;
      });
    });

    newSocket.on("group_moved", ({ groupId, dx, dy }) => {
      if (!groupId || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
      setHistory((prev) => {
        const next = applyGroupsOffset(prev, [groupId], dx, dy);
        historyRef.current = next;
        requestAnimationFrame(() => redrawCanvas(next));
        return next;
      });
    });

    newSocket.on("groups_deleted", ({ groupIds }) => {
      if (!Array.isArray(groupIds) || groupIds.length === 0) return;
      const idSet = new Set(groupIds);
      setHistory((prev) => {
        const next = removeHistoryByGroupIds(prev, groupIds);
        historyRef.current = next;
        requestAnimationFrame(() => redrawCanvas(next));
        return next;
      });
      setMoveSelection((sel) => sel.filter((id) => !idSet.has(id)));
    });

    newSocket.on("remote_draw", (data) => {
      setHistory((prev) => {
        const next = [...prev, data];
        historyRef.current = next;
        requestAnimationFrame(() => redrawCanvas(next));
        return next;
      });
      if (data.socketId) {
        setCursors((prev) => {
          const cur = prev[data.socketId];
          if (!cur) return prev;
          return {
            ...prev,
            [data.socketId]: {
              ...cur,
              color: data.color || cur.color,
            },
          };
        });
      }
    });

    newSocket.on("remote_erase", (data) => {
      setHistory((prev) => {
        const next = [...prev, data];
        historyRef.current = next;
        requestAnimationFrame(() => redrawCanvas(next));
        return next;
      });
    });

    newSocket.on("board_cleared", () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      setHistory([]);
      historyRef.current = [];
      requestAnimationFrame(() => redrawCanvas([]));
    });

    newSocket.on("participants_update", ({ participants: p }) => {
      setParticipants(Array.isArray(p) ? p : []);
    });

    newSocket.on("remote_cursor", (payload) => {
      const strokeColor = payload.color || "#6366f1";
      setCursors((prev) => ({
        ...prev,
        [payload.socketId]: {
          nx: payload.nx,
          ny: payload.ny,
          name: payload.displayName || "Peer",
          color: strokeColor,
        },
      }));
    });

    newSocket.on("user_disconnected", (id) => {
      setCursors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    });

    return () => newSocket.close();
  }, [roomId, roomToken, redrawCanvas]);

  useEffect(() => {
    if (!peopleOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setPeopleOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [peopleOpen]);

  useEffect(() => {
    if (!drawPermission) setExtraColorMenuOpen(false);
  }, [drawPermission]);

  useEffect(() => {
    setRecentColorHexes(readRecentColorsFromStorage());
  }, []);

  /** Repair list if duplicates or bad casing ever appear (legacy storage, races). */
  useEffect(() => {
    const d = dedupeRecentColorsPreserveOrder(recentColorHexes);
    const same =
      d.length === recentColorHexes.length &&
      d.every((hex, i) => hex === recentColorHexes[i]);
    if (same) return;
    setRecentColorHexes(d);
    writeRecentColorsToStorage(d);
  }, [recentColorHexes]);

  useEffect(() => {
    if (!extraColorMenuOpen) setExtraColorSearch("");
  }, [extraColorMenuOpen]);

  useEffect(() => {
    if (!extraColorMenuOpen) return undefined;
    const id = requestAnimationFrame(() => {
      document.getElementById("extra-color-search")?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [extraColorMenuOpen]);

  const bumpRecentColor = useCallback((hex) => {
    const n = normalizeHexColor(hex) ?? canonicalRecentHex(hex);
    if (!n) return;
    const lc = n.toLowerCase();
    setRecentColorHexes((prev) => {
      const cleaned = dedupeRecentColorsPreserveOrder(prev);
      const rest = cleaned.filter((h) => h.toLowerCase() !== lc);
      const next = [n, ...rest].slice(0, MAX_RECENT_COLORS);
      writeRecentColorsToStorage(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!pagesMenuOpen) return undefined;
    const onDoc = (e) => {
      const el = pagesMenuRef.current;
      if (el && !el.contains(e.target)) setPagesMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setPagesMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDoc, true);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [pagesMenuOpen]);

  useEffect(() => {
    if (!downloadMenuOpen) return undefined;
    const onDoc = (e) => {
      const el = downloadMenuRef.current;
      if (el && !el.contains(e.target)) setDownloadMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setDownloadMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDoc, true);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [downloadMenuOpen]);

  useEffect(() => {
    if (!exportScopeModal) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setExportScopeModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exportScopeModal]);

  useEffect(() => {
    if (!extraColorMenuOpen) return undefined;
    const onDoc = (e) => {
      const el = extraColorMenuRef.current;
      if (el && !el.contains(e.target)) setExtraColorMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setExtraColorMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDoc, true);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [extraColorMenuOpen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (currentTool === "eraser") {
      ctx.lineWidth = eraserSize;
    } else {
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = currentSize;
    }
  }, [currentColor, currentSize, currentTool, eraserSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const area = canvasAreaRef.current;
    if (!canvas || !area) return;
    const ctx = canvas.getContext("2d");

    function resize() {
      const r = area.getBoundingClientRect();
      const w = Math.max(1, r.width);
      const h = Math.max(1, r.height);
      canvas.width = w * window.devicePixelRatio;
      canvas.height = h * window.devicePixelRatio;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      redrawCanvas(historyRef.current);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(area);
    window.addEventListener("resize", resize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [redrawCanvas]);

  const getCanvasPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX = e.clientX;
    let clientY = e.clientY;
    if (clientX == null && e.touches?.[0]) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }
    if (clientX == null && e.changedTouches?.[0]) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    }
    if (clientX == null) return { x: 0, y: 0 };
    const dpr = window.devicePixelRatio;
    return {
      x:
        ((clientX - rect.left) * (canvas.width / rect.width)) / dpr,
      y:
        ((clientY - rect.top) * (canvas.height / rect.height)) / dpr,
    };
  };

  const tryMovePointerDown = (e) => {
    if (!drawPermission || currentTool !== "move") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    const pos = getCanvasPos(e);
    const visible = strokesVisibleOnPage(
      historyRef.current,
      activePageIdRef.current,
      canvasPagesRef.current
    );
    const gid = findHitGroupAt(visible, pos.x, pos.y);

    if (!gid) {
      setMoveDragPreview(null);
      setMarqueeRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
      moveSessionRef.current = {
        phase: "marquee",
        startX: pos.x,
        startY: pos.y,
        curX: pos.x,
        curY: pos.y,
        captured: false,
      };
      return;
    }

    setMarqueeRect(null);

    if (e.shiftKey) {
      setMoveDragPreview(null);
      setMoveSelection((prev) => {
        const next = new Set(prev);
        if (next.has(gid)) next.delete(gid);
        else next.add(gid);
        return [...next];
      });
      moveSessionRef.current = null;
      return;
    }

    const sel = moveSelectionRef.current;
    if (!sel.includes(gid)) {
      setMoveDragPreview(null);
      setMoveSelection([gid]);
      moveSessionRef.current = {
        phase: "pending",
        groupIds: [gid],
        startX: pos.x,
        startY: pos.y,
      };
      return;
    }

    setMoveDragPreview(null);
    const snap = historyRef.current.map((ev) => ({ ...ev }));
    moveSessionRef.current = {
      phase: "dragging",
      groupIds: [...sel],
      baseHistory: snap,
      lastX: pos.x,
      lastY: pos.y,
      accDx: 0,
      accDy: 0,
    };
    setMoveDragging(true);
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const tryMovePointerMove = (e) => {
    const sess = moveSessionRef.current;
    if (!sess) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = getCanvasPos(e);
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;

    if (sess.phase === "pending") {
      if (Math.hypot(pos.x - sess.startX, pos.y - sess.startY) > 4) {
        const snap = historyRef.current.map((ev) => ({ ...ev }));
        const rdx = pos.x - sess.startX;
        const rdy = pos.y - sess.startY;
        const clamped = clampMoveDelta(snap, sess.groupIds, rdx, rdy, cw, ch);
        moveSessionRef.current = {
          phase: "dragging",
          groupIds: sess.groupIds,
          baseHistory: snap,
          lastX: pos.x,
          lastY: pos.y,
          accDx: clamped.dx,
          accDy: clamped.dy,
        };
        setMoveDragging(true);
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
          /* ignore */
        }
        redrawCanvas(
          applyGroupsOffset(snap, sess.groupIds, clamped.dx, clamped.dy)
        );
        flushSync(() =>
          setMoveDragPreview({ dx: clamped.dx, dy: clamped.dy })
        );
      }
      return;
    }

    if (sess.phase !== "dragging") return;
    e.preventDefault();
    const rdx = pos.x - sess.lastX;
    const rdy = pos.y - sess.lastY;
    sess.lastX = pos.x;
    sess.lastY = pos.y;
    const nextAccDx = sess.accDx + rdx;
    const nextAccDy = sess.accDy + rdy;
    const clamped = clampMoveDelta(
      sess.baseHistory,
      sess.groupIds,
      nextAccDx,
      nextAccDy,
      cw,
      ch
    );
    sess.accDx = clamped.dx;
    sess.accDy = clamped.dy;
    redrawCanvas(
      applyGroupsOffset(sess.baseHistory, sess.groupIds, sess.accDx, sess.accDy)
    );
    flushSync(() =>
      setMoveDragPreview({ dx: sess.accDx, dy: sess.accDy })
    );
  };

  const tryMovePointerUp = (e) => {
    const sess = moveSessionRef.current;
    const canvas = canvasRef.current;
    if (!sess) return;

    if (sess.phase === "pending") {
      moveSessionRef.current = null;
      setMoveDragPreview(null);
      return;
    }

    if (sess.phase !== "dragging") {
      moveSessionRef.current = null;
      setMoveDragPreview(null);
      return;
    }

    e.preventDefault();
    moveSessionRef.current = null;
    try {
      canvas?.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    setMoveDragging(false);
    setMoveDragPreview(null);
    const { groupIds, accDx, accDy } = sess;
    if (accDx !== 0 || accDy !== 0) {
      setHistory((prev) => {
        const next = applyGroupsOffset(prev, groupIds, accDx, accDy);
        historyRef.current = next;
        const s = socketRef.current;
        if (s?.connected)
          s.emit("move_groups", { groupIds, dx: accDx, dy: accDy });
        requestAnimationFrame(() => redrawCanvas(next));
        return next;
      });
      setMoveSelection([]);
    } else {
      redrawCanvas(historyRef.current);
    }
  };

  const tryMarqueePointerMove = (e) => {
    const sess = moveSessionRef.current;
    if (!sess || sess.phase !== "marquee") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    const pos = getCanvasPos(e);
    sess.curX = pos.x;
    sess.curY = pos.y;
    if (!sess.captured) {
      const dist = Math.hypot(pos.x - sess.startX, pos.y - sess.startY);
      if (dist > 3) {
        sess.captured = true;
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
          /* ignore */
        }
      }
    }
    const r = normalizedRect(sess.startX, sess.startY, sess.curX, sess.curY);
    setMarqueeRect(r);
  };

  const tryMarqueePointerUp = (e) => {
    const sess = moveSessionRef.current;
    const canvas = canvasRef.current;
    if (!sess || sess.phase !== "marquee") return;
    e.preventDefault();
    if (e.type === "pointercancel") {
      if (sess.captured) {
        try {
          canvas?.releasePointerCapture?.(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      moveSessionRef.current = null;
      setMarqueeRect(null);
      return;
    }
    if (sess.captured) {
      try {
        canvas?.releasePointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    moveSessionRef.current = null;
    const r = normalizedRect(sess.startX, sess.startY, sess.curX, sess.curY);
    setMarqueeRect(null);
    const MIN = 4;
    if (r.w < MIN && r.h < MIN) {
      if (!e.shiftKey) setMoveSelection([]);
      return;
    }
    const visibleMarq = strokesVisibleOnPage(
      historyRef.current,
      activePageIdRef.current,
      canvasPagesRef.current
    );
    const ids = collectGroupIdsInMarquee(visibleMarq, r);
    if (e.shiftKey) {
      setMoveSelection((prev) => [...new Set([...prev, ...ids])]);
    } else {
      setMoveSelection(ids);
    }
  };

  const handleCanvasPointerDown = (e) => {
    if (!drawPermission) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (currentTool === "text") {
      e.preventDefault();
      finalizeTextFromComposer();
      const pos = getCanvasPos(e);
      const pageId =
        activePageIdRef.current || canvasPagesRef.current[0]?.id || "";
      textDraftRef.current = "";
      setTextComposer({
        x: pos.x,
        y: pos.y,
        pageId,
        draft: "",
        key:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `t-${Date.now()}`,
      });
      return;
    }
    if (currentTool === "move") {
      tryMovePointerDown(e);
      return;
    }
    startDrawing(e);
  };

  const handleCanvasPointerMove = (e) => {
    const ms = moveSessionRef.current;
    if (ms?.phase === "marquee") {
      tryMarqueePointerMove(e);
      return;
    }
    if (ms?.phase === "pending" || ms?.phase === "dragging") {
      tryMovePointerMove(e);
      return;
    }
    draw(e);
  };

  const handleCanvasPointerUp = (e) => {
    const ms = moveSessionRef.current;
    if (ms?.phase === "marquee") {
      tryMarqueePointerUp(e);
      return;
    }
    if (ms?.phase === "pending" || ms?.phase === "dragging") {
      tryMovePointerUp(e);
      return;
    }
    stopDrawing(e);
  };

  const handleCanvasPointerLeave = (e) => {
    const ms = moveSessionRef.current;
    if (ms?.phase === "dragging") return;
    if (ms?.phase === "pending") {
      moveSessionRef.current = null;
      setMoveDragPreview(null);
      return;
    }
    if (ms?.phase === "marquee") {
      moveSessionRef.current = null;
      setMarqueeRect(null);
      setMoveDragPreview(null);
      return;
    }
    stopDrawing(e);
  };

  const cursorStrokeColor =
    currentTool === "eraser" ? "#94a3b8" : currentColor;

  const emitCursorFromEvent = useCallback(
    (e) => {
      if (!socket?.connected) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx =
        e.clientX ??
        (e.touches && e.touches[0] ? e.touches[0].clientX : undefined);
      const cy =
        e.clientY ??
        (e.touches && e.touches[0] ? e.touches[0].clientY : undefined);
      if (cx === undefined || cy === undefined) return;
      const nx = (cx - rect.left) / rect.width;
      const ny = (cy - rect.top) / rect.height;
      const now = performance.now();
      if (now - lastCursorEmit.current < 40) return;
      lastCursorEmit.current = now;
      socket.emit("cursor_move", {
        nx,
        ny,
        color: cursorStrokeColor,
      });
    },
    [socket, cursorStrokeColor]
  );

  const startDrawing = (e) => {
    if (!drawPermission) return;
    if (currentTool === "move") return;
    e.preventDefault();
    const pos = getCanvasPos(e);
    setLastPos(pos);
    setIsDrawing(true);

    if (SHAPE_TOOL_TYPES.includes(currentTool)) {
      setShapeStart(pos);
    } else {
      activePenGroupRef.current = crypto.randomUUID();
      freestyleMovedRef.current = false;
      const ctx = canvasRef.current.getContext("2d");
      if (currentTool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
        ctx.lineWidth = eraserSize;
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentSize;
      }
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  };

  const draw = (e) => {
    const ms = moveSessionRef.current;
    if (ms?.phase === "marquee") {
      tryMarqueePointerMove(e);
      return;
    }
    if (ms?.phase === "pending" || ms?.phase === "dragging") {
      tryMovePointerMove(e);
      return;
    }
    emitCursorFromEvent(e);
    const pos = getCanvasPos(e);

    if (!isDrawing || !canvasRef.current || !drawPermission) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");

    if (SHAPE_TOOL_TYPES.includes(currentTool)) {
      if (rafPreview.current) cancelAnimationFrame(rafPreview.current);
      rafPreview.current = requestAnimationFrame(() => {
        redrawCanvas(history);
        drawOnCanvas(ctx, {
          type: currentTool,
          fromX: shapeStart?.x,
          fromY: shapeStart?.y,
          toX: pos.x,
          toY: pos.y,
          color: currentColor,
          size: currentSize,
          eraserSize,
          filled:
            FILL_CAPABLE_SHAPES.has(currentTool) && shapeFilled,
        });
      });
      return;
    }

    if (currentTool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = eraserSize;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = currentSize;
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (Math.hypot(pos.x - lastPos.x, pos.y - lastPos.y) > 0.12) {
      freestyleMovedRef.current = true;
    }

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);

    const eventType = currentTool === "eraser" ? "erase" : "draw";
    const data = {
      type: eventType,
      fromX: lastPos.x,
      fromY: lastPos.y,
      toX: pos.x,
      toY: pos.y,
      color: currentColor,
      size: currentSize,
      eraserSize,
      groupId: activePenGroupRef.current,
      pageId:
        activePageIdRef.current || canvasPagesRef.current[0]?.id || undefined,
    };
    setHistory((prev) => [...prev, data]);
    if (socket && socket.connected) socket.emit(eventType, data);
    setLastPos(pos);
  };

  const stopDrawing = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);
    const ctx = canvasRef.current.getContext("2d");
    const pos = getCanvasPos(e);

    if (shapeStart && SHAPE_TOOL_TYPES.includes(currentTool)) {
      const shapeData = {
        type: currentTool,
        fromX: shapeStart.x,
        fromY: shapeStart.y,
        toX: pos.x,
        toY: pos.y,
        color: currentColor,
        size: currentSize,
        eraserSize,
        groupId: crypto.randomUUID(),
        pageId:
          activePageIdRef.current || canvasPagesRef.current[0]?.id || undefined,
        ...(FILL_CAPABLE_SHAPES.has(currentTool)
          ? { filled: shapeFilled }
          : {}),
      };
      drawOnCanvas(ctx, shapeData);
      setHistory((prev) => [...prev, shapeData]);
      if (socket && socket.connected) socket.emit("draw", shapeData);
      setShapeStart(null);
    } else if (
      !shapeStart &&
      (currentTool === "pen" || currentTool === "eraser")
    ) {
      if (!freestyleMovedRef.current) {
        const x = lastPos.x;
        const y = lastPos.y;
        if (currentTool === "eraser") {
          ctx.globalCompositeOperation = "destination-out";
          ctx.fillStyle = "#000";
          ctx.beginPath();
          ctx.arc(x, y, eraserSize / 2, 0, Math.PI * 2);
          ctx.fill();
          const dotErase = {
            type: "erase",
            fromX: x,
            fromY: y,
            toX: x,
            toY: y,
            color: currentColor,
            size: currentSize,
            eraserSize,
            dot: true,
            groupId: activePenGroupRef.current,
            pageId:
              activePageIdRef.current ||
              canvasPagesRef.current[0]?.id ||
              undefined,
          };
          setHistory((prev) => [...prev, dotErase]);
          if (socket && socket.connected) socket.emit("erase", dotErase);
        } else {
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = currentColor;
          ctx.beginPath();
          ctx.arc(x, y, Math.max(0.5, currentSize / 2), 0, Math.PI * 2);
          ctx.fill();
          const dotDraw = {
            type: "draw",
            fromX: x,
            fromY: y,
            toX: x,
            toY: y,
            color: currentColor,
            size: currentSize,
            eraserSize,
            dot: true,
            groupId: activePenGroupRef.current,
            pageId:
              activePageIdRef.current ||
              canvasPagesRef.current[0]?.id ||
              undefined,
          };
          setHistory((prev) => [...prev, dotDraw]);
          if (socket && socket.connected) socket.emit("draw", dotDraw);
        }
      }
    }
    ctx.beginPath();
  };

  const clearBoard = () => {
    if (role !== "host") return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHistory([]);
    if (socket && socket.connected) socket.emit("clear_board");
  };

  const undoLastRef = useRef(() => {});
  undoLastRef.current = () => {
    if (!drawPermission || !socket?.connected) return;
    socket.emit("undo_last");
  };

  const redoLastRef = useRef(() => {});
  redoLastRef.current = () => {
    if (!drawPermission || !socket?.connected) return;
    socket.emit("redo_last");
  };

  const deleteMoveSelectionRef = useRef(() => {});
  deleteMoveSelectionRef.current = () => {
    if (!drawPermission || currentTool !== "move") return;
    const ids = [...moveSelectionRef.current];
    if (ids.length === 0) return;
    moveSessionRef.current = null;
    setMoveDragging(false);
    setMoveDragPreview(null);
    setMarqueeRect(null);
    setMoveSelection([]);
    setHistory((prev) => {
      const next = removeHistoryByGroupIds(prev, ids);
      historyRef.current = next;
      const s = socketRef.current;
      if (s?.connected) s.emit("delete_groups", { groupIds: ids });
      requestAnimationFrame(() => redrawCanvas(next));
      return next;
    });
  };

  const placeImageFromFile = useCallback(
    (file, cx, cy) => {
      if (!drawPermission || !file?.type?.startsWith?.("image/")) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        if (typeof dataUrl !== "string" || dataUrl.length > 4_500_000) return;
        const im = new Image();
        im.onload = () => {
          const nw = im.naturalWidth;
          const nh = im.naturalHeight;
          const pageId =
            activePageIdRef.current || canvasPagesRef.current[0]?.id || "";
          const cr = canvas.getBoundingClientRect();
          const cw = Math.max(1, cr.width);
          const ch = Math.max(1, cr.height);
          const stroke = buildImageStroke(
            dataUrl,
            nw,
            nh,
            cw,
            ch,
            cx ?? cw / 2,
            cy ?? ch / 2,
            pageId
          );
          setHistory((prev) => {
            const next = [...prev, stroke];
            historyRef.current = next;
            const s = socketRef.current;
            if (s?.connected) s.emit("draw", stroke);
            requestAnimationFrame(() => redrawCanvas(next));
            return next;
          });
        };
        im.onerror = () => {};
        im.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [drawPermission, redrawCanvas]
  );

  const addCanvasPage = useCallback(() => {
    if (!drawPermission || !socket?.connected) return;
    socket.emit("add_canvas_page", {});
    setPagesMenuOpen(false);
  }, [drawPermission, socket]);

  const deleteCanvasPage = useCallback(
    (pageId) => {
      if (!drawPermission || !socket?.connected || !pageId) return;
      if (canvasPages.length <= 1) return;
      socket.emit("delete_canvas_page", { pageId });
      setPagesMenuOpen(false);
    },
    [drawPermission, socket, canvasPages.length]
  );

  const applyImageResize = useCallback(
    (groupId, newScale) => {
      if (!drawPermission || !groupId) return;
      setHistory((prev) => {
        const idx = prev.findIndex(
          (evt) => evt.groupId === groupId && evt.type === "image"
        );
        if (idx < 0) return prev;
        const updated = resizeImageStrokeByScale(prev[idx], newScale);
        const next = [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)];
        historyRef.current = next;
        const s = socketRef.current;
        if (s?.connected)
          s.emit("resize_image_group", {
            groupId,
            fromX: updated.fromX,
            fromY: updated.fromY,
            toX: updated.toX,
            toY: updated.toY,
            imageScale: updated.imageScale,
          });
        requestAnimationFrame(() => redrawCanvas(next));
        return next;
      });
    },
    [drawPermission, redrawCanvas]
  );

  const moveSelectionToPage = useCallback(
    (pageId) => {
      if (!drawPermission || !pageId || !socket?.connected) return;
      const ids = [...moveSelectionRef.current];
      if (!ids.length) return;
      socket.emit("set_groups_page", { groupIds: ids, pageId });
      setHistory((prev) => {
        const idSet = new Set(ids);
        const next = prev.map((evt) =>
          evt.groupId && idSet.has(evt.groupId) ? { ...evt, pageId } : evt
        );
        historyRef.current = next;
        requestAnimationFrame(() => redrawCanvas(next));
        return next;
      });
    },
    [drawPermission, socket, redrawCanvas]
  );

  const handleCanvasDragOver = (e) => {
    if (!drawPermission) return;
    e.preventDefault();
    try {
      e.dataTransfer.dropEffect = "copy";
    } catch {
      /* ignore */
    }
  };

  const handleCanvasDrop = (e) => {
    if (!drawPermission) return;
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (!f?.type?.startsWith?.("image/")) return;
    const pos = getCanvasPos(e);
    placeImageFromFile(f, pos.x, pos.y);
  };

  const onHiddenImageInputChange = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const canvas = canvasRef.current;
    const cr = canvas?.getBoundingClientRect();
    const cw = cr ? Math.max(1, cr.width) : undefined;
    const ch = cr ? Math.max(1, cr.height) : undefined;
    placeImageFromFile(f, cw != null ? cw / 2 : undefined, ch != null ? ch / 2 : undefined);
  };

  const getExportGeometry = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return {
      cssW: Math.max(1, canvas.clientWidth),
      cssH: Math.max(1, canvas.clientHeight),
      dpr: window.devicePixelRatio || 1,
    };
  };

  const safePageFilenamePart = (pages, pageId) => {
    const t = pages.find((p) => p.id === pageId)?.title || "page";
    return String(t)
      .replace(/[^\w\- ]+/g, "_")
      .replace(/\s+/g, "-")
      .slice(0, 48);
  };

  const downloadCurrentPageRaster = useCallback(
    async (mime, ext) => {
      const g = getExportGeometry();
      if (!g) return;
      const history = historyRef.current;
      const pages = canvasPagesRef.current;
      const pid = activePageIdRef.current || pages[0]?.id;
      if (!pid) return;
      setExportBusy(true);
      try {
        const strokes = strokesVisibleOnPage(history, pid, pages);
        const dataUrl = await rasterizeStrokesToDataURL(
          strokes,
          g.cssW,
          g.cssH,
          g.dpr,
          mime,
          ext === "jpg" ? 0.92 : undefined
        );
        const part = safePageFilenamePart(pages, pid);
        triggerDataUrlDownload(
          dataUrl,
          `whiteboard-${(roomId || "board").slice(0, 8)}-${part}.${ext}`
        );
      } finally {
        setExportBusy(false);
        setDownloadMenuOpen(false);
      }
    },
    [roomId]
  );

  const openExportScopeModal = (format) => {
    setDownloadMenuOpen(false);
    setExportScopeChoice("current");
    const pages = canvasPagesRef.current;
    const cur = activePageIdRef.current || pages[0]?.id || "";
    const pick = {};
    for (const p of pages) pick[p.id] = p.id === cur;
    setExportPickPages(pick);
    setExportScopeModal(format);
  };

  const runScopedPdfOrDoc = async () => {
    const g = getExportGeometry();
    if (!g || !exportScopeModal) return;
    const history = historyRef.current;
    const pages = canvasPagesRef.current;
    if (!pages.length) return;
    let pageIds = [];
    if (exportScopeChoice === "current") {
      pageIds = [activePageIdRef.current || pages[0].id];
    } else if (exportScopeChoice === "all") {
      pageIds = pages.map((p) => p.id);
    } else {
      pageIds = pages.map((p) => p.id).filter((id) => exportPickPages[id]);
      if (pageIds.length === 0) return;
    }
    setExportBusy(true);
    try {
      if (exportScopeModal === "pdf") {
        await exportPagesAsPdf({
          pageIds,
          history,
          pages,
          cssW: g.cssW,
          cssH: g.cssH,
          dpr: g.dpr,
          roomId,
        });
      } else {
        await exportPagesAsDocx({
          pageIds,
          history,
          pages,
          cssW: g.cssW,
          cssH: g.cssH,
          dpr: g.dpr,
          roomId,
        });
      }
      setExportScopeModal(null);
    } catch (err) {
      console.error(err);
    } finally {
      setExportBusy(false);
    }
  };

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      const timers = copyFeedbackTimersRef.current;
      if (timers.id) clearTimeout(timers.id);
      setCopyIdCopied(true);
      timers.id = setTimeout(() => {
        setCopyIdCopied(false);
        timers.id = null;
      }, 2000);
    } catch {
      /* ignore */
    }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      const timers = copyFeedbackTimersRef.current;
      if (timers.link) clearTimeout(timers.link);
      setCopyLinkCopied(true);
      timers.link = setTimeout(() => {
        setCopyLinkCopied(false);
        timers.link = null;
      }, 2000);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName))
        return;
      if (e.target?.isContentEditable) return;
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        drawPermission &&
        currentToolRef.current === "move" &&
        moveSelectionRef.current.length > 0
      ) {
        e.preventDefault();
        deleteMoveSelectionRef.current();
        return;
      }
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "z") {
        e.preventDefault();
        if (e.shiftKey) redoLastRef.current();
        else undoLastRef.current();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && k === "y") {
        e.preventDefault();
        redoLastRef.current();
        return;
      }
      if (k === "p") setCurrentTool("pen");
      if (k === "e") setCurrentTool("eraser");
      if (k === "v") setCurrentTool("move");
      if (k === "i") setCurrentTool("text");
      if (k === "l") setCurrentTool("line");
      if (k === "r") setCurrentTool("rectangle");
      if (k === "c") setCurrentTool("circle");
      if (k === "u") setCurrentTool("ellipse");
      if (k === "a") setCurrentTool("arrow");
      if (k === "t") setCurrentTool("triangle");
      if (k === "m") setCurrentTool("diamond");
      if (k === "b") setCurrentTool("roundRect");
      if (k === "8") setCurrentTool("star");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawPermission]);

  const drawTools = shapeOptions.filter((o) => o.group === "draw");
  const shapeTools = shapeOptions.filter((o) => o.group === "shapes");

  const onlineShort = `${userCount} online`;

  const sortedPeople = useMemo(() => {
    const list = Array.isArray(participants) ? [...participants] : [];
    list.sort((a, b) => {
      const ah = a.role === "host" ? 0 : 1;
      const bh = b.role === "host" ? 0 : 1;
      if (ah !== bh) return ah - bh;
      return String(a.displayName || "").localeCompare(
        String(b.displayName || ""),
        undefined,
        { sensitivity: "base" }
      );
    });
    return list;
  }, [participants]);

  const peopleRows = useMemo(() => {
    if (sortedPeople.length > 0) return sortedPeople;
    return [
      {
        socketId: mySocketId || "__local__",
        displayName,
        role,
        userKey: myUserKey || undefined,
        canDraw: drawPermission,
      },
    ];
  }, [sortedPeople, mySocketId, displayName, role, myUserKey, drawPermission]);

  const hostSetParticipantDraw = useCallback((targetUserKey, nextCanDraw) => {
    const s = socketRef.current;
    if (!s?.connected || !targetUserKey) return;
    s.emit("host_set_participant_draw", {
      targetUserKey,
      canDraw: nextCanDraw,
    });
  }, []);

  const filteredExtraColorSwatches = useMemo(() => {
    const q = extraColorSearch.trim().toLowerCase().replace(/^#/, "");
    if (!q) return EXTRA_COLOR_SWATCHES;
    return EXTRA_COLOR_SWATCHES.filter(({ hex, label }) => {
      const hexTail = hex.replace(/^#/, "").toLowerCase();
      return (
        label.toLowerCase().includes(q) ||
        hex.toLowerCase().includes(q) ||
        hexTail.includes(q)
      );
    });
  }, [extraColorSearch]);

  const strokesOnActiveCanvas = useMemo(
    () => strokesVisibleOnPage(history, activePageId, canvasPages),
    [history, activePageId, canvasPages]
  );

  const canvasSlideIndex = useMemo(() => {
    const n = canvasPages.length;
    if (n === 0) return null;
    const i = canvasPages.findIndex((p) => p.id === activePageId);
    const cur = i >= 0 ? i + 1 : 1;
    return { cur, n };
  }, [canvasPages, activePageId]);

  const selectedImageForPanel = useMemo(() => {
    if (currentTool !== "move" || moveSelection.length !== 1) return null;
    const gid = moveSelection[0];
    return (
      strokesOnActiveCanvas.find(
        (e) => e.groupId === gid && e.type === "image"
      ) || null
    );
  }, [currentTool, moveSelection, strokesOnActiveCanvas]);

  const moveSelectionOutline = useMemo(() => {
    if (currentTool !== "move" || moveSelection.length === 0) return null;
    if (marqueeRect != null) return null;
    const base = unionBoundsForGroups(strokesOnActiveCanvas, moveSelection);
    if (!base) return null;
    const d = moveDragPreview || { dx: 0, dy: 0 };
    return {
      x: base.x + d.dx,
      y: base.y + d.dy,
      w: base.w,
      h: base.h,
    };
  }, [
    currentTool,
    moveSelection,
    strokesOnActiveCanvas,
    moveDragPreview,
    marqueeRect,
  ]);

  return (
    <div className="cq-shell flex flex-col [&_a]:cursor-pointer [&_button:not(:disabled)]:cursor-pointer [&_button:disabled]:cursor-not-allowed [&_input[type=color]:not(:disabled)]:cursor-pointer [&_input[type=range]:not(:disabled)]:cursor-pointer">
      {/* Top navbar: Home (text only), room id, live status, theme, you */}
      <header className="cq-header-bar z-30 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 md:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="cq-navbar-link shrink-0 cursor-pointer text-sm">
            Home
          </Link>
          <span
            className="max-w-[200px] truncate font-mono text-xs text-cq-muted sm:max-w-md"
            title="Room"
          >
            {roomId}
          </span>
        </div>
        <div className="flex min-w-[12rem] flex-1 items-center gap-2 text-xs text-cq-muted">
          <span
            className={`inline-block w-2 h-2 rounded-full shrink-0 ${
              isConnected ? "bg-emerald-500" : "bg-red-500"
            }`}
            title={isConnected ? "Live" : "Off"}
          />
          <span className="truncate cursor-default" title="Users">
            {onlineShort}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 shrink-0 w-full sm:w-auto sm:ml-auto">
          <button
            type="button"
            onClick={copyRoomId}
            title="Copy ID"
            className="cq-btn-ghost cq-transition min-w-[4.75rem]"
          >
            {copyIdCopied ? "Copied!" : "Copy ID"}
          </button>
          <button
            type="button"
            onClick={copyInvite}
            title="Copy link"
            className="cq-btn-ghost cq-transition min-w-[4.75rem]"
          >
            {copyLinkCopied ? "Copied!" : "Copy link"}
          </button>
          <div className="relative" ref={pagesMenuRef}>
            <button
              type="button"
              title="Pages — click outside or Esc to close"
              aria-expanded={pagesMenuOpen}
              aria-haspopup="listbox"
              onClick={() => setPagesMenuOpen((o) => !o)}
              className="cq-btn-ghost cq-transition min-w-[4.5rem]"
            >
              Pages
              {canvasPages.length > 0
                ? ` (${canvasPages.findIndex((p) => p.id === activePageId) + 1}/${canvasPages.length})`
                : ""}
            </button>
            {pagesMenuOpen && (
              <div
                className="absolute right-0 top-full z-[100] mt-1 min-w-[13.5rem] rounded-md border border-cq-border bg-[var(--cq-surface)] py-1 text-left shadow-cq-md"
                role="listbox"
              >
                <p className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-cq-faint">
                  Open page
                </p>
                <ul className="max-h-52 list-none overflow-y-auto py-0.5">
                  {canvasPages.map((p) => (
                    <li
                      key={p.id}
                      className={`cq-transition flex w-full items-stretch border-b border-cq-border-subtle last:border-b-0 ${
                        p.id === activePageId ? "bg-[var(--cq-selected-bg)]" : ""
                      }`}
                    >
                      <button
                        type="button"
                        role="option"
                        aria-selected={p.id === activePageId}
                        className={`cq-transition min-w-0 flex-1 px-2 py-1.5 text-left text-[11px] hover:bg-cq-raised ${
                          p.id === activePageId
                            ? "font-medium text-[var(--cq-selected-text)]"
                            : "text-cq-text"
                        }`}
                        onClick={() => {
                          setActivePageId(p.id);
                          setPagesMenuOpen(false);
                        }}
                      >
                        {p.title}
                      </button>
                      <button
                        type="button"
                        disabled={
                          canvasPages.length <= 1 || !drawPermission || !isConnected
                        }
                        title={
                          canvasPages.length <= 1
                            ? "Cannot delete the only page"
                            : `Delete ${p.title}`
                        }
                        aria-label={`Delete ${p.title}`}
                        className={`cq-page-delete-btn cq-transition flex w-10 shrink-0 items-center justify-center border-l border-cq-border-subtle text-cq-muted hover:bg-cq-raised hover:text-cq-text disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-cq-muted ${
                          p.id === activePageId
                            ? "text-[var(--cq-selected-text)] hover:text-[var(--cq-selected-text)]"
                            : ""
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          deleteCanvasPage(p.id);
                        }}
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={!drawPermission || !isConnected}
                  title="Add a new blank page (like slides)"
                  className="w-full border-t border-cq-border px-2.5 py-2 text-left text-xs font-medium text-[var(--cq-accent)] hover:bg-cq-raised disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => addCanvasPage()}
                >
                  + Add new page
                </button>
              </div>
            )}
          </div>
          <input
            ref={imageFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onHiddenImageInputChange}
          />
          <button
            type="button"
            disabled={!drawPermission}
            onClick={() => imageFileInputRef.current?.click()}
            title="Add image — also drag & drop onto the canvas"
            className="cq-btn-ghost cq-transition inline-flex min-w-0 items-center gap-1.5 px-2"
          >
            <IconImage className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Add</span>
          </button>
          <div className="relative" ref={downloadMenuRef}>
            <button
              type="button"
              disabled={exportBusy}
              onClick={() => setDownloadMenuOpen((o) => !o)}
              title="Download"
              aria-label="Download"
              aria-expanded={downloadMenuOpen}
              aria-haspopup="menu"
              className="cq-btn-ghost cq-transition inline-flex min-w-0 items-center justify-center px-2 disabled:cursor-wait disabled:opacity-50"
            >
              <IconDownload className="h-4 w-4 shrink-0" />
            </button>
            {downloadMenuOpen && (
              <div
                className="absolute right-0 top-full z-[100] mt-1 min-w-[13.5rem] rounded-md border border-cq-border bg-[var(--cq-surface)] py-1 text-left shadow-cq-md"
                role="menu"
              >
                <p className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-cq-faint">
                  Download
                </p>
                <button
                  type="button"
                  role="menuitem"
                  disabled={exportBusy}
                  className="cq-transition block w-full px-2.5 py-2 text-left text-xs text-cq-text hover:bg-cq-raised disabled:opacity-40"
                  onClick={() => downloadCurrentPageRaster("image/png", "png")}
                >
                  Download as PNG (this page)
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={exportBusy}
                  className="cq-transition block w-full px-2.5 py-2 text-left text-xs text-cq-text hover:bg-cq-raised disabled:opacity-40"
                  onClick={() => downloadCurrentPageRaster("image/jpeg", "jpg")}
                >
                  Download as JPG (this page)
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={exportBusy}
                  className="cq-transition block w-full border-t border-cq-border-subtle px-2.5 py-2 text-left text-xs text-cq-text hover:bg-cq-raised disabled:opacity-40"
                  onClick={() => openExportScopeModal("pdf")}
                >
                  Download as PDF…
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={exportBusy}
                  className="cq-transition block w-full px-2.5 py-2 text-left text-xs text-cq-text hover:bg-cq-raised disabled:opacity-40"
                  onClick={() => openExportScopeModal("doc")}
                >
                  Download as Word (.docx)…
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => undoLastRef.current()}
            disabled={!drawPermission}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            className="cq-btn-ghost cq-transition inline-flex min-w-0 items-center justify-center px-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <IconUndo className="h-4 w-4 shrink-0" />
          </button>
          <button
            type="button"
            onClick={() => redoLastRef.current()}
            disabled={!drawPermission}
            title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
            aria-label="Redo"
            className="cq-btn-ghost cq-transition inline-flex min-w-0 items-center justify-center px-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <IconRedo className="h-4 w-4 shrink-0" />
          </button>
          {role === "host" && (
            <button type="button" onClick={clearBoard} title="Clear" className="cq-btn-danger cq-transition">
              Clear
            </button>
          )}
          <ThemeToggleButton />
          <button
            type="button"
            onClick={() => setPeopleOpen((o) => !o)}
            title="People"
            aria-label="People in room"
            aria-expanded={peopleOpen}
            className={`cq-transition flex cursor-pointer items-center gap-2 rounded-full border border-cq-border bg-cq-raised py-1 pl-1 pr-2.5 shadow-cq-sm hover:border-cq-accent-soft hover:bg-cq-mid ${
              peopleOpen ? "ring-2 ring-cq-accent ring-offset-1 ring-offset-cq-surface" : ""
            }`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white shadow-sm dark:bg-cq-accent dark:text-cq-on-accent dark:shadow-cq-sm">
              {nameInitial(displayName)}
            </span>
            <span className="min-w-[1ch] text-sm font-semibold tabular-nums text-cq-text">
              {userCount}
            </span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {!sidebarOpen && (
          <div className="cq-toolbar-rail z-20 flex w-12 shrink-0 flex-col items-center border-r border-cq-border-subtle pt-3">
            <button
              type="button"
              title="Tools"
              aria-label="Tools"
              aria-expanded={false}
              aria-controls="whiteboard-tools-sidebar"
              onClick={() => setSidebarOpen(true)}
              className="cq-transition flex h-9 w-9 items-center justify-center rounded-cq-lg border border-cq-border bg-cq-surface-soft text-cq-text shadow-cq-sm hover:border-cq-accent-soft hover:bg-cq-raised"
            >
              <IconSidebarClosed />
            </button>
            <span className="mt-2 px-1 text-center text-[10px] leading-tight text-cq-faint">
              Tools
            </span>
          </div>
        )}

        <aside
          id="whiteboard-tools-sidebar"
          className={`cq-sidebar cq-transition flex shrink-0 flex-col overflow-hidden border-r border-cq-border-subtle transition-[width] duration-200 ease-out ${
            sidebarOpen
              ? "w-[min(15rem,calc(100vw-2rem))]"
              : "w-0 border-0 overflow-hidden"
          }`}
        >
          <div className="flex min-w-[13.5rem] shrink-0 items-center justify-between gap-2 border-b border-cq-border-subtle px-2.5 py-2">
            <span className="text-[11px] font-semibold tracking-tight text-cq-text">
              Tools
            </span>
            <button
              type="button"
              title="Close"
              aria-label="Close"
              aria-expanded={true}
              onClick={() => setSidebarOpen(false)}
              className="cq-transition flex h-8 w-8 items-center justify-center rounded-cq border border-cq-border bg-cq-surface-soft text-cq-muted hover:border-cq-accent-soft hover:bg-cq-raised"
            >
              <IconSidebarOpen />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2.5 space-y-3 min-w-[13.5rem] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0">
            {!drawPermission && (
              <p className="text-[11px] text-cq-warn">View-only — drawing is disabled.</p>
            )}

            <div className="cq-tool-well p-2">
              <p className="mb-1.5 text-[9px] font-medium uppercase tracking-wider text-cq-faint">
                Draw
              </p>
              <div className="flex flex-wrap gap-1">
                {drawTools.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    title={TOOL_HINTS[opt.value] || opt.label}
                    aria-label={TOOL_HINTS[opt.value] || opt.label}
                    onClick={() => setCurrentTool(opt.value)}
                    className={`cq-transition flex h-9 min-w-0 flex-1 items-center justify-center rounded-cq border ${
                      currentTool === opt.value
                        ? "border-cq-accent bg-[var(--cq-selected-bg)] text-[var(--cq-selected-text)] shadow-cq-sm"
                        : "border-transparent text-cq-muted hover:bg-cq-raised"
                    }`}
                  >
                    {opt.value === "text" ? (
                      <span className="select-none text-[10px] font-semibold leading-none tracking-tight">
                        Text
                      </span>
                    ) : (
                      <ToolRailIcon
                        tool={opt.value}
                        className="h-[14px] w-[14px] shrink-0"
                      />
                    )}
                  </button>
                ))}
                {drawPermission &&
                  currentTool === "move" &&
                  moveSelection.length > 0 && (
                    <button
                      type="button"
                      title="Delete selection — Delete or Backspace"
                      aria-label="Delete selection"
                      onClick={() => deleteMoveSelectionRef.current()}
                      className="cq-transition flex h-9 min-w-[2.25rem] shrink-0 items-center justify-center rounded-cq border border-cq-border bg-cq-surface-soft text-[var(--cq-danger)] hover:border-[var(--cq-danger)] hover:bg-[color-mix(in_srgb,var(--cq-danger)_10%,transparent)]"
                    >
                      <IconTrash className="h-[15px] w-[15px] shrink-0" />
                    </button>
                  )}
              </div>
            </div>

            <div className="cq-tool-well p-2">
              <p className="mb-1.5 text-[9px] font-medium uppercase tracking-wider text-cq-faint">
                Shapes
              </p>
              <div className="grid grid-cols-4 gap-1">
                {shapeTools.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    title={TOOL_HINTS[opt.value] || opt.label}
                    aria-label={TOOL_HINTS[opt.value] || opt.label}
                    onClick={() => setCurrentTool(opt.value)}
                    className={`cq-transition flex h-9 items-center justify-center rounded-cq border ${
                      currentTool === opt.value
                        ? "border-cq-accent bg-[var(--cq-selected-bg)] text-[var(--cq-selected-text)] shadow-cq-sm"
                        : "border-transparent text-cq-muted hover:bg-cq-raised"
                    }`}
                  >
                    <ToolRailIcon
                      tool={opt.value}
                      className="w-[15px] h-[15px] shrink-0"
                    />
                  </button>
                ))}
              </div>
              <div
                className={`mt-2 flex gap-0.5 rounded-cq border p-0.5 ${
                  FILL_CAPABLE_SHAPES.has(currentTool)
                    ? "border-cq-border bg-cq-surface-soft"
                    : "border-cq-border-subtle opacity-50"
                }`}
              >
                <button
                  type="button"
                  disabled={!drawPermission || !FILL_CAPABLE_SHAPES.has(currentTool)}
                  onClick={() => setShapeFilled(true)}
                  title="Fill"
                  aria-label="Fill"
                  className={`cq-transition flex h-8 flex-1 items-center justify-center gap-1 rounded-md text-[10px] font-medium ${
                    shapeFilled && FILL_CAPABLE_SHAPES.has(currentTool)
                      ? "bg-cq-surface text-[var(--cq-selected-text)] shadow-cq-sm"
                      : "text-cq-muted hover:text-cq-text"
                  }`}
                >
                  <IconFill className="w-3.5 h-3.5 shrink-0" />
                  Fill
                </button>
                <button
                  type="button"
                  disabled={!drawPermission || !FILL_CAPABLE_SHAPES.has(currentTool)}
                  onClick={() => setShapeFilled(false)}
                  title="Outline"
                  aria-label="Outline"
                  className={`cq-transition flex h-8 flex-1 items-center justify-center gap-1 rounded-md text-[10px] font-medium ${
                    !shapeFilled && FILL_CAPABLE_SHAPES.has(currentTool)
                      ? "bg-cq-surface text-[var(--cq-selected-text)] shadow-cq-sm"
                      : "text-cq-muted hover:text-cq-text"
                  }`}
                >
                  <IconOutline className="w-3.5 h-3.5 shrink-0" />
                  Outline
                </button>
              </div>
            </div>

            <div className="cq-tool-well p-2">
              <p className="mb-1.5 text-[9px] font-medium uppercase tracking-wider text-cq-faint">
                Color
              </p>
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap gap-1.5">
                  {recentColorHexes.map((hex) => {
                    const { label } = swatchForHex(hex);
                    return (
                      <button
                        key={hex}
                        type="button"
                        disabled={!drawPermission}
                        title={label}
                        aria-label={label}
                        className={`h-7 w-7 shrink-0 rounded-full border-2 cq-transition ${
                          currentColor.toLowerCase() === hex.toLowerCase()
                            ? "scale-105 border-cq-accent ring-2 ring-cq-accent-soft"
                            : "border-cq-border"
                        }`}
                        style={{ backgroundColor: hex }}
                        onClick={() => {
                          setCurrentColor(hex);
                          bumpRecentColor(hex);
                        }}
                      />
                    );
                  })}
                  <input
                    type="color"
                    value={currentColor}
                    disabled={!drawPermission}
                    onChange={(e) => {
                      const n = normalizeHexColor(e.target.value);
                      if (n) {
                        setCurrentColor(n);
                        bumpRecentColor(n);
                      } else {
                        setCurrentColor(e.target.value);
                      }
                    }}
                    title="Color"
                    aria-label="Color"
                    className="h-7 w-7 cursor-pointer rounded-cq border border-cq-border bg-transparent"
                    suppressHydrationWarning
                  />
                </div>
                {EXTRA_COLOR_SWATCHES.length > 0 && (
                  <div className="relative" ref={extraColorMenuRef}>
                    <button
                      type="button"
                      disabled={!drawPermission}
                      title="click to open more colors"
                      aria-expanded={extraColorMenuOpen}
                      aria-haspopup="listbox"
                      aria-controls="extra-color-listbox"
                      id="extra-color-trigger"
                      onClick={() => setExtraColorMenuOpen((o) => !o)}
                      className="cq-transition flex w-full items-center justify-between gap-2 rounded-md border border-cq-border-subtle bg-cq-surface py-1.5 pl-2 pr-2 text-left text-[11px] font-medium text-cq-text hover:border-cq-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span>More colors…</span>
                      <span className="text-cq-muted" aria-hidden>
                        {extraColorMenuOpen ? "▲" : "▼"}
                      </span>
                    </button>
                    {extraColorMenuOpen && (
                      <div
                        id="extra-color-listbox"
                        role="listbox"
                        aria-labelledby="extra-color-trigger"
                        className="cq-extra-color-list absolute left-0 right-0 top-full z-[80] mt-0.5 flex max-h-56 flex-col overflow-hidden rounded-md border border-cq-border"
                      >
                        <div className="shrink-0 border-b border-cq-border px-2 py-1.5">
                          <label htmlFor="extra-color-search" className="sr-only">
                            Search colors
                          </label>
                          <input
                            id="extra-color-search"
                            type="search"
                            autoComplete="off"
                            spellCheck={false}
                            value={extraColorSearch}
                            onChange={(e) => setExtraColorSearch(e.target.value)}
                            placeholder="Search by name or hex…"
                            className="w-full rounded-md border border-cq-border-subtle bg-[var(--cq-input-bg)] px-2 py-1.5 text-[11px] text-cq-text placeholder:text-cq-muted outline-none focus:border-cq-accent-soft"
                          />
                        </div>
                        <ul className="cq-extra-color-scroll max-h-[11.5rem] min-h-0 flex-1 overflow-y-auto py-0.5">
                          {filteredExtraColorSwatches.length === 0 ? (
                            <li
                              className="px-2 py-3 text-center text-[11px] text-cq-muted"
                              role="presentation"
                            >
                              No matches
                            </li>
                          ) : (
                            filteredExtraColorSwatches.map(({ hex, label }) => (
                              <li key={hex} role="presentation">
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={
                                    currentColor.toLowerCase() === hex.toLowerCase()
                                  }
                                  data-selected={
                                    currentColor.toLowerCase() === hex.toLowerCase()
                                      ? "true"
                                      : "false"
                                  }
                                  className="cq-extra-color-option cq-transition flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-[11px] text-cq-text"
                                  onClick={() => {
                                    setCurrentColor(hex);
                                    bumpRecentColor(hex);
                                    setExtraColorMenuOpen(false);
                                  }}
                                >
                                  <span className="min-w-0 flex-1 truncate">{label}</span>
                                  <span
                                    className="h-5 w-5 shrink-0 rounded border border-cq-border"
                                    style={{ backgroundColor: hex }}
                                    title={hex}
                                    aria-hidden
                                  />
                                </button>
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="cq-tool-well p-2">
              <p className="mb-1 text-[9px] font-medium uppercase tracking-wider text-cq-faint">
                Size ({currentTool === "eraser" ? eraserSize : currentSize}px)
              </p>
              <input
                type="range"
                min="1"
                max="70"
                disabled={!drawPermission}
                title="Size"
                aria-label="Size"
                value={
                  currentTool === "pen"
                    ? currentSize
                    : currentTool === "eraser"
                    ? eraserSize
                    : currentSize
                }
                onChange={(e) =>
                  currentTool === "pen"
                    ? setCurrentSize(+e.target.value)
                    : currentTool === "eraser"
                    ? setEraserSize(+e.target.value)
                    : setCurrentSize(+e.target.value)
                }
                className="w-full accent-[var(--cq-accent)]"
                suppressHydrationWarning
              />
            </div>
          </div>
        </aside>

        {/* Canvas + People (right panel sits beside canvas, not over tools) */}
        <div className="flex min-h-0 min-w-0 flex-1">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col p-2 md:p-3">
            <div
              ref={canvasAreaRef}
              className="cq-canvas-frame relative min-h-[280px] flex-1 overflow-hidden"
            >
              {currentTool === "move" &&
                marqueeRect != null &&
                (marqueeRect.w > 0.5 || marqueeRect.h > 0.5) && (
                  <div
                    className="pointer-events-none absolute z-[5] border-2 border-dashed border-[var(--cq-accent)] bg-[color-mix(in_srgb,var(--cq-accent)_14%,transparent)]"
                    style={{
                      left: marqueeRect.x,
                      top: marqueeRect.y,
                      width: Math.max(1, marqueeRect.w),
                      height: Math.max(1, marqueeRect.h),
                    }}
                    aria-hidden
                  />
                )}
              {currentTool === "move" && moveSelectionOutline && (
                <div
                  className="pointer-events-none absolute z-[7] rounded-sm border-2 border-dotted border-[var(--cq-accent)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--cq-canvas-shell-bg)_70%,transparent)]"
                  style={{
                    left: moveSelectionOutline.x,
                    top: moveSelectionOutline.y,
                    width: moveSelectionOutline.w,
                    height: moveSelectionOutline.h,
                  }}
                  aria-hidden
                />
              )}
              {canvasSlideIndex != null && (
                <div
                  className="pointer-events-none absolute bottom-2 left-2 z-[8] rounded-md border border-cq-border bg-[var(--cq-card-bg-solid)] px-2.5 py-1 shadow-cq-sm"
                  aria-live="polite"
                >
                  <span className="text-[9px] font-medium uppercase tracking-wider text-cq-faint">
                    Page
                  </span>
                  <span className="ml-1 text-xs font-medium tabular-nums text-cq-muted">
                    {canvasSlideIndex.cur} / {canvasSlideIndex.n}
                  </span>
                </div>
              )}
              <canvas
                ref={canvasRef}
                className={`absolute inset-0 block h-full w-full touch-none ${
                  !drawPermission
                    ? "cursor-not-allowed opacity-90"
                    : currentTool === "move"
                    ? moveDragging
                      ? "cursor-grabbing"
                      : marqueeRect != null
                      ? "cursor-crosshair"
                      : "cursor-grab"
                    : currentTool === "text"
                    ? "cursor-text"
                    : "cq-canvas-cursor-draw"
                }`}
                width={1200}
                height={600}
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onPointerCancel={handleCanvasPointerUp}
                onPointerLeave={handleCanvasPointerLeave}
                onDragOver={handleCanvasDragOver}
                onDrop={handleCanvasDrop}
                style={{
                  touchAction: "none",
                  background: "transparent",
                }}
              />
              {textComposer &&
                textComposer.pageId === activePageId &&
                drawPermission && (
                  <input
                    key={textComposer.key}
                    ref={textInputRef}
                    type="text"
                    aria-label="Type text"
                    autoComplete="off"
                    maxLength={MAX_TEXT_CHARS}
                    defaultValue=""
                    placeholder="Type…"
                    className="absolute z-[15] min-w-[10rem] max-w-[min(92vw,22rem)] rounded border-2 border-sky-500 bg-[color-mix(in_srgb,var(--cq-surface)_88%,transparent)] px-2 py-1 text-sm text-cq-text shadow-cq-sm outline-none backdrop-blur-[2px]"
                    style={{
                      left: textComposer.x,
                      top: textComposer.y,
                    }}
                    onChange={(ev) => {
                      textDraftRef.current = ev.target.value;
                    }}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter") {
                        ev.preventDefault();
                        finalizeTextFromComposer();
                      }
                      if (ev.key === "Escape") {
                        ev.preventDefault();
                        textDraftRef.current = "";
                        textComposerRef.current = null;
                        setTextComposer(null);
                      }
                    }}
                    onBlur={() => finalizeTextFromComposer()}
                  />
                )}
              <div className="pointer-events-none absolute inset-0">
                {Object.entries(cursors).map(([id, c]) => {
                  const bg = c.color || "#6366f1";
                  const fg = pickContrastingText(bg);
                  return (
                    <div
                      key={id}
                      className="absolute flex flex-col items-start"
                      style={{
                        left: `${(c.nx ?? 0) * 100}%`,
                        top: `${(c.ny ?? 0) * 100}%`,
                        transform: "translate(-4px, -4px)",
                      }}
                    >
                      <span
                        className="max-w-[8rem] truncate rounded px-1.5 py-0.5 text-[10px] font-medium shadow"
                        style={{ backgroundColor: bg, color: fg }}
                      >
                        {c.name}
                      </span>
                      <span
                        className="mt-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-cq-canvas"
                        style={{ backgroundColor: bg }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {peopleOpen && (
            <aside
              className="cq-sidebar flex w-[min(18rem,calc(100vw-2rem))] shrink-0 flex-col border-l border-cq-border-subtle shadow-cq"
              aria-label="People in room"
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-cq-border-subtle px-3 py-2.5">
                <h2 className="text-sm font-semibold text-cq-text">People</h2>
                <button
                  type="button"
                  title="Close"
                  aria-label="Close"
                  onClick={() => setPeopleOpen(false)}
                  className="cq-transition flex h-8 w-8 cursor-pointer items-center justify-center rounded-cq border border-transparent text-cq-muted hover:bg-cq-raised"
                >
                  <span className="text-lg leading-none" aria-hidden>
                    ×
                  </span>
                </button>
              </div>
              <p className="shrink-0 px-3 pt-2 text-[10px] font-medium uppercase tracking-wider text-cq-faint">
                In the room
              </p>
              <ul className="min-h-0 flex-1 list-none space-y-1 overflow-y-auto p-2 [scrollbar-width:thin]">
                {peopleRows.map((p) => {
                  const isYou =
                    mySocketId && p.socketId === mySocketId
                      ? true
                      : p.socketId === "__local__";
                  const samePersonAsYou =
                    Boolean(
                      p.userKey && myUserKey && p.userKey === myUserKey
                    ) || isYou;
                  const hue = avatarHueFromName(p.displayName);
                  return (
                    <li
                      key={p.socketId}
                      className="cq-transition flex items-center gap-2.5 rounded-cq-lg border border-transparent px-2 py-2 hover:bg-cq-surface-soft"
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-cq-on-accent shadow-cq-sm"
                        style={{
                          backgroundColor: `hsl(${hue} 52% 40%)`,
                        }}
                      >
                        {nameInitial(p.displayName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-cq-text">
                          {p.displayName}
                          {isYou ? (
                            <span className="font-normal text-cq-muted">
                              {" "}
                              (You)
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs capitalize text-cq-muted">
                          {p.role}
                          {typeof p.canDraw === "boolean" && p.role !== "host" ? (
                            <span className="text-cq-faint">
                              {" · "}
                              {p.canDraw ? "Can draw" : "View only"}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {role === "host" &&
                      p.userKey &&
                      !samePersonAsYou &&
                      p.role !== "host" ? (
                        p.role === "viewer" ? (
                          <span
                            className="shrink-0 rounded-md border border-cq-border-subtle px-1.5 py-1 text-[10px] font-medium text-cq-muted"
                            title="This person joined as a viewer. They need an editor invite link to draw; you cannot enable drawing from here."
                          >
                            View
                          </span>
                        ) : (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={p.canDraw}
                            aria-label={
                              p.canDraw
                                ? `${p.displayName}: can draw; switch to view-only`
                                : `${p.displayName}: view-only; allow drawing`
                            }
                            title={
                              p.canDraw
                                ? "Switch this person to view-only (they stay in the room)"
                                : "Allow this person to draw again"
                            }
                            onClick={() =>
                              hostSetParticipantDraw(p.userKey, !p.canDraw)
                            }
                            className={`relative h-6 w-10 shrink-0 rounded-full border p-0.5 transition-colors ${
                              p.canDraw
                                ? "border-emerald-700/35 bg-emerald-600"
                                : "border-cq-border bg-cq-surface-soft"
                            }`}
                          >
                            <span
                              className={`pointer-events-none absolute left-0.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow ring-1 ring-black/10 transition-transform duration-200 ease-out motion-reduce:transition-none ${
                                p.canDraw ? "translate-x-4" : "translate-x-0"
                              }`}
                              aria-hidden
                            />
                          </button>
                        )
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </aside>
          )}
        </div>
      </div>

      {selectedImageForPanel && drawPermission && (
        <div
          role="dialog"
          aria-label="Image size"
          className="fixed bottom-5 right-5 z-[95] w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border border-cq-border bg-[var(--cq-card-bg-solid)] p-3 shadow-cq-md"
        >
          <p className="mb-2 text-[11px] font-semibold text-cq-text">Image size</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cq-border bg-cq-surface-soft text-cq-muted hover:border-cq-accent-soft hover:text-cq-text"
              title="Smaller"
              aria-label="Zoom out"
              onClick={() => {
                const s = selectedImageForPanel;
                const cur =
                  s.imageScale ??
                  (s.naturalWidth
                    ? Math.abs(s.toX - s.fromX) / s.naturalWidth
                    : 0.2);
                applyImageResize(s.groupId, cur * 0.88);
              }}
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3M8 11h6" strokeLinecap="round" />
              </svg>
            </button>
            <input
              type="range"
              className="h-2 min-w-0 flex-1 cursor-pointer accent-[var(--cq-accent)]"
              aria-valuemin={IMAGE_SCALE_SLIDER_MIN * 100}
              aria-valuemax={IMAGE_SCALE_SLIDER_MAX * 100}
              min={Math.round(IMAGE_SCALE_SLIDER_MIN * 100)}
              max={Math.round(IMAGE_SCALE_SLIDER_MAX * 100)}
              value={Math.round(
                ((selectedImageForPanel.imageScale ??
                  (selectedImageForPanel.naturalWidth
                    ? Math.abs(
                        selectedImageForPanel.toX - selectedImageForPanel.fromX
                      ) / selectedImageForPanel.naturalWidth
                    : IMAGE_SCALE_SLIDER_MIN)) *
                  100)
              )}
              onChange={(e) =>
                applyImageResize(
                  selectedImageForPanel.groupId,
                  Number(e.target.value) / 100
                )
              }
            />
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cq-border bg-cq-surface-soft text-cq-muted hover:border-cq-accent-soft hover:text-cq-text"
              title="Larger"
              aria-label="Zoom in"
              onClick={() => {
                const s = selectedImageForPanel;
                const cur =
                  s.imageScale ??
                  (s.naturalWidth
                    ? Math.abs(s.toX - s.fromX) / s.naturalWidth
                    : 0.2);
                applyImageResize(s.groupId, cur * 1.12);
              }}
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M11 8v6M8 11h6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <label className="mt-3 flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-cq-faint">
              Move image to page
            </span>
            <select
              key={selectedImageForPanel.groupId}
              className="rounded-md border border-cq-border bg-[var(--cq-input-bg)] px-2 py-1.5 text-[11px] text-cq-text"
              defaultValue=""
              onChange={(e) => {
                const v = e.target.value;
                e.target.value = "";
                if (v) moveSelectionToPage(v);
              }}
            >
              <option value="">Choose page…</option>
              {canvasPages.map((p) => (
                <option
                  key={p.id}
                  value={p.id}
                  disabled={p.id === activePageId}
                >
                  {p.title}
                  {p.id === activePageId ? " (current)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {exportScopeModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setExportScopeModal(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-scope-title"
            className="w-full max-w-md rounded-xl border border-cq-border bg-[var(--cq-card-bg-solid)] p-4 shadow-cq-md"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2
              id="export-scope-title"
              className="mb-2 text-sm font-semibold text-cq-text"
            >
              {exportScopeModal === "pdf"
                ? "Download as PDF"
                : "Download as Word (.docx)"}
            </h2>
            <p className="mb-3 text-xs text-cq-muted">
              Each exported page is a snapshot of the canvas: pen strokes, shapes,
              images, and eraser marks on that page—everything drawn there. Output
              matches your current canvas size.
            </p>
            <div className="flex flex-col gap-2 text-sm text-cq-text">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-cq-raised">
                <input
                  type="radio"
                  name="exportScope"
                  className="accent-[var(--cq-accent)]"
                  checked={exportScopeChoice === "current"}
                  onChange={() => setExportScopeChoice("current")}
                />
                <span>Current page only</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-cq-raised">
                <input
                  type="radio"
                  name="exportScope"
                  className="accent-[var(--cq-accent)]"
                  checked={exportScopeChoice === "all"}
                  onChange={() => setExportScopeChoice("all")}
                />
                <span>All pages (entire file)</span>
              </label>
              <div className="rounded-lg border border-cq-border-subtle p-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-md p-1 hover:bg-cq-raised">
                  <input
                    type="radio"
                    name="exportScope"
                    className="accent-[var(--cq-accent)]"
                    checked={exportScopeChoice === "pick"}
                    onChange={() => setExportScopeChoice("pick")}
                  />
                  <span className="font-medium">Choose pages</span>
                  <span className="text-xs text-cq-muted">
                    (e.g. page 1 and 2 only out of 4)
                  </span>
                </label>
                {exportScopeChoice === "pick" && (
                  <div className="mt-2 space-y-2 border-t border-cq-border-subtle pt-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-cq-border bg-cq-surface-soft px-2 py-1 text-[11px] text-cq-text hover:bg-cq-raised"
                        onClick={() => {
                          const next = {};
                          for (const p of canvasPages) next[p.id] = true;
                          setExportPickPages(next);
                        }}
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-cq-border bg-cq-surface-soft px-2 py-1 text-[11px] text-cq-text hover:bg-cq-raised"
                        onClick={() => {
                          const next = {};
                          for (const p of canvasPages) next[p.id] = false;
                          setExportPickPages(next);
                        }}
                      >
                        Clear
                      </button>
                    </div>
                    <ul className="max-h-40 list-none space-y-1 overflow-y-auto pr-1">
                      {canvasPages.map((p) => (
                        <li key={p.id}>
                          <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-cq-raised">
                            <input
                              type="checkbox"
                              className="accent-[var(--cq-accent)]"
                              checked={!!exportPickPages[p.id]}
                              onChange={() => {
                                setExportPickPages((prev) => ({
                                  ...prev,
                                  [p.id]: !prev[p.id],
                                }));
                                setExportScopeChoice("pick");
                              }}
                            />
                            <span>
                              {p.title}
                              {p.id === activePageId ? " (current)" : ""}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    {exportScopeChoice === "pick" &&
                      !canvasPages.some((p) => exportPickPages[p.id]) && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400">
                          Select at least one page to download.
                        </p>
                      )}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="cq-btn-ghost cq-transition rounded-lg px-3 py-2 text-sm"
                onClick={() => setExportScopeModal(null)}
                disabled={exportBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cq-btn-primary cq-transition rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                disabled={
                  exportBusy ||
                  (exportScopeChoice === "pick" &&
                    !canvasPages.some((p) => exportPickPages[p.id]))
                }
                onClick={() => void runScopedPdfOrDoc()}
              >
                {exportBusy ? "Working…" : "Download"}
              </button>
            </div>
          </div>
        </div>
      )}

      {(!isConnected || socketError) && (
        <div className="fixed left-1/2 top-16 z-50 max-w-[90vw] -translate-x-1/2 rounded-full bg-gradient-to-r from-cq-danger to-cq-danger-hover px-4 py-2 text-center text-sm text-white shadow-cq">
          {socketError || "Reconnecting…"}
        </div>
      )}
    </div>
  );
}
