import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BackIcon } from './Icons'
import { InkUnderline } from './Ink'
import { delay } from '@/styles/motion'
import { STEP_COUNT } from '@/store/factory'
import { Sticker, type StickerName } from './Sticker'

/** 화면 머리말. 뒤로가기 · 단계 표시 · 저장 상태 (§6 화면 구성 공통) */
export function TopBar({
  back,
  onBack,
  backLabel = '뒤로',
  center,
  right,
  sticker,
}: {
  /** 돌아갈 주소. 화면 안에서 앞 문항으로 돌아가야 하면 onBack을 대신 준다. */
  back?: string
  onBack?: () => void
  backLabel?: string
  center?: ReactNode
  right?: ReactNode
  /** 오른쪽 빈자리에 붙이는 스티커 한 장 (디자인 시스템 §5 '스티커 (화면)') */
  sticker?: StickerName
}) {
  return (
    <div className="topbar m-lift">
      {onBack ? (
        <button type="button" aria-label={backLabel} className="iconbtn iconbtn--back" onClick={onBack}>
          <BackIcon />
        </button>
      ) : back ? (
        <Link to={back} aria-label={backLabel} className="iconbtn iconbtn--back">
          <BackIcon />
        </Link>
      ) : (
        <span style={{ width: 30 }} />
      )}
      {typeof center === 'string' ? <span className="topbar__step">{center}</span> : center}
      {right ??
        (sticker ? (
          <span className="topbar__sticker">
            <Sticker name={sticker} width={40} rotate={8} className="m-settle" style={{ '--d': '360ms' } as object} />
          </span>
        ) : (
          <span style={{ width: 44 }} />
        ))}
    </div>
  )
}

/** 진행 단계바 (§5). 완료 구간 --ink, 미완료 --border. */
export function StepBar({ step, total = STEP_COUNT }: { step: number; total?: number }) {
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
 * 5칸 척도 — 마음이 기운 정도·회고 (§5).
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

/**
 * 1~5 점수 고르기 (평가 화면). 비우면 "잘 모르겠다"로 남는다.
 * 양 끝에는 방향만 적는다(bad ↔ good). 칸마다 말을 붙이면 '매우 만족'처럼
 * 기준에 안 맞는 말이 끼어든다.
 */
export function Score5({
  value,
  onChange,
  lowLabel = 'bad',
  highLabel = 'good',
}: {
  value: number | null
  onChange: (v: number) => void
  lowLabel?: string
  highLabel?: string
}) {
  return (
    <>
      <div className="score5" role="radiogroup" aria-label="이 기준에서의 점수">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={n === 1 ? `1점, ${lowLabel}` : n === 5 ? `5점, ${highLabel}` : `${n}점`}
            className={`score5__cell${value === n ? ' is-picked' : ''}`}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="scale5__ends" aria-hidden="true">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </>
  )
}

/** 적합도 막대 (§5). 앞선 쪽만 --accent, 나머지는 보조색. */
/**
 * 적합도 막대.
 *
 * ordinal을 주면 그 선택지의 고유색으로 칠하고, 앞서지 않은 쪽은
 * --alt-dim만큼 흐려진다 (디자인 시스템 §1). 안 주면 예전처럼
 * 앞선 쪽 --accent / 나머지 --bar-second.
 */
export function FitBar({
  ratio,
  lead,
  ordinal,
  thin = false,
  delayMs = 0,
}: {
  ratio: number
  lead: boolean
  /** 선택지의 1-기준 순번. 색은 순위가 아니라 정체성에 붙는다. */
  ordinal?: number
  thin?: boolean
  delayMs?: number
}) {
  return (
    <div className={`fitbar${thin ? ' fitbar--thin' : ''}`}>
      <span
        className={[
          'fitbar__fill',
          lead ? 'fitbar__fill--lead' : '',
          ordinal ? 'fitbar__fill--own' : '',
          'm-grow',
        ]
          .filter(Boolean)
          .join(' ')}
        style={
          {
            width: `${Math.round(ratio * 100)}%`,
            '--d': `${delayMs}ms`,
            ...(ordinal ? { '--own': altColor(ordinal) } : {}),
          } as object
        }
      />
    </div>
  )
}

/** ①②③④⑤의 고유색. 다섯을 넘으면 마지막 색을 돌려 쓴다. */
export function altColor(ordinal: number): string {
  return `var(--alt-${Math.min(Math.max(ordinal, 1), 5)})`
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

/**
 * 종이에 펜으로 쓰는 입력 한 줄.
 *
 * 장식용 펜 커서는 **비어 있고 포커스가 없을 때만** 보인다. 포커스가 들어오면
 * 브라우저의 진짜 커서가 왼쪽에서 깜빡이므로, 둘을 함께 두면 커서가 두 개로 보인다.
 */
export function WriteField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  fontSize = 19,
  underlineDelayMs = 300,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  hint?: string
  fontSize?: number
  underlineDelayMs?: number
}) {
  const [focused, setFocused] = useState(false)

  return (
    <>
      <label className="write__label" htmlFor={id}>
        {label}
      </label>
      <div className="write__line">
        <input
          id={id}
          type="text"
          className="write__input"
          style={{ fontSize }}
          placeholder={placeholder}
          value={value}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {value.trim() === '' && !focused && (
          <span className="write__caret m-caret" aria-hidden="true" />
        )}
      </div>
      <InkUnderline delayMs={underlineDelayMs} />
      {hint && (
        <p style={{ margin: '8px 0 0', fontSize: 12, lineHeight: 1.7, color: 'var(--soft)' }}>
          {hint}
        </p>
      )}
    </>
  )
}
