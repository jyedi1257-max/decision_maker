import { describe, expect, it } from 'vitest'
import { evaluate, weightsFor } from './evaluate'
import { makeDecision } from './fixtures'
import { analyzeSensitivity, findRankFlip } from './sensitivity'
import { normalizeWeights, overrideFits, rocWeights } from './weights'

/** ①은 비용에, ②는 공간에 강하다. 기본(ROC)에서는 비용이 1순위라 ①이 이긴다. */
function tugOfWar() {
  return makeDecision({
    alternatives: ['비용이 싼 쪽', '넓은 쪽'],
    criteria: ['비용', '공간', '통근'],
    scores: [
      [5, 1, 3],
      [1, 5, 3],
    ],
  })
}

describe('normalizeWeights', () => {
  it('합을 1로 맞춘다', () => {
    const w = normalizeWeights([3, 1, 1])
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
    expect(w[0]).toBeCloseTo(0.6, 10)
  })
  it('비율은 그대로 둔다', () => {
    const w = normalizeWeights([2, 1])
    expect(w[0]! / w[1]!).toBeCloseTo(2, 10)
  })
  it('음수와 NaN은 0으로 본다', () => {
    const w = normalizeWeights([1, -5, Number.NaN])
    expect(w).toEqual([1, 0, 0])
  })
  it('전부 0이면 순서 기반 무게로 돌아간다', () => {
    expect(normalizeWeights([0, 0, 0])).toEqual(rocWeights(3))
  })
})

describe('overrideFits', () => {
  it('길이가 기준 수와 같아야 쓴다', () => {
    expect(overrideFits([0.5, 0.5], 2)).toBe(true)
    expect(overrideFits([0.5, 0.5], 3)).toBe(false)
    expect(overrideFits(null, 2)).toBe(false)
    expect(overrideFits([], 0)).toBe(false)
  })
})

describe('weightsFor', () => {
  it('손으로 정한 게 없으면 순서에서 뽑는다', () => {
    const d = tugOfWar()
    expect(weightsFor(d)).toEqual(rocWeights(3))
  })

  it('손으로 정했으면 그걸 쓴다', () => {
    const d = { ...tugOfWar(), weightOverride: [0.2, 0.7, 0.1] }
    expect(weightsFor(d)).toEqual([0.2, 0.7, 0.1])
  })

  it('기준을 하나 지워 길이가 어긋나면 버린다', () => {
    const d = tugOfWar()
    const stale = { ...d, weightOverride: [0.2, 0.7, 0.1], criteria: d.criteria.slice(0, 2) }
    expect(weightsFor(stale)).toEqual(rocWeights(2))
  })
})

describe('evaluate — 손으로 정한 무게', () => {
  it('공간을 무겁게 밀면 1위가 바뀐다', () => {
    const d = tugOfWar()
    expect(evaluate(d).ranked[0]!.name).toBe('비용이 싼 쪽')
    expect(evaluate({ ...d, weightOverride: [0.15, 0.75, 0.1] }).ranked[0]!.name).toBe('넓은 쪽')
  })

  it('넘겨준 무게는 저장된 것보다 우선한다 — 슬라이더 미리보기', () => {
    const d = { ...tugOfWar(), weightOverride: [0.15, 0.75, 0.1] }
    expect(evaluate(d).ranked[0]!.name).toBe('넓은 쪽')
    // 화면이 슬라이더 값을 그대로 넘겨 미리 계산해본다
    expect(evaluate(d, [0.8, 0.1, 0.1]).ranked[0]!.name).toBe('비용이 싼 쪽')
  })

  it('길이가 안 맞는 임시 무게는 무시한다', () => {
    const d = tugOfWar()
    expect(evaluate(d, [0.5, 0.5]).ranked[0]!.name).toBe(evaluate(d).ranked[0]!.name)
  })

  it('필수조건은 무게를 어떻게 밀어도 그대로 거른다', () => {
    const d = { ...tugOfWar(), musts: [{ id: 'm0', name: '조건', passes: { a1: false } }] }
    const r = evaluate(d, [0.05, 0.9, 0.05])
    expect(r.ranked).toHaveLength(1)
    expect(r.ranked[0]!.name).toBe('비용이 싼 쪽')
  })
})

describe('민감도 — 손으로 정한 무게가 있을 때', () => {
  it('순서 이동 분석을 내놓지 않는다 — 순서가 더 이상 무게를 정하지 않으므로', () => {
    const d = tugOfWar()
    expect(findRankFlip(d)).not.toBeNull()
    expect(findRankFlip({ ...d, weightOverride: [0.34, 0.33, 0.33] })).toBeNull()
  })

  it('박빙/안정 판정은 손으로 정한 무게 기준으로 다시 한다', () => {
    const d = tugOfWar()
    expect(analyzeSensitivity(d).robustness).toBe('stable')
    // 비용과 공간을 거의 같게 놓으면 두 후보가 붙는다
    const even = { ...d, weightOverride: [0.45, 0.45, 0.1] }
    expect(analyzeSensitivity(even).robustness).toBe('close')
  })
})
