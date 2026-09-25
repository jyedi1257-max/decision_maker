#!/usr/bin/env node
/**
 * 스티커 에셋.
 *
 *   npm run stickers
 *
 * 모양은 이 파일 한 곳에만 있다. src/assets/stickers/에 SVG를 뽑고, 목록을 index.json에,
 * 피그마용 전체 시트를 figma-sheet.svg에 적는다. SVG를 손으로 고치지 않는다.
 *
 *   그림 — 흑백 먹선. 그림마다 어울리는 칠 하나를 정해 두고
 *          오림선(외곽선) 있음 · 없음 · 선만(투명) 세 가지로 뽑는다.
 *   라벨 — 글자를 얹는 틀. 그림과 같은 세 가지.
 *   포스트잇 · 마스킹테이프 — 감성 컬러(분홍·세이지·버터·하늘·라벤더).
 *
 * 피그마에서 객체를 따로 쓰도록 스티커마다 레이어를 나눈다.
 *   외곽선 · 칠 · 무늬 · 먹선   (포스트잇은 그림자 · 종이 · 무늬 · 접힌 모서리)
 * 그룹 id가 피그마 레이어 이름이 된다. 무늬는 SVG pattern 대신 실제 점·선 도형을
 * 그림 모양으로 잘라(clip-path) 넣는다 — 피그마는 pattern 채우기를 제대로 못 읽는다.
 *
 * 색은 디자인 시스템 §1에 있는 값만 쓴다. 감성 컬러는 '스티커 전용'으로 §1에 올라가 있다.
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
  rule: '#c7c0b2',
}
/** 감성 컬러 (스티커 전용, 디자인 시스템 §1) — 바탕과 한 톤 짙은 무늬색 */
const SOFT = {
  rose: { name: '분홍', base: '#efc4bb', deep: '#d99f94' },
  sage: { name: '세이지', base: '#c6d4b7', deep: '#a1b58f' },
  butter: { name: '버터', base: '#f4e1a3', deep: '#e0c270' },
  sky: { name: '하늘', base: '#c3d6e8', deep: '#95b3d1' },
  lav: { name: '라벤더', base: '#d6cbe8', deep: '#ae9fd0' },
}
const LINE = 1.8
const HALO = 4.5
const PAD = 8

const attrs = (o) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ')
const round = { 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }
const geo = (a) => {
  const g = { ...a }
  delete g['stroke-width']
  delete g['stroke-dasharray']
  return g
}

/* ── 무늬: 상자 크기만큼 점·선을 깔고, 그림 모양으로 잘라 쓴다 ── */
function texture(kind, w, h, color) {
  const out = []
  if (kind === 'dots') {
    for (let y = 3; y < h + 6; y += 6) for (let x = (y / 6) % 2 ? 6 : 3; x < w + 6; x += 6) out.push(`<circle cx="${x}" cy="${y}" r="1.1" fill="${color}"/>`)
  } else if (kind === 'stripe') {
    for (let k = -h; k < w + h; k += 6) out.push(`<path d="M${k} ${h + 4}L${k + h + 8} -4" stroke="${color}" stroke-width="1.6"/>`)
  } else if (kind === 'grid') {
    for (let x = 0.5; x < w + 6; x += 6) out.push(`<path d="M${x} -2V${h + 2}" stroke="${color}" stroke-width=".9"/>`)
    for (let y = 0.5; y < h + 6; y += 6) out.push(`<path d="M-2 ${y}H${w + 2}" stroke="${color}" stroke-width=".9"/>`)
  } else if (kind === 'gingham') {
    for (let x = 0; x < w + 8; x += 8) out.push(`<rect x="${x}" y="-2" width="4" height="${h + 4}" fill="${color}" fill-opacity=".38"/>`)
    for (let y = 0; y < h + 8; y += 8) out.push(`<rect x="-2" y="${y}" width="${w + 4}" height="4" fill="${color}" fill-opacity=".38"/>`)
  } else if (kind === 'hstripe') {
    for (let y = 2; y < h + 6; y += 7) out.push(`<rect x="-2" y="${y}" width="${w + 4}" height="3" fill="${color}" fill-opacity=".7"/>`)
  } else if (kind === 'flowers') {
    for (let y = 8; y < h + 10; y += 14)
      for (let x = (y / 14) % 2 ? 4 : 11; x < w + 10; x += 14)
        for (let a = 0; a < 5; a++) {
          const r = (a * 72 * Math.PI) / 180
          out.push(`<circle cx="${(x + Math.cos(r) * 2.4).toFixed(1)}" cy="${(y + Math.sin(r) * 2.4).toFixed(1)}" r="1.5" fill="${color}"/>`)
        }
  } else if (kind === 'wave') {
    for (let y = 8; y < h + 10; y += 10) {
      let d = `M-4 ${y}`
      for (let x = -4; x < w + 8; x += 8) d += ` q2 -3 4 0 t4 0`
      out.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="1.4"/>`)
    }
  } else if (kind === 'lined') {
    for (let y = 18; y < h - 6; y += 8) out.push(`<path d="M12 ${y}H${w - 10}" stroke="${color}" stroke-width="1"/>`)
  }
  return out.join('')
}

/*
 * ── 그림 36가지 ─────────────────────────────────────────────
 * 조각은 [태그, 속성, 역할]
 *   main  — 넓은 면. 이 그림의 칠(흰색·회색·도트·줄무늬·격자)이 들어간다
 *   sub   — 흰 면
 *   shade — 회색 면
 *   line  — 선만
 *   ink   — 먹으로 칠한 작은 면
 * fill — 그림마다 어울리는 칠 하나
 */
const MOTIFS = {
  // 결정 · 생각
  sign: { name: '갈림길 표지판', group: '결정·생각', fill: 'white', parts: [
    ['rect', { x: 29.5, y: 12, width: 5, height: 48, rx: 1 }, 'sub'],
    ['path', { d: 'M8 14H44L51 21 44 28H8Z' }, 'main'],
    ['path', { d: 'M56 32H20L13 39 20 46H56Z' }, 'shade'],
    ['path', { d: 'M20 60H44' }, 'line'],
  ] },
  compass: { name: '나침반', group: '결정·생각', fill: 'grey', parts: [
    ['circle', { cx: 32, cy: 6, r: 3 }, 'line'],
    ['circle', { cx: 32, cy: 34, r: 24 }, 'main'],
    ['circle', { cx: 32, cy: 34, r: 18 }, 'sub'],
    ['path', { d: 'M32 11V14M32 54V57M9 34H12M52 34H55' }, 'line'],
    ['path', { d: 'M32 18 37 34H27Z' }, 'ink'],
    ['path', { d: 'M32 50 37 34H27Z' }, 'sub'],
    ['circle', { cx: 32, cy: 34, r: 2 }, 'sub'],
  ] },
  scale: { name: '저울', group: '결정·생각', fill: 'white', parts: [
    ['path', { d: 'M32 12V50' }, 'line'],
    ['path', { d: 'M22 56H42L38 50H26Z' }, 'shade'],
    ['path', { d: 'M10 18H54' }, 'line'],
    ['path', { d: 'M10 18 4 36M10 18 16 36M54 18 48 36M54 18 60 36' }, 'line'],
    ['path', { d: 'M2 36H18A8 6 0 0 1 2 36Z' }, 'main'],
    ['path', { d: 'M46 36H62A8 6 0 0 1 46 36Z' }, 'main'],
    ['circle', { cx: 32, cy: 11, r: 3 }, 'ink'],
  ] },
  bulb: { name: '전구', group: '결정·생각', fill: 'white', parts: [
    ['path', { d: 'M32 8A16 16 0 0 1 41 37V44H23V37A16 16 0 0 1 32 8Z' }, 'main'],
    ['rect', { x: 23, y: 44, width: 18, height: 6, rx: 1.5 }, 'shade'],
    ['rect', { x: 26, y: 50, width: 12, height: 5, rx: 1.5 }, 'shade'],
    ['path', { d: 'M28 30l4 5 4-5' }, 'line'],
    ['path', { d: 'M6 22h5M53 22h5M12 7l3 3M52 7l-3 3' }, 'line'],
  ] },
  think: { name: '생각구름', group: '결정·생각', fill: 'dots', parts: [
    ['path', { d: 'M16 40A8 8 0 0 1 17 24 11 11 0 0 1 37 17 9 9 0 0 1 51 24 8 8 0 0 1 52 40Z' }, 'main'],
    ['circle', { cx: 15, cy: 47, r: 3.5 }, 'sub'],
    ['circle', { cx: 9, cy: 54, r: 2 }, 'sub'],
    ['circle', { cx: 32.5, cy: 30.5, r: 8.5 }, 'sub'],
    ['path', { d: 'M29 27a4 4 0 1 1 6 3.4c-1.5 .9-2 1.7-2 3' }, 'line'],
    ['circle', { cx: 33, cy: 36.4, r: 1.3 }, 'ink'],
  ] },
  checklist: { name: '체크리스트', group: '결정·생각', fill: 'grid', parts: [
    ['rect', { x: 12, y: 8, width: 40, height: 50, rx: 3 }, 'main'],
    ['rect', { x: 24, y: 4, width: 16, height: 8, rx: 2 }, 'shade'],
    ['rect', { x: 17, y: 19, width: 7, height: 7, rx: 1 }, 'sub'],
    ['rect', { x: 17, y: 31, width: 7, height: 7, rx: 1 }, 'sub'],
    ['rect', { x: 17, y: 43, width: 7, height: 7, rx: 1 }, 'sub'],
    ['path', { d: 'M18.5 22.5l2 2 4.5-5.5M18.5 34.5l2 2 4.5-5.5' }, 'line'],
    ['rect', { x: 28, y: 20, width: 19, height: 5, rx: 1 }, 'sub'],
    ['rect', { x: 28, y: 32, width: 16, height: 5, rx: 1 }, 'sub'],
    ['rect', { x: 28, y: 44, width: 13, height: 5, rx: 1 }, 'sub'],
  ] },
  key: { name: '열쇠', group: '결정·생각', fill: 'dots', parts: [
    ['path', { d: 'M26 29H56V35H52V41H47V35H26Z' }, 'sub'],
    ['circle', { cx: 17, cy: 32, r: 11 }, 'main'],
    ['circle', { cx: 14, cy: 32, r: 3.5 }, 'sub'],
  ] },
  lock: { name: '자물쇠', group: '결정·생각', fill: 'stripe', parts: [
    ['path', { d: 'M22 30V22a10 10 0 0 1 20 0V30', 'stroke-width': 3.2 }, 'line'],
    ['rect', { x: 15, y: 29, width: 34, height: 28, rx: 5 }, 'main'],
    ['rect', { x: 26, y: 35, width: 12, height: 16, rx: 3 }, 'sub'],
    ['circle', { cx: 32, cy: 41, r: 2.6 }, 'ink'],
    ['path', { d: 'M32 43V47', 'stroke-width': 2.6 }, 'line'],
  ] },
  hourglass: { name: '모래시계', group: '결정·생각', fill: 'white', parts: [
    ['path', { d: 'M20 13C20 26 29 28 29 32S20 38 20 51H44C44 38 35 36 35 32S44 26 44 13Z' }, 'main'],
    ['path', { d: 'M24.5 48C26.5 44 30 43 32 43S37.5 44 39.5 48Z' }, 'shade'],
    ['path', { d: 'M24 17H40C38 22 34 25 32 26 30 25 26 22 24 17Z' }, 'shade'],
    ['rect', { x: 15, y: 8, width: 34, height: 5, rx: 1.5 }, 'sub'],
    ['rect', { x: 15, y: 51, width: 34, height: 5, rx: 1.5 }, 'sub'],
  ] },
  calendar: { name: '달력', group: '결정·생각', fill: 'white', parts: [
    ['rect', { x: 8, y: 12, width: 48, height: 44, rx: 4 }, 'main'],
    ['path', { d: 'M8 16a4 4 0 0 1 4-4H52a4 4 0 0 1 4 4V24H8Z' }, 'shade'],
    ['path', { d: 'M20 7V16M44 7V16', 'stroke-width': 3 }, 'line'],
    ['path', { d: 'M15 32h5M27 32h5M39 32h5M15 41h5M27 41h5M15 50h5M27 50h5M39 41h5' }, 'line'],
    ['circle', { cx: 41.5, cy: 41, r: 5.8 }, 'line'],
  ] },
  clock: { name: '자명종', group: '결정·생각', fill: 'grey', parts: [
    ['path', { d: 'M17 57l5-6M47 57l-5-6' }, 'line'],
    ['path', { d: 'M10 21A10 10 0 0 1 24 9Z' }, 'sub'],
    ['path', { d: 'M54 21A10 10 0 0 0 40 9Z' }, 'sub'],
    ['circle', { cx: 32, cy: 34, r: 19 }, 'main'],
    ['circle', { cx: 32, cy: 34, r: 14.5 }, 'sub'],
    ['path', { d: 'M32 25V34L38 38' }, 'line'],
    ['circle', { cx: 32, cy: 34, r: 1.8 }, 'ink'],
  ] },

  // 문구 · 다이어리
  pencil: { name: '연필', group: '문구·다이어리', fill: 'stripe', parts: [
    ['path', { d: 'M16 44 42 18 50 26 24 52Z' }, 'main'],
    ['path', { d: 'M42 18l5-5a3 3 0 0 1 4 0l4 4a3 3 0 0 1 0 4l-5 5Z' }, 'shade'],
    ['path', { d: 'M16 44 24 52 10 58Z' }, 'sub'],
    ['path', { d: 'M10 58l3-7 4 4Z' }, 'ink'],
  ] },
  pen: { name: '만년필', group: '문구·다이어리', fill: 'grey', parts: [
    ['path', { d: 'M26 44 46 12a4 4 0 0 1 6 4L32 48Z' }, 'main'],
    ['path', { d: 'M26 44 32 48 24 60Z' }, 'sub'],
    ['path', { d: 'M29 46 25.5 55' }, 'line'],
    ['circle', { cx: 28.7, cy: 48.6, r: 1.1 }, 'ink'],
    ['path', { d: 'M47 18 38 33' }, 'line'],
  ] },
  clip: { name: '클립', group: '문구·다이어리', fill: 'white', parts: [
    ['path', { d: 'M24 50V16a8 8 0 0 1 16 0V46a5 5 0 0 1-10 0V20', 'stroke-width': 3.2 }, 'line'],
  ] },
  pin: { name: '압정', group: '문구·다이어리', fill: 'dots', parts: [
    ['path', { d: 'M32 42V60' }, 'line'],
    ['path', { d: 'M24 32H40L37 42H27Z' }, 'sub'],
    ['circle', { cx: 32, cy: 20, r: 14 }, 'main'],
    ['path', { d: 'M25 15a8 8 0 0 1 6-4', 'stroke-width': 1.4 }, 'line'],
  ] },
  eraser: { name: '지우개', group: '문구·다이어리', fill: 'stripe', parts: [
    ['path', { d: 'M10 40 30 20 44 34 24 54Z' }, 'sub'],
    ['path', { d: 'M30 20 38 12 52 26 44 34Z' }, 'main'],
  ] },
  scissors: { name: '가위', group: '문구·다이어리', fill: 'grey', parts: [
    ['path', { d: 'M30 36 54 8 36 38Z' }, 'sub'],
    ['path', { d: 'M34 36 10 8 28 38Z' }, 'sub'],
    ['path', { d: 'M26 42 30 37M38 42 34 37' }, 'line'],
    ['circle', { cx: 22, cy: 48, r: 8 }, 'main'],
    ['circle', { cx: 42, cy: 48, r: 8 }, 'main'],
    ['circle', { cx: 22, cy: 48, r: 3.8 }, 'sub'],
    ['circle', { cx: 42, cy: 48, r: 3.8 }, 'sub'],
    ['circle', { cx: 32, cy: 36, r: 1.8 }, 'ink'],
  ] },
  envelope: { name: '봉투', group: '문구·다이어리', fill: 'white', parts: [
    ['rect', { x: 7, y: 15, width: 50, height: 36, rx: 2.5 }, 'main'],
    ['path', { d: 'M8 17 32 36 56 17' }, 'line'],
    ['rect', { x: 45, y: 20, width: 7, height: 8, rx: .8 }, 'shade'],
    ['circle', { cx: 32, cy: 36, r: 5 }, 'sub'],
  ] },
  stamp: { name: '우표', group: '문구·다이어리', fill: 'grey', parts: [
    ['rect', { x: 12, y: 8, width: 40, height: 48, rx: 1, 'stroke-dasharray': '1.6 3.2' }, 'main'],
    ['rect', { x: 17, y: 13, width: 30, height: 28 }, 'sub'],
    ['path', { d: 'M17 37 26 27 32 33 37 28 47 38' }, 'line'],
    ['circle', { cx: 40, cy: 20, r: 3 }, 'shade'],
    ['path', { d: 'M18 48H34M18 52H28' }, 'line'],
  ] },
  seal: { name: '도장', group: '문구·다이어리', fill: 'grey', parts: [
    ['ellipse', { cx: 32, cy: 54, rx: 15, ry: 5 }, 'shade'],
    ['circle', { cx: 32, cy: 10, r: 6 }, 'main'],
    ['path', { d: 'M28 15H36L38 30H26Z' }, 'main'],
    ['rect', { x: 18, y: 30, width: 28, height: 10, rx: 2 }, 'sub'],
  ] },
  book: { name: '펼친 책', group: '문구·다이어리', fill: 'grey', parts: [
    ['path', { d: 'M32 16C24 11 14 11 6 14V52C14 49 24 49 32 54Z' }, 'main'],
    ['path', { d: 'M32 16C40 11 50 11 58 14V52C50 49 40 49 32 54Z' }, 'sub'],
    ['path', { d: 'M37 23C42 21 47 21 52 22M37 30C42 28 47 28 52 29M37 37C42 35 47 35 52 36M37 44C40 43 43 43 46 43.5' }, 'line'],
  ] },
  bookmark: { name: '책갈피', group: '문구·다이어리', fill: 'dots', parts: [
    ['path', { d: 'M32 11C29 5 25 3 21 3' }, 'line'],
    ['path', { d: 'M20 6H44V58L32 48 20 58Z' }, 'main'],
    ['circle', { cx: 32, cy: 14, r: 3 }, 'sub'],
  ] },

  // 일상 · 감성
  cup: { name: '커피잔', group: '일상·감성', fill: 'stripe', parts: [
    ['path', { d: 'M46 29a8 8 0 0 1 0 14', 'stroke-width': 3 }, 'line'],
    ['path', { d: 'M13 25H47V39A13 13 0 0 1 34 52H26A13 13 0 0 1 13 39Z' }, 'main'],
    ['ellipse', { cx: 30, cy: 56, rx: 23, ry: 4 }, 'sub'],
    ['path', { d: 'M24 19c-4-4 4-6 0-11M33 19c-4-4 4-6 0-11' }, 'line'],
  ] },
  pot: { name: '화분', group: '일상·감성', fill: 'stripe', parts: [
    ['path', { d: 'M32 34C31 25 28 18 21 12 19 21 23 29 32 34Z' }, 'shade'],
    ['path', { d: 'M32 34C33 23 38 16 47 13 47 24 41 31 32 34Z' }, 'sub'],
    ['path', { d: 'M18 38H46L42 58H22Z' }, 'main'],
    ['rect', { x: 15, y: 33, width: 34, height: 7, rx: 2 }, 'sub'],
  ] },
  flower: { name: '꽃', group: '일상·감성', fill: 'white', parts: [
    ['path', { d: 'M32 34V60' }, 'line'],
    ['path', { d: 'M32 50C38 44 46 44 50 46 46 52 38 53 32 50Z' }, 'shade'],
    ['circle', { cx: 32, cy: 14, r: 7 }, 'main'],
    ['circle', { cx: 39.6, cy: 19.5, r: 7 }, 'main'],
    ['circle', { cx: 36.7, cy: 28.5, r: 7 }, 'main'],
    ['circle', { cx: 27.3, cy: 28.5, r: 7 }, 'main'],
    ['circle', { cx: 24.4, cy: 19.5, r: 7 }, 'main'],
    ['circle', { cx: 32, cy: 22, r: 4.5 }, 'shade'],
  ] },
  leaf: { name: '새싹', group: '일상·감성', fill: 'white', parts: [
    ['path', { d: 'M32 60C32 44 33 30 38 12' }, 'line'],
    ['path', { d: 'M33 38C20 38 12 30 11 22 22 21 31 27 33 38Z' }, 'main'],
    ['path', { d: 'M35 28C44 29 52 22 53 12 43 12 36 19 35 28Z' }, 'shade'],
    ['path', { d: 'M32 50C24 51 18 46 16 40 24 39 30 43 32 50Z' }, 'main'],
  ] },
  moon: { name: '달', group: '일상·감성', fill: 'dots', parts: [
    ['path', { d: 'M38 8A24 24 0 1 0 56 46 19 19 0 1 1 38 8Z' }, 'main'],
    ['path', { d: 'M50 12l1.6 3.8 4 .4-3 2.6.9 4-3.5-2.1-3.5 2.1.9-4-3-2.6 4-.4Z', 'stroke-width': 1.4 }, 'sub'],
  ] },
  sun: { name: '해', group: '일상·감성', fill: 'white', parts: [
    ['path', { d: 'M32 5V13M32 51V59M5 32H13M51 32H59M13 13l5.5 5.5M45.5 45.5 51 51M13 51l5.5-5.5M45.5 18.5 51 13' }, 'line'],
    ['circle', { cx: 32, cy: 32, r: 13 }, 'main'],
    ['circle', { cx: 32, cy: 32, r: 8 }, 'shade'],
  ] },
  rain: { name: '비구름', group: '일상·감성', fill: 'grey', parts: [
    ['path', { d: 'M14 36A8 8 0 0 1 16 20 12 12 0 0 1 38 14 10 10 0 0 1 50 23 7 7 0 0 1 50 36Z' }, 'main'],
    ['path', { d: 'M20 42l-3 7M31 42l-3 7M42 42l-3 7M25 52l-2 5M36 52l-2 5' }, 'line'],
  ] },
  umbrella: { name: '우산', group: '일상·감성', fill: 'stripe', parts: [
    ['path', { d: 'M32 8V4' }, 'line'],
    ['path', { d: 'M32 32V52a5 5 0 0 1-10 0', 'stroke-width': 2.6 }, 'line'],
    ['path', { d: 'M6 32C6 18 18 8 32 8S58 18 58 32C54 28 49 28 45 32 41 28 36 28 32 32 28 28 23 28 19 32 15 28 10 28 6 32Z' }, 'main'],
    ['path', { d: 'M32 8C24 14 20 22 19 32M32 8C40 14 44 22 45 32M32 8V32' }, 'line'],
  ] },
  plane: { name: '종이비행기', group: '일상·감성', fill: 'white', parts: [
    ['path', { d: 'M6 30 58 10 38 54 30 36Z' }, 'main'],
    ['path', { d: 'M30 36 28 48 34 42Z' }, 'shade'],
    ['path', { d: 'M30 36 58 10' }, 'line'],
  ] },
  house: { name: '집', group: '일상·감성', fill: 'stripe', parts: [
    ['rect', { x: 41, y: 12, width: 6, height: 12 }, 'sub'],
    ['path', { d: 'M14 28H50V56H14Z' }, 'sub'],
    ['path', { d: 'M8 30 32 8 56 30Z' }, 'main'],
    ['rect', { x: 20, y: 40, width: 10, height: 16, rx: 1 }, 'shade'],
    ['rect', { x: 37, y: 36, width: 9, height: 9 }, 'sub'],
    ['path', { d: 'M41.5 36V45M37 40.5H46' }, 'line'],
  ] },
  suitcase: { name: '캐리어', group: '일상·감성', fill: 'grid', parts: [
    ['path', { d: 'M25 18V12a3 3 0 0 1 3-3H36a3 3 0 0 1 3 3V18', 'stroke-width': 2.6 }, 'line'],
    ['rect', { x: 12, y: 18, width: 40, height: 36, rx: 5 }, 'main'],
    ['rect', { x: 20, y: 18, width: 5, height: 36 }, 'sub'],
    ['rect', { x: 39, y: 18, width: 5, height: 36 }, 'sub'],
    ['circle', { cx: 20, cy: 57.5, r: 2.5 }, 'ink'],
    ['circle', { cx: 44, cy: 57.5, r: 2.5 }, 'ink'],
  ] },
  mountain: { name: '산', group: '일상·감성', fill: 'stripe', parts: [
    ['circle', { cx: 48, cy: 15, r: 6 }, 'line'],
    ['path', { d: 'M26 54 42 26 58 54Z' }, 'shade'],
    ['path', { d: 'M4 54 24 18 44 54Z' }, 'main'],
    ['path', { d: 'M18 29 24 18 30 29 27 27 24 30 21 27Z' }, 'sub'],
    ['path', { d: 'M2 54H62' }, 'line'],
  ] },
  heart: { name: '하트', group: '일상·감성', fill: 'dots', parts: [
    ['path', { d: 'M32 54C18 44 8 36 8 24A11 11 0 0 1 32 18 11 11 0 0 1 56 24C56 36 46 44 32 54Z' }, 'main'],
  ] },
  cat: { name: '고양이', group: '일상·감성', fill: 'grey', parts: [
    ['path', { d: 'M44 54C56 54 58 44 52 40', 'stroke-width': 3 }, 'line'],
    ['path', { d: 'M18 56C16 44 20 34 32 34S48 44 46 56Z' }, 'main'],
    ['path', { d: 'M20 30V12L27 19H37L44 12V30A12 11 0 0 1 20 30Z' }, 'main'],
    ['circle', { cx: 27, cy: 26, r: 1.6 }, 'ink'],
    ['circle', { cx: 37, cy: 26, r: 1.6 }, 'ink'],
    ['path', { d: 'M30.5 30.5 32 32 33.5 30.5' }, 'line'],
  ] },
}

const LABELS = {
  round: { name: '원형 라벨', box: [56, 56], parts: [['circle', { cx: 28, cy: 28, r: 24 }, 'main']] },
  tag: { name: '꼬리표', box: [96, 56], parts: [
    ['path', { d: 'M16 6H86a6 6 0 0 1 6 6V44a6 6 0 0 1-6 6H16L4 28Z' }, 'main'],
    ['circle', { cx: 17, cy: 28, r: 3.5 }, 'sub'],
  ] },
  ticket: { name: '티켓', box: [96, 56], parts: [
    ['path', { d: 'M6 6H90V20a8 8 0 0 0 0 16V50H6V36a8 8 0 0 0 0-16Z' }, 'main'],
    ['path', { d: 'M70 10V46', 'stroke-dasharray': '3 3.5' }, 'line'],
  ] },
  bubble: { name: '말풍선', box: [96, 60], parts: [
    ['path', { d: 'M10 6H86a6 6 0 0 1 6 6V36a6 6 0 0 1-6 6H36L22 54 25 42H10a6 6 0 0 1-6-6V12a6 6 0 0 1 6-6Z' }, 'main'],
  ] },
  banner: { name: '리본 배너', box: [96, 50], parts: [
    ['path', { d: 'M4 18H24V44H4L11 31Z' }, 'shade'],
    ['path', { d: 'M92 18H72V44H92L85 31Z' }, 'shade'],
    ['path', { d: 'M16 8H80V36H16Z' }, 'main'],
  ] },
}
for (const l of Object.values(LABELS)) l.fill = 'white'

/* ── 그림·라벨 한 장 ── */
const VERSIONS = {
  cut: { name: '외곽선', halo: true, paint: true },
  plain: { name: '외곽선 없음', halo: false, paint: true },
  line: { name: '선만', halo: false, paint: false },
}

function faceColor(role, fill) {
  if (role === 'sub') return C.white
  if (role === 'shade') return C.grey
  if (role === 'main') return fill === 'grey' ? C.grey : C.white
  return null
}

function stickerLayers(item, version, uid) {
  const v = VERSIONS[version]
  const [w, h] = item.box ?? [64, 64]
  let defs = ''
  let body = ''

  // 외곽선: 그림 둘레로 흰 띠, 그 바깥에 아주 옅은 테두리 한 줄 (흰 바탕 위에서도 가장자리가 보이게)
  if (v.halo) {
    const band = (color, width) =>
      item.parts.map(([tag, a]) => `<${tag} ${attrs({ ...geo(a), fill: color, stroke: color, 'stroke-width': width, ...round })}/>`).join('')
    body += `<g id="외곽선">${band(C.edge, HALO * 2 + 1.6)}${band(C.white, HALO * 2)}</g>`
  }

  if (v.paint) {
    const faces = item.parts
      .filter(([, , role]) => ['main', 'sub', 'shade'].includes(role))
      .map(([tag, a, role]) => `<${tag} ${attrs({ ...geo(a), fill: faceColor(role, item.fill), stroke: 'none' })}/>`)
      .join('')
    if (faces) body += `<g id="칠">${faces}</g>`

    const mains = item.parts.filter(([, , role]) => role === 'main')
    if (['dots', 'stripe', 'grid'].includes(item.fill) && mains.length) {
      const clip = `${uid}-clip`
      defs += `<clipPath id="${clip}">${mains.map(([tag, a]) => `<${tag} ${attrs(geo(a))}/>`).join('')}</clipPath>`
      const color = item.fill === 'grid' ? C.rule : C.ink
      body += `<g id="무늬" clip-path="url(#${clip})">${texture(item.fill, w, h, color)}</g>`
    }
  }

  const lines = item.parts
    .map(([tag, a, role]) => `<${tag} ${attrs({ 'stroke-width': LINE, ...a, fill: role === 'ink' ? C.ink : 'none', stroke: C.ink, ...round })}/>`)
    .join('')
  body += `<g id="먹선">${lines}</g>`
  return { defs, body, w, h, pad: v.halo ? PAD : 2 }
}

/* ── 포스트잇 (감성 컬러) ── */
const POSTITS = {
  fold: { name: '포스트잇', box: [64, 64] },
  lined: { name: '줄 포스트잇', box: [64, 64] },
  grid: { name: '모눈 포스트잇', box: [64, 64] },
  torn: { name: '찢은 메모지', box: [64, 64] },
  flag: { name: '인덱스 탭', box: [60, 20] },
}
function postitLayers(shape, colorKey, uid) {
  const col = SOFT[colorKey]
  const { box } = POSTITS[shape]
  const [w, h] = box
  let defs = ''
  let body = ''
  if (shape === 'flag') {
    body += `<g id="그림자"><rect x="3" y="4.5" width="55" height="14" rx="1" fill="${C.ink}" fill-opacity=".1"/></g>`
    body += `<g id="종이"><rect x="2" y="3" width="38" height="14" rx="1" fill="${col.base}"/><rect x="40" y="3" width="18" height="14" rx="1" fill="${col.base}" fill-opacity=".55"/></g>`
    return { defs, body, w, h, pad: 2 }
  }
  const paper =
    shape === 'torn'
      ? 'M6 10L9 6 12 9 15 5 18 9 21 6 24 9 27 5 30 9 33 6 36 9 39 5 42 9 45 6 48 9 51 5 54 9 58 6V58H6Z'
      : shape === 'fold'
        ? 'M6 6H58V46L46 58H6Z'
        : 'M6 6H58V58H6Z'
  const shadow = shape === 'fold' ? 'M8 9H60V49L49 61H8Z' : 'M8 9H60V61H8Z'
  body += `<g id="그림자"><path d="${shadow}" fill="${C.ink}" fill-opacity=".1"/></g>`
  body += `<g id="종이"><path d="${paper}" fill="${col.base}"/></g>`
  if (shape === 'lined' || shape === 'grid') {
    const clip = `${uid}-clip`
    defs += `<clipPath id="${clip}"><path d="${paper}"/></clipPath>`
    body += `<g id="무늬" clip-path="url(#${clip})">${texture(shape === 'lined' ? 'lined' : 'grid', w, h, col.deep)}</g>`
  }
  if (shape === 'fold') body += `<g id="접힌 모서리"><path d="M58 46H50a4 4 0 0 0-4 4V58Z" fill="${col.deep}"/></g>`
  return { defs, body, w, h, pad: 2 }
}

/* ── 마스킹테이프 (감성 컬러) ── */
const TAPE_PATH = 'M4 2H136L132 6 136 10 132 14 136 18 132 22 136 26 132 28H4L8 24 4 20 8 16 4 12 8 8Z'
const TAPES = {
  'rose-dots': { name: '분홍 도트', color: 'rose', tex: 'dots', on: C.white },
  'sage-stripe': { name: '세이지 사선', color: 'sage', tex: 'stripe', on: C.white },
  'butter-plain': { name: '버터 민무늬', color: 'butter', tex: null },
  'sky-gingham': { name: '하늘 깅엄체크', color: 'sky', tex: 'gingham', on: C.white },
  'lav-flowers': { name: '라벤더 잔꽃', color: 'lav', tex: 'flowers', on: C.white },
  'rose-gingham': { name: '분홍 깅엄체크', color: 'rose', tex: 'gingham', on: C.white },
  'sage-grid': { name: '세이지 격자', color: 'sage', tex: 'grid', on: 'deep' },
  'butter-dots': { name: '버터 도트', color: 'butter', tex: 'dots', on: 'deep' },
  'sky-wave': { name: '하늘 물결', color: 'sky', tex: 'wave', on: C.white },
  'lav-stripe': { name: '라벤더 줄무늬', color: 'lav', tex: 'hstripe', on: C.white },
}
function tapeLayers(key, uid) {
  const t = TAPES[key]
  const col = SOFT[t.color]
  let defs = ''
  let body = `<g id="테이프"><path d="${TAPE_PATH}" fill="${col.base}" fill-opacity=".85"/></g>`
  if (t.tex) {
    const clip = `${uid}-clip`
    defs += `<clipPath id="${clip}"><path d="${TAPE_PATH}"/></clipPath>`
    const color = t.on === 'deep' ? col.deep : t.on
    body += `<g id="무늬" clip-path="url(#${clip})" opacity=".85">${texture(t.tex, 140, 30, color)}</g>`
  }
  return { defs, body, w: 140, h: 30, pad: 0 }
}

/* ── 파일로 ── */
const svgFile = ({ defs, body, w, h, pad }, name) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}" width="${w + pad * 2}" height="${h + pad * 2}">${defs ? `<defs>${defs}</defs>` : ''}<g id="${name}">${body}</g></svg>\n`

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const index = []
const sheet = { defs: [], items: [], labels: [] }
let y = 40
const LEFT = 150
const heading = (text) => {
  sheet.labels.push(`<text x="0" y="${y}" font-family="Gowun Batang, serif" font-size="22" font-weight="700" fill="${C.ink}">${text}</text>`)
  y += 22
}
const place = (layers, name, x, yy) => {
  if (layers.defs) sheet.defs.push(layers.defs)
  sheet.items.push(`<g id="${name}" transform="translate(${x + layers.pad} ${yy + layers.pad})">${layers.body}</g>`)
}
const emit = (file, layers, name, meta) => {
  writeFileSync(resolve(OUT, file), svgFile(layers, name))
  index.push({ file, name: meta.name, ...meta })
}

/* 그림: 한 줄에 여섯 가지 그림 × 세 가지 버전 */
heading('그림')
const motifKeys = Object.keys(MOTIFS)
for (let i = 0; i < motifKeys.length; i += 6) {
  const row = motifKeys.slice(i, i + 6)
  row.forEach((key, c) => {
    const item = MOTIFS[key]
    Object.keys(VERSIONS).forEach((ver, k) => {
      const uid = `${key}-${ver}`
      const layers = stickerLayers(item, ver, uid)
      const name = `스티커/그림/${item.group}/${item.name}/${VERSIONS[ver].name}`
      emit(`${uid}.svg`, layers, name, { kind: '그림', key, name: item.name, group: item.group, version: ver, versionName: VERSIONS[ver].name })
      place(layers, name, c * 260 + k * 84, y + (ver === 'cut' ? 0 : PAD - 2))
    })
    sheet.labels.push(`<text x="${c * 260}" y="${y + 104}" font-family="Gowun Batang, serif" font-size="13" fill="${C.ink}">${item.name}</text>`)
  })
  y += 130
}

y += 20
heading('라벨')
Object.entries(LABELS).forEach(([key, item], c) => {
  Object.keys(VERSIONS).forEach((ver, k) => {
    const uid = `label-${key}-${ver}`
    const layers = stickerLayers(item, ver, uid)
    const name = `스티커/라벨/${item.name}/${VERSIONS[ver].name}`
    emit(`${uid}.svg`, layers, name, { kind: '라벨', key, name: item.name, version: ver, versionName: VERSIONS[ver].name })
    place(layers, name, (c % 3) * 360 + k * 116, y + Math.floor(c / 3) * 110 + (ver === 'cut' ? 0 : PAD - 2))
  })
  sheet.labels.push(`<text x="${(c % 3) * 360}" y="${y + Math.floor(c / 3) * 110 + 92}" font-family="Gowun Batang, serif" font-size="13" fill="${C.ink}">${item.name}</text>`)
})
y += 2 * 110 + 30

heading('포스트잇')
Object.entries(POSTITS).forEach(([shape, p], r) => {
  sheet.labels.push(`<text x="0" y="${y + (p.box[1] + 4) / 2 + 5}" font-family="Gowun Batang, serif" font-size="13" fill="${C.ink}">${p.name}</text>`)
  Object.entries(SOFT).forEach(([colorKey, col], c) => {
    const uid = `postit-${shape}-${colorKey}`
    const layers = postitLayers(shape, colorKey, uid)
    const name = `스티커/포스트잇/${p.name}/${col.name}`
    emit(`${uid}.svg`, layers, name, { kind: '포스트잇', key: shape, name: p.name, color: colorKey, colorName: col.name })
    place(layers, name, LEFT + c * 96, y)
  })
  y += p.box[1] + 26
})

y += 10
heading('마스킹테이프')
Object.entries(TAPES).forEach(([key, t], i) => {
  const uid = `tape-${key}`
  const layers = tapeLayers(key, uid)
  const name = `스티커/마스킹테이프/${t.name}`
  emit(`${uid}.svg`, layers, name, { kind: '테이프', key, name: t.name, color: t.color, colorName: SOFT[t.color].name })
  place(layers, name, (i % 5) * 170, y + Math.floor(i / 5) * 48)
})
y += 2 * 48 + 30

const W = 1560
writeFileSync(
  resolve(OUT, 'figma-sheet.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${y}" width="${W}" height="${y}">
<defs>${sheet.defs.join('')}</defs>
<g id="이름표">${sheet.labels.join('')}</g>
<g id="스티커">${sheet.items.join('\n')}</g>
</svg>
`,
)
writeFileSync(resolve(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n')
console.log(`스티커 ${index.length}장 + 피그마용 시트 → src/assets/stickers/`)
