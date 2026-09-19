import { describe, expect, it } from 'vitest'
import { canEvaluate, evaluate, evaluationCells, fitLabel, normalizeScore, NEUTRAL } from './evaluate'
import { makeDecision } from './fixtures'

describe('normalizeScore', () => {
  it('1~5를 0~1로 편다', () => {
    expect(normalizeScore(1)).toBe(0)
    expect(normalizeScore(3)).toBe(0.5)
    expect(normalizeScore(5)).toBe(1)
  })

  it('빈 칸은 중립이다 — 모르는 걸 유리하게도 불리하게도 두지 않는다', () => {
    expect(normalizeScore(null)).toBe(NEUTRAL)
  })

  it('범위를 벗어난 값은 잘라낸다', () => {
    expect(normalizeScore(0)).toBe(0)
    expect(normalizeScore(9)).toBe(1)
  })
})

describe('evaluate', () => {
  it('가중합으로 적합도를 낸다', () => {
    const d = makeDecision({
      alternatives: ['A', 'B'],
      criteria: ['비용', '공간'],
      scores: [
        [5, 1],
        [1, 5],
      ],
    })
    const r = evaluate(d)
    // 비용이 1순위(w=0.75), 공간이 2순위(w=0.25)
    expect(r.weights[0]).toBeCloseTo(0.75, 6)
    expect(r.weights[1]).toBeCloseTo(0.25, 6)
    expect(r.ranked[0]!.name).toBe('A')
    expect(r.ranked[0]!.fit).toBeCloseTo(0.75, 6)
    expect(r.ranked[1]!.fit).toBeCloseTo(0.25, 6)
  })

  it('필수조건은 합산 전에 거른다 — 다른 장점이 커도 상쇄되지 않는다', () => {
    const d = makeDecision({
      alternatives: ['압도적이지만 탈락', '평범하지만 통과'],
      criteria: ['비용', '공간'],
      scores: [
        [5, 5],
        [2, 2],
      ],
      musts: [{ name: '보증금 3억 이하', fails: [0] }],
    })
    const r = evaluate(d)
    expect(r.ranked).toHaveLength(1)
    expect(r.ranked[0]!.name).toBe('평범하지만 통과')
    const dropped = r.all.find((a) => a.name === '압도적이지만 탈락')!
    expect(dropped.eliminatedBy).toBe('보증금 3억 이하')
    // 탈락해도 배열에서 빼지 않는다 — 화면이 취소선으로 보여줘야 하므로
    expect(r.all).toHaveLength(2)
  })

  it('탈락 후보는 살아남은 후보 뒤로 간다', () => {
    const r = evaluate(
      makeDecision({
        alternatives: ['탈락', '통과'],
        criteria: ['비용'],
        scores: [[5], [1]],
        musts: [{ name: '조건', fails: [0] }],
      }),
    )
    expect(r.all.map((a) => a.name)).toEqual(['통과', '탈락'])
  })

  it('모두 탈락하면 allEliminated가 선다', () => {
    const r = evaluate(
      makeDecision({
        alternatives: ['A', 'B'],
        criteria: ['비용'],
        scores: [[5], [4]],
        musts: [{ name: '불가능한 조건', fails: [0, 1] }],
      }),
    )
    expect(r.allEliminated).toBe(true)
    expect(r.ranked).toHaveLength(0)
  })

  it('미평가 필수조건은 통과로 본다 — 앱이 임의로 떨어뜨리지 않는다', () => {
    const d = makeDecision({
      alternatives: ['A', 'B'],
      criteria: ['비용'],
      scores: [[3], [3]],
    })
    d.musts = [{ id: 'm0', name: '아직 안 본 조건', passes: {} }]
    expect(evaluate(d).allEliminated).toBe(false)
  })

  it('완전 동점이면 먼저 적은 후보가 앞선다', () => {
    const r = evaluate(
      makeDecision({
        alternatives: ['먼저', '나중'],
        criteria: ['비용', '공간'],
        scores: [
          [4, 2],
          [4, 2],
        ],
      }),
    )
    expect(r.ranked[0]!.name).toBe('먼저')
    expect(r.ranked[0]!.fit).toBeCloseTo(r.ranked[1]!.fit, 12)
  })

  it('빈 칸을 중립으로 세되 isMissing으로 표시한다', () => {
    const r = evaluate(
      makeDecision({
        alternatives: ['A', 'B'],
        criteria: ['비용', '공간'],
        scores: [
          [5, null],
          [3, 3],
        ],
      }),
    )
    const a = r.ranked.find((x) => x.name === 'A')!
    expect(a.breakdown[1]!.isMissing).toBe(true)
    expect(a.breakdown[1]!.value).toBe(NEUTRAL)
    expect(a.breakdown[0]!.isMissing).toBe(false)
  })

  it('채운 칸 수를 센다', () => {
    const r = evaluate(
      makeDecision({
        alternatives: ['A', 'B'],
        criteria: ['x', 'y', 'z'],
        scores: [
          [5, 4, null],
          [3, null, null],
        ],
      }),
    )
    expect(r.totalCells).toBe(6)
    expect(r.filledCells).toBe(3)
  })

  it('적합도는 0~1 안에 있다', () => {
    const r = evaluate(
      makeDecision({
        alternatives: ['A', 'B', 'C'],
        criteria: ['x', 'y', 'z'],
        scores: [
          [5, 5, 5],
          [1, 1, 1],
          [3, 1, 5],
        ],
      }),
    )
    for (const a of r.all) {
      expect(a.fit).toBeGreaterThanOrEqual(0)
      expect(a.fit).toBeLessThanOrEqual(1)
    }
    expect(r.ranked[0]!.fit).toBeCloseTo(1, 10)
  })

  it('기준이 없으면 가중치도 없다', () => {
    const r = evaluate(makeDecision({ alternatives: ['A', 'B'], criteria: [] }))
    expect(r.weights).toEqual([])
    expect(r.ranked[0]!.fit).toBe(0)
  })
})

describe('fitLabel', () => {
  it('숫자 대신 말로 옮긴다', () => {
    expect(fitLabel(0.9)).toBe('높음')
    expect(fitLabel(0.5)).toBe('보통')
    expect(fitLabel(0.1)).toBe('낮음')
  })
})

describe('evaluationCells', () => {
  it('후보 하나를 기준 전부로 훑고 다음 후보로 넘어간다', () => {
    const cells = evaluationCells(
      makeDecision({ alternatives: ['A', 'B'], criteria: ['x', 'y'] }),
    )
    expect(cells).toEqual([
      { alternativeId: 'a0', criterionId: 'c0' },
      { alternativeId: 'a0', criterionId: 'c1' },
      { alternativeId: 'a1', criterionId: 'c0' },
      { alternativeId: 'a1', criterionId: 'c1' },
    ])
  })

  it('탈락한 후보는 평가하지 않는다', () => {
    const cells = evaluationCells(
      makeDecision({
        alternatives: ['A', 'B'],
        criteria: ['x', 'y'],
        musts: [{ name: '조건', fails: [0] }],
      }),
    )
    expect(cells.every((c) => c.alternativeId === 'a1')).toBe(true)
    expect(cells).toHaveLength(2)
  })
})

describe('canEvaluate', () => {
  it('후보 2개와 기준 1개면 결과를 낼 수 있다', () => {
    expect(
      canEvaluate(makeDecision({ alternatives: ['A', 'B'], criteria: ['x'] })),
    ).toBe(true)
  })
  it('후보가 하나뿐이면 아직이다', () => {
    expect(canEvaluate(makeDecision({ alternatives: ['A'], criteria: ['x'] }))).toBe(false)
  })
  it('기준이 없으면 아직이다', () => {
    expect(canEvaluate(makeDecision({ alternatives: ['A', 'B'], criteria: [] }))).toBe(false)
  })
})
