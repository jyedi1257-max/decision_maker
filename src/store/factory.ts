/** 새 결정 만들기와 작은 변환들. */
import type { Alternative, Criterion, Decision, MustCondition } from '@/core/types'

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function newDecision(): Decision {
  const now = new Date().toISOString()
  return {
    id: newId(),
    question: '',
    alternatives: [],
    criteria: [],
    musts: [],
    scores: {},
    gut: { alternativeId: null, confidence: null },
    commit: null,
    review: null,
    stage: 'frame',
    createdAt: now,
    updatedAt: now,
    hiddenAlternativeAsked: false,
    dismissedDuplicateHints: [],
  }
}

export function newAlternative(name = ''): Alternative {
  return { id: newId(), name }
}

export function newCriterion(name = ''): Criterion {
  return { id: newId(), name }
}

export function newMust(name = ''): MustCondition {
  return { id: newId(), name, passes: {} }
}

/** 화면에 보이는 단계 순서. 진행 단계바와 "다음" 버튼이 같은 표를 쓴다. */
export const FLOW = [
  'frame',
  'alternatives',
  'gut',
  'criteria',
  'must',
  'weight',
  'evaluate',
] as const

export type FlowStep = (typeof FLOW)[number]

export function stepNumber(step: FlowStep): number {
  return FLOW.indexOf(step) + 1
}

export function nextPath(id: string, step: FlowStep): string {
  const index = FLOW.indexOf(step)
  const next = FLOW[index + 1]
  return next ? `/d/${id}/${next}` : `/d/${id}/result`
}

export function prevPath(id: string, step: FlowStep): string {
  const index = FLOW.indexOf(step)
  const prev = FLOW[index - 1]
  return prev ? `/d/${id}/${prev}` : '/'
}

/** 30일 뒤 회고 예정일 (기획안 4.1 단계 10). */
export const REVIEW_AFTER_DAYS = 30

export function reviewDueDate(from: Date = new Date()): Date {
  const due = new Date(from)
  due.setDate(due.getDate() + REVIEW_AFTER_DAYS)
  return due
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

export function formatFullDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}`
}

export function daysUntil(iso: string, now: Date = new Date()): number {
  const target = new Date(iso)
  const ms = target.setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)
  return Math.round(ms / 86_400_000)
}
