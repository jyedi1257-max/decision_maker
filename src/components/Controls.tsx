import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BackIcon, DragHandleIcon } from './Icons'
import { delay } from '@/styles/motion'

/** 화면 머리말. 뒤로가기 · 단계 표시 · 저장 상태 (§6 화면 구성 공통) */
export function TopBar({
  back,
  center,
  right,
}: {
  back?: string
  center?: ReactNode
  right?: ReactNode
}) {
  return (
    <div className="topbar m-lift">
      {back ? (
        <Link to={back} aria-label="뒤로" className="iconbtn iconbtn--back">
          <BackIcon />
        </Link>
      ) : (
        <span style={{ width: 30 }} />
      )}
      {typeof center === 'string' ? <span className="topbar__step">{center}</span> : center}
      {right ?? <span style={{ width: 44 }} />}
    </div>
  )
}

/** 7칸 진행 단계바 (§5). 완료 구간 --ink, 미완료 --border. */
export function StepBar({ step, total = 7 }: { step: number; total?: number }) {
  return (
    <div className="stepbar" role="img" aria-label={`${total}단계 중 ${step}단계`}>
      {Array.from({ length: total }, (_, i) => {
        const done = i < step
        const isCurrent = i === step - 1
        return (
          <span
            key={i}
            className={`stepbar__cell${done ? ' stepbar__cell--done' : ''}${isCurrent ? ' m-grow' : ''}`}
            style={isCurrent ? ({ '--d': '120ms' } as object) : undefined}
          />
        )
      })}
    </div>
  )
}

/**
 * 5칸 척도 — 확신도·만족도 (§5).
 * 선택 이하 칸은 --accent로 채우고, 이상 칸은 투명 테두리만 남긴다.
 */
export function Scale5({
  value,
  onChange,
  name,
  lowLabel,
  highLabel,
}: {
  value: number | null
  onChange: (v: number) => void
  name: string
  lowLabel?: string
  highLabel?: string
}) {
  return (
    <>
      <div className="scale5" role="radiogroup" aria-label={name}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${name} ${n}`}
            className={`scale5__cell${value !== null && n <= value ? ' is-filled' : ''}`}
            onClick={() => onChange(n)}
          />
        ))}
      </div>
      {(lowLabel || highLabel) && (
        <div className="scale5__ends">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
    </>
  )
}

/** 1~5 점수 고르기 (평가 화면). 비우면 "잘 모르겠다"로 남는다. */
export function Score5({
  value,
  onChange,
  labels,
}: {
  value: number | null
  onChange: (v: number) => void
  labels: readonly string[]
}) {
  return (
    <div className="score5" role="radiogroup" aria-label="이 기준에서의 점수">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={labels[n - 1]}
          className={`score5__cell${value === n ? ' is-picked' : ''}`}
          onClick={() => onChange(n)}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

/** 적합도 막대 (§5). 앞선 쪽만 --accent, 나머지는 보조색. */
export function FitBar({
  ratio,
  lead,
  thin = false,
  delayMs = 0,
}: {
  ratio: number
  lead: boolean
  thin?: boolean
  delayMs?: number
}) {
  return (
    <div className={`fitbar${thin ? ' fitbar--thin' : ''}`}>
      <span
        className={`fitbar__fill${lead ? ' fitbar__fill--lead' : ''} m-grow`}
        style={{ width: `${Math.round(ratio * 100)}%`, '--d': `${delayMs}ms` } as object}
      />
    </div>
  )
}

/** 순서 바꾸기 손잡이 — 드래그와 키보드 두 경로를 함께 둔다. */
export function ReorderHandle({
  label,
  onUp,
  onDown,
  canUp,
  canDown,
}: {
  label: string
  onUp: () => void
  onDown: () => void
  canUp: boolean
  canDown: boolean
}) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <button
        type="button"
        className="iconbtn"
        style={{ width: 34, height: 44 }}
        aria-label={`${label} 위로`}
        disabled={!canUp}
        onClick={onUp}
      >
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true">
          <path
            d="M1 8 L7 2 L13 8"
            stroke={canUp ? 'var(--soft)' : 'var(--border)'}
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        className="iconbtn"
        style={{ width: 34, height: 44 }}
        aria-label={`${label} 아래로`}
        disabled={!canDown}
        onClick={onDown}
      >
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true">
          <path
            d="M1 2 L7 8 L13 2"
            stroke={canDown ? 'var(--soft)' : 'var(--border)'}
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <span aria-hidden="true" style={{ display: 'flex', paddingLeft: 2 }}>
        <DragHandleIcon />
      </span>
    </span>
  )
}

/** 원형 번호 ①②③ (§5) — 후보·기준 순서 표시에만. */
const CIRCLED = ['①', '②', '③', '④', '⑤'] as const
export function CircleNum({ n, size = 19 }: { n: number; size?: number }) {
  return (
    <span className="circlenum" style={{ fontSize: size }} aria-hidden="true">
      {CIRCLED[n - 1] ?? `(${n})`}
    </span>
  )
}
export function circledLabel(n: number): string {
  return CIRCLED[n - 1] ?? `(${n})`
}

/** 펜으로 동그라미 친 순위 번호 (중요한 순서 화면). */
export function RankNum({ n, delayMs = 0 }: { n: number; delayMs?: number }) {
  return (
    <span className="ranknum">
      {n}
      <svg className="ranknum__circle" width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
        <circle
          className="m-draw"
          cx="17"
          cy="17"
          r="15"
          stroke="var(--pen)"
          strokeWidth="1.8"
          style={{ strokeDasharray: 96, strokeDashoffset: 96, '--d': `${delayMs}ms` } as object}
        />
      </svg>
    </span>
  )
}

/** 화면 제목 — 줄마다 왼쪽에서 쓰이듯 나타난다 (§4 write-on, 줄당 80ms). */
export function Title({ lines, size = 25, base = 80 }: { lines: string[]; size?: number; base?: number }) {
  return (
    <h1 className="title" style={{ fontSize: size, marginTop: 0 }}>
      {lines.map((line, i) => (
        <span key={i} className="m-write" style={delay(i, 'm-write', base)}>
          {line}
        </span>
      ))}
    </h1>
  )
}
