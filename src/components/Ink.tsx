import type { CSSProperties, ReactNode } from 'react'
import { INK_PHRASES, type InkPhraseKey } from '@/styles/ink-phrases'

/**
 * 손글씨 문구. 서브셋 폰트에 담긴 문구만 키로 고를 수 있게 해서,
 * 임의의 글자가 손글씨로 들어가 폴백이 섞이는 일을 막는다.
 */
export function InkPhrase({
  phrase,
  size,
  rotate = 0,
  className = '',
  style,
}: {
  phrase: InkPhraseKey
  size: number
  rotate?: number
  className?: string
  style?: CSSProperties
}) {
  return (
    <span
      className={`ink-hand ${className}`}
      style={{
        fontSize: size,
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
        display: 'inline-block',
        ...style,
      }}
    >
      {INK_PHRASES[phrase]}
    </span>
  )
}

/**
 * 펜으로 그은 밑줄. stroke-dashoffset을 풀어 왼쪽에서 오른쪽으로 그어진다 (§4 ink-draw).
 */
export function InkUnderline({
  width = 312,
  color = 'var(--rule-ink)',
  strokeWidth = 1.6,
  delayMs = 0,
  className = '',
}: {
  width?: number
  color?: string
  strokeWidth?: number
  delayMs?: number
  className?: string
}) {
  // 원본 패스는 폭 312 기준으로 그려졌다. viewBox로 늘려 쓴다.
  return (
    <svg
      className={className}
      width="100%"
      height="8"
      viewBox="0 0 312 8"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
      style={{ display: 'block', marginTop: -4, maxWidth: width }}
    >
      <path
        className="m-draw"
        d="M1 5 C 86 1, 222 8, 311 3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        style={{ strokeDasharray: 330, strokeDashoffset: 330, '--d': `${delayMs}ms` } as object}
      />
    </svg>
  )
}

/** 제목 아래 짧은 손자국 밑줄 (홈 화면). */
export function InkFlourish({ delayMs = 0 }: { delayMs?: number }) {
  return (
    <svg
      width="168"
      height="12"
      viewBox="0 0 168 12"
      fill="none"
      aria-hidden="true"
      style={{ display: 'block', marginTop: 4 }}
    >
      <path
        className="m-draw"
        d="M2 8 C 40 3, 102 11, 166 4"
        stroke="var(--pen)"
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ strokeDasharray: 180, strokeDashoffset: 180, '--d': `${delayMs}ms` } as object}
      />
    </svg>
  )
}

/** 필수조건 탈락 취소선 (§5). */
export function InkStrike({ delayMs = 0 }: { delayMs?: number }) {
  return (
    <svg
      className="row__strike"
      width="100%"
      height="26"
      viewBox="0 0 294 26"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
      style={{ right: 11 }}
    >
      <path
        className="m-strike"
        d="M4 17 C 76 9, 200 20, 290 8"
        stroke="var(--pen)"
        strokeWidth="2.4"
        strokeLinecap="round"
        style={{ strokeDasharray: 310, strokeDashoffset: 310, '--d': `${delayMs}ms` } as object}
      />
    </svg>
  )
}

/** 형광펜 — 화면당 최대 1곳 (§1 색 사용 규칙). */
export function Hilite({ delayMs = 0, children }: { delayMs?: number; children: ReactNode }) {
  return (
    <span className="m-hilite" style={{ '--d': `${delayMs}ms` } as object}>
      {children}
    </span>
  )
}
