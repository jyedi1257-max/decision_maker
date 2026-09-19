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

const chars = [...new Set(phrases.join('').split('').filter((c) => c.trim() !== ''))].sort()
const codepoints = chars.map((c) => c.codePointAt(0))

console.log(`문구 ${phrases.length}개 → 글자 ${chars.length}자: ${chars.join('')}`)

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

const size = statSync(OUT).size
console.log(`→ ${OUT} (${(size / 1024).toFixed(1)} KB)`)
console.log(`→ unicode-range: ${range}`)
