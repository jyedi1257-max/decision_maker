/**
 * 입력칸의 예시 문구.
 *
 * 시안에서는 '이사' 예시가 모든 화면에 고정돼 있었는데, 실제로 다른 고민을 적으면
 * 화면이 남의 옷을 입은 것처럼 읽혔다. 그래서 이렇게 나눈다.
 *
 *   · 고민 한 문장  — 문장의 *꼴*을 보여줘야 해서 예시가 필요하다. 대신 도메인을 섞은
 *                    묶음에서 결정마다 다른 것을 뽑는다.
 *   · 그 외 칸      — 후보·기준·조건·이유는 전적으로 그 사람의 고민에 달렸다.
 *                    예시를 주면 그 방향으로 끌려가므로 자리만 알려준다.
 */

/** 고민 한 문장의 예시. 한 묶음 안에서 서로 다른 생활 영역을 고른다. */
const QUESTION_EXAMPLES: string[][] = [
  ['가을에 이사할까, 지금 집에 더 살까', '전세로 갈까, 월세로 버틸까'],
  ['대학원을 올해 갈까, 2년 뒤에 갈까', '지금 회사에 남을까, 옮길까'],
  ['지금 차를 바꿀까, 2년 더 탈까', '이 장비를 살까, 한 해 더 미룰까'],
  ['이 관계를 이어갈까, 여기서 정리할까', '이번 주말에 말할까, 조금 더 볼까'],
  ['운동을 아침에 할까, 퇴근 후에 할까', '치료를 지금 받을까, 경과를 더 볼까'],
  ['이 프로젝트를 맡을까, 넘길까', '혼자 할까, 같이 할까'],
]

/**
 * 같은 결정에서는 늘 같은 예시가 나오도록 id로 고른다.
 * 화면을 오갈 때마다 예시가 바뀌면 산만하다.
 */
export function questionExamples(seed: string): string[] {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  const index = Math.abs(hash) % QUESTION_EXAMPLES.length
  return QUESTION_EXAMPLES[index] ?? QUESTION_EXAMPLES[0]!
}

/** 고민 입력칸의 흐린 글씨. 예시 묶음의 첫 문장을 쓴다. */
export function questionPlaceholder(seed: string): string {
  return questionExamples(seed)[0] ?? ''
}

/**
 * 후보·기준 칸의 흐린 글씨. 내용이 아니라 순서만 알려준다.
 * 예시를 넣으면 그 도메인으로 생각이 끌려간다.
 */
const ORDINAL_WORDS = ['첫 번째', '두 번째', '세 번째', '네 번째', '다섯 번째'] as const

export function slotPlaceholder(index: number, noun: string): string {
  const word = ORDINAL_WORDS[index]
  return word ? `${word} ${noun}` : noun
}
