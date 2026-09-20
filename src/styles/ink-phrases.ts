/**
 * 손글씨(KCC김환기체)로 찍는 문구.
 *
 * 디자인 시스템 §2 — 손글씨는 "사용자가 직접 남긴 것처럼 보이는 요소"에만 쓴다.
 * 앱에 실린 폰트는 이 목록의 글자만 담은 서브셋이므로, 여기를 고치면 반드시
 * `npm run font:subset`을 다시 돌려야 한다. 빠진 글자는 Gowun Batang으로 폴백된다.
 *
 * 자간은 절대 조정하지 않는다 (디자인 시스템 §9 금지 목록).
 */
export const INK_PHRASES = {
  /** 홈 하단, 종이 오른쪽에 비스듬히 */
  home: '적을수록 고민이 적어집니다',
  /** 결정 확정 화면의 도장 */
  stamp: '결정함',
} as const

export type InkPhraseKey = keyof typeof INK_PHRASES

/**
 * 문구가 아니라 낱글자로 서브셋에 들어가는 것들.
 *
 * 매트릭스 화면(§2 — 사용자가 직접 남긴 것)이 쓴다. 사용자가 매긴 점수,
 * 후보 번호, 기준의 무게 비율, 적합도 라벨은 **앱이 미리 아는 글자**라
 * 서브셋에 담을 수 있다. 반면 선택지·기준 **이름은 사용자가 직접 치는
 * 글자**라 어떤 글자가 나올지 알 수 없어 손글씨로 못 간다 — 담으려면
 * 원본 1.9MB를 통째로 실어야 한다. 그래서 이름은 본문 서체로 남는다.
 */
export const INK_GLYPHS = '0123456789%①②③④⑤낮보통높음'

/** 서브셋에 반드시 들어가야 하는 문자 집합 (공백 제외, 정렬됨). */
export function inkGlyphs(): string[] {
  const set = new Set<string>()
  for (const phrase of [...Object.values(INK_PHRASES), INK_GLYPHS]) {
    for (const ch of phrase) {
      if (ch.trim() !== '') set.add(ch)
    }
  }
  return [...set].sort()
}
