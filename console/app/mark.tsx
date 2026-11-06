/** The Interlace mark: orange leads, green follows, at −30°. Colours come from the DS brand tokens. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <g transform="rotate(-30 50 50)">
        <rect x="10" y="18" width="62" height="28" rx="14" fill="var(--brand-mark-bar-o)" />
        <rect x="28" y="54" width="62" height="28" rx="14" fill="var(--brand-mark-bar-g)" />
      </g>
    </svg>
  );
}
