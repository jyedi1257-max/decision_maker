/**
 * 조언자 — AI가 하는 일의 경계.
 *
 * 기획안 8.3이 역할을 이미 못박아뒀다.
 *   해야 하는 것: 유사 기준 묶을지 묻기 / 명백한 핵심 누락 하나만 확인 /
 *                 사실과 추정 구분 돕기 / 사용자의 문장을 간결한 기준으로 정리
 *   하지 말 것:   기준 12개 자동 생성 / 끝없는 대안 추천 / 근거 없이 "AI가 8점" /
 *                 AI가 최종 선택을 단정
 *
 * 그래서 이 인터페이스에는 **점수 부여·최종 선택·가중치 산출이 없다.** 앞의 둘은
 * 기획안의 명시적 금지이고, 가중치는 ROC가 결정론적이어야 결과를 기준별 기여도로
 * 분해해 "차이를 만든 기준"을 말할 수 있기 때문이다 (원칙 5).
 *
 * 기본 구현은 네트워크를 쓰지 않는다. 외부 모델을 붙이고 싶으면 이 인터페이스 뒤에
 * 새 구현을 꽂으면 되고, 그때도 위 경계는 그대로다.
 */
import type { Criterion, Decision, Evidence } from './types'

export interface DuplicateHint {
  /** 겹쳐 보이는 두 기준 */
  a: Criterion
  b: Criterion
  /** 이 쌍을 이미 "따로 볼게요"로 닫았는지 판별할 키 */
  key: string
}

export interface Advisor {
  /** 같은 걸 두 번 재는 기준을 찾아 묶을지 묻는다. 찾지 못하면 null. */
  findDuplicateCriteria(criteria: Criterion[], dismissed: string[]): DuplicateHint | null
  /** 숨은 대안을 한 번만 제안한다 (기획안 4.1 단계 2). */
  suggestHiddenAlternative(decision: Decision): string | null
  /** 사용자가 적은 메모가 사실인지 추정인지 짚어준다. 확정은 사용자가 한다. */
  guessEvidence(note: string): Evidence | null
}

/* ── 한글 비교 ─────────────────────────────────────────── */

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
const JONG = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'

/** 완성형 한글을 자모로 편다. 받침 차이("출퇴근"/"출퇴근길")를 잡기 위해서다. */
export function decomposeHangul(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    if (code >= 0xac00 && code <= 0xd7a3) {
      const index = code - 0xac00
      out += CHO[Math.floor(index / 588)] ?? ''
      out += JUNG[Math.floor((index % 588) / 28)] ?? ''
      const jong = JONG[index % 28]
      if (jong && jong !== ' ') out += jong
    } else {
      out += ch
    }
  }
  return out
}

/** 비교 전에 군더더기를 걷어낸다. */
export function normalizeName(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s·.,/()[\]{}'"`~!@#$%^&*+=|\\<>?;:-]/g, '')
    .replace(/(하기|되기|여부|정도|수준|문제|사항)$/u, '')
}

/** 두 글자씩 끊어 만든 집합. */
function bigrams(text: string): Set<string> {
  const set = new Set<string>()
  for (let i = 0; i < text.length - 1; i++) set.add(text.slice(i, i + 2))
  if (text.length === 1) set.add(text)
  return set
}

/** 0~1. 같은 뜻을 다르게 적은 기준을 잡기 위한 대략적인 겹침 정도. */
export function similarity(a: string, b: string): number {
  const na = decomposeHangul(normalizeName(a))
  const nb = decomposeHangul(normalizeName(b))
  if (na.length === 0 || nb.length === 0) return 0
  if (na === nb) return 1

  // 한쪽이 다른 쪽을 통째로 품으면 같은 걸 재고 있을 가능성이 높다.
  if (na.includes(nb) || nb.includes(na)) {
    return 0.82 + 0.18 * (Math.min(na.length, nb.length) / Math.max(na.length, nb.length))
  }

  const ga = bigrams(na)
  const gb = bigrams(nb)
  let shared = 0
  for (const g of ga) if (gb.has(g)) shared++
  return (2 * shared) / (ga.size + gb.size)
}

/** 이 선을 넘으면 사용자에게 한 번 물어본다. */
export const DUPLICATE_THRESHOLD = 0.62

/** 뜻이 같은 표현을 미리 묶어둔 사전. 문자열만으로는 못 잡는 쌍을 보완한다. */
const SYNONYM_GROUPS: string[][] = [
  ['출퇴근시간', '통근시간', '직장거리', '회사거리', '통근', '출퇴근'],
  ['월주거비', '월세', '월비용', '월부담', '주거비용', '생활비'],
  ['방개수', '방수', '공간', '넓이', '평수', '면적'],
  ['계약안정성', '거주안정성', '안정성'],
  ['소음', '층간소음', '조용함'],
  ['연봉', '급여', '보수', '월급'],
  ['성장가능성', '커리어', '전망', '발전가능성'],
]

function synonymGroupOf(name: string): number {
  const n = normalizeName(name)
  return SYNONYM_GROUPS.findIndex((group) => group.some((s) => normalizeName(s) === n))
}

export function duplicateKey(a: Criterion, b: Criterion): string {
  return [a.id, b.id].sort().join('~')
}

/** 기기 안에서만 도는 기본 조언자. 네트워크를 쓰지 않는다. */
export class LocalAdvisor implements Advisor {
  findDuplicateCriteria(criteria: Criterion[], dismissed: string[]): DuplicateHint | null {
    let best: { hint: DuplicateHint; score: number } | null = null

    for (let i = 0; i < criteria.length; i++) {
      for (let j = i + 1; j < criteria.length; j++) {
        const a = criteria[i]!
        const b = criteria[j]!
        const key = duplicateKey(a, b)
        if (dismissed.includes(key)) continue

        const groupA = synonymGroupOf(a.name)
        const sameGroup = groupA !== -1 && groupA === synonymGroupOf(b.name)
        const score = sameGroup ? 1 : similarity(a.name, b.name)
        if (score < DUPLICATE_THRESHOLD) continue

        if (best === null || score > best.score) {
          best = { hint: { a, b, key }, score }
        }
      }
    }

    return best?.hint ?? null
  }

  suggestHiddenAlternative(decision: Decision): string | null {
    // 한 번만 묻는다 (기획안 4.1 단계 2).
    if (decision.hiddenAlternativeAsked) return null
    if (decision.alternatives.length === 0) return null

    const names = decision.alternatives.map((a) => normalizeName(a.name))
    const waitWords = ['기다', '미루', '유지', '그대로', '나중', '내년', '보류', '아무것도']
    const hasWaitOption = names.some((n) => waitWords.some((w) => n.includes(normalizeName(w))))
    if (hasWaitOption) return null

    return '“지금은 그냥 두기”도 선택지에 넣을까요?'
  }

  guessEvidence(note: string): Evidence | null {
    const text = note.trim()
    if (text.length === 0) return null

    // 얼버무리는 말이 먼저다. "30분 정도"는 숫자가 있어도 확인한 값이 아니다.
    if (/(같|듯|아마|대충|느낌|싶|보임|보인다|듯하)/.test(text)) return 'feeling'
    if (/(정도|쯤|예상|추정|가량|내외|대략|안팎)/.test(text)) return 'estimate'
    // 숫자와 단위가 붙어 있으면 확인한 값일 가능성이 높다.
    if (/\d/.test(text) && /(원|만|억|분|시간|개|평|㎡|년|월|일|%|km|m)/.test(text)) return 'fact'
    return null
  }
}

export const advisor: Advisor = new LocalAdvisor()
