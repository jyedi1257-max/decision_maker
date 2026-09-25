#!/usr/bin/env node
/**
 * 홍보 영상 1단계 — 실제 앱을 조작하며 화면을 녹화한다.
 *
 *   npm run build && node scripts/promo/capture.mjs
 *
 * 크롬의 스크린캐스트로 프레임을 받아 .promo/capture/에 JPEG로 남기고,
 * 장면 경계(marks)와 누른 자리(taps)를 capture.json에 적는다.
 * 2단계(compose.mjs)가 이걸 폰 틀에 넣고 자막을 얹는다.
 */
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const dist = join(root, 'dist')
const out = join(root, '.promo/capture')
const PORT = 4195

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png',
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  let file = join(dist, url.pathname)
  if (!existsSync(file) || url.pathname.endsWith('/')) file = join(dist, 'index.html')
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' })
  res.end(await readFile(file))
}).listen(PORT)

const executablePath = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync)
// 스크린캐스트는 기기 배율을 무시하고 CSS 픽셀 크기로 보낸다. 배율을 강제해야 2배로 받는다.
const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ['--force-device-scale-factor=2'] })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR' })
const page = await context.newPage()
const base = `http://localhost:${PORT}`

await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })

// 홈이 비어 있으면 허전하다 — 먼저 적어둔 결정 두 개를 깔아둔다.
await page.goto(base)
await page.waitForTimeout(400)
await page.evaluate(async () => {
  const day = 86400000
  const now = Date.now()
  const iso = (t) => new Date(t).toISOString()
  const make = (id, question, t) => ({
    id, question,
    alternatives: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    criteria: [{ id: 'c1', name: '1' }, { id: 'c2', name: '2' }, { id: 'c3', name: '3' }],
    musts: [], scores: {}, gut: { alternativeId: null, confidence: null }, commit: null, review: null,
    stage: 'committed', createdAt: iso(t), updatedAt: iso(t),
    hiddenAlternativeAsked: true, dismissedDuplicateHints: [], weightOverride: null, insight: null,
  })
  const a = { ...make('p1', '이직 제안, 받을까 말까', now - 3 * day),
    commit: { alternativeId: 'a', reason: 'r', confidence: 4, committedAt: iso(now - 3 * day), reviewScheduled: true, reviewDueAt: iso(now + 27 * day) } }
  const b = { ...make('p2', '대학원을 올해 갈까, 2년 뒤에 갈까', now - 40 * day),
    commit: { alternativeId: 'a', reason: 'r', confidence: 3, committedAt: iso(now - 35 * day), reviewScheduled: true, reviewDueAt: iso(now - 5 * day) } }
  const db = await new Promise((res) => { const o = indexedDB.open('decision-note'); o.onsuccess = () => res(o.result) })
  await new Promise((res) => {
    const tx = db.transaction('decisions', 'readwrite')
    for (const d of [b, a]) tx.objectStore('decisions').put(d)
    tx.oncomplete = res
  })
})

// ── 녹화 ─────────────────────────────────────────────
const frames = []
const marks = {}
const taps = []
const now = () => Date.now() / 1000
const mark = (name) => { marks[name] = now() }
const wait = (ms) => page.waitForTimeout(ms)

const cdp = await context.newCDPSession(page)
cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
  frames.push({ t: metadata.timestamp, data })
  cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
})
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 })

/** 누른 자리를 적어두고 누른다 — 영상에서 손끝 자국을 그 자리에 찍는다. */
async function tap(selector) {
  const el = page.locator(selector).first()
  await el.waitFor({ state: 'visible' })
  const box = await el.boundingBox()
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  taps.push({ t: now(), x, y })
  await page.mouse.click(x, y)
}
async function write(selector, text, delay = 70) {
  await tap(selector)
  await page.keyboard.type(text, { delay })
}

await page.reload()
mark('home')
await wait(2400)

await tap('text=새 고민 꺼내놓기')
await page.waitForURL(/\/frame$/)
mark('frame')
await wait(700)
await write('#question', '가을에 이사할까, 지금 집에 더 살까', 75)
await wait(700)
await tap('button:has-text("선택지 적기")')

await page.waitForURL(/\/alternatives$/)
mark('alternatives')
await wait(700)
await write('input[aria-label="선택지 1"]', '지금 집 재계약')
await write('input[aria-label="선택지 2"]', '신도시 24평으로 이사')
await wait(500)
if (await page.isVisible('text=하나만 여쭤볼게요')) {
  await tap('button:has-text("괜찮아요")')
  await wait(400)
}
mark('alternativesEnd')
await tap('button:has-text("다음")')

await page.waitForURL(/\/gut$/)
mark('gut')
await wait(700)
await tap('button[role="radio"]:has-text("지금 집 재계약")')
await wait(300)
await tap('button[aria-label="마음이 기운 정도 3"]')
await wait(600)
mark('gutEnd')
await tap('button:has-text("판단 기준 정하기")')

await page.waitForURL(/\/criteria$/)
mark('criteria')
await wait(700)
await write('input[aria-label="기준 1"]', '방 개수', 80)
await write('input[aria-label="기준 2"]', '월 주거비', 80)
await write('input[aria-label="기준 3"]', '출퇴근 시간', 80)
await wait(600)
mark('criteriaEnd')
await tap('.paper__foot button:has-text("다음")')

await page.waitForURL(/\/must$/)
mark('must')
await wait(600)
await tap('button:has-text("조건 없이 넘어가기")')

await page.waitForURL(/\/evaluate$/)
mark('evaluate')
await wait(800)
const answers = [[2, '사실'], [5, '사실'], [4, '추정'], [5, '사실'], [3, '사실'], [3, '느낌']]
for (let i = 0; i < answers.length; i++) {
  const [score, evidence] = answers[i]
  if (i === 2) mark('evaluateFast')
  await tap(`.score5__cell >> nth=${score - 1}`)
  await wait(320)
  await tap(`button[aria-pressed]:has-text("${evidence}")`)
  await wait(320)
  await tap(i === answers.length - 1 ? 'button:has-text("결과 보기")' : 'button:has-text("다음 평가")')
  await wait(420)
}

await page.waitForURL(/\/matrix$/)
mark('matrix')
await page.locator('.paper__foot button:has-text("결과 보기"):not([disabled])').waitFor({ timeout: 20000 })
await wait(900)
mark('matrixEnd')
await tap('.paper__foot button:has-text("결과 보기")')

await page.waitForURL(/\/result$/)
mark('result')
await wait(3000)
mark('resultEnd')
await tap('text=이걸로 정하기')

await page.waitForURL(/\/commit$/)
mark('commit')
await wait(800)
await write('#reason', '방이 하나 더 필요하다는 게 제일 컸다', 55)
await wait(300)
await tap('button[aria-label="마음이 기운 정도 4"]')
await wait(900)
// 도장이 하단 버튼에 반쯤 가린다 — 끝까지 내려서 다 보이게 한다.
await page.evaluate(() => document.querySelector('.sheet')?.scrollTo({ top: 99999, behavior: 'smooth' }))
await wait(2200)
mark('commitEnd')

await cdp.send('Page.stopScreencast')
await wait(200)

// ── 저장 ─────────────────────────────────────────────
const index = []
for (let i = 0; i < frames.length; i++) {
  const file = `${String(i).padStart(5, '0')}.jpg`
  await writeFile(join(out, file), Buffer.from(frames[i].data, 'base64'))
  index.push({ t: frames[i].t, file })
}
await writeFile(join(out, 'capture.json'), JSON.stringify({ frames: index, marks, taps, viewport: { width: 390, height: 844 } }, null, 1))
console.log(`프레임 ${frames.length}장 · 장면 ${Object.keys(marks).length}개 · 누름 ${taps.length}번 → .promo/capture/`)
console.log(Object.entries(marks).map(([k, v]) => `  ${k.padEnd(16)} ${(v - marks.home).toFixed(2)}s`).join('\n'))

await browser.close()
server.close()
