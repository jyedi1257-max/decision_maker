#!/usr/bin/env node
/**
 * 스티커 에셋 — 흑백(먹선) 스타일.
 *
 *   npm run stickers
 *
 * 그림의 모양은 이 파일 한 곳에만 있다. 바탕 6가지 × 외곽선(흰 오림선) 있음/없음을
 * 전부 src/assets/stickers/에 SVG로 뽑고, 목록을 index.json에 적는다.
 * SVG를 손으로 고치면 어느 게 최신인지 알 수 없게 되므로 여기서 고치고 다시 돌린다.
 *
 * 색은 디자인 시스템 §1에 이미 있는 값만 쓴다 — 먹(--ink), 카드 흰색(--card),
 * 회색 종이(--chip-neutral), 테두리(--border), 점선(--dashed), 입력 밑줄(--rule-ink).
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(root, 'src/assets/stickers')

const C = {
  ink: '#23201c',
  white: '#ffffff',
  grey: '#efebe1',
  edge: '#e3dfd5',
  tape: '#d2ccbf',
  rule: '#c7c0b2',
}
const LINE = 1.8
/** 오림선 두께의 절반. 그림 둘레로 이만큼 흰 여백이 생긴다. */
const HALO = 4.5
const PAD = 8

/**
 * 바탕 — 그림의 넓은 면(main)을 무엇으로 칠하나.
 * 작은 면(sub)은 도트·줄무늬·격자일 때 흰색으로 두어 무늬가 한 곳에만 보이게 한다.
 */
const FILLS = {
  white: { name: '흰색', main: C.white, sub: C.white },
  none: { name: '투명', main: 'none', sub: 'none' },
  grey: { name: '회색', main: C.grey, sub: C.white },
  dots: { name: '도트', main: 'url(#P-dots)', sub: C.white },
  stripe: { name: '줄무늬', main: 'url(#P-stripe)', sub: C.white },
  grid: { name: '격자', main: 'url(#P-grid)', sub: C.white },
}

const PATTERNS = {
  dots: `<pattern id="P-dots" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${C.white}"/><circle cx="3" cy="3" r="1.1" fill="${C.ink}"/></pattern>`,
  stripe: `<pattern id="P-stripe" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="${C.white}"/><rect width="1.7" height="6" fill="${C.ink}"/></pattern>`,
  grid: `<pattern id="P-grid" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${C.white}"/><path d="M0 .5H6M.5 0V6" stroke="${C.rule}" stroke-width=".9"/></pattern>`,
}

/**
 * 그림. 각 조각은 [태그, 속성, 역할].
 *   main — 넓은 면. 바탕 무늬가 들어간다
 *   sub  — 작은 면. 흰색(또는 투명)
 *   line — 선만
 *   ink  — 먹으로 칠한 작은 점
 */
const MOTIFS = {
  sign: {
    name: '갈림길 표지판',
    box: [64, 64],
    parts: [
      ['rect', { x: 29.5, y: 12, width: 5, height: 48, rx: 1 }, 'sub'],
      ['path', { d: 'M8 14H44L51 21 44 28H8Z' }, 'main'],
      ['path', { d: 'M56 32H20L13 39 20 46H56Z' }, 'sub'],
      ['path', { d: 'M20 60H44' }, 'line'],
    ],
  },
  cup: {
    name: '커피잔',
    box: [64, 64],
    parts: [
      ['path', { d: 'M46 29a8 8 0 0 1 0 14', 'stroke-width': 3 }, 'line'],
      ['path', { d: 'M13 25H47V39A13 13 0 0 1 34 52H26A13 13 0 0 1 13 39Z' }, 'main'],
      ['ellipse', { cx: 30, cy: 56, rx: 23, ry: 4 }, 'sub'],
      ['path', { d: 'M24 19c-4-4 4-6 0-11M33 19c-4-4 4-6 0-11' }, 'line'],
    ],
  },
  clip: {
    name: '클립',
    box: [64, 64],
    parts: [['path', { d: 'M24 50V16a8 8 0 0 1 16 0V46a5 5 0 0 1-10 0V20', 'stroke-width': 3.2 }, 'line']],
  },
  leaf: {
    name: '새싹',
    box: [64, 64],
    parts: [
      ['path', { d: 'M32 60C32 44 33 30 38 12' }, 'line'],
      ['path', { d: 'M33 38C20 38 12 30 11 22 22 21 31 27 33 38Z' }, 'main'],
      ['path', { d: 'M35 28C44 29 52 22 53 12 43 12 36 19 35 28Z' }, 'main'],
      ['path', { d: 'M32 50C24 51 18 46 16 40 24 39 30 43 32 50Z' }, 'sub'],
    ],
  },
  moon: {
    name: '달',
    box: [64, 64],
    parts: [
      ['path', { d: 'M38 8A24 24 0 1 0 56 46 19 19 0 1 1 38 8Z' }, 'main'],
      ['path', { d: 'M50 12l1.6 3.8 4 .4-3 2.6.9 4-3.5-2.1-3.5 2.1.9-4-3-2.6 4-.4Z', 'stroke-width': 1.4 }, 'sub'],
    ],
  },
  plane: {
    name: '종이비행기',
    box: [64, 64],
    parts: [
      ['path', { d: 'M6 30 58 10 38 54 30 36Z' }, 'main'],
      ['path', { d: 'M30 36 28 48 34 42Z' }, 'sub'],
      ['path', { d: 'M30 36 58 10' }, 'line'],
    ],
  },
  pencil: {
    name: '연필',
    box: [64, 64],
    parts: [
      ['path', { d: 'M16 44 42 18 50 26 24 52Z' }, 'main'],
      ['path', { d: 'M42 18l5-5a3 3 0 0 1 4 0l4 4a3 3 0 0 1 0 4l-5 5Z' }, 'sub'],
      ['path', { d: 'M16 44 24 52 10 58Z' }, 'sub'],
      ['path', { d: 'M10 58l3-7 4 4Z' }, 'ink'],
    ],
  },
  envelope: {
    name: '봉투',
    box: [64, 64],
    parts: [
      ['rect', { x: 7, y: 15, width: 50, height: 36, rx: 2.5 }, 'main'],
      ['path', { d: 'M8 17 32 36 56 17' }, 'line'],
      ['circle', { cx: 32, cy: 36, r: 5 }, 'sub'],
    ],
  },
  bulb: {
    name: '전구',
    box: [64, 64],
    parts: [
      ['path', { d: 'M32 8A16 16 0 0 1 41 37V44H23V37A16 16 0 0 1 32 8Z' }, 'main'],
      ['rect', { x: 23, y: 44, width: 18, height: 6, rx: 1.5 }, 'sub'],
      ['rect', { x: 26, y: 50, width: 12, height: 5, rx: 1.5 }, 'sub'],
      ['path', { d: 'M28 30l4 5 4-5' }, 'line'],
      ['path', { d: 'M8 22h4M52 22h4M13 8l3 3M51 8l-3 3' }, 'line'],
    ],
  },
  pin: {
    name: '압정',
    box: [64, 64],
    parts: [
      ['path', { d: 'M32 42V60' }, 'line'],
      ['path', { d: 'M24 32H40L37 42H27Z' }, 'sub'],
      ['circle', { cx: 32, cy: 20, r: 14 }, 'main'],
      ['path', { d: 'M25 15a8 8 0 0 1 6-4', 'stroke-width': 1.4 }, 'line'],
    ],
  },
}

const LABELS = {
  round: { name: '원형 라벨', box: [56, 56], parts: [['circle', { cx: 28, cy: 28, r: 24 }, 'main']] },
  tag: {
    name: '꼬리표',
    box: [96, 56],
    parts: [
      ['path', { d: 'M16 6H86a6 6 0 0 1 6 6V44a6 6 0 0 1-6 6H16L4 28Z' }, 'main'],
      ['circle', { cx: 17, cy: 28, r: 3.5 }, 'sub'],
    ],
  },
  ticket: {
    name: '티켓',
    box: [96, 56],
    parts: [
      ['path', { d: 'M6 6H90V20a8 8 0 0 0 0 16V50H6V36a8 8 0 0 0 0-16Z' }, 'main'],
      ['path', { d: 'M70 10V46', 'stroke-dasharray': '3 3.5' }, 'line'],
    ],
  },
  bubble: {
    name: '말풍선',
    box: [96, 60],
    parts: [['path', { d: 'M10 6H86a6 6 0 0 1 6 6V36a6 6 0 0 1-6 6H36L22 54 25 42H10a6 6 0 0 1-6-6V12a6 6 0 0 1 6-6Z' }, 'main']],
  },
}

/** 양 끝을 손으로 찢은 마스킹테이프 */
const TAPE_PATH =
  'M4 2H136L132 6 136 10 132 14 136 18 132 22 136 26 132 28H4L8 24 4 20 8 16 4 12 8 8Z'
const TAPES = {
  plain: { name: '민무늬 테이프', fill: C.tape, extra: '' },
  dots: {
    name: '도트 테이프',
    fill: 'url(#T)',
    extra: `<pattern id="T" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="${C.tape}"/><circle cx="3.5" cy="3.5" r="1.3" fill="${C.white}"/></pattern>`,
  },
  stripe: {
    name: '줄무늬 테이프',
    fill: 'url(#T)',
    extra: `<pattern id="T" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="8" height="8" fill="${C.tape}"/><rect width="3" height="8" fill="${C.white}" fill-opacity=".7"/></pattern>`,
  },
  grid: {
    name: '격자 테이프',
    fill: 'url(#T)',
    extra: `<pattern id="T" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="${C.grey}"/><path d="M0 .5H7M.5 0V7" stroke="${C.rule}" stroke-width="1"/></pattern>`,
  },
  ink: { name: '먹색 테이프', fill: C.ink, extra: '' },
}

const attrs = (o) =>
  Object.entries(o)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ')

function paint(role, fill) {
  if (role === 'line') return { fill: 'none', stroke: C.ink }
  if (role === 'ink') return { fill: C.ink, stroke: C.ink }
  return { fill: role === 'main' ? fill.main : fill.sub, stroke: C.ink }
}

function renderSticker(item, fillKey, cut, uid) {
  const fill = FILLS[fillKey]
  const [w, h] = item.box
  const pad = cut ? PAD : 2
  const vb = `${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`
  const common = { 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }
  const geo = (a) => {
    const g = { ...a }
    delete g['stroke-width']
    delete g['stroke-dasharray']
    return g
  }

  // 오림선: 그림 둘레로 흰 띠, 그 바깥에 아주 옅은 테두리 한 줄 (흰 바탕 위에서도 가장자리가 보이게)
  let halo = ''
  if (cut) {
    const band = (color, width) =>
      item.parts
        .map(([tag, a]) => `<${tag} ${attrs({ ...geo(a), fill: color, stroke: color, 'stroke-width': width, ...common })}/>`)
        .join('')
    halo = `<g>${band(C.edge, HALO * 2 + 1.6)}${band(C.white, HALO * 2)}</g>`
  }

  const art = item.parts
    .map(([tag, a, role]) => {
      const p = paint(role, fill)
      return `<${tag} ${attrs({ 'stroke-width': LINE, ...a, fill: p.fill, stroke: p.stroke, ...common })}/>`
    })
    .join('')

  const pattern = fillKey in PATTERNS ? `<defs>${PATTERNS[fillKey]}</defs>` : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w + pad * 2}" height="${h + pad * 2}">${pattern}${halo}${art}</svg>\n`
  // 여러 스티커를 한 문서에 인라인해도 무늬 id가 부딪히지 않게 파일마다 고유하게
  return svg.replaceAll('P-', `${uid}-`)
}

function renderTape(key) {
  const t = TAPES[key]
  const uid = `tape-${key}`
  const defs = t.extra ? `<defs>${t.extra.replace('id="T"', `id="${uid}"`)}</defs>` : ''
  const fill = t.fill === 'url(#T)' ? `url(#${uid})` : t.fill
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 30" width="140" height="30">${defs}<path d="${TAPE_PATH}" fill="${fill}" fill-opacity="${key === 'ink' ? 0.9 : 0.78}"/></svg>\n`
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const index = []
for (const [kind, group] of [
  ['그림', MOTIFS],
  ['라벨', LABELS],
]) {
  for (const [key, item] of Object.entries(group)) {
    // 칠할 면이 없는 선 그림(클립)은 바탕을 바꿔도 똑같다 — 투명 하나만 뽑는다
    const hasFace = item.parts.some(([, , role]) => role === 'main' || role === 'sub')
    for (const fillKey of hasFace ? Object.keys(FILLS) : ['none']) {
      for (const cut of [true, false]) {
        const file = `${key}-${fillKey}${cut ? '-cut' : ''}.svg`
        const uid = file.replace('.svg', '')
        writeFileSync(resolve(OUT, file), renderSticker(item, fillKey, cut, uid))
        index.push({ file, kind, key, name: item.name, fill: fillKey, fillName: FILLS[fillKey].name, cut })
      }
    }
  }
}
for (const key of Object.keys(TAPES)) {
  const file = `tape-${key}.svg`
  writeFileSync(resolve(OUT, file), renderTape(key))
  index.push({ file, kind: '테이프', key: `tape-${key}`, name: TAPES[key].name, fill: key, fillName: TAPES[key].name, cut: false })
}
writeFileSync(resolve(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n')
console.log(`스티커 ${index.length}장 → src/assets/stickers/`)
