/**
 * 앱 아이콘의 원본. 여기 한 곳만 고치면 모든 크기가 다시 나온다.
 *
 *   npm run icons
 *
 * `ink-phrases.ts` → `font:subset`과 같은 방식이다. PNG를 손으로 만들면
 * 어느 게 최신인지 알 수 없게 되고, 5개 밀도 중 하나를 빠뜨려도 모른다.
 *
 * 모티프는 확정 화면에 찍히는 도장이다 — 손글씨 '결정'을 세로로 쌓고
 * 세로로 긴 타원을 두른다. 격자는 108×108로 안드로이드 적응형 아이콘과 같고,
 * 모티프는 전부 안전 영역(중심에서 반지름 36) 안에 있어 어떤 런처 마스크에도
 * 잘리지 않는다. 확인은 `npm run icons`가 직접 픽셀로 잰다.
 */

/** 디자인 시스템 §1 — 새 색을 만들지 않는다. */
export const PAPER = '#FAF9F6'
export const PEN = '#B3402B'
export const DESK = '#EFECE5'
const RULE = '#EAE7DF'

/**
 * 도장.
 *
 * 손글씨는 글자마다 좌우 여백이 달라서 text-anchor:middle만으로는 치우친다.
 * 칠해진 픽셀로 재서 x는 +1, y는 -0.9만큼 되민 값이 아래 좌표다.
 */
export const MOTIF = `
  <ellipse cx="54" cy="54" rx="23.5" ry="33" fill="none" stroke="${PEN}" stroke-width="3.4"/>
  <text x="55" y="39.1" text-anchor="middle" dominant-baseline="central"
        font-family="PenInk" font-size="29" fill="${PEN}">결</text>
  <text x="55" y="67.1" text-anchor="middle" dominant-baseline="central"
        font-family="PenInk" font-size="29" fill="${PEN}">정</text>`

/** 원고지 바탕 — 크림색에 빨간 여백선과 괘선. 웹 파비콘이 쓴다. */
const PAPER_BG = `
  <rect width="108" height="108" fill="${PAPER}"/>
  ${[30, 48, 66, 84].map((y) => `<path d="M6 ${y} H102" stroke="${RULE}" stroke-width="1.4"/>`).join('')}
  <path d="M24 0 V108" stroke="${PEN}" stroke-width="1.6" opacity=".26"/>`

const svg = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${inner}</svg>`

/** 배경까지 있는 완성형. 파비콘·PWA·레거시 런처가 쓴다. */
export const iconFull = () => svg(PAPER_BG + MOTIF)

/**
 * 적응형 아이콘의 앞면. 배경은 런처가 따로 깐다.
 *
 * 괘선과 여백선은 넣지 않는다 — 앞면만 살짝 흔드는(패럴랙스) 런처가 있어서
 * 종이 무늬를 앞면에 넣으면 종이에서 떠 보이고, 배경에 넣으면 앞면과 어긋난다.
 * 그래서 안드로이드는 단색 종이 + 모티프로 간다.
 */
export const iconForeground = () => svg(MOTIF)

/** 안드로이드에서 실제로 보이는 모양 (배경색 + 앞면). 눈으로 확인할 때 쓴다. */
export const iconAdaptive = () => svg(`<rect width="108" height="108" fill="${PAPER}"/>${MOTIF}`)

/**
 * 실행 직후 잠깐 뜨는 화면.
 *
 * 바탕은 책상색이다 — capacitor.config.ts의 backgroundColor와 같은 값이라
 * 이미지와 그 뒤 화면 사이에 이음매가 안 보인다. 도장 하나만 가운데 둔다.
 */
export const splash = (w, h) => {
  const size = Math.min(w, h) * 0.3
  const x = (w - size) / 2
  const y = (h - size) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" fill="${DESK}"/>
    <svg x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${size.toFixed(2)}" height="${size.toFixed(2)}"
         viewBox="0 0 108 108">${MOTIF}</svg>
  </svg>`
}
