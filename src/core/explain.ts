/**
 * "왜 이 결과인지"를 설명한다.
 *
 * 기획안 8.1 원칙 5 — Show why, not just who: 1등보다 "왜 차이가 났는지"를 먼저 말한다.
 * 결과 화면은 총점이 아니라 차이를 만든 기준 2~3개를 보여준다 (기획안 8.2).
 */
import type { AlternativeResult, EvaluationResult } from './evaluate'
import type { Criterion, Evidence } from './types'

export interface DifferenceMaker {
  criterion: Criterion
  /** 1위 기여 - 2위 기여. 양수면 1위에게 유리한 기준. */
  delta: number
  /** 이 기준이 벌린 차이가 전체 격차에서 차지하는 비중 (0~1) */
  share: number
  favorsLeader: boolean
  /** 격차가 큰가 — "크게 앞섬" / "조금 앞섬" */
  strong: boolean
}

/**
 * 1위와 2위 사이에서 차이를 만든 기준을 큰 순서로.
 * 후보가 하나뿐이면 비교할 대상이 없으므로 빈 배열.
 */
export function differenceMakers(result: EvaluationResult, limit = 2): DifferenceMaker[] {
  const [leader, runnerUp] = result.ranked
  if (!leader || !runnerUp) return []

  const deltas = leader.breakdown.map((b, i) => {
    const other = runnerUp.breakdown[i]
    return {
      criterion: b.criterion,
      delta: b.contribution - (other?.contribution ?? 0),
    }
  })

  const totalSwing = deltas.reduce((sum, d) => sum + Math.abs(d.delta), 0)

  return deltas
    .filter((d) => Math.abs(d.delta) > 1e-9)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, limit)
    .map((d) => {
      const share = totalSwing > 0 ? Math.abs(d.delta) / totalSwing : 0
      return {
        criterion: d.criterion,
        delta: d.delta,
        share,
        favorsLeader: d.delta > 0,
        strong: share >= 0.45,
      }
    })
}

export interface Uncertainty {
  alternativeName: string
  alternativeOrdinal: number
  criterionName: string
  /** 비워둔 칸인가, 아니면 추정·느낌으로 채운 칸인가 */
  kind: 'missing' | Exclude<Evidence, 'fact'>
  /** 이 칸이 결과를 뒤집을 만한 무게를 가졌는가 */
  matters: boolean
}

/**
 * 남아 있는 불확실성. 기획안 8.1 원칙 6 — 모르는 것을 억지 숫자로 바꾸지 않고
 * 작게, 명확하게 남긴다. 화면에는 한두 개만 올린다.
 */
export function uncertainties(result: EvaluationResult, limit = 3): Uncertainty[] {
  const gap = margin(result)
  const found: Uncertainty[] = []

  for (const alt of result.ranked) {
    for (const b of alt.breakdown) {
      const kind: Uncertainty['kind'] | null = b.isMissing
        ? 'missing'
        : b.evidence === 'estimate' || b.evidence === 'feeling'
          ? b.evidence
          : null
      if (kind === null) continue

      // 이 칸이 최선/최악으로 바뀌면 움직이는 폭
      const swing = b.weight * Math.max(b.value, 1 - b.value)
      found.push({
        alternativeName: alt.name,
        alternativeOrdinal: alt.ordinal,
        criterionName: b.criterion.name,
        kind,
        matters: swing >= gap,
      })
    }
  }

  return found
    .sort((a, b) => Number(b.matters) - Number(a.matters))
    .slice(0, limit)
}

/** 1위와 2위의 적합도 차이. 후보가 하나뿐이면 무한대로 본다(뒤집힐 일이 없다). */
export function margin(result: EvaluationResult): number {
  const [leader, runnerUp] = result.ranked
  if (!leader || !runnerUp) return Number.POSITIVE_INFINITY
  return leader.fit - runnerUp.fit
}

/** 직감과 분석이 갈렸는가 (기획안 4.1 단계 8 Gut Check). */
export function gutConflict(
  result: EvaluationResult,
  gutAlternativeId: string | null,
): AlternativeResult | null {
  const leader = result.ranked[0]
  if (!leader || !gutAlternativeId) return null
  if (leader.alternativeId === gutAlternativeId) return null
  return result.all.find((a) => a.alternativeId === gutAlternativeId) ?? null
}
