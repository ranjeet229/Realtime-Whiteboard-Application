/** Compact SVG icons for the whiteboard tool rail (light + dark via currentColor). */

export function IconPen({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14.5 3.5l6 6L8 22H3v-5L14.5 3.5z" />
      <path d="M12.5 5.5l6 6" opacity="0.85" />
    </svg>
  );
}

/** Lucide-style eraser (rubber + edge) — reads as eraser at small sizes */
export function IconEraser({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l2.6 2.6c1 1 1 2.5 0 3.4L13 21" />
      <path d="M22 21H7" />
      <path d="m10 10 2 2" />
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

const ICONS = {
  pen: IconPen,
  eraser: IconEraser,
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
