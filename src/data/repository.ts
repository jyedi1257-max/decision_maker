/**
 * 저장소 경계. 화면은 이 인터페이스만 안다.
 *
 * 기본은 기기 저장(IndexedDB)이고, 사용자가 켤 때만 Firestore로 밀어 올린다
 * (디자인 §7: 고민 본문은 기기 우선 저장, 동기화는 사용자 선택).
 */
import type { Decision } from '@/core/types'

export interface DecisionSummary {
  id: string
  question: string
  stage: Decision['stage']
  criteriaCount: number
  alternativesCount: number
  committedAt: string | null
  confidence: number | null
  satisfaction: number | null
  reviewDueAt: string | null
  updatedAt: string
}

export interface DecisionRepository {
  list(): Promise<DecisionSummary[]>
  get(id: string): Promise<Decision | null>
  save(decision: Decision): Promise<void>
  remove(id: string): Promise<void>
  /** 내보내기·전체 삭제용 */
  all(): Promise<Decision[]>
  clear(): Promise<void>
}

export function summarize(decision: Decision): DecisionSummary {
  return {
    id: decision.id,
    question: decision.question,
    stage: decision.stage,
    criteriaCount: decision.criteria.length,
    alternativesCount: decision.alternatives.length,
    committedAt: decision.commit?.committedAt ?? null,
    confidence: decision.commit?.confidence ?? null,
    satisfaction: decision.review?.satisfaction ?? null,
    reviewDueAt: decision.commit?.reviewDueAt ?? null,
    updatedAt: decision.updatedAt,
  }
}
