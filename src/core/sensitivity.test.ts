import { describe, expect, it } from 'vitest'
import { evaluate, normalizeScore } from './evaluate'
import { makeDecision } from './fixtures'
import {
  analyzeSensitivity,
  CLOSE_CALL_THRESHOLD,
  findRankFlip,
  findWeightFlipPoint,
} from './sensitivity'
import { scoreKey } from './types'
import { moveTo, rocWeights, scaleWeight } from './weights'

/**
 * 프로토타입의 이사 결정을 실제로 성립하는 숫자로 옮긴 것.
 * 박빙이고, 기준 순서를 한 칸만 바꾸면 1위가 뒤집힌다.
 *
 * 프로토타입 시안의 막대 수치를 그대로 쓰지는 않았다. 시안은 '월 주거비'를 1순위에
 * 놓은 채 "'월 주거비'를 한 단계만 더 무겁게 보면 ①로 바뀝니다"라고 적고 있는데,
 * 1순위는 더 올릴 자리가 없어 그 문장이 성립하지 않는다. 정적 시안의 예시 수치일 뿐이므로
 * 여기서는 같은 성질(박빙 + 1칸 이동으로 뒤집힘)을 갖는 값으로 대신한다.
 */
function movingDecision() {
  return makeDecision({
    alternatives: ['지금 집 재계약', '신도시 24평으로 이사'],
    criteria: ['월 주거비', '방 개수', '출퇴근 시간'],
    scores: [
      [4, 2, 5],
      [3, 5, 4],
    ],
  })
}

describe('findRankFlip', () => {
  it('찾아낸 이동이 실제로 1위를 바꾼다 (역검증)', () => {
    const d = movingDecision()
    const before = evaluate(d).ranked[0]!.alternativeId
    const flip = findRankFlip(d)
    expect(flip).not.toBeNull()

    // steps만큼 옮겨서 다시 계산했을 때 정말 바뀌는지 직접 확인한다.
    const from = d.criteria.findIndex((c) => c.id === flip!.criterionId)
    const to = from - flip!.steps
    const after = evaluate({ ...d, criteria: moveTo(d.criteria, from, to) }).ranked[0]!
    expect(after.alternativeId).not.toBe(before)
    expect(after.alternativeId).toBe(flip!.newLeaderId)
  })

  it('가장 작은 이동을 고른다 — 더 작은 이동으로는 안 뒤집힌다', () => {
    const d = movingDecision()
    const flip = findRankFlip(d)!
    const leader = evaluate(d).ranked[0]!.alternativeId
    const smaller = Math.abs(flip.steps) - 1

    if (smaller > 0) {
      // 같은 크기보다 작은 모든 이동은 1위를 바꾸지 못해야 한다.
      for (let from = 0; from < d.criteria.length; from++) {
        for (let to = 0; to < d.criteria.length; to++) {
          if (Math.abs(from - to) > smaller || from === to) continue
          const moved = evaluate({ ...d, criteria: moveTo(d.criteria, from, to) })
          expect(moved.ranked[0]!.alternativeId).toBe(leader)
        }
      }
    }
  })

  it('압도적인 결과는 순서를 바꿔도 안 뒤집힌다', () => {
    const d = makeDecision({
      alternatives: ['모든 기준에서 최고', '모든 기준에서 최저'],
      criteria: ['a', 'b', 'c'],
      scores: [
        [5, 5, 5],
        [1, 1, 1],
      ],
    })
    expect(findRankFlip(d)).toBeNull()
  })

  it('기준이 하나뿐이면 옮길 자리가 없다', () => {
    const d = makeDecision({
      alternatives: ['A', 'B'],
      criteria: ['비용'],
      scores: [[5], [1]],
    })
    expect(findRankFlip(d)).toBeNull()
  })

  it('비교할 후보가 하나뿐이면 민감도가 없다', () => {
    const d = makeDecision({
      alternatives: ['A', 'B'],
      criteria: ['a', 'b'],
      scores: [
        [5, 1],
        [1, 5],
      ],
      musts: [{ name: '조건', fails: [1] }],
    })
    expect(findRankFlip(d)).toBeNull()
  })

  it('steps 부호는 방향을 뜻한다 — 양수면 위로(더 중요하게)', () => {
    const d = movingDecision()
    const flip = findRankFlip(d)!
    const from = d.criteria.findIndex((c) => c.id === flip.criterionId)
    const to = from - flip.steps
    expect(to).toBeGreaterThanOrEqual(0)
    expect(to).toBeLessThan(d.criteria.length)
  })
})

/** 주어진 가중치로 1위를 직접 구한다 — 엔진과 독립적인 검산용. */
function leaderByWeights(d: ReturnType<typeof movingDecision>, w: number[]): string {
  let bestId = ''
  let best = -Infinity
  for (const alt of d.alternatives) {
    let fit = 0
    d.criteria.forEach((c, i) => {
      fit += (w[i] ?? 0) * normalizeScore(d.scores[scoreKey(alt.id, c.id)]?.value ?? null)
    })
    if (fit > best + 1e-12) {
      best = fit
      bestId = alt.id
    }
  }
  return bestId
}

describe('findWeightFlipPoint', () => {
  it('찾아낸 배율 바로 양쪽에서 1위가 실제로 갈린다 (역검증)', () => {
    const d = movingDecision()
    const point = findWeightFlipPoint(d)
    expect(point).not.toBeNull()

    const i = d.criteria.findIndex((c) => c.id === point!.criterionId)
    const w = rocWeights(d.criteria.length)
    const leader = evaluate(d).ranked[0]!.alternativeId

    // 뒤집힘 지점에서 살짝 못 미치면 원래 1위, 살짝 넘으면 새 1위여야 한다.
    const toward = point!.factor > 1 ? 0.97 : 1.03
    const beyond = point!.factor > 1 ? 1.03 : 0.97

    expect(leaderByWeights(d, scaleWeight(w, i, point!.factor * toward))).toBe(leader)
    expect(leaderByWeights(d, scaleWeight(w, i, point!.factor * beyond))).toBe(point!.newLeaderId)
  })

  it('슬라이더 위치는 0~1 안에 있고 현재 위치와 다르다', () => {
    const point = findWeightFlipPoint(movingDecision())!
    expect(point.currentPosition).toBeGreaterThan(0)
    expect(point.currentPosition).toBeLessThan(1)
    expect(point.flipPosition).toBeGreaterThanOrEqual(0)
    expect(point.flipPosition).toBeLessThanOrEqual(1)
    expect(point.flipPosition).not.toBeCloseTo(point.currentPosition, 3)
  })

  it('안 뒤집히는 결과에는 지점이 없다', () => {
    const d = makeDecision({
      alternatives: ['압도적', '한참 아래'],
      criteria: ['a', 'b'],
      scores: [
        [5, 5],
        [1, 1],
      ],
    })
    expect(findWeightFlipPoint(d)).toBeNull()
  })
})

describe('analyzeSensitivity', () => {
  it('차이가 작으면 박빙이다', () => {
    const d = makeDecision({
      alternatives: ['A', 'B'],
      criteria: ['a', 'b', 'c'],
      scores: [
        [4, 3, 3],
        [4, 3, 2],
      ],
    })
    const s = analyzeSensitivity(d)
    expect(s.margin).toBeLessThan(CLOSE_CALL_THRESHOLD)
    expect(s.robustness).toBe('close')
  })

  it('차이가 크면 안정이다', () => {
    const d = makeDecision({
      alternatives: ['A', 'B'],
      criteria: ['a', 'b'],
      scores: [
        [5, 5],
        [1, 1],
      ],
    })
    expect(analyzeSensitivity(d).robustness).toBe('stable')
  })

  it('박빙인 결정에서는 뒤집힘 지점을 찾아낸다', () => {
    const s = analyzeSensitivity(movingDecision())
    expect(s.robustness).toBe('close')
    expect(s.rankFlip).not.toBeNull()
  })

  it('후보가 하나뿐이면 뒤집힐 일이 없다', () => {
    const d = makeDecision({
      alternatives: ['A', 'B'],
      criteria: ['a'],
      scores: [[5], [1]],
      musts: [{ name: '조건', fails: [1] }],
    })
    const s = analyzeSensitivity(d)
    expect(s.margin).toBe(Number.POSITIVE_INFINITY)
    expect(s.robustness).toBe('stable')
    expect(s.rankFlip).toBeNull()
    expect(s.weightFlip).toBeNull()
  })
})
