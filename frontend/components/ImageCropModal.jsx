"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const MAX_DATA_URL_CHARS = 4_500_000;
const MIN_CROP_NAT = 8;

function clampRectToImage({ x, y, w, h }, iw, ih) {
  let ww = Math.max(MIN_CROP_NAT, w);
  let hh = Math.max(MIN_CROP_NAT, h);
  if (ww > iw) ww = iw;
  if (hh > ih) hh = ih;
  let xx = Math.max(0, Math.min(x, iw - ww));
  let yy = Math.max(0, Math.min(y, ih - hh));
  return { x: xx, y: yy, w: ww, h: hh };
}

function validInitialRect(r, iw, ih) {
  if (!r || typeof r !== "object") return false;
  const x = Number(r.x);
  const y = Number(r.y);
  const w = Number(r.w);
  const h = Number(r.h);
  if (![x, y, w, h].every(Number.isFinite)) return false;
  if (w < MIN_CROP_NAT || h < MIN_CROP_NAT) return false;
  if (x < -0.5 || y < -0.5 || x + w > iw + 0.5 || y + h > ih + 0.5) return false;
  return true;
}

/** @param {number} nx @param {number} ny — natural image coords */
function hitTestHandle(nx, ny, crop, m) {
  const { x, y, w, h } = crop;
  const slopX = Math.max(8, (14 / m.dispW) * m.natW);
  const slopY = Math.max(8, (14 / m.dispH) * m.natH);

  const onN = ny <= y + slopY;
  const onS = ny >= y + h - slopY;
  const onW = nx <= x + slopX;
  const onE = nx >= x + w - slopX;
  const midX = nx > x + slopX && nx < x + w - slopX;
  const midY = ny > y + slopY && ny < y + h - slopY;

  if (onN && onW) return "nw";
  if (onN && onE) return "ne";
  if (onS && onW) return "sw";
  if (onS && onE) return "se";
  if (onN && midX) return "n";
  if (onS && midX) return "s";
  if (onW && midY) return "w";
  if (onE && midY) return "e";
  if (nx >= x && nx <= x + w && ny >= y && ny <= y + h) return "move";
  return null;
}

function applyResizeKind(kind, base, dxN, dyN, natW, natH) {
  const { x, y, w, h } = base;
  switch (kind) {
    case "move":
      return clampRectToImage({ x: x + dxN, y: y + dyN, w, h }, natW, natH);
    case "se":
      return clampRectToImage({ x, y, w: w + dxN, h: h + dyN }, natW, natH);
    case "e":
      return clampRectToImage({ x, y, w: w + dxN, h }, natW, natH);
    case "s":
      return clampRectToImage({ x, y, w, h: h + dyN }, natW, natH);
    case "w":
      return clampRectToImage({ x: x + dxN, y, w: w - dxN, h }, natW, natH);
    case "n":
      return clampRectToImage({ x, y: y + dyN, w, h: h - dyN }, natW, natH);
    case "nw":
      return clampRectToImage(
        { x: x + dxN, y: y + dyN, w: w - dxN, h: h - dyN },
        natW,
        natH
      );
    case "ne":
      return clampRectToImage({ x, y: y + dyN, w: w + dxN, h: h - dyN }, natW, natH);
    case "sw":
      return clampRectToImage({ x: x + dxN, y, w: w - dxN, h: h + dyN }, natW, natH);
    default:
      return base;
  }
}

/**
 * @param {object} props
 * @param {string} props.sourceDataUrl — full image (original); crop dialog always shows this
 * @param {{ x: number, y: number, w: number, h: number } | null | undefined} props.initialCropRect — region on source matching current canvas image (natural px)
 * @param {(r: { croppedDataUrl: string, cropRectOnSource: object, cropSourceDataUrl: string }) => void} props.onApply
 */
export default function ImageCropModal({
  open,
  sourceDataUrl,
  initialCropRect,
  onCancel,
  onApply,
}) {
  const wrapRef = useRef(null);
  const imgRef = useRef(null);
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [error, setError] = useState("");
  const dragRef = useRef(null);
  const initialCropRectRef = useRef(initialCropRect);

  useEffect(() => {
    initialCropRectRef.current = initialCropRect;
  }, [initialCropRect]);

  const initCropFromImageDims = useCallback((iw, ih) => {
    if (iw < 1 || ih < 1) return;
    setNat({ w: iw, h: ih });
    const init = initialCropRectRef.current;
    if (validInitialRect(init, iw, ih)) {
      setCrop(clampRectToImage({ x: init.x, y: init.y, w: init.w, h: init.h }, iw, ih));
    } else {
      setCrop({ x: 0, y: 0, w: iw, h: ih });
    }
    setError("");
  }, []);

  useEffect(() => {
    if (!open) {
      setNat({ w: 0, h: 0 });
      setCrop({ x: 0, y: 0, w: 0, h: 0 });
      setError("");
      dragRef.current = null;
      return;
    }
    const t = window.setTimeout(() => {
      const img = imgRef.current;
      if (img?.complete && img.naturalWidth > 0) {
        initCropFromImageDims(img.naturalWidth, img.naturalHeight);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [open, sourceDataUrl, initialCropRect, initCropFromImageDims]);

  const onImgLoad = useCallback(
    (e) => {
      const iw = e.currentTarget.naturalWidth;
      const ih = e.currentTarget.naturalHeight;
      initCropFromImageDims(iw, ih);
    },
    [initCropFromImageDims]
  );

  const displayMetrics = useCallback(() => {
    const img = imgRef.current;
    if (!img || !nat.w) return null;
    const r = img.getBoundingClientRect();
    const dispW = r.width;
    const dispH = r.height;
    if (dispW < 1 || dispH < 1) return null;
    return { r, dispW, dispH, natW: nat.w, natH: nat.h };
  }, [nat.w, nat.h]);

  const onPointerDownOverlay = useCallback(
    (e) => {
      if (!nat.w || e.button !== 0) return;
      const m = displayMetrics();
      if (!m) return;
      const relX = e.clientX - m.r.left;
      const relY = e.clientY - m.r.top;
      const nx = (relX / m.dispW) * m.natW;
      const ny = (relY / m.dispH) * m.natH;
      const kind = hitTestHandle(nx, ny, crop, m);
      if (!kind) return;
      dragRef.current = {
        kind,
        startX: e.clientX,
        startY: e.clientY,
        crop: { ...crop },
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [nat.w, crop, displayMetrics]
  );

  const onPointerMoveOverlay = useCallback(
    (e) => {
      const d = dragRef.current;
      if (!d || !nat.w) return;
      const m = displayMetrics();
      if (!m) return;
      const dxN = ((e.clientX - d.startX) / m.dispW) * m.natW;
      const dyN = ((e.clientY - d.startY) / m.dispH) * m.natH;
      const next = applyResizeKind(d.kind, d.crop, dxN, dyN, m.natW, m.natH);
      setCrop(next);
    },
    [nat.w, displayMetrics]
  );

  const endDrag = useCallback((e) => {
    if (dragRef.current && e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    dragRef.current = null;
  }, []);

  const handleApply = useCallback(() => {
    const img = imgRef.current;
    if (!img?.complete || !nat.w || crop.w < MIN_CROP_NAT || crop.h < MIN_CROP_NAT) {
      setError("Could not read image for cropping.");
      return;
    }
    const c = document.createElement("canvas");
    c.width = Math.round(crop.w);
    c.height = Math.round(crop.h);
    const ctx = c.getContext("2d");
    if (!ctx) {
      setError("Canvas is not available.");
      return;
    }
    try {
      ctx.drawImage(
        img,
        Math.round(crop.x),
        Math.round(crop.y),
        Math.round(crop.w),
        Math.round(crop.h),
        0,
        0,
        c.width,
        c.height
      );
    } catch {
      setError("Could not crop this image.");
      return;
    }

    let quality = 0.9;
    let out = "";
    for (let i = 0; i < 5; i++) {
      out = c.toDataURL("image/jpeg", quality);
      if (out.length <= MAX_DATA_URL_CHARS) break;
      quality -= 0.12;
    }
    if (!out || out.length > MAX_DATA_URL_CHARS) {
      setError("Cropped image is still too large. Try a smaller crop area.");
      return;
    }
    const cropRectOnSource = {
      x: Math.round(crop.x),
      y: Math.round(crop.y),
      w: Math.round(crop.w),
      h: Math.round(crop.h),
    };
    onApply({
      croppedDataUrl: out,
      cropRectOnSource,
      cropSourceDataUrl: sourceDataUrl,
    });
  }, [nat.w, crop, onApply, sourceDataUrl]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (ev) => {
      if (ev.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open || !sourceDataUrl) return null;

  const pct = (v, max) => `${(v / max) * 100}%`;

  return (
    <div
      className="fixed inset-0 z-[180] flex items-center justify-center bg-black/55 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-crop-title"
        className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-xl border border-cq-border bg-[var(--cq-card-bg-solid)] shadow-cq-md"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-cq-border px-3 py-2">
          <h2 id="image-crop-title" className="text-sm font-semibold text-cq-text">
            Crop image
          </h2>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-cq-muted hover:bg-cq-surface-soft hover:text-cq-text"
            aria-label="Close"
            onClick={onCancel}
          >
            ×
          </button>
        </div>
        <p className="px-3 pt-2 text-xs text-cq-muted">
          The full original is shown here. Drag any edge or corner to adjust the crop, or
          drag inside the box to move it. Apply updates what appears on the canvas; you can
          open crop again later to include more of the original.
        </p>
        <div className="max-h-[58vh] overflow-auto p-3">
          <div ref={wrapRef} className="relative mx-auto w-fit max-w-full">
            <img
              ref={imgRef}
              src={sourceDataUrl}
              alt=""
              draggable={false}
              onLoad={onImgLoad}
              className="block max-h-[55vh] max-w-full select-none rounded border border-cq-border"
            />
            {nat.w > 0 && (
              <div
                className="absolute inset-0 cursor-crosshair touch-none"
                onPointerDown={onPointerDownOverlay}
                onPointerMove={onPointerMoveOverlay}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                <div
                  className="pointer-events-none absolute bg-black/55"
                  style={{
                    left: 0,
                    top: 0,
                    width: "100%",
                    height: pct(crop.y, nat.h),
                  }}
                />
                <div
                  className="pointer-events-none absolute bg-black/55"
                  style={{
                    left: 0,
                    top: pct(crop.y + crop.h, nat.h),
                    width: "100%",
                    bottom: 0,
                  }}
                />
                <div
                  className="pointer-events-none absolute bg-black/55"
                  style={{
                    left: 0,
                    top: pct(crop.y, nat.h),
                    width: pct(crop.x, nat.w),
                    height: pct(crop.h, nat.h),
                  }}
                />
                <div
                  className="pointer-events-none absolute bg-black/55"
                  style={{
                    left: pct(crop.x + crop.w, nat.w),
                    top: pct(crop.y, nat.h),
                    right: 0,
                    height: pct(crop.h, nat.h),
                  }}
                />
                <div
                  className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
                  style={{
                    left: pct(crop.x, nat.w),
                    top: pct(crop.y, nat.h),
                    width: pct(crop.w, nat.w),
                    height: pct(crop.h, nat.h),
                  }}
                >
                  {/* Corner + edge handle markers (visual only; hit-test is on overlay) */}
                  {[
                    ["0%", "0%"],
                    ["50%", "0%"],
                    ["100%", "0%"],
                    ["100%", "50%"],
                    ["100%", "100%"],
                    ["50%", "100%"],
                    ["0%", "100%"],
                    ["0%", "50%"],
                  ].map(([lx, ly], hi) => (
                    <span
                      key={hi}
                      className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-white bg-[var(--cq-accent)] shadow"
                      style={{ left: lx, top: ly }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        {error ? (
          <p className="px-3 pb-1 text-xs text-red-600 dark:text-red-400">{error}</p>
        ) : null}
        <div className="flex justify-end gap-2 border-t border-cq-border px-3 py-2.5">
          <button
            type="button"
            className="rounded-lg border border-cq-border px-3 py-1.5 text-sm text-cq-text hover:bg-cq-surface-soft"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-[var(--cq-accent)] px-3 py-1.5 text-sm font-medium text-cq-on-accent hover:opacity-95"
            onClick={handleApply}
            disabled={!nat.w || crop.w < MIN_CROP_NAT || crop.h < MIN_CROP_NAT}
          >
            Apply crop
          </button>
        </div>
      </div>
    </div>
  );
}
