#!/usr/bin/env node
/**
 * KCC김환기체 원본에서 손글씨 문구에 쓰이는 글자만 뽑아 woff2로 만든다.
 *
 *   npm run font:subset
 *
 * fonttools(pyftsubset)가 필요하다:  pip install 'fonttools[woff]' brotli
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = resolve(root, 'assets/fonts/source/KCC-Kimhwanki.otf')
const OUT = resolve(root, 'src/assets/fonts/penink.woff2')
const RANGE_OUT = resolve(root, 'src/assets/fonts/penink.unicode-range.txt')

// ink-phrases.ts를 파싱해서 문구를 꺼낸다 (TS를 실행하지 않기 위해).
const phrasesSrc = readFileSync(resolve(root, 'src/styles/ink-phrases.ts'), 'utf8')
const phrases = [...phrasesSrc.matchAll(/^\s*\w+:\s*'([^']+)',$/gm)].map((m) => m[1])
if (phrases.length === 0) {
  throw new Error('ink-phrases.ts에서 문구를 찾지 못했습니다.')
}

// 문구 말고 낱글자로 들어가는 것들 (매트릭스 화면의 숫자·번호·%·적합도 라벨).
const glyphsMatch = phrasesSrc.match(/^export const INK_GLYPHS = '([^']+)'$/m)
if (!glyphsMatch) {
  throw new Error('ink-phrases.ts에서 INK_GLYPHS를 찾지 못했습니다.')
}

const source = phrases.join('') + glyphsMatch[1]
const chars = [...new Set(source.split('').filter((c) => c.trim() !== ''))].sort()
const codepoints = chars.map((c) => c.codePointAt(0))

console.log(`문구 ${phrases.length}개 + 낱글자 → ${chars.length}자: ${chars.join('')}`)

mkdirSync(dirname(OUT), { recursive: true })
execFileSync(
  'pyftsubset',
  [
    SOURCE,
    `--output-file=${OUT}`,
    '--flavor=woff2',
    `--unicodes=${codepoints.map((c) => 'U+' + c.toString(16).toUpperCase()).join(',')}`,
    '--layout-features=',
    '--no-hinting',
    '--desubroutinize',
    '--name-IDs=',
    '--drop-tables+=DSIG',
  ],
  { stdio: 'inherit' },
)

// @font-face의 unicode-range로 쓸 값. 서브셋에 없는 글자는 자동으로 폴백된다.
const range = codepoints.map((c) => 'U+' + c.toString(16).toUpperCase()).join(', ')
writeFileSync(RANGE_OUT, range + '\n')

// base.css의 unicode-range도 같이 고쳐둔다. 손으로 옮겨 적다 빠뜨리면
// 서브셋에 들어간 글자가 폴백으로 새어나가서 알아채기 어렵다.
const CSS = resolve(root, 'src/styles/base.css')
const css = readFileSync(CSS, 'utf8')
const RANGE_LINE = /(\n  unicode-range: )[^;]+;/
if (!RANGE_LINE.test(css)) {
  throw new Error('base.css의 @font-face에서 unicode-range를 찾지 못했습니다.')
}
writeFileSync(CSS, css.replace(RANGE_LINE, `$1${range};`))

const size = statSync(OUT).size
console.log(`→ ${OUT} (${(size / 1024).toFixed(1)} KB)`)
console.log(`→ base.css의 unicode-range도 갱신했습니다 (${codepoints.length}자)`)
