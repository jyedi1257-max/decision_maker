#!/usr/bin/env node
/**
 * 홍보 영상 2단계 — 녹화를 폰 틀에 넣고 자막을 얹어 mp4로 굽는다.
 *
 *   node scripts/promo/compose.mjs            # docs/promo/decision-note-promo.mp4 + 표지
 *   node scripts/promo/compose.mjs --stills   # 몇 장면만 PNG로 (.promo/stills/)
 *
 * 먼저 capture.mjs가 .promo/capture/를 만들어 둬야 한다.
 * ffmpeg는 PATH나 FFMPEG 환경변수, 없으면 파이썬 imageio-ffmpeg의 것을 찾는다.
 */
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFileSync, spawn } from 'node:child_process'
import { extname, join, resolve, dirname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const PORT = 4196
const stillsOnly = process.argv.includes('--stills')
const outDir = join(root, 'docs/promo')
const outFile = join(outDir, 'decision-note-promo.mp4')

if (!existsSync(join(root, '.promo/capture/capture.json'))) {
  console.error('녹화가 없습니다. 먼저: npm run build && node scripts/promo/capture.mjs')
  process.exit(1)
}

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

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.woff2': 'font/woff2', '.otf': 'font/otf', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
}
// 무대가 저장소 안의 폰트·스티커·녹화를 그대로 가져다 쓴다.
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  const path = url.pathname === '/' ? '/scripts/promo/stage.html' : decodeURIComponent(url.pathname)
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
const { duration, fps } = await page.evaluate(() => window.setup())

async function frame(t, type = 'jpeg') {
  await page.evaluate((t) => window.render(t), t)
  return page.screenshot(type === 'jpeg' ? { type, quality: 94 } : { type })
}

if (stillsOnly) {
  const dir = join(root, '.promo/stills')
  await mkdir(dir, { recursive: true })
  const times = process.argv.slice(3).map(Number).filter((n) => !Number.isNaN(n))
  for (const t of times.length ? times : [1.8, 4.3, 5.2, 8.5, 12.8, 16, 21.5, 26, 30.5, 35.5]) {
    await writeFile(join(dir, `t${t.toFixed(1).padStart(4, '0')}.png`), await frame(t, 'png'))
  }
  console.log(`장면 → .promo/stills/`)
} else {
  await mkdir(outDir, { recursive: true })
  const ffmpeg = spawn(findFfmpeg(), [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    // 소리 없는 트랙을 깔아둔다 — 올리는 곳에서 음악을 고르게.
    '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
    '-map', '0:v', '-map', '1:a', '-shortest',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart', outFile,
  ], { stdio: ['pipe', 'inherit', 'inherit'] })
  const done = new Promise((res, rej) => ffmpeg.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg ${c}`)))))

  const total = Math.round(duration * fps)
  for (let i = 0; i < total; i++) {
    const buf = await frame(i / fps)
    if (!ffmpeg.stdin.write(buf)) await new Promise((r) => ffmpeg.stdin.once('drain', r))
    if (i % 90 === 0) process.stdout.write(`\r  ${i}/${total}`)
  }
  ffmpeg.stdin.end()
  await done
  // 릴스·쇼츠 표지로 쓸 한 장 — 끝 카드가 다 나온 순간.
  await writeFile(join(outDir, 'decision-note-cover.png'), await frame(duration - 0.5, 'png'))
  console.log(`\r  ${total}/${total} → docs/promo/decision-note-promo.mp4 · decision-note-cover.png`)
}

await browser.close()
server.close()
