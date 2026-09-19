import { describe, expect, it } from 'vitest'
import { evaluate } from './evaluate'
import { differenceMakers, gutConflict, margin, uncertainties } from './explain'
import { makeDecision } from './fixtures'

describe('differenceMakers', () => {
  it('차이를 크게 벌린 기준부터 내놓는다', () => {
    const d = makeDecision({
      alternatives: ['A', 'B'],
      criteria: ['비용', '공간', '통근'],
      scores: [
        [5, 1, 3],
        [1, 5, 3],
      ],
    })
    const makers = differenceMakers(evaluate(d))
    expect(makers).toHaveLength(2)
    expect(makers[0]!.criterion.name).toBe('비용')
    expect(makers[1]!.criterion.name).toBe('공간')
  })

  it('차이가 없는 기준은 빼놓는다', () => {
    const makers = differenceMakers(
      evaluate(
        makeDecision({
          alternatives: ['A', 'B'],
          criteria: ['비용', '똑같은기준'],
          scores: [
            [5, 3],
            [1, 3],
          ],
        }),
      ),
    )
    expect(makers.map((m) => m.criterion.name)).toEqual(['비용'])
  })

  it('1위에게 유리한 기준과 불리한 기준을 가른다', () => {
    const d = makeDecision({
      alternatives: ['A', 'B'],
      criteria: ['공간', '비용'],
      // 공간이 1순위: A가 크게 앞서 1위가 되지만, 비용에서는 B가 낫다
      scores: [
        [5, 1],
        [1, 4],
      ],
    })
    const r = evaluate(d)
    expect(r.ranked[0]!.name).toBe('A')
    const makers = differenceMakers(r)
    expect(makers.find((m) => m.criterion.name === '공간')!.favorsLeader).toBe(true)
    expect(makers.find((m) => m.criterion.name === '비용')!.favorsLeader).toBe(false)
  })

  it('비교할 2위가 없으면 빈 배열이다', () => {
    const makers = differenceMakers(
      evaluate(
        makeDecision({
          alternatives: ['A', 'B'],
          criteria: ['비용'],
          scores: [[5], [1]],
          musts: [{ name: '조건', fails: [1] }],
        }),
      ),
    )
    expect(makers).toEqual([])
  })

  it('share 합은 1을 넘지 않는다', () => {
    const makers = differenceMakers(
      evaluate(
        makeDecision({
          alternatives: ['A', 'B'],
          criteria: ['a', 'b', 'c'],
          scores: [
            [5, 2, 4],
            [1, 5, 1],
          ],
        }),
      ),
      3,
    )
    const total = makers.reduce((s, m) => s + m.share, 0)
    expect(total).toBeLessThanOrEqual(1 + 1e-9)
  })
})

describe('uncertainties', () => {
  it('빈 칸과 추정·느낌을 모은다', () => {
    const d = makeDecision({
      alternatives: ['A', 'B'],
      criteria: ['비용', '공간'],
      scores: [
        [5, null],
        [3, 4],
      ],
      evidence: [
        ['fact', null],
        ['estimate', 'feeling'],
      ],
    })
    const found = uncertainties(evaluate(d), 10)
    const kinds = found.map((u) => u.kind).sort()
    expect(kinds).toEqual(['estimate', 'feeling', 'missing'])
  })

  it('사실로 채운 칸은 불확실성이 아니다', () => {
    const d = makeDecision({
      alternatives: ['A', 'B'],
      criteria: ['비용'],
      scores: [[5], [1]],
      evidence: [['fact'], ['fact']],
    })
    expect(uncertainties(evaluate(d))).toEqual([])
  })

  it('결과를 뒤집을 무게가 있는 칸을 앞에 둔다', () => {
    const d = makeDecision({
      alternatives: ['A', 'B'],
      criteria: ['가장 무거운 기준', '가장 가벼운 기준'],
      // 박빙이라 1순위 기준의 불확실성은 결과를 뒤집을 수 있다
      scores: [
        [3, null],
        [3, 3],
      ],
      evidence: [
        ['estimate', null],
        ['fact', 'fact'],
      ],
    })
    const found = uncertainties(evaluate(d), 10)
    expect(found[0]!.criterionName).toBe('가장 무거운 기준')
    expect(found[0]!.matters).toBe(true)
  })

  it('limit만큼만 준다 — 화면에 한두 개만 올린다', () => {
    const d = makeDecision({
      alternatives: ['A', 'B'],
      criteria: ['a', 'b', 'c'],
      scores: [
        [null, null, null],
        [null, null, null],
      ],
    })
    expect(uncertainties(evaluate(d), 2)).toHaveLength(2)
  })
})

describe('margin', () => {
  it('1위와 2위의 차이를 준다', () => {
    const r = evaluate(
      makeDecision({
        alternatives: ['A', 'B'],
        criteria: ['비용'],
        scores: [[5], [1]],
      }),
    )
    expect(margin(r)).toBeCloseTo(1, 10)
  })

  it('비교 대상이 없으면 무한대다', () => {
    const r = evaluate(makeDecision({ alternatives: ['A'], criteria: ['비용'], scores: [[5]] }))
    expect(margin(r)).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('gutConflict', () => {
  const base = makeDecision({
    alternatives: ['A', 'B'],
    criteria: ['비용'],
    scores: [[5], [1]],
  })

  it('직감과 결과가 같으면 충돌이 없다', () => {
    expect(gutConflict(evaluate(base), 'a0')).toBeNull()
  })

  it('갈리면 직감이 고른 쪽을 돌려준다', () => {
    const conflict = gutConflict(evaluate(base), 'a1')
    expect(conflict?.name).toBe('B')
  })

  it('직감을 안 적었으면 충돌도 없다', () => {
    expect(gutConflict(evaluate(base), null)).toBeNull()
  })
})
