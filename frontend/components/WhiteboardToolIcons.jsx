/** Compact SVG icons for the whiteboard tool rail (light + dark via currentColor). */

/** Fountain pen — rounded capsule body, pointed nib (outline only) */
export function IconPen({ className = "w-5 h-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6.5 19.8 8.5 17.5 15.5 4.5Q16.5 3 18 3.8Q19.5 4.6 18.8 6.2L12.5 15.5 6.5 19.8Z" />
    </svg>
  );
}

/** Wide translucent marker stroke */
export function IconHighlighter({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 18l8-8 4 4-8 8H4v-4z" fill="currentColor" fillOpacity="0.35" />
      <path d="M12 10l2-2 3 3-2 2" />
      <path d="M15 7l2-2" />
    </svg>
  );
}

/** Masking tape strip */
export function IconTape({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="9" width="18" height="6" rx="1" fill="currentColor" fillOpacity="0.25" />
      <path d="M3 12h18" strokeDasharray="2 2" opacity="0.6" />
      <path d="M7 9V7M12 9V7M17 9V7" opacity="0.5" />
    </svg>
  );
}

/** Handheld laser pointer with beam tip */
export function IconLaser({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4.5 19.5l6.2-6.2" />
      <path d="M9.2 14.8l1.6 1.6c.4.4 1 .4 1.4 0l1.2-1.2c.4-.4.4-1 0-1.4L12 12.2" />
      <path d="M10.8 11l2.2-2.2" />
      <circle cx="17.2" cy="6.8" r="1.35" fill="#ef4444" stroke="#ef4444" strokeWidth="0.5" />
      <path d="M14.2 8.2l1.6-1.6" stroke="#ef4444" strokeWidth="1.5" />
      <path d="M18.4 5.6l1.3-1.3M19.1 7.8l1.5.2M16.5 5l-.2-1.5" stroke="#ef4444" strokeWidth="1.25" opacity="0.85" />
    </svg>
  );
}

/** Lucide-style eraser (rubber + edge) */
export function IconEraser({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l2.6 2.6c1 1 1 2.5 0 3.4L13 21" />
      <path d="M22 21H7" />
      <path d="m10 10 2 2" />
    </svg>
  );
}

/** Laser dot mode preview (popup) */
export function IconLaserDotPreview({ className = "h-3 w-3" }) {
  return (
    <span
      className={`inline-block rounded-full bg-red-500 shadow-[0_0_8px_2px_rgba(239,68,68,0.85)] ${className}`}
      aria-hidden
    />
  );
}

/** Laser line mode preview — thin dotted red trail */
export function IconLaserLinePreview({ className = "h-4 w-10" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 10"
      fill="none"
      aria-hidden
    >
      <line
        x1="2"
        y1="5"
        x2="38"
        y2="5"
        stroke="#ef4444"
        strokeWidth="4"
        strokeDasharray="3 3"
        strokeLinecap="round"
        opacity="0.25"
      />
      <line
        x1="2"
        y1="5"
        x2="38"
        y2="5"
        stroke="#ef4444"
        strokeWidth="1.25"
        strokeDasharray="3 3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Freehand lasso selection — dashed loop */
export function IconLasso({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8.5 6.5c-2.5 1-4 3.2-4 5.8 0 3.9 3.1 7 7 7 2.2 0 4.1-1 5.3-2.6" strokeDasharray="3 2.5" />
      <path d="M15.8 16.7c1.8-1.2 3.2-3.2 3.2-5.7 0-4.4-3.6-8-8-8-1.8 0-3.5.6-4.8 1.6" strokeDasharray="3 2.5" />
      <path d="M17 4l1.5 1.5M19 6l1.5-.5M18 3.5l.5 1.5" strokeWidth="1.5" opacity="0.75" />
    </svg>
  );
}

/** Move / reposition tool — four-way drag hint */
export function IconMove({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      <path d="m8 8-3-3M16 8l3-3M16 16l3 3M8 16l-3 3" />
    </svg>
  );
}

export function IconImage({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10.5" r="1.5" />
      <path d="M21 17l-5-5-4 4-3-3-6 6" />
    </svg>
  );
}

export function IconTrash({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function IconLine({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M5 19L19 5" />
    </svg>
  );
}

export function IconRect({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="4" y="5" width="16" height="14" rx="1" />
    </svg>
  );
}

export function IconCircle({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

export function IconEllipse({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <ellipse cx="12" cy="12" rx="9" ry="6" />
    </svg>
  );
}

export function IconArrow({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

export function IconTriangle({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
      <path d="M12 4L4 20h16L12 4z" />
    </svg>
  );
}

export function IconDiamond({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
      <path d="M12 2l9 10-9 10-9-10 9-10z" />
    </svg>
  );
}

export function IconRoundRect({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="4" />
    </svg>
  );
}

export function IconStar({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
      <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6L12 2z" />
    </svg>
  );
}

export function IconFill({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" aria-hidden>
      <path
        d="M12 3.5c-3.2 2.4-6 6-6 11a6 6 0 1012 0c0-5-2.8-8.6-6-11z"
        fill="currentColor"
        fillOpacity="0.3"
        stroke="currentColor"
      />
    </svg>
  );
}

export function IconOutline({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="5" y="6" width="14" height="12" rx="1.5" />
    </svg>
  );
}

export function IconUndo({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-15-6.3L3 13" />
    </svg>
  );
}

export function IconRedo({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 15-6.3L21 13" />
    </svg>
  );
}

export function IconDownload({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

const ICONS = {
  pen: IconPen,
  highlighter: IconHighlighter,
  tape: IconTape,
  eraser: IconEraser,
  laser: IconLaser,
  lasso: IconLasso,
  move: IconMove,
  line: IconLine,
  rectangle: IconRect,
  circle: IconCircle,
  ellipse: IconEllipse,
  arrow: IconArrow,
  triangle: IconTriangle,
  diamond: IconDiamond,
  roundRect: IconRoundRect,
  star: IconStar,
};

export function ToolRailIcon({ tool, className }) {
  const Cmp = ICONS[tool] || IconLine;
  return <Cmp className={className} />;
}
