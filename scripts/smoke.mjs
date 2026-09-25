#!/usr/bin/env node
/**
 * 스모크 — 전체 화면 흐름을 실제로 클릭해 끝까지 완주한다.
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

/** 다음으로 가는 버튼이 스크롤 없이 첫 화면 안에 온전히 보이는가 (하단 버튼 영역, 디자인 §5). */
async function ctaInView(page, label) {
  const box = await page.locator('.paper__foot').last().boundingBox()
  const vh = page.viewportSize().height
  check(`${label} — 주 버튼이 잘리지 않고 첫 화면에 보인다`, Boolean(box) && box.y >= 0 && box.y + box.height <= vh, box ? `y ${Math.round(box.y)}~${Math.round(box.y + box.height)} / ${vh}` : '하단 영역 없음')
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
const outboundRequests = []
page.on('request', (r) => {
  const url = r.url()
  if (!url.startsWith(`http://localhost:${PORT}`) && !url.startsWith('data:')) {
    outboundRequests.push(url.split('?')[0])
  }
})
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
  check('빈 상태를 보여준다', await visible(page, 'text=첫 장은 비어 있어요'))
  check('저장 위치를 먼저 말해준다', await visible(page, 'text=고민은 이 기기에만 저장됩니다'))
  check('빈 홈에는 점선 상자 대신 스티커를 붙인다', await visible(page, '.empty--sticker img[data-sticker="sign"]'))
  check('스티커는 읽어주지 않는다', (await page.locator('img[data-sticker]:not([aria-hidden="true"])').count()) === 0)
  await shot(page, 'main-empty')

  console.log('\n1 · 고민 한 문장')
  await page.click('text=새 고민 꺼내놓기')
  await page.waitForURL(/\/frame$/)
  check('빈 문장이면 다음으로 못 간다', await page.isDisabled('button:has-text("선택지 적기")'))
  await page.fill('#question', '가을에 이사할까, 지금 집에 더 살까')
  check('빈 칸일 때만 펜 커서가 보인다', (await page.locator('.write__caret').count()) === 0)
  check('적으면 다음이 열린다', await page.isEnabled('button:has-text("선택지 적기")'))
  check('적는 단계는 상단바에 스티커 한 장', (await page.locator('.topbar__sticker img[data-sticker]').count()) === 1)
  await shot(page, 'frame')

  console.log('\n2 · 후보 적기')
  await page.click('button:has-text("선택지 적기")')
  await page.waitForURL(/\/alternatives$/)
  await page.fill('input[aria-label="선택지 1"]', '지금 집 재계약')
  await page.fill('input[aria-label="선택지 2"]', '신도시 24평으로 이사')
  await page.click('button:has-text("선택지 추가")')
  await page.fill('input[aria-label="선택지 3"]', '회사 앞 오피스텔')
  check('숨은 선택지를 한 번 묻는다', await visible(page, 'text=하나만 여쭤볼게요'))
  await shot(page, 'alternatives')
  check('묻는 문장과 넣는 값이 같다', await visible(page, 'text=지금은 그냥 두기'))
  await page.click('button:has-text("괜찮아요")')
  check('거절하면 다시 묻지 않는다', !(await page.isVisible('text=하나만 여쭤볼게요')))

  console.log('\n3 · 직감 봉인')
  await page.click('button:has-text("다음")')
  await page.waitForURL(/\/gut$/)
  check('직감 없이는 넘어가지 못한다', await page.isDisabled('button:has-text("판단 기준 정하기")'))
  await page.click('button[role="radio"]:has-text("지금 집 재계약")')
  await page.click('button[aria-label="마음이 기운 정도 3"]')
  await ctaInView(page, '직감')
  await shot(page, 'gut')

  console.log('\n4 · 기준 세 개')
  await page.click('button:has-text("판단 기준 정하기")')
  await page.waitForURL(/\/criteria$/)
  await page.fill('input[aria-label="기준 1"]', '월 주거비')
  await page.fill('input[aria-label="기준 2"]', '방 개수')
  await page.fill('input[aria-label="기준 3"]', '출퇴근 시간')
  await page.click('button:has-text("+ 기준 하나 더")')
  await page.fill('input[aria-label="기준 4"]', '통근 시간')
  await page.waitForTimeout(350)
  check('겹치는 기준을 잡아낸다', await visible(page, 'text=비슷해 보여요'))
  await shot(page, 'criteria-duplicate')
  await page.click('button:has-text("하나로")')
  await page.waitForTimeout(350)
  check('묶으면 기준이 셋으로 돌아온다', (await page.locator('ol .row').count()) === 3)

  // 순서는 이 화면에서 잡는다 — 따로 '중요한 순서' 단계가 없다.
  const criteriaOrder = () =>
    page.$$eval('ol .row', (rows) =>
      rows.map((row) => {
        const input = row.querySelector('input')
        return input ? input.value : (row.querySelector('.row__edit')?.textContent ?? '')
      }),
    )
  const rowOf = (name) => page.locator(`ol .row:has(.row__edit:text-is("${name}"))`)

  await page.locator('ol .row').first().click({ position: { x: 8, y: 8 } }) // 입력칸 밖을 눌러 포커스를 뺀다
  await page.click('.row__edit:text-is("월 주거비")')
  check('적은 기준은 눌러서 다시 고칠 수 있다', (await page.locator('input[aria-label="기준 1"]').inputValue()) === '월 주거비')
  await page.locator('input[aria-label="기준 1"]').blur()
  await page.waitForTimeout(100)

  // 길게 누르지 않고 바로 움직이면 스크롤이다 — 줄이 딸려오면 안 된다.
  {
    const box = await rowOf('방 개수').boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    for (let i = 1; i <= 5; i++) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + i * 30)
      await page.waitForTimeout(16)
    }
    await page.mouse.up()
    await page.waitForTimeout(250)
    const after = await criteriaOrder()
    check('바로 끌면 순서가 안 바뀐다 (스크롤과 구분)', after[1] === '방 개수', `실제: ${after.join(' > ')}`)
  }

  // 길게 눌러 들고 맨 아래로.
  {
    const box = await rowOf('월 주거비').boundingBox()
    const last = await page.locator('ol .row').last().boundingBox()
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.waitForTimeout(450)
    check('길게 누르면 줄이 들린다', (await page.locator('.row--held').count()) === 1)
    for (let i = 1; i <= 6; i++) {
      await page.mouse.move(x, y + ((last.y - box.y) * i) / 6)
      await page.waitForTimeout(30)
    }
    await page.mouse.up()
    await page.waitForTimeout(350)
    const after = await criteriaOrder()
    check('길게 눌러 끌면 순서가 바뀐다', after[2] === '월 주거비', `실제: ${after.join(' > ')}`)
    check('들었다 놓은 손길은 고치기로 번지지 않는다', (await page.locator('ol .row input').count()) === 0)
  }

  // 키보드·보조기기 길: Alt+위/아래. 월 주거비를 둘째로 되돌린다.
  await page.focus('.row__edit:text-is("월 주거비")')
  await page.keyboard.press('Alt+ArrowUp')
  await page.waitForTimeout(250)
  {
    const after = await criteriaOrder()
    check('키보드로도 순서가 바뀐다', after.join('|') === '방 개수|월 주거비|출퇴근 시간', `실제: ${after.join(' > ')}`)
  }
  check('옮긴 뒤에도 포커스가 그 줄에 남는다', await page.evaluate(() => document.activeElement?.textContent === '월 주거비'))
  await shot(page, 'criteria')

  console.log('\n5 · 필수조건')
  await page.click('button:has-text("다음")')
  await page.waitForURL(/\/must$/)
  await page.click('button:has-text("조건 하나 더")')
  await page.fill('input[aria-label="필수조건 1"]', '보증금 3억 이하')
  await page.waitForTimeout(350)
  await page.click('button[aria-pressed="true"]:has-text("회사 앞 오피스텔")')
  await page.waitForTimeout(500)
  check('탈락 선택지에 조건 이름이 붙는다', await visible(page, '.chip:has-text("보증금 3억 이하")'))
  check('남은 둘을 비교하자고 한다', await visible(page, 'button:has-text("남은 선택지 2개 비교하기")'))
  await shot(page, 'must')

  console.log('\n6 · 평가')
  await page.click('button:has-text("남은 선택지 2개")')
  await page.waitForURL(/\/evaluate$/)
  check('탈락 후보는 평가하지 않는다 (2후보 × 3기준 = 6칸)', await visible(page, 'text=평가 1 / 6'))
  check('점수 양 끝에 방향만 적는다 (bad ↔ good)', await visible(page, '.scale5__ends:has-text("bad"):has-text("good")'))
  check('칸마다 붙던 만족/불만족 말이 없다', !(await page.isVisible('text=만족')))
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

  console.log('\n내가 매긴 표')
  await page.waitForURL(/\/matrix$/)
  check('평가가 끝나면 결과보다 표가 먼저 나온다', await visible(page, 'text=내가 매긴 표'))
  check('건너뛰기가 처음부터 떠 있다', await visible(page, 'button:has-text("그리는 건 건너뛰기")'))
  check('소리 배지가 상단에 있다', await visible(page, '.soundbadge'))

  // 만년필이 실제로 종이 위에 나타나는지. 카메라가 움직이는 동안에는 펜을
  // 떼므로 잠깐 사라진다 — 3초 안에 한 번이라도 보이면 된다.
  let penSeen = false
  for (let i = 0; i < 30 && !penSeen; i++) {
    const opacity = await page
      .locator('.mx-pen')
      .evaluate((el) => getComputedStyle(el).opacity)
      .catch(() => '0')
    if (opacity !== '0') penSeen = true
    else await page.waitForTimeout(100)
  }
  check('만년필이 종이 위에 있다', penSeen)
  await shot(page, 'matrix-writing')

  await page.click('button:has-text("그리는 건 건너뛰기")')
  await page.waitForTimeout(300)

  // SVG <text>는 innerText가 비어 나온다. textContent로 읽는다.
  const cells = await page.$$eval('.matrix__sheet g text', (nodes) => nodes.map((n) => n.textContent))
  // 이름이 길면 두 줄로 갈리므로 이어붙여서 본다.
  const joined = cells.join(' ')
  check('선택지가 가로축에 있다', joined.includes('지금 집 재계약') && joined.includes('신도시'), cells.join('/'))
  check('①②를 그대로 쓴다', cells.includes('①') && cells.includes('②'))
  check('기준이 세로축에 있다', cells.includes('월 주거비'), cells.join('/'))
  check('내가 매긴 점수가 그대로 있다', ['2', '5', '4', '3'].every((v) => cells.includes(v)), cells.join('/'))
  check('무게를 비율로 적는다', cells.some((t) => /^\d+%$/.test(t)), cells.join('/'))
  check(
    '기준마다 가장 높은 점수에 동그라미',
    (await page.locator('.matrix__sheet .mx-rings path').count()) === 3,
  )
  // 결과보다 앞에 오는 화면이라 적합도를 미리 말하면 안 된다.
  check(
    '적합도를 미리 말하지 않는다',
    !cells.includes('적합도') && !cells.some((t) => ['낮음', '보통', '높음'].includes(t)),
    cells.join('/'),
  )
  check('다 그려지면 결과 보기가 열린다', await page.isEnabled('button:has-text("결과 보기")'))
  await shot(page, 'matrix')

  console.log('\n결과')
  await page.click('button:has-text("결과 보기")')
  await page.waitForURL(/\/result$/)
  check('결론 한 문장이 있다', await visible(page, 'text=지금 적은 기준에서는'))
  check('차이를 만든 기준을 문장으로 꺼낸다', await visible(page, 'text=앞의 둘을 가른 건'))
  // 표제부(작은 라벨)는 전부 걷어냈다 (디자인 §5, 2026-09-20).
  check('블록마다 붙던 표제부가 없다', (await page.locator('.card__label').count()) === 0)
  check('선택지마다 고유색 막대', (await page.locator('.fitbar__fill--own').count()) >= 2)
  check('적합도를 말로 쓴다', await page.isVisible('text=적합도'))
  const body = await page.innerText('body')
  check('총점 숫자를 노출하지 않는다', !/\b0\.\d{2,}\b/.test(body), body.match(/0\.\d{2,}/)?.[0])
  check('직감 충돌을 짚는다', await visible(page, 'text=처음 마음은'))
  await ctaInView(page, '결과')
  check('결론을 읽는 화면에는 스티커를 붙이지 않는다', (await page.locator('img[data-sticker]').count()) === 0)
  await shot(page, 'result')

  console.log('\n왜 이런 결과인지')
  await page.click('text=판단 기준 자세히 보기')
  await page.waitForURL(/\/why$/)
  check('결과가 얼마나 단단한지를 말한다', await visible(page, 'text=얼마나 단단한가'))
  check('뒤집히는 지점을 말한다', await visible(page, 'text=단계만 더'))
  check('확인 안 한 칸을 표시한다', await visible(page, 'text=아직 확인 안 한 것'))
  // 기준별 막대 비교는 '내가 매긴 표'로 옮겼다. 두 화면이 같은 말을 하지 않는다.
  check('기준별 막대를 중복해 그리지 않는다', !(await page.isVisible('text=기준마다 어디서')))
  await shot(page, 'why')

  console.log('\n직접 움직여보기')
  await page.click('text=무엇이 중요한지 직접 조정해보기')
  await page.waitForURL(/\/explore$/)
  await page.locator('.tune__slider').first().waitFor({ state: 'visible' })
  const sliders = await page.locator('.tune__slider').count()
  const rows = await page.locator('.tune__name').allInnerTexts()
  check('무게 손잡이가 기준 수만큼 있다', sliders === 3, `손잡이 ${sliders}개 · 기준 [${rows.join(', ')}]`)
  check('처음엔 적용할 게 없다', await page.isDisabled('button:has-text("이걸로 계산하기")'))
  const leadBefore = await page.locator('.barhead').first().innerText()

  // 1순위 기준을 바닥까지 내리고 2순위를 끝까지 올린다
  await page.locator('.tune__slider').first().fill('2')
  await page.locator('.tune__slider').nth(1).fill('100')
  await page.waitForTimeout(300)
  const leadAfter = await page.locator('.barhead').first().innerText()
  check('무게를 밀면 순위가 실제로 움직인다', leadBefore !== leadAfter, `${leadBefore} → ${leadAfter}`)
  check('끝까지 민 손잡이는 그 자리에 있는다', (await page.locator('.tune__slider').nth(1).inputValue()) === '100')
  check('건드리지 않은 손잡이에는 움직임 표시가 없다', (await page.locator('.tune__weight.is-moved').count()) === 2)
  check('바뀐 결과를 문장으로 알려준다', await visible(page, 'text=로 바뀌네요'))
  check('되돌리기가 생긴다', await visible(page, 'text=되돌리기'))

  // 순위가 바뀔 때 줄이 미끄러져야 한다. 그냥 다시 그리면 순간이동해서
  // 무엇이 무엇을 제쳤는지 볼 수 없다 (디자인 §5).
  const slide = await page
    .locator('.rankrow')
    .first()
    .evaluate((el) => getComputedStyle(el).transitionDuration)
  check('순위 변동에 모션이 걸려 있다', slide === '0.42s', `transition-duration=${slide}`)
  check(
    '선택지마다 고유색 막대',
    (await page.locator('.fitbar__fill--own').count()) === 2,
  )
  const dim = await page
    .locator('.fitbar__fill--own:not(.fitbar__fill--lead)')
    .first()
    .evaluate((el) => getComputedStyle(el).opacity)
  check('앞서지 않은 쪽만 흐리다', dim === '0.55', `opacity=${dim}`)
  await shot(page, 'explore')

  await page.fill('#insight', '비용이라고 생각했는데 사실은 답답한 게 더 컸다')
  await page.click('button:has-text("이걸로 계산하기")')
  await page.waitForURL(/\/result$/)
  await page.waitForTimeout(400)
  const newLeader = leadAfter.split('\n')[0].trim()
  check('적용한 무게가 결과에 반영된다', (await page.innerText('body')).includes(newLeader))

  console.log('\n결정 확정')
  await page.click('text=이걸로 정하기')
  await page.waitForURL(/\/commit$/)
  await page.waitForTimeout(400)
  const committedTitle = await page.locator('h1.title').innerText()
  check(
    '확정 화면이 결과와 같은 답을 말한다',
    committedTitle.includes(newLeader.replace(/^[①-⑤]\s*/, '')),
    `결과 ${newLeader} / 확정 ${committedTitle.split('\n')[0]}`,
  )
  await page.waitForURL(/\/commit$/)
  await page.fill('#reason', '방이 하나 더 필요하다는 게 제일 컸다')
  await page.click('button[aria-label="마음이 기운 정도 4"]')
  check('도장이 찍힌다', await visible(page, '.stamp__word'))
  check('도장 글자가 손글씨다', (await page.locator('.stamp__word').innerText()) === '결정함')
  check('30일 뒤 회고를 예약한다', await page.isVisible('text=30일 뒤에 다시 물어보기'))
  await ctaInView(page, '확정')
  await shot(page, 'commit')

  console.log('\n홈으로 — 저장 확인')
  await page.click('button:has-text("기록하고 나가기")')
  await page.waitForURL(`${base}/`)
  await page.waitForTimeout(400)
  check('목록에 남는다', await page.isVisible('text=가을에 이사할까'))
  check('회고 D-day를 센다', await visible(page, 'text=회고 D-30'))
  check('마음이 기운 정도를 숫자 대신 말로 적는다', await visible(page, 'text=마음 꽤 기욺'))
  await shot(page, 'main-with-decision')

  console.log('\n결정 복제 — 같은 기준으로 다시 시작')
  check('복제 버튼이 목록 카드에 보인다', await visible(page, 'text=같은 기준으로 다시 시작'))
  await page.click('text=같은 기준으로 다시 시작')
  await page.waitForURL(/\/must$/)
  await page.waitForTimeout(300)
  check('대안이 그대로 옮겨온다', await visible(page, 'text=지금 집 재계약'))
  const mustName = await page.inputValue('input[aria-label="필수조건 1"]')
  check('필수조건 이름도 옮겨온다', mustName === '보증금 3억 이하', `실제: ${mustName}`)
  check(
    '통과 여부는 새로 판단하게 비워둔다 (아무도 탈락 안 함)',
    await visible(page, 'button:has-text("남은 선택지 3개 비교하기")'),
  )
  await shot(page, 'main-duplicate')
  await page.goto(`${base}/`)
  await page.waitForTimeout(300)
  check('복제한 결정도 목록에 남는다', (await page.locator('.card').count()) === 2)
  check('상태는 알약 대신 포스트잇 쪽지로 붙는다', (await page.locator('.card .postit').count()) === 2)
  check('손이 가야 하는 상태만 노란 쪽지', (await page.locator('.postit--call').count()) === 1)
  check('기록이 있는 홈에는 스티커가 붙어 있다', (await page.locator('img[data-sticker]').count()) >= 2)
  await shot(page, 'main-postits')

  console.log('\n새로고침 뒤에도 남아 있나')
  await page.reload()
  await page.waitForTimeout(600)
  check('IndexedDB에서 복원된다', await page.isVisible('text=가을에 이사할까'))

  console.log('\n30일 뒤 회고')
  // 복제본이 하나 더 생긴 뒤라 목록의 첫 항목을 그냥 집으면 안 된다 — 확정 기록이 있는 쪽을 찾는다.
  const id = await page.evaluate(async () => {
    const open = indexedDB.open('decision-note')
    const db = await new Promise((res) => {
      open.onsuccess = () => res(open.result)
    })
    const all = await new Promise((res) => {
      const req = db.transaction('decisions').objectStore('decisions').getAll()
      req.onsuccess = () => res(req.result)
    })
    return all.find((d) => d.commit !== null).id
  })
  await page.goto(`${base}/d/${id}/review`)
  await page.waitForURL(/\/review$/)
  check('그때 적은 이유를 다시 보여준다', await visible(page, 'text=방이 하나 더 필요하다'))
  check('움직여보며 알게 된 것도 다시 읽힌다', await visible(page, 'text=사실은 답답한 게 더 컸다'))
  check('만족도 전에는 기록할 수 없다', await page.isDisabled('button:has-text("기록 남기기")'))
  await page.click('button[aria-label="돌아보면 4"]')
  await page.selectOption('#now-top', { index: 2 })
  check('패턴을 지어내지 않는다 (표본 1건)', !(await page.isVisible('text=지금까지 모인 패턴')))
  await ctaInView(page, '회고')
  await shot(page, 'review')
  await page.click('button:has-text("기록 남기기")')
  await page.waitForURL(`${base}/`)

  console.log('\n보관함')
  await page.goto(base)
  await page.click('a:has-text("보관함")')
  await page.waitForURL(/\/settings$/)
  check('홈 우상단에서 보관함으로 간다', true)
  check('기기 저장을 설명한다', await visible(page, 'text=전부 이 기기에만 있습니다'))
  check(
    '동기화를 켤 수 있다 (Firebase 설정이 들어 있음)',
    await page.isEnabled('button[aria-label="다른 기기와 동기화"]'),
  )
  // 켜기 전에는 firebase 청크가 로드조차 되면 안 된다 — 고민 본문이 기기를 벗어나지 않는 근거
  check(
    '켜기 전에는 바깥으로 아무것도 안 나간다',
    outboundRequests.length === 0,
    outboundRequests.slice(0, 3).join(' | '),
  )
  await shot(page, 'settings')

  console.log('\n개인정보 처리방침')
  await page.click('text=개인정보 처리방침')
  await page.waitForURL(/\/privacy$/)
  check('기본은 수집이 없다고 말한다', await visible(page, 'text=아무것도 수집하지 않습니다'))
  check('동기화를 켰을 때만 나가는 것도 밝힌다', await visible(page, 'text=익명 로그인'))
  await shot(page, 'privacy')

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
    .locator('.card, .empty')
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
