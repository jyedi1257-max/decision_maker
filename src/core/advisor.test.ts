import { describe, expect, it } from 'vitest'
import {
  decomposeHangul,
  duplicateKey,
  LocalAdvisor,
  normalizeName,
  similarity,
} from './advisor'
import { makeDecision } from './fixtures'
import type { Criterion } from './types'

const advisor = new LocalAdvisor()
const crit = (id: string, name: string): Criterion => ({ id, name })

describe('decomposeHangul', () => {
  it('완성형을 자모로 편다', () => {
    expect(decomposeHangul('강')).toBe('ㄱㅏㅇ')
    expect(decomposeHangul('가')).toBe('ㄱㅏ')
  })
  it('한글이 아닌 글자는 그대로 둔다', () => {
    expect(decomposeHangul('A1 가')).toBe('A1 ㄱㅏ')
  })
})

describe('normalizeName', () => {
  it('공백과 기호를 걷어낸다', () => {
    expect(normalizeName('월 주거비')).toBe('월주거비')
    expect(normalizeName('출퇴근 시간(편도)')).toBe('출퇴근시간편도')
  })
  it('흔한 꼬리말을 떼어낸다', () => {
    expect(normalizeName('소음 정도')).toBe('소음')
    expect(normalizeName('안전 여부')).toBe('안전')
  })
})

describe('similarity', () => {
  it('같은 말은 1이다', () => {
    expect(similarity('월 주거비', '월주거비')).toBe(1)
  })
  it('한쪽이 다른 쪽을 품으면 높게 본다', () => {
    expect(similarity('출퇴근', '출퇴근 시간')).toBeGreaterThan(0.8)
  })
  it('상관없는 말은 낮게 본다', () => {
    expect(similarity('월 주거비', '방 개수')).toBeLessThan(0.3)
  })
  it('빈 문자열은 0이다', () => {
    expect(similarity('', '방 개수')).toBe(0)
  })
  it('대칭이다', () => {
    expect(similarity('통근 시간', '출퇴근')).toBeCloseTo(similarity('출퇴근', '통근 시간'), 10)
  })
})

describe('findDuplicateCriteria', () => {
  it('같은 뜻을 다르게 적은 기준을 잡아낸다', () => {
    const hint = advisor.findDuplicateCriteria(
      [crit('c0', '월 주거비'), crit('c1', '방 개수'), crit('c2', '출퇴근 시간')],
      [],
    )
    expect(hint).toBeNull() // 셋은 서로 다른 기준이다

    const dup = advisor.findDuplicateCriteria(
      [crit('c0', '출퇴근 시간'), crit('c1', '직장 거리')],
      [],
    )
    expect(dup).not.toBeNull()
    expect([dup!.a.name, dup!.b.name].sort()).toEqual(['직장 거리', '출퇴근 시간'].sort())
  })

  it('글자가 겹치는 기준도 잡는다', () => {
    const dup = advisor.findDuplicateCriteria([crit('c0', '소음'), crit('c1', '소음 정도')], [])
    expect(dup).not.toBeNull()
  })

  it('"따로 볼게요"로 닫은 쌍은 다시 묻지 않는다', () => {
    const a = crit('c0', '출퇴근 시간')
    const b = crit('c1', '직장 거리')
    const key = duplicateKey(a, b)
    expect(advisor.findDuplicateCriteria([a, b], [key])).toBeNull()
  })

  it('기준이 하나뿐이면 물을 게 없다', () => {
    expect(advisor.findDuplicateCriteria([crit('c0', '비용')], [])).toBeNull()
  })

  it('기준을 새로 만들어 제안하지 않는다 — 있는 것끼리만 짝짓는다', () => {
    const criteria = [crit('c0', '월세'), crit('c1', '월 비용')]
    const hint = advisor.findDuplicateCriteria(criteria, [])!
    expect(criteria).toContain(hint.a)
    expect(criteria).toContain(hint.b)
  })
})

describe('suggestHiddenAlternative', () => {
  it('기다리기 계열 후보가 없으면 한 번 묻는다', () => {
    const d = makeDecision({ alternatives: ['재계약', '이사'], criteria: [] })
    expect(advisor.suggestHiddenAlternative(d)).toContain('후보인가요')
  })

  it('이미 물었으면 다시 묻지 않는다', () => {
    const d = makeDecision({ alternatives: ['재계약', '이사'], criteria: [] })
    d.hiddenAlternativeAsked = true
    expect(advisor.suggestHiddenAlternative(d)).toBeNull()
  })

  it('기다리는 선택지가 이미 있으면 묻지 않는다', () => {
    const d = makeDecision({ alternatives: ['이사', '1년 미루기'], criteria: [] })
    expect(advisor.suggestHiddenAlternative(d)).toBeNull()
  })

  it('후보가 없으면 묻지 않는다', () => {
    expect(advisor.suggestHiddenAlternative(makeDecision({ alternatives: [], criteria: [] }))).toBeNull()
  })
})

describe('guessEvidence', () => {
  it('숫자와 단위가 붙으면 사실로 본다', () => {
    expect(advisor.guessEvidence('보증금 3억, 월 90만원')).toBe('fact')
  })
  it('말끝이 흐리면 느낌으로 본다', () => {
    expect(advisor.guessEvidence('그냥 좋을 것 같다')).toBe('feeling')
  })
  it('어림수는 추정으로 본다 — 숫자가 있어도 확인한 값은 아니다', () => {
    expect(advisor.guessEvidence('30분 정도 예상')).toBe('estimate')
    expect(advisor.guessEvidence('대략 3억')).toBe('estimate')
  })
  it('빈 메모는 짚지 않는다', () => {
    expect(advisor.guessEvidence('  ')).toBeNull()
  })
  it('판단이 안 서면 null — 사용자 대신 정하지 않는다', () => {
    expect(advisor.guessEvidence('아직 모름')).toBeNull()
  })
})

describe('조언자의 경계 (기획안 8.3)', () => {
  it('점수를 매기거나 최종 선택을 정하는 창구가 없다', () => {
    const surface = Object.getOwnPropertyNames(LocalAdvisor.prototype)
    expect(surface).not.toContain('score')
    expect(surface).not.toContain('chooseBest')
    expect(surface).not.toContain('computeWeights')
    expect(surface.sort()).toEqual(
      ['constructor', 'findDuplicateCriteria', 'guessEvidence', 'suggestHiddenAlternative'].sort(),
    )
  })
})
