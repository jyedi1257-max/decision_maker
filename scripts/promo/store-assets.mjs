#!/usr/bin/env node
/**
 * Play 스토어 이미지 — 휴대전화 스크린샷 6장(1080×1920)과 그래픽 이미지(1024×500).
 *
 *   node scripts/promo/store-assets.mjs     # docs/store/
 *
 * 홍보 영상과 같은 녹화(.promo/capture/)에서 장면을 고른다. 없으면 먼저:
 *   npm run build && node scripts/promo/capture.mjs
 *
 * 앱 스크린샷(780×1688)을 그대로 올리면 Play가 거절한다 — 긴 변이 짧은 변의 두 배를
 * 넘으면 안 된다. 그래서 9:16 종이 위에 폰 화면을 놓고 한 줄 설명을 붙인다.
 * Play는 알파 채널이 있는 PNG를 싫어하니 마지막에 RGB로 바꿔 저장한다.
 */
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { extname, join, resolve, dirname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const PORT = 4197
const out = join(root, 'docs/store')
const capturePath = join(root, '.promo/capture/capture.json')

if (!existsSync(capturePath)) {
  console.error('녹화가 없습니다. 먼저: npm run build && node scripts/promo/capture.mjs')
  process.exit(1)
}
const capture = JSON.parse(await readFile(capturePath, 'utf8'))
const m = capture.marks
/** 그 시각이나 그 직전에 찍힌 녹화 프레임 */
const frameAt = (t) => `/.promo/capture/${capture.frames.filter((f) => f.t <= t).pop().file}`

// 문장은 기획안 8.1 원칙 7을 지킨다 — "정답"이 아니라 "지금 기준에서 더 맞는 쪽".
const SHOTS = [
  { name: '01-home', at: m.home + 2.3, title: ['고민이 생기면,', '종이 한 장 꺼내듯'], sub: '로그인 없이 바로 시작해요. 적은 건 내 폰에만 남아요.', tapes: ['tape-rose-dots', 'tape-butter-dots'], underline: true },
  { name: '02-alternatives', at: m.alternativesEnd - 0.05, title: ['머릿속 선택지를 적어보세요'], sub: '다섯 개까지만. 적는 순간 또렷해져요.', tapes: ['tape-sage-stripe', 'tape-rose-gingham'] },
  { name: '03-evaluate', at: m.evaluate + 1.45, title: ['기준마다 1점에서 5점'], sub: '잘 모르겠으면 비워두세요. 빈 칸도 결과에 반영돼요.', tapes: ['tape-sky-gingham', 'tape-butter-plain'] },
  { name: '04-matrix', at: m.matrixEnd - 0.1, title: ['내가 매긴 표가 손글씨로'], sub: '기준마다 앞선 칸에 동그라미를 쳐 줘요.', tapes: ['tape-lav-stripe', 'tape-sage-grid'] },
  { name: '05-result', at: m.resultEnd - 0.1, title: ['지금 기준에서 더 맞는 쪽을,', '이유와 함께'], sub: '무엇이 둘을 갈랐는지, 결과가 얼마나 단단한지 보여줘요.', tapes: ['tape-butter-dots', 'tape-sky-wave'] },
  { name: '06-commit', at: m.commitEnd - 0.1, title: ['정했으면, 도장 쾅'], sub: '30일 뒤에 그 결정이 어땠는지 다시 물어봐요.', tapes: ['tape-rose-dots', 'tape-lav-flowers'], underline: true },
]

function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
    return 'ffmpeg'
  } catch {}
  try {
    return execFileSync('python3', ['-c', 'import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())']).toString().trim()
  } catch {}
  console.error('ffmpeg를 찾지 못했습니다. `pip install imageio-ffmpeg` 또는 FFMPEG=/경로')
  process.exit(1)
}
const ffmpeg = findFfmpeg()

const TYPES = {
  '.html': 'text/html', '.json': 'application/json', '.woff2': 'font/woff2', '.otf': 'font/otf',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  const path = url.pathname === '/' ? '/scripts/promo/store.html' : decodeURIComponent(url.pathname)
  const file = normalize(join(root, path))
  if (!file.startsWith(root) || !existsSync(file)) return res.writeHead(404).end()
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' })
  res.end(await readFile(file))
}).listen(PORT)

const executablePath = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync)
const browser = await chromium.launch(executablePath ? { executablePath } : {})
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
page.on('pageerror', (e) => console.error('무대 오류:', e))
await page.goto(`http://localhost:${PORT}/`)

await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })

/** 찍고 알파 채널을 뺀 RGB PNG로 저장한다. */
async function save(name, clip) {
  const tmp = join(out, `${name}.rgba.png`)
  await writeFile(tmp, await page.screenshot({ clip }))
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', tmp, '-pix_fmt', 'rgb24', join(out, `${name}.png`)])
  await rm(tmp)
}

for (const s of SHOTS) {
  await page.evaluate(([d]) => window.show('shot', d), [{ ...s, image: frameAt(s.at) }])
  await save(s.name, { x: 0, y: 0, width: 1080, height: 1920 })
}
await page.evaluate(([image]) => window.show('feature', { image }), [frameAt(m.resultEnd - 0.1)])
await save('feature-graphic', { x: 0, y: 0, width: 1024, height: 500 })

console.log(`스크린샷 ${SHOTS.length}장 + 그래픽 이미지 → docs/store/`)
await browser.close()
server.close()
