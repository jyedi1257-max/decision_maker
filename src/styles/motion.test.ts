import { describe, expect, it } from 'vitest'
import { DURATION_MS, ENTER_BUDGET_MS, STAGGER_MS, delayFor, type MotionClass } from './motion'

const ALL = Object.keys(DURATION_MS) as MotionClass[]

describe('진입 모션 예산', () => {
  it('항목 간 간격은 80ms다', () => {
    expect(delayFor(1, 'm-lift') - delayFor(0, 'm-lift')).toBe(STAGGER_MS)
  })

  it('어떤 항목도 900ms를 넘겨 끝나지 않는다', () => {
    for (const motion of ALL) {
      for (let i = 0; i < 40; i++) {
        for (const base of [0, 200, 600, 1500]) {
          const end = delayFor(i, motion, base) + DURATION_MS[motion]
          expect(end).toBeLessThanOrEqual(ENTER_BUDGET_MS)
        }
      }
    }
  })

  it('지연은 음수가 되지 않는다', () => {
    for (const motion of ALL) {
      expect(delayFor(0, motion, -500)).toBe(0)
    }
  })

  it('상한에 닿기 전까지는 순서대로 늦어진다', () => {
    const a = delayFor(0, 'm-lift')
    const b = delayFor(2, 'm-lift')
    expect(b).toBeGreaterThan(a)
  })
})
