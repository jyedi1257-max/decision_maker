import type { CSSProperties } from 'react'

/**
 * 진입 모션의 지연 시간표.
 *
 * 디자인 시스템 §4: 항목 간 지연은 80ms, **한 화면의 진입 모션 전체는 900ms 안에 멈춘다.**
 * 지연을 화면마다 손으로 적으면 그 상한이 조용히 깨지므로 여기서만 만들고,
 * 테스트(`motion.test.ts`)가 상한을 지킨다.
 */

/** 항목 간 기본 간격 (§4) */
export const STAGGER_MS = 80

/** 진입 모션이 끝나야 하는 시각 (§9 금지 목록: 900ms 초과) */
export const ENTER_BUDGET_MS = 900

/** 각 모션 클래스의 재생 길이 (§4 모션 토큰 표) */
export const DURATION_MS = {
  'm-write': 300,
  'm-draw': 380,
  'm-settle': 260,
  'm-lift': 220,
  'm-grow': 380,
  'm-fade': 300,
  'm-stamp': 320,
  'm-strike': 420,
  'm-hilite': 320,
} as const

export type MotionClass = keyof typeof DURATION_MS

/**
 * n번째 항목의 지연을 만든다. 상한을 넘지 않도록 잘라낸다.
 *
 * @param index  0부터 세는 항목 순서
 * @param motion 그 항목이 쓰는 모션 클래스
 * @param base   그 묶음이 시작하는 시각
 */
export function delayFor(index: number, motion: MotionClass, base = 0): number {
  const raw = base + index * STAGGER_MS
  const latestStart = ENTER_BUDGET_MS - DURATION_MS[motion]
  return Math.max(0, Math.min(raw, latestStart))
}

/**
 * style 속성에 그대로 펼쳐 넣는 CSS 변수.
 * `--d`는 표준 속성이 아니라서 CSSProperties로 한 번 감싼다.
 */
export function delay(index: number, motion: MotionClass, base = 0): CSSProperties {
  return { '--d': `${delayFor(index, motion, base)}ms` } as CSSProperties
}
