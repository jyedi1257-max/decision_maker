/**
 * 결정 하나의 모양.
 *
 * 기획안 6.8의 8층 구조(Frame → Filter → Criteria → Weight → Score → Aggregate →
 * Robustness → Human Check)를 데이터로 옮긴 것이다.
 */

/** 점수가 무엇에 기대고 있는지 (기획안 6.6 불확실성, 8.2 근거/확신). */
export type Evidence = 'fact' | 'estimate' | 'feeling'

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  fact: '사실',
  estimate: '추정',
  feeling: '느낌',
}

export interface Alternative {
  id: string
  name: string
}

export interface Criterion {
  id: string
  name: string
}

/** "이것만 안 되면 바로 빼는 조건" — 합산 전에 거른다 (기획안 6.6 비보상성). */
export interface MustCondition {
  id: string
  name: string
  /** 후보 id → 이 조건을 통과하는가. 미평가면 통과로 본다. */
  passes: Record<string, boolean>
}

export interface Score {
  /** 1~5. 비워두면 null — "잘 모르겠다"를 숫자로 덮지 않는다 (기획안 8.1 원칙 6). */
  value: number | null
  evidence: Evidence | null
}

/** 분석 전에 봉인해 두는 첫 마음 (기획안 4.1 단계 8, 8.2 직감 비교). */
export interface GutFeeling {
  alternativeId: string | null
  confidence: number | null
}

export interface CommitRecord {
  alternativeId: string
  reason: string
  confidence: number | null
  committedAt: string
  /** 회고 알림을 예약했는가 */
  reviewScheduled: boolean
  reviewDueAt: string | null
}

export interface ReviewRecord {
  satisfaction: number | null
  /** 지금 다시 고른 1순위 기준 id — 그때와 지금을 비교한다 */
  topCriterionNow: string | null
  reviewedAt: string
}

export type DecisionStage =
  | 'frame'
  | 'alternatives'
  | 'gut'
  | 'criteria'
  | 'must'
  | 'weight'
  | 'evaluate'
  | 'result'
  | 'committed'
  | 'reviewed'

export interface Decision {
  id: string
  /** 고민 한 문장 (Decision Quality의 frame) */
  question: string
  alternatives: Alternative[]
  /** 중요한 순서대로. 앞이 1순위. 가중치는 이 순서에서 ROC로 뽑는다. */
  criteria: Criterion[]
  musts: MustCondition[]
  /** `${alternativeId}:${criterionId}` → 점수 */
  scores: Record<string, Score>
  gut: GutFeeling
  commit: CommitRecord | null
  review: ReviewRecord | null
  stage: DecisionStage
  createdAt: string
  updatedAt: string
  /** 앱이 "한 번만 묻는" 제안을 이미 했는지 (기획안 4.1 단계 2) */
  hiddenAlternativeAsked: boolean
  dismissedDuplicateHints: string[]
}

export function scoreKey(alternativeId: string, criterionId: string): string {
  return `${alternativeId}:${criterionId}`
}

/** 기준 개수 상한·하한 (기획안 8.2, 디자인 §6) */
export const MIN_ALTERNATIVES = 2
export const MAX_ALTERNATIVES = 5
export const DEFAULT_CRITERIA = 3
export const MAX_CRITERIA = 5
export const MAX_MUSTS = 2
