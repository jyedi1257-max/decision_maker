/**
 * 민감도 — 결과가 얼마나 단단한가.
 *
 * 기획안 6.7: 가중치나 입력값을 변화시켜 순위가 얼마나 쉽게 바뀌는지 확인하면
 * "5점 차이"보다 의미 있는 정보를 줄 수 있다.
 * 기획안 4.2 / 디자인 §7: **그래프보다 자연어 문장을 먼저** 보여준다.
 */
import { evaluate, normalizeScore, weightsFor, type EvaluationResult } from './evaluate'
import { margin } from './explain'
import { scoreKey, type Decision } from './types'
import { moveTo, overrideFits, scaleWeight } from './weights'

/** 1·2위 차이가 이보다 작으면 박빙으로 본다. */
export const CLOSE_CALL_THRESHOLD = 0.06

export interface RankFlip {
  criterionId: string
  criterionName: string
  /** 몇 칸 옮겨야 뒤집히는가. 양수면 위로(더 중요하게), 음수면 아래로. */
  steps: number
  /** 뒤집힌 뒤 1위가 되는 후보 */
  newLeaderId: string
  newLeaderName: string
  newLeaderOrdinal: number
}

/**
 * 기준 순서를 한 칸씩 옮겨보며 1위가 바뀌는 **가장 작은 이동**을 찾는다.
 *
 * 사용자가 실제로 하는 조작(순서 바꾸기)과 같은 단위라서
 * "월 주거비를 한 단계만 더 무겁게 보면 ①이 앞섭니다"로 그대로 읽힌다.
 */
export function findRankFlip(decision: Decision): RankFlip | null {
  // 사용자가 무게를 손으로 정했다면 순서를 옮겨도 무게가 안 바뀐다 — 할 말이 없다.
  if (overrideFits(decision.weightOverride, decision.criteria.length)) return null

  const base = evaluate(decision)
  const leader = base.ranked[0]
  if (!leader || base.ranked.length < 2) return null

  const n = decision.criteria.length
  if (n < 2) return null

  let best: RankFlip | null = null

  for (let from = 0; from < n; from++) {
    for (let to = 0; to < n; to++) {
      if (to === from) continue
      const steps = from - to // 양수 = 위로 올림 = 더 중요하게
      if (best !== null && Math.abs(steps) >= Math.abs(best.steps)) continue

      const moved = evaluate({ ...decision, criteria: moveTo(decision.criteria, from, to) })
      const newLeader = moved.ranked[0]
      if (!newLeader || newLeader.alternativeId === leader.alternativeId) continue

      const criterion = decision.criteria[from]
      if (!criterion) continue

      best = {
        criterionId: criterion.id,
        criterionName: criterion.name,
        steps,
        newLeaderId: newLeader.alternativeId,
        newLeaderName: newLeader.name,
        newLeaderOrdinal: newLeader.ordinal,
      }
    }
  }

  return best
}

export interface WeightFlipPoint {
  criterionId: string
  criterionName: string
  /** 현재 가중치를 1로 봤을 때, 뒤집히는 배율 */
  factor: number
  /** 뒤집힌 뒤의 1위 */
  newLeaderId: string
  /** 슬라이더 위의 현재 위치 (0~1) */
  currentPosition: number
  /** 슬라이더 위의 뒤집힘 지점 (0~1) */
  flipPosition: number
}

/** 배율 탐색 범위. 이 밖은 "현실적으로 안 뒤집힘"으로 본다. */
const MIN_FACTOR = 0.05
const MAX_FACTOR = 20

/**
 * 한 기준의 무게에 연속적인 배율을 걸어 1위가 뒤집히는 지점을 이분탐색으로 찾는다.
 * Why 화면의 `여기부터 ①` 표식 위치를 만든다.
 */
export function findWeightFlipPoint(decision: Decision): WeightFlipPoint | null {
  const base = evaluate(decision)
  const leader = base.ranked[0]
  if (!leader || base.ranked.length < 2) return null

  const n = decision.criteria.length
  if (n < 2) return null
  const weights = weightsFor(decision)

  let best: { index: number; factor: number; newLeaderId: string } | null = null

  for (let i = 0; i < n; i++) {
    for (const direction of [1, -1] as const) {
      const far = direction === 1 ? MAX_FACTOR : MIN_FACTOR
      const farLeader = leaderWith(decision, weights, i, far)
      if (farLeader === null || farLeader === leader.alternativeId) continue

      // [1, far] 구간에서 뒤집히는 경계를 좁힌다.
      let stay = 1
      let flip = far
      for (let iter = 0; iter < 40; iter++) {
        const mid = Math.sqrt(stay * flip) // 배율이므로 기하평균으로 좁힌다
        if (leaderWith(decision, weights, i, mid) === leader.alternativeId) stay = mid
        else flip = mid
      }

      const distance = Math.abs(Math.log(flip))
      if (best === null || distance < Math.abs(Math.log(best.factor))) {
        best = { index: i, factor: flip, newLeaderId: farLeader }
      }
    }
  }

  if (best === null) return null
  const criterion = decision.criteria[best.index]
  if (!criterion) return null

  // 슬라이더는 로그 배율 축이다. MIN_FACTOR~MAX_FACTOR를 0~1로 편다.
  const toPosition = (factor: number) =>
    (Math.log(factor) - Math.log(MIN_FACTOR)) / (Math.log(MAX_FACTOR) - Math.log(MIN_FACTOR))

  return {
    criterionId: criterion.id,
    criterionName: criterion.name,
    factor: best.factor,
    newLeaderId: best.newLeaderId,
    currentPosition: toPosition(1),
    flipPosition: Math.min(1, Math.max(0, toPosition(best.factor))),
  }
}

/** 가중치 하나에 배율을 건 상태에서의 1위. 동점이면 먼저 적은 후보. */
function leaderWith(
  decision: Decision,
  weights: number[],
  index: number,
  factor: number,
): string | null {
  const w = scaleWeight(weights, index, factor)
  let bestId: string | null = null
  let bestFit = -Infinity

  for (const alt of decision.alternatives) {
    if (decision.musts.some((m) => m.passes[alt.id] === false)) continue
    let fit = 0
    decision.criteria.forEach((criterion, ci) => {
      fit += (w[ci] ?? 0) * normalizeScore(decision.scores[scoreKey(alt.id, criterion.id)]?.value ?? null)
    })
    // 엄격한 부등호라 동점이면 먼저 나온 후보가 유지된다.
    if (fit > bestFit + 1e-12) {
      bestFit = fit
      bestId = alt.id
    }
  }

  return bestId
}

export type Robustness = 'close' | 'stable'

export interface SensitivitySummary {
  robustness: Robustness
  margin: number
  rankFlip: RankFlip | null
  weightFlip: WeightFlipPoint | null
}

export function analyzeSensitivity(decision: Decision, result?: EvaluationResult): SensitivitySummary {
  const evaluated = result ?? evaluate(decision)
  const gap = margin(evaluated)
  return {
    robustness: gap < CLOSE_CALL_THRESHOLD ? 'close' : 'stable',
    margin: gap,
    rankFlip: findRankFlip(decision),
    weightFlip: findWeightFlipPoint(decision),
  }
}
