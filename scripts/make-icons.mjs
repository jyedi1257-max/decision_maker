#!/usr/bin/env node
/**
 * 아이콘 원본(scripts/icon-source.mjs)에서 모든 크기를 굽는다.
 *
 *   npm run icons
 *
 * 손글씨는 앱에 실린 서브셋 폰트(penink.woff2)를 그대로 써서 굽는다 —
 * 아이콘과 앱 안 도장이 같은 손에서 나오게.
 *
 * 굽기 전에 모티프가 안전 영역 안에 있는지 **픽셀로 직접 잰다.** 안드로이드
 * 런처는 기기마다 다른 마스크를 씌우고, 원형 마스크에서 잘리면 되돌릴 방법이 없다.
 */
import { chromium } from 'playwright'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { iconFull, iconForeground, iconAdaptive, splash, PAPER } from './icon-source.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ANDROID = join(root, 'android/app/src/main/res')
const WEB = join(root, 'public/icons')

/** 안드로이드 밀도별 크기. 런처 아이콘은 dp 48, 적응형 앞면은 dp 108. */
const DENSITIES = [
  ['mdpi', 1],
  ['hdpi', 1.5],
  ['xhdpi', 2],
  ['xxhdpi', 3],
  ['xxxhdpi', 4],
]

/**
 * 실행 직후의 스플래시. Capacitor 템플릿이 깔아둔 기본 로고를 덮는다 —
 * 안 덮으면 앱을 열 때마다 Capacitor 로고가 번쩍인다.
 */
const SPLASHES = [
  ['drawable', 480, 320],
  ['drawable-port-mdpi', 320, 480],
  ['drawable-port-hdpi', 480, 800],
  ['drawable-port-xhdpi', 720, 1280],
  ['drawable-port-xxhdpi', 960, 1600],
  ['drawable-port-xxxhdpi', 1280, 1920],
  ['drawable-land-mdpi', 480, 320],
  ['drawable-land-hdpi', 800, 480],
  ['drawable-land-xhdpi', 1280, 720],
  ['drawable-land-xxhdpi', 1600, 960],
  ['drawable-land-xxxhdpi', 1920, 1280],
]

/** 웹 쪽 — 파비콘, 애플 터치 아이콘, PWA. */
const WEB_ICONS = [
  ['favicon-48.png', 48],
  ['favicon-96.png', 96],
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512], // 안전 영역 안에 다 들어가서 마스크형으로도 쓸 수 있다
]

function chromiumPath() {
  for (const p of [
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome',
  ]) {
    if (existsSync(p)) return p
  }
  return undefined
}

const fontB64 = (await readFile(join(root, 'src/assets/fonts/penink.woff2'))).toString('base64')
const executablePath = chromiumPath()
const browser = await chromium.launch(executablePath ? { executablePath } : {})
const page = await browser.newPage()

// 글자를 그리려면 손글씨가 올라와 있어야 한다. 안 기다리면 폴백 서체로 구워진다.
await page.setContent(`<!doctype html><meta charset="utf-8"><style>
  @font-face{font-family:'PenInk';src:url(data:font/woff2;base64,${fontB64}) format('woff2');font-display:block}
  html,body{margin:0;background:transparent}
  #stage{line-height:0}
  /* 최상위 svg만 늘린다. 스플래시는 도장을 중첩 svg로 얹는데,
     자손까지 100%로 늘리면 그 중첩 svg가 x/y만 남고 전체 크기가 돼 화면 밖으로 밀린다. */
  #stage > svg{display:block;width:100%;height:100%}
</style><div id="stage"></div>`)
await page.evaluate(() => document.fonts.load('29px PenInk', '결정'))
await page.evaluate(() => document.fonts.ready)

/** 모티프가 안전 영역(중심에서 반지름 36) 안에 있는지 픽셀로 잰다. */
async function safeZoneRadius(svg) {
  return page.evaluate(async (svg) => {
    const S = 432
    const img = new Image()
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    await img.decode()
    const c = document.createElement('canvas')
    c.width = c.height = S
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0, S, S)
    const d = ctx.getImageData(0, 0, S, S).data
    let far = 0
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (d[(y * S + x) * 4 + 3] < 24) continue // 거의 투명한 건 안 센다
        const r = Math.hypot(x + 0.5 - S / 2, y + 0.5 - S / 2)
        if (r > far) far = r
      }
    }
    return (far / S) * 108
  }, svg)
}

async function bake(svg, width, out, { transparent = false, height = width } = {}) {
  await page.setViewportSize({ width, height })
  await page.evaluate(
    ([svg, width, height]) => {
      const stage = document.getElementById('stage')
      stage.style.width = width + 'px'
      stage.style.height = height + 'px'
      stage.innerHTML = svg
    },
    [svg, width, height],
  )
  await mkdir(dirname(out), { recursive: true })
  await page.screenshot({ path: out, omitBackground: transparent })
}

// ── 안전 영역 먼저 ────────────────────────────────────────────
const far = await safeZoneRadius(iconForeground())
const LIMIT = 36
console.log(`안전 영역: 중심에서 제일 먼 점 ${far.toFixed(1)} / ${LIMIT}`)
if (far > LIMIT) {
  await browser.close()
  throw new Error(
    `모티프가 안전 영역을 ${(far - LIMIT).toFixed(1)}만큼 넘습니다. ` +
      '원형 마스크를 씌우는 런처에서 잘립니다 — icon-source.mjs에서 줄여주세요.',
  )
}

// ── 안드로이드 ────────────────────────────────────────────────
let count = 0
for (const [density, scale] of DENSITIES) {
  const dir = join(ANDROID, `mipmap-${density}`)
  const launcher = Math.round(48 * scale)
  const adaptive = Math.round(108 * scale)
  await bake(iconFull(), launcher, join(dir, 'ic_launcher.png'))
  await bake(iconFull(), launcher, join(dir, 'ic_launcher_round.png'))
  await bake(iconForeground(), adaptive, join(dir, 'ic_launcher_foreground.png'), { transparent: true })
  count += 3
  console.log(`  ${density.padEnd(8)} 런처 ${launcher} · 앞면 ${adaptive}`)
}

// 적응형 배경은 색 하나다. 기본값이 흰색이라 종이색으로 바꾼다.
await writeFile(
  join(ANDROID, 'values/ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<!-- 적응형 아이콘의 배경. 디자인 시스템 §1의 종이색이다.
     앞면은 mipmap/ic_launcher_foreground. 손으로 고치지 말고 npm run icons를 돌린다.
     (XML 주석 안에는 하이픈 두 개를 쓸 수 없어서 토큰 이름을 그대로 적지 않는다.) -->
<resources>
    <color name="ic_launcher_background">${PAPER}</color>
</resources>
`,
)

// ── 웹 ────────────────────────────────────────────────────────
for (const [name, size] of WEB_ICONS) {
  await bake(iconFull(), size, join(WEB, name))
  count++
  console.log(`  web      ${name} ${size}`)
}

for (const [dir, w, h] of SPLASHES) {
  await bake(splash(w, h), w, join(ANDROID, dir, 'splash.png'), { height: h })
  count++
}
console.log(`  스플래시  ${SPLASHES.length}장 (세로·가로 5밀도 + 기본)`)

// 눈으로 확인할 때 쓰는 미리보기. 안드로이드에서 실제로 보이는 모양이다.
await bake(iconAdaptive(), 512, join(root, 'docs/screenshots/00-icon.png'))

await browser.close()
console.log(`\n→ ${count}장 + 적응형 배경색 + 미리보기 1장`)
