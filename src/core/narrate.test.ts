import { describe, expect, it } from 'vitest'
import { evaluate } from './evaluate'
import { makeDecision } from './fixtures'
import {
  conclusionSentence,
  differenceRows,
  flipPointSentence,
  ordinalMark,
  robustnessSentence,
} from './narrate'
import { analyzeSensitivity } from './sensitivity'

const close = makeDecision({
  alternatives: ['지금 집 재계약', '신도시 24평으로 이사'],
  criteria: ['월 주거비', '방 개수', '출퇴근 시간'],
  scores: [
    [4, 2, 5],
    [3, 5, 4],
  ],
})

const stable = makeDecision({
  alternatives: ['압도적', '한참 아래'],
  criteria: ['a', 'b'],
  scores: [
    [5, 5],
    [1, 1],
  ],
})

describe('ordinalMark', () => {
  it('1~5를 원형 숫자로 바꾼다', () => {
    expect(ordinalMark(1)).toBe('①')
    expect(ordinalMark(5)).toBe('⑤')
  })
  it('범위를 넘으면 괄호로 떨어진다', () => {
    expect(ordinalMark(9)).toBe('(9)')
  })
})

describe('conclusionSentence', () => {
  it('정답이라고 단정하지 않는다', () => {
    const r = evaluate(close)
    const s = conclusionSentence(r, analyzeSensitivity(close, r))!
    expect(s.tail).toContain('기울어요')
    expect(s.tail).not.toContain('최선')
    expect(s.tail).not.toContain('정답')
  })

  it('박빙이면 "조금 더"라고 말한다', () => {
    const r = evaluate(close)
    expect(conclusionSentence(r, analyzeSensitivity(close, r))!.tail).toContain('조금')
  })

  it('안정적이면 "조금 더"를 붙이지 않는다', () => {
    const r = evaluate(stable)
    expect(conclusionSentence(r, analyzeSensitivity(stable, r))!.tail).not.toContain('조금')
  })

  it('필수조건으로 하나만 남으면 그렇게 말한다', () => {
    const d = makeDecision({
      alternatives: ['A', 'B'],
      criteria: ['a'],
      scores: [[5], [1]],
      musts: [{ name: '조건', fails: [1] }],
    })
    const r = evaluate(d)
    const s = conclusionSentence(r, analyzeSensitivity(d, r))!
    expect(s.particle).toBe('만')
    expect(s.tail).toContain('남았어요')
  })

  it('남은 후보가 없으면 결론도 없다', () => {
    const d = makeDecision({
      alternatives: ['A', 'B'],
      criteria: ['a'],
      scores: [[5], [1]],
      musts: [{ name: '조건', fails: [0, 1] }],
    })
    expect(conclusionSentence(evaluate(d), analyzeSensitivity(d))).toBeNull()
  })
})

describe('robustnessSentence', () => {
  it('박빙이면 박빙이라고 하고 뒤집는 조건을 함께 준다', () => {
    const text = robustnessSentence(analyzeSensitivity(close))
    expect(text).toContain('박빙')
    expect(text).toMatch(/월 주거비|방 개수|출퇴근 시간/)
  })

  it('안 뒤집히면 차이가 분명하다고만 한다 — 점수가 높다고 말하지 않는다', () => {
    const text = robustnessSentence(analyzeSensitivity(stable))
    expect(text).toContain('차이가 분명')
    // 두 선택지가 모두 낮은데 차이만 클 수 있으므로 점수로 말하면 거짓이 된다
    expect(text).not.toContain('점수')
  })

  it('그래프 없이 문장만으로 읽힌다 — 숫자를 노출하지 않는다', () => {
    const text = robustnessSentence(analyzeSensitivity(close))
    expect(text).not.toMatch(/0\.\d/)
    expect(text).not.toContain('%')
  })
})

describe('flipPointSentence', () => {
  it('뒤집히는 기준과 방향을 말한다', () => {
    const text = flipPointSentence(analyzeSensitivity(close))
    expect(text).toMatch(/무겁게|가볍게/)
  })

  it('안 뒤집히면 단단하다고 말한다', () => {
    expect(flipPointSentence(analyzeSensitivity(stable))).toContain('단단')
  })
})

describe('differenceRows', () => {
  it('차이를 만든 기준을 말로 옮긴다', () => {
    const rows = differenceRows(evaluate(close))
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.text).toMatch(/나음|손해/)
    }
  })

  it('유리한 기준과 불리한 기준이 다르게 읽힌다', () => {
    const rows = differenceRows(evaluate(close))
    const favors = rows.filter((r) => r.maker.favorsLeader)
    const against = rows.filter((r) => !r.maker.favorsLeader)
    for (const r of favors) expect(r.text).toContain('나음')
    for (const r of against) expect(r.text).toContain('손해')
  })
})
