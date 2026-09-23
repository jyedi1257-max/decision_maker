/** 화면에서 쓰는 선 아이콘. 이모지는 쓰지 않는다. */

export function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M11 2 L4 9 L11 16"
        stroke="var(--soft)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function PlusIcon({ size = 14, color = 'var(--soft)' }: { size?: number; color?: string }) {
  const c = size / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden="true">
      <path
        d={`M${c} 1 V${size - 1} M1 ${c} H${size - 1}`}
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M2 2 L12 12 M12 2 L2 12"
        stroke="var(--icon-mute)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function CheckIcon({ delayMs = 0 }: { delayMs?: number }) {
  return (
    <svg
      width="20"
      height="16"
      viewBox="0 0 20 16"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path
        className="m-draw"
        d="M2 8.5 L7 13.5 L18 2.5"
        stroke="var(--ink)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ strokeDasharray: 34, strokeDashoffset: 34, '--d': `${delayMs}ms` } as object}
      />
    </svg>
  )
}

export function ArrowUpIcon({ color = 'var(--accent)' }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 13 V3 M3.5 7.5 L8 3 L12.5 7.5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ArrowDownIcon({ color = 'var(--soft)' }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 3 V13 M3.5 8.5 L8 13 L12.5 8.5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function LockIcon({ delayMs = 0 }: { delayMs?: number }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M6 10 V7 a5 5 0 0 1 10 0 v3" stroke="var(--soft)" strokeWidth="1.5" strokeLinecap="round" />
      <rect
        className="m-draw"
        x="4.5"
        y="10"
        width="13"
        height="9.5"
        rx="2.5"
        stroke="var(--soft)"
        strokeWidth="1.5"
        style={{ strokeDasharray: 60, strokeDashoffset: 60, '--d': `${delayMs}ms` } as object}
      />
    </svg>
  )
}

export function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.5 L9.8 6.2 L14.5 8 L9.8 9.8 L8 14.5 L6.2 9.8 L1.5 8 L6.2 6.2 Z"
        stroke="var(--pen)"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CautionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M8 1 L15 14 H1 Z" stroke="var(--soft)" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 6 V9.5 M8 11.6 v.4" stroke="var(--soft)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 13 H13 V5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export function ArrowRightIcon({ delayMs = 0 }: { delayMs?: number }) {
  return (
    <svg width="26" height="14" viewBox="0 0 26 14" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path
        className="m-draw"
        d="M1 7 H24 M18 2 L24 7 L18 12"
        stroke="var(--pen)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ strokeDasharray: 48, strokeDashoffset: 48, '--d': `${delayMs}ms` } as object}
      />
    </svg>
  )
}

/** 보관함 — 뚜껑 덮인 상자. */
export function ArchiveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="2.5" width="13" height="3.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.8 6 V13.5 H13.2 V6 M6.2 9 H9.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
