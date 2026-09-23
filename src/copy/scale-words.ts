/**
 * 5칸 척도의 값을 말로 읽는다.
 *
 * 목록·회고 카드에 "마음 4", "돌아보니 4"처럼 숫자만 남기면 무엇의 4인지 알 수 없다.
 * 척도 양 끝의 말(기울지 않았다 ↔ 이미 정했다, 별로였다 ↔ 잘한 선택이었다)에 맞춘다.
 */

const LEAN = ['거의 안 기욺', '조금 기욺', '반쯤 기욺', '꽤 기욺', '확실히 기욺'] as const
const LOOKING_BACK = ['별로였음', '조금 아쉬움', '그저 그럼', '괜찮았음', '잘한 선택'] as const

/** 확정할 때 "마음이 기운 정도" → "마음 꽤 기욺" */
export function leanWords(value: number): string {
  return `마음 ${LEAN[value - 1] ?? LEAN[2]}`
}

/** 회고 만족도 → "돌아보니 잘한 선택" */
export function lookingBackWords(value: number): string {
  return `돌아보니 ${LOOKING_BACK[value - 1] ?? LOOKING_BACK[2]}`
}
