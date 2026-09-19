/**
 * MUST 필터 → 정규화 → 가중합 (Simple Additive Value Model).
 *
 * 기획안 6.8:
 *   2. Filter    MUST 조건으로 탈락 후보 제거
 *   5. Score     대안별 간단 평가
 *   6. Aggregate Simple Additive Value Model
 */
import type { Criterion, Decision, Evidence } from './types'
import { scoreKey } from './types'
import { rocWeights } from './weights'

/** 빈 칸의 값. 모르는 것을 유리하게도 불리하게도 두지 않는다. */
export const NEUTRAL = 0.5

/** 1~5 → 0~1. 비어 있으면 중립. */
export function normalizeScore(value: number | null): number {
  if (value === null) return NEUTRAL
  const clamped = Math.min(5, Math.max(1, value))
  return (clamped - 1) / 4
}

export interface CriterionBreakdown {
  criterion: Criterion
  weight: number
  /** 0~1로 정규화된 값 */
  value: number
  /** weight × value */
  contribution: number
  /** 점수를 비워둔 칸인가 */
  isMissing: boolean
  evidence: Evidence | null
}

export interface AlternativeResult {
  alternativeId: string
  name: string
  /** 후보 목록에서의 1-기준 순번 — 화면의 ①②③ */
  ordinal: number
  /** 0~1 적합도. 화면에는 숫자로 내보내지 않는다 (디자인 §9). */
  fit: number
  /** 필수조건에 걸려 탈락했다면 그 조건 이름 */
  eliminatedBy: string | null
  breakdown: CriterionBreakdown[]
}

export interface EvaluationResult {
  /** 기준 순서대로의 ROC 가중치 */
  weights: number[]
  /** 탈락 후보를 포함한 전체. 탈락하지 않은 것이 적합도 내림차순으로 먼저 온다. */
  all: AlternativeResult[]
  /** 살아남은 후보만, 적합도 내림차순 */
  ranked: AlternativeResult[]
  /** 모든 후보가 필수조건에 걸렸는가 */
  allEliminated: boolean
  /** 평가가 끝나야 채워지는 칸 수 */
  totalCells: number
  filledCells: number
}

/** 적합도를 말로 (§7: 총점 숫자는 기본 화면에 노출하지 않는다) */
export type FitLabel = '낮음' | '보통' | '높음'
export function fitLabel(fit: number): FitLabel {
  if (fit >= 0.66) return '높음'
  if (fit >= 0.38) return '보통'
  return '낮음'
}

function eliminatedBy(decision: Decision, alternativeId: string): string | null {
  for (const must of decision.musts) {
    // 미평가는 통과로 본다 — 앱이 임의로 후보를 떨어뜨리지 않는다.
    if (must.passes[alternativeId] === false) return must.name
  }
  return null
}

export function evaluate(decision: Decision): EvaluationResult {
  const { alternatives, criteria } = decision
  const weights = criteria.length > 0 ? rocWeights(criteria.length) : []

  const all: AlternativeResult[] = alternatives.map((alt, index) => {
    const breakdown: CriterionBreakdown[] = criteria.map((criterion, ci) => {
      const score = decision.scores[scoreKey(alt.id, criterion.id)]
      const raw = score?.value ?? null
      const value = normalizeScore(raw)
      const weight = weights[ci] ?? 0
      return {
        criterion,
        weight,
        value,
        contribution: weight * value,
        isMissing: raw === null,
        evidence: score?.evidence ?? null,
      }
    })

    return {
      alternativeId: alt.id,
      name: alt.name,
      ordinal: index + 1,
      fit: breakdown.reduce((sum, b) => sum + b.contribution, 0),
      eliminatedBy: eliminatedBy(decision, alt.id),
      breakdown,
    }
  })

  const survivors = all.filter((a) => a.eliminatedBy === null)
  const ranked = survivors.slice().sort(byFitThenOrder)

  const sorted = [...ranked, ...all.filter((a) => a.eliminatedBy !== null)]

  return {
    weights,
    all: sorted,
    ranked,
    allEliminated: survivors.length === 0 && all.length > 0,
    totalCells: alternatives.length * criteria.length,
    filledCells: countFilled(decision),
  }
}

/** 적합도 내림차순. 완전 동점이면 후보를 적은 순서가 앞선다. */
function byFitThenOrder(a: AlternativeResult, b: AlternativeResult): number {
  const diff = b.fit - a.fit
  if (Math.abs(diff) > 1e-12) return diff
  return a.ordinal - b.ordinal
}

function countFilled(decision: Decision): number {
  let filled = 0
  for (const alt of decision.alternatives) {
    for (const criterion of decision.criteria) {
      if (decision.scores[scoreKey(alt.id, criterion.id)]?.value != null) filled++
    }
  }
  return filled
}

/**
 * 평가할 칸을 순서대로. 후보 하나를 기준 전부로 훑고 다음 후보로 넘어간다 —
 * 화면이 "① 지금 집 재계약, 이 기준에선 어때요?"로 이어지므로.
 * 필수조건에 탈락한 후보는 평가하지 않는다.
 */
export function evaluationCells(
  decision: Decision,
): Array<{ alternativeId: string; criterionId: string }> {
  const cells: Array<{ alternativeId: string; criterionId: string }> = []
  for (const alt of decision.alternatives) {
    if (eliminatedBy(decision, alt.id) !== null) continue
    for (const criterion of decision.criteria) {
      cells.push({ alternativeId: alt.id, criterionId: criterion.id })
    }
  }
  return cells
}

/** 결과를 만들 수 있는 최소 조건. */
export function canEvaluate(decision: Decision): boolean {
  return (
    decision.alternatives.length >= 2 &&
    decision.criteria.length >= 1 &&
    evaluate(decision).ranked.length >= 1
  )
}
