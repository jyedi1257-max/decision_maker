/** 테스트용 결정 만들기. */
import type { Decision, Evidence } from './types'
import { scoreKey } from './types'

export function makeDecision(init: {
  alternatives: string[]
  criteria: string[]
  /** [후보 index][기준 index] = 1~5 또는 null */
  scores?: Array<Array<number | null>>
  musts?: Array<{ name: string; fails: number[] }>
  evidence?: Array<Array<Evidence | null>>
}): Decision {
  const alternatives = init.alternatives.map((name, i) => ({ id: `a${i}`, name }))
  const criteria = init.criteria.map((name, i) => ({ id: `c${i}`, name }))

  const scores: Decision['scores'] = {}
  init.scores?.forEach((row, ai) => {
    row.forEach((value, ci) => {
      const alt = alternatives[ai]
      const criterion = criteria[ci]
      if (!alt || !criterion) return
      scores[scoreKey(alt.id, criterion.id)] = {
        value,
        evidence: init.evidence?.[ai]?.[ci] ?? (value === null ? null : 'fact'),
      }
    })
  })

  const musts = (init.musts ?? []).map((m, i) => ({
    id: `m${i}`,
    name: m.name,
    passes: Object.fromEntries(
      alternatives.map((alt, ai) => [alt.id, !m.fails.includes(ai)]),
    ),
  }))

  const now = '2026-09-19T00:00:00.000Z'
  return {
    id: 'd0',
    question: '테스트 고민',
    alternatives,
    criteria,
    musts,
    scores,
    gut: { alternativeId: null, confidence: null },
    commit: null,
    review: null,
    stage: 'evaluate',
    createdAt: now,
    updatedAt: now,
    hiddenAlternativeAsked: false,
    dismissedDuplicateHints: [],
  }
}
