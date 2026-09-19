#!/usr/bin/env node
/**
 * 스모크 — 13화면 흐름을 실제로 클릭해 끝까지 완주한다.
 *
 *   npm run build && npm run smoke
 *
 * 화면마다 390×844 스크린샷을 docs/screenshots/에 남겨 프로토타입과 나란히 볼 수 있게 한다.
 */
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const shots = join(root, 'docs/screenshots')
const PORT = 4178

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon',
}

/** dist를 SPA로 서빙한다 (firebase.json의 rewrite와 같은 규칙). */
function serve() {
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
    let file = join(dist, url.pathname)
    if (!existsSync(file) || url.pathname.endsWith('/')) file = join(dist, 'index.html')
    try {
      const body = await readFile(file)
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' })
      res.end(body)
    } catch {
      res.writeHead(404).end('not found')
    }
  }).listen(PORT)
}

let step = 0
const failures = []

async function shot(page, name) {
  step++
  await page.waitForTimeout(950) // 진입 모션이 끝난 뒤 (§4: 900ms 안에 멈춘다)
  await page.screenshot({ path: join(shots, `${String(step).padStart(2, '0')}-${name}.png`) })
}

/**
 * page.isVisible()은 기다려주지 않아서 렌더 직후에 찍으면 헛읽는다.
 * 화면이 막 바뀐 직후에는 이걸 쓴다.
 */
async function visible(page, selector, timeout = 4000) {
  try {
    await page.locator(selector).first().waitFor({ state: 'visible', timeout })
    return true
  } catch {
    return false
  }
}

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`)
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
    failures.push(label)
  }
}

/**
 * 이 환경에는 Chromium이 미리 깔려 있다. Playwright가 기대하는 빌드 번호와 다를 수 있으므로
 * 새로 내려받지 않고 있는 실행파일을 직접 가리킨다.
 */
function chromiumPath() {
  for (const candidate of [
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome',
  ]) {
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

const server = serve()
const executablePath = chromiumPath()
const browser = await chromium.launch(executablePath ? { executablePath } : {})
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: 'ko-KR',
})
const page = await context.newPage()

const consoleErrors = []
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})
page.on('pageerror', (e) => consoleErrors.push(String(e)))

await rm(shots, { recursive: true, force: true })
await mkdir(shots, { recursive: true })

try {
  const base = `http://localhost:${PORT}`

  console.log('\n홈')
  await page.goto(base)
  await page.waitForSelector('text=오늘은 어떤 걸')
  check('빈 상태를 보여준다', await visible(page, 'text=아직 펼친 고민이 없어요'))
  check('기기에만 저장됨 배지', await page.isVisible('text=기기에만 저장됨'))
  await shot(page, 'main-empty')

  console.log('\n1 · 고민 한 문장')
  await page.click('text=새 고민 펼치기')
  await page.waitForURL(/\/frame$/)
  check('빈 문장이면 다음으로 못 간다', await page.isDisabled('button:has-text("후보 적기")'))
  await page.fill('#question', '가을에 이사할까, 지금 집에 더 살까')
  check('적으면 다음이 열린다', await page.isEnabled('button:has-text("후보 적기")'))
  await shot(page, 'frame')

  console.log('\n2 · 후보 적기')
  await page.click('button:has-text("후보 적기")')
  await page.waitForURL(/\/alternatives$/)
  await page.fill('input[aria-label="후보 1"]', '지금 집 재계약')
  await page.fill('input[aria-label="후보 2"]', '신도시 24평으로 이사')
  await page.click('button:has-text("후보 하나 더")')
  await page.fill('input[aria-label="후보 3"]', '회사 앞 오피스텔')
  check('숨은 대안을 한 번 묻는다', await page.isVisible('text=한 번만 묻습니다'))
  await shot(page, 'alternatives')
  await page.click('button:has-text("아니요")')
  check('아니요를 누르면 다시 묻지 않는다', !(await page.isVisible('text=한 번만 묻습니다')))

  console.log('\n3 · 직감 봉인')
  await page.click('button:has-text("다음")')
  await page.waitForURL(/\/gut$/)
  check('직감 없이는 넘어가지 못한다', await page.isDisabled('button:has-text("접어두고")'))
  await page.click('button[role="radio"]:has-text("지금 집 재계약")')
  await page.click('button[aria-label="확신 3"]')
  await shot(page, 'gut')

  console.log('\n4 · 기준 세 개')
  await page.click('button:has-text("접어두고")')
  await page.waitForURL(/\/criteria$/)
  await page.fill('input[aria-label="기준 1"]', '월 주거비')
  await page.fill('input[aria-label="기준 2"]', '방 개수')
  await page.fill('input[aria-label="기준 3"]', '출퇴근 시간')
  await page.click('button:has-text("+ 직접 적기")')
  await page.fill('input[aria-label="기준 4"]', '통근 시간')
  await page.waitForTimeout(350)
  check('겹치는 기준을 잡아낸다', await page.isVisible('text=겹쳐 보여요'))
  await shot(page, 'criteria-duplicate')
  await page.click('button:has-text("묶기")')
  await page.waitForTimeout(350)
  check('묶으면 기준이 셋으로 돌아온다', (await page.locator('.row input').count()) === 3)
  await shot(page, 'criteria')

  console.log('\n5 · 필수조건')
  await page.click('button:has-text("다음")')
  await page.waitForURL(/\/must$/)
  await page.click('button:has-text("조건 하나 더")')
  await page.fill('input[aria-label="필수조건 1"]', '보증금 3억 이하')
  await page.waitForTimeout(350)
  await page.click('button[aria-pressed="true"]:has-text("회사 앞 오피스텔")')
  await page.waitForTimeout(500)
  check('탈락 후보에 조건 이름이 붙는다', await page.isVisible('.chip:has-text("보증금 3억 이하")'))
  check('남은 두 개를 비교하자고 한다', await page.isVisible('button:has-text("남은 2개 비교하기")'))
  await shot(page, 'must')

  console.log('\n6 · 중요한 순서')
  await page.click('button:has-text("남은 2개")')
  await page.waitForURL(/\/weight$/)
  await page.click('button[aria-label="방 개수 위로"]')
  await page.waitForTimeout(300)
  const order = await page.locator('.row__text').allInnerTexts()
  check('키보드 경로로 순서가 바뀐다', order[0] === '방 개수', `실제: ${order.join(' > ')}`)
  await page.click('button:has-text("숫자로 보기")')
  await page.waitForTimeout(200)
  check('ROC 비중이 61/28/11로 나온다', await page.isVisible('text=61%'))
  await shot(page, 'weight')

  console.log('\n7 · 평가')
  await page.click('button:has-text("평가하러 가기")')
  await page.waitForURL(/\/evaluate$/)
  check('탈락 후보는 평가하지 않는다 (2후보 × 3기준 = 6칸)', await visible(page, 'text=평가 1 / 6'))
  await shot(page, 'evaluate')

  // ①은 방 개수에 약하고 주거비에 강하다. ②는 그 반대.
  const answers = [
    [2, '사실'], [5, '사실'], [4, '추정'],
    [5, '사실'], [3, '사실'], [3, '느낌'],
  ]
  for (let i = 0; i < answers.length; i++) {
    const [score, evidence] = answers[i]
    await page.click(`.score5__cell >> nth=${score - 1}`)
    await page.click(`button[aria-pressed]:has-text("${evidence}")`)
    await page.click(i === answers.length - 1 ? 'button:has-text("결과 보기")' : 'button:has-text("다음 평가")')
    await page.waitForTimeout(200)
  }

  console.log('\n결과')
  await page.waitForURL(/\/result$/)
  check('결론 한 문장이 있다', await visible(page, 'text=지금 적은 기준에서는'))
  check('차이를 만든 기준을 보여준다', await visible(page, 'text=차이를 만든 건'))
  check('적합도를 말로 쓴다', await page.isVisible('text=적합도'))
  const body = await page.innerText('body')
  check('총점 숫자를 노출하지 않는다', !/\b0\.\d{2,}\b/.test(body), body.match(/0\.\d{2,}/)?.[0])
  check('직감 충돌을 짚는다', await page.isVisible('text=처음 마음은'))
  await shot(page, 'result')

  console.log('\n왜 이런 결과인지')
  await page.click('text=왜 이렇죠?')
  await page.waitForURL(/\/why$/)
  check('기준별 비교를 보여준다', await visible(page, 'text=기준마다 어디서'))
  check('뒤집히는 지점을 말한다', await visible(page, 'text=결과가 뒤집히는 지점'))
  check('남은 불확실성을 표시한다', await visible(page, 'text=아직 남아 있는 불확실성'))
  await shot(page, 'why')

  console.log('\n결정 확정')
  await page.click('text=그래도 지금 정하기')
  await page.waitForURL(/\/commit$/)
  await page.fill('#reason', '방이 하나 더 필요하다는 게 제일 컸다')
  await page.click('button[aria-label="확신 4"]')
  check('도장이 찍힌다', await visible(page, '.stamp__word'))
  check('도장 글자가 손글씨다', (await page.locator('.stamp__word').innerText()) === '결정함')
  check('30일 뒤 회고를 예약한다', await page.isVisible('text=30일 뒤에 다시 물어보기'))
  await shot(page, 'commit')

  console.log('\n홈으로 — 저장 확인')
  await page.click('button:has-text("노트 닫기")')
  await page.waitForURL(`${base}/`)
  await page.waitForTimeout(400)
  check('목록에 남는다', await page.isVisible('text=가을에 이사할까'))
  check('회고 D-day를 센다', await page.isVisible('text=회고 D-30'))
  await shot(page, 'main-with-decision')

  console.log('\n새로고침 뒤에도 남아 있나')
  await page.reload()
  await page.waitForTimeout(600)
  check('IndexedDB에서 복원된다', await page.isVisible('text=가을에 이사할까'))

  console.log('\n30일 뒤 회고')
  const id = await page.evaluate(async () => {
    const open = indexedDB.open('decision-note')
    const db = await new Promise((res) => {
      open.onsuccess = () => res(open.result)
    })
    const all = await new Promise((res) => {
      const req = db.transaction('decisions').objectStore('decisions').getAll()
      req.onsuccess = () => res(req.result)
    })
    return all[0].id
  })
  await page.goto(`${base}/d/${id}/review`)
  await page.waitForURL(/\/review$/)
  check('그때 적은 이유를 다시 보여준다', await visible(page, 'text=방이 하나 더 필요하다'))
  check('만족도 전에는 기록할 수 없다', await page.isDisabled('button:has-text("기록 남기기")'))
  await page.click('button[aria-label="만족도 4"]')
  await page.selectOption('#now-top', { index: 2 })
  check('패턴을 지어내지 않는다 (표본 1건)', !(await page.isVisible('text=지금까지 모인 패턴')))
  await shot(page, 'review')
  await page.click('button:has-text("기록 남기기")')
  await page.waitForURL(`${base}/`)

  console.log('\n보관함')
  await page.goto(`${base}/settings`)
  check('기기 저장을 설명한다', await visible(page, 'text=이 기기 안에만 저장됩니다'))
  check('설정이 없으면 동기화가 잠긴다', await page.isDisabled('button[aria-label="다른 기기와 동기화"]'))
  await shot(page, 'settings')

  console.log('\n모션을 끈 상태')
  await context.close()
  const reduced = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: 'ko-KR',
    reducedMotion: 'reduce',
  })
  const rp = await reduced.newPage()
  await rp.goto(base)
  await rp.waitForSelector('text=오늘은 어떤 걸')
  await rp.waitForTimeout(150) // 모션을 껐으면 이 시점에 이미 최종 상태여야 한다
  const opacity = await rp
    .locator('a.card, p.empty')
    .first()
    .evaluate((el) => getComputedStyle(el).opacity)
  check('reduced-motion에서 즉시 최종 상태', opacity === '1', `opacity=${opacity}`)
  await rp.screenshot({ path: join(shots, '99-reduced-motion.png') })
  await reduced.close()

  check('콘솔 오류 없음', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))
} catch (error) {
  console.error('\n흐름이 중간에 끊겼습니다:', error.message)
  await page.screenshot({ path: join(shots, 'FAIL.png') }).catch(() => {})
  failures.push(`흐름 중단: ${error.message}`)
} finally {
  await browser.close()
  server.close()
}

console.log(
  failures.length === 0
    ? `\n전부 통과. 스크린샷 ${step}장 → docs/screenshots/`
    : `\n${failures.length}건 실패:\n${failures.map((f) => `  - ${f}`).join('\n')}`,
)
process.exit(failures.length === 0 ? 0 : 1)
