/**
 * 결과를 사람이 읽는 문장으로.
 *
 * 기획안 4.2 / 6.7 / 디자인 §7 — 민감도는 tornado chart 대신
 * "두 선택지는 박빙이에요. 비용을 조금만 더 중요하게 생각하면 결과가 바뀝니다." 처럼
 * 먼저 한 문장으로 요약한다.
 *
 * 기획안 8.1 원칙 7 — "정답/최선"으로 단정하지 않고 "현재 입력 기준에서는"이라고 말한다.
 */
import type { EvaluationResult } from './evaluate'
import { differenceMakers, type DifferenceMaker, type Uncertainty } from './explain'
import type { SensitivitySummary } from './sensitivity'

const CIRCLED = ['①', '②', '③', '④', '⑤'] as const
export function ordinalMark(n: number): string {
  return CIRCLED[n - 1] ?? `(${n})`
}

/**
 * 결과 화면 결론. "A가 정답"이 아니라 "지금 적은 기준에서는 A가 더 잘 맞는다".
 *
 * 세 토막으로 나눠 돌려준다. 화면은 `lead + particle`을 한 줄로, `tail`을 다음 줄로 놓는다 —
 * 조사만 다음 줄로 넘어가면 읽기 어색해지기 때문이다.
 */
export function conclusionSentence(result: EvaluationResult, sensitivity: SensitivitySummary) {
  const leader = result.ranked[0]
  if (!leader) return null

  const lead = `${ordinalMark(leader.ordinal)} ${leader.name}`

  if (result.ranked.length === 1) {
    return { lead, particle: '만', tail: '남았어요.' }
  }
  return {
    lead,
    // 선택지 이름이 길면 첫 줄이 이미 꽉 찬다. '쪽으로'까지 둘째 줄에 함께 내린다.
    particle: '',
    tail: sensitivity.robustness === 'close' ? '쪽으로 조금 기울어요.' : '쪽으로 기울어요.',
  }
}

/** "차이를 만든 건" 줄. */
export function differenceSentence(maker: DifferenceMaker, leaderOrdinal: number): string {
  const mark = `${ordinalMark(leaderOrdinal)}가`
  if (maker.favorsLeader) {
    return maker.strong ? `${mark} 훨씬 나음` : `${mark} 나음`
  }
  return maker.strong ? `${mark} 크게 손해` : `${mark} 손해`
}

/** 민감도 한 문장. 숫자와 그래프는 상세 보기 안으로 넣는다. */
export function robustnessSentence(sensitivity: SensitivitySummary): string {
  const { robustness, rankFlip } = sensitivity

  if (rankFlip === null) {
    return robustness === 'close'
      ? '두 선택지가 거의 붙어 있어요. 기준을 어떻게 놓아도 결과는 비슷합니다.'
      : '둘 사이 차이가 분명해요. 기준 순서를 바꿔도 잘 뒤집히지 않습니다.'
  }

  const direction = rankFlip.steps > 0 ? '높이면' : '낮추면'
  const amount = Math.abs(rankFlip.steps) === 1 ? '한 칸만' : `${Math.abs(rankFlip.steps)}칸`
  const target = `${ordinalMark(rankFlip.newLeaderOrdinal)}`

  if (robustness === 'close') {
    return `결과는 박빙이에요. ‘${rankFlip.criterionName}’의 중요도를 ${amount} ${direction} ${target}이 앞섭니다.`
  }
  return `둘 사이 차이가 분명해요. 다만 ‘${rankFlip.criterionName}’의 중요도를 ${amount} ${direction} ${target}으로 바뀝니다.`
}

/**
 * 아직 확인 안 한 칸 — 비워뒀거나 추정·느낌으로 채운 칸 (기획안 8.1 원칙 6).
 * 평가 화면에서 사실/추정/느낌을 고르게 한 이유가 여기서 돌아온다.
 * 가장 무게 있는 한 칸만 말하고, 나머지는 개수로만 덧붙인다. 없으면 null.
 */
export function uncertaintySentence(list: Uncertainty[]): string | null {
  const u = list[0]
  if (!u) return null
  const who = `${ordinalMark(u.alternativeOrdinal)}의 ‘${u.criterionName}’${topicParticle(u.criterionName)}`
  const what = u.kind === 'missing' ? '아직 비워둔 칸이에요' : u.kind === 'estimate' ? '추정으로 매겼어요' : '느낌으로 매겼어요'
  const tail = u.matters ? '실제로 확인해 보면 결과를 더 믿을 수 있어요.' : '알아두면 좋아요.'
  const more = list.length > 1 ? ` 이런 칸이 ${list.length - 1}개 더 있어요.` : ''
  return `${who} ${what}. ${tail}${more}`
}

/** 직감과 분석이 갈렸을 때. 직감을 틀린 것으로 다루지 않는다 (기획안 7.3). */
export function gutConflictSentence(): string {
  return '머리와 마음이 갈렸어요. 어디서 갈렸는지 볼 수 있어요.'
}

/** 받침이 있으면 '과', 없으면 '와'. "주거비과"가 되지 않게. */
function andParticle(word: string): string {
  const code = word.charCodeAt(word.length - 1)
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return '와'
  return (code - 0xac00) % 28 === 0 ? '와' : '과'
}

/** 받침이 있으면 '은', 없으면 '는'. "방 개수은"이 되지 않게. */
function topicParticle(word: string): string {
  const code = word.charCodeAt(word.length - 1)
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return '는'
  return (code - 0xac00) % 28 === 0 ? '는' : '은'
}

/** 이름 여럿을 "A와 B" / "A, B와 C"로 잇는다. */
export function joinNames(names: string[]): string {
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]!
  const last = names[names.length - 1]!
  const head = names.slice(0, -1)
  const beforeLast = head[head.length - 1]!
  return `${head.join(', ')}${andParticle(beforeLast)} ${last}`
}

/**
 * "차이를 만든 기준" 블록의 첫 문장.
 *
 * 작은 표제부("결정적이었던 두 가지")를 걷어내고 그 자리에 들어간다 —
 * 블록마다 라벨을 얹는 건 사람이 쓴 글의 모양이 아니다 (디자인 §5, 2026-09-20).
 * 비교 대상은 1위와 2위다. 셋 이상이어도 "앞의 둘"이라고만 말한다.
 */
export function differenceLead(result: EvaluationResult): string | null {
  if (result.ranked.length < 2) return null
  const names = differenceMakers(result).map((maker) => maker.criterion.name)
  if (names.length === 0) return null
  return names.length === 1
    ? `앞의 둘을 가른 건 ${names[0]} 하나였어요.`
    : `앞의 둘을 가른 건 ${joinNames(names)}였어요.`
}

/** 결과 화면에 올릴 "차이를 만든 기준" 묶음. */
export function differenceRows(result: EvaluationResult) {
  const leader = result.ranked[0]
  if (!leader) return []
  return differenceMakers(result).map((maker) => ({
    maker,
    text: differenceSentence(maker, leader.ordinal),
  }))
}
