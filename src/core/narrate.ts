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
import { differenceMakers, type DifferenceMaker } from './explain'
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

/** Why 화면의 "결과가 뒤집히는 지점". */
export function flipPointSentence(sensitivity: SensitivitySummary): string {
  const { rankFlip } = sensitivity
  if (rankFlip === null) {
    return '기준 순서를 어떻게 바꿔도 1위는 그대로예요. 지금 정보로는 결과가 단단합니다.'
  }
  const direction = rankFlip.steps > 0 ? '무겁게' : '가볍게'
  const amount = Math.abs(rankFlip.steps) === 1 ? '한 단계만 더' : `${Math.abs(rankFlip.steps)}단계 더`
  return `‘${rankFlip.criterionName}’을 ${amount} ${direction} 보면 ${ordinalMark(rankFlip.newLeaderOrdinal)}로 바뀝니다. 나머지 기준은 조금 바꿔도 결과가 유지돼요.`
}

/** 직감과 분석이 갈렸을 때. 직감을 틀린 것으로 다루지 않는다 (기획안 7.3). */
export function gutConflictSentence(): string {
  return '머리와 마음이 갈렸어요. 어디서 갈렸는지 볼 수 있어요.'
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
